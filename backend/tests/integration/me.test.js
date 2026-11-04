import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import * as authRepo from '../../src/repositories/auth.repo.js';
import { truncateAll, createUser, createTodo } from './helpers/db.js';
import { agentFor } from './helpers/agent.js';
import { parseSetCookie } from './helpers/cookies.js';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const ME_KEYS = ['email', 'id', 'name', 'timezone'];
const OLD = 'password123';
const NEW = 'newpass456';

const login = (email, password = OLD) => request(app).post('/api/auth/login').send({ email, password });
const refresh = (raw) =>
  request(app)
    .post('/api/auth/refresh')
    .set('Cookie', 'refresh_token=' + raw);
// supertest는 Secure 쿠키를 http에서 다시 보내지 않으므로 Cookie 헤더를 직접 만든다
const cookieHeader = (c) => `access_token=${c.access_token.value}; refresh_token=${c.refresh_token.value}`;
const patchAs = (u, body) => agentFor(u.id).patch('/api/me').send(body);
const tokenRows = async (userId) =>
  (await pool.query('SELECT * FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at', [userId])).rows;
const dbUser = async (id) => (await pool.query('SELECT * FROM users WHERE id = $1', [id])).rows[0];
const today = (tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

// 브라우저 2개 로그인
async function twoBrowsers() {
  const u = await createUser({ email: 'a@example.com' });
  const b1 = parseSetCookie(await login(u.email));
  const b2 = parseSetCookie(await login(u.email));
  return { u, b1, b2 };
}

beforeEach(truncateAll);
afterEach(() => vi.restoreAllMocks());
afterAll(() => pool.end());

describe('PATCH /api/me 비밀번호 변경', () => {
  it('EX-44 SEC-02 변경 후 다른 브라우저 갱신 401, 현재 브라우저는 새 토큰으로 유지 (조건1)', async () => {
    const { u, b1, b2 } = await twoBrowsers();
    const res = await request(app)
      .patch('/api/me')
      .set('Cookie', cookieHeader(b1))
      .send({ currentPassword: OLD, newPassword: NEW });
    expect(res.status).toBe(200);

    const c = parseSetCookie(res);
    expect(Object.keys(c).sort()).toEqual(['access_token', 'refresh_token']);
    expect(c.access_token).toMatchObject({ path: '/', maxAge: 900, httpOnly: true, secure: true, sameSite: 'lax' });
    const r3 = c.refresh_token;
    expect(r3).toMatchObject({ path: '/api/auth', httpOnly: true, secure: true, sameSite: 'lax' });
    expect(Math.abs(r3.expires.getTime() - (Date.now() + 7 * 86400e3))).toBeLessThan(60e3);

    const rows = await tokenRows(u.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toBe(sha256(r3.value));

    expect((await refresh(b2.refresh_token.value)).status).toBe(401);
    expect((await refresh(b1.refresh_token.value)).status).toBe(401);
    // 회귀 방지: 위 두 번의 거부(재사용 감지 포함)가 새 토큰을 폐기하면 안 된다
    expect((await refresh(r3.value)).status).toBe(204);

    expect((await login(u.email, NEW)).status).toBe(200);
    const old = await login(u.email, OLD);
    expect(old.status).toBe(401);
    expect(old.body.error.code).toBe('INVALID_CREDENTIALS');
    expect((await dbUser(u.id)).password_hash).toMatch(/^\$2[aby]\$10\$/);
  });

  it('SEC-01 응답은 키 4개뿐이고 비밀번호·해시가 노출되지 않는다 (조건9)', async () => {
    const { u, b1 } = await twoBrowsers();
    const res = await request(app)
      .patch('/api/me')
      .set('Cookie', cookieHeader(b1))
      .send({ currentPassword: OLD, newPassword: NEW });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(ME_KEYS);
    const { password_hash: hash } = await dbUser(u.id);
    for (const secret of [OLD, NEW, hash]) expect(res.text).not.toContain(secret);
  });

  it('EX-30 현재 비밀번호가 틀리면 400 WRONG_PASSWORD, 아무것도 바뀌지 않는다 (조건3)', async () => {
    const { u, b1 } = await twoBrowsers();
    const before = await dbUser(u.id);
    const rowsBefore = await tokenRows(u.id);

    const res = await request(app)
      .patch('/api/me')
      .set('Cookie', cookieHeader(b1))
      .send({ name: '바뀜', currentPassword: 'wrong-pass', newPassword: NEW });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WRONG_PASSWORD');
    expect(res.headers['set-cookie']).toBeUndefined();

    const after = await dbUser(u.id);
    expect(after.password_hash).toBe(before.password_hash);
    expect(after.name).toBe(before.name);
    expect(await tokenRows(u.id)).toEqual(rowsBefore);
    expect((await refresh(b1.refresh_token.value)).status).toBe(204);
  });

  it('C-23 newPassword 24자 한글(72바이트) 허용, 앞뒤 공백은 trim하지 않는다 (경계)', async () => {
    const u = await createUser({ email: 'a@example.com' });
    const long = '가'.repeat(24);
    expect((await patchAs(u, { currentPassword: OLD, newPassword: long })).status).toBe(200);
    expect((await login(u.email, long)).status).toBe(200);

    const spaced = ' pass word ';
    expect((await patchAs(u, { currentPassword: long, newPassword: spaced })).status).toBe(200);
    expect((await login(u.email, spaced)).status).toBe(200);
    expect((await login(u.email, spaced.trim())).status).toBe(401);
  });
});

describe('PATCH /api/me 이름·시간대', () => {
  it('US-16 이름·시간대 변경 200, 쿠키·토큰 행 변화 없음, GET /api/me 동일 (조건2)', async () => {
    const u = await createUser({ email: 'a@example.com' });
    await login(u.email);
    const rowsBefore = await tokenRows(u.id);

    const res = await patchAs(u, { name: '  새이름 ', timezone: 'America/New_York' });
    expect(res.status).toBe(200);
    const expected = { id: u.id, email: u.email, name: '새이름', timezone: 'America/New_York' };
    expect(res.body).toEqual(expected);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(await tokenRows(u.id)).toEqual(rowsBefore);
    expect((await agentFor(u.id).get('/api/me')).body).toEqual(expected);
  });

  it.each([
    ['이름만', { name: '이름만' }, { name: '이름만', timezone: 'Asia/Seoul' }],
    ['시간대만', { timezone: 'Europe/London' }, { name: '원래이름', timezone: 'Europe/London' }],
  ])('US-16 %s 보내면 다른 필드는 유지', async (_n, body, want) => {
    const u = await createUser({ name: '원래이름' });
    const res = await patchAs(u, body);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(want);
    expect(await dbUser(u.id)).toMatchObject(want);
  });

  it.each([['Mars/Phobos'], ['asia/seoul'], [''], [null], [9]])(
    'S-09 목록에 없는 시간대 %j 는 400 fields.timezone, DB 그대로 (조건2)',
    async (tz) => {
      const u = await createUser();
      const res = await patchAs(u, { timezone: tz });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields).toHaveProperty('timezone');
      expect((await dbUser(u.id)).timezone).toBe('Asia/Seoul');
    },
  );

  it('FR-03 #3 US-16 시간대 변경 후 응답 오프셋과 기본 기간 "오늘"이 새 기준 (조건5)', async () => {
    const u = await createUser();
    const todo = await createTodo({ ownerId: u.id, startAt: '2099-01-10T00:00Z', endAt: '2099-01-10T10:00Z' });
    const tz = 'Pacific/Pago_Pago';
    expect((await patchAs(u, { timezone: tz })).status).toBe(200);

    const got = await agentFor(u.id).get(`/api/todos/${todo.id}`);
    expect(got.status).toBe(200);
    expect(got.body.startAt).toBe('2099-01-09T13:00-11:00');

    const before = today(tz);
    const created = await agentFor(u.id).post('/api/todos').send({ title: 't' });
    const days = [before, today(tz)];
    expect(created.status).toBe(201);
    const d = days.find((x) => created.body.startAt === `${x}T00:00-11:00`);
    expect(d).toBeDefined();
    expect(created.body.endAt).toBe(`${d}T23:59-11:00`);
  });
});

describe('PATCH /api/me 이메일 불변', () => {
  it.each([[{ email: 'x@example.com' }], [{ name: 'a', email: 'x@example.com' }]])(
    'EX-31 %j 는 400 fields.email, 이메일·이름 불변 (조건4)',
    async (body) => {
      const u = await createUser({ email: 'a@example.com', name: '원래이름' });
      const res = await patchAs(u, body);
      expect(res.status).toBe(400);
      expect(res.body.error.fields).toHaveProperty('email');
      expect(await dbUser(u.id)).toMatchObject({ email: 'a@example.com', name: '원래이름' });
    },
  );
});

describe('PATCH /api/me 입력 검증', () => {
  const cases = [
    ['빈 객체', {}, null],
    ['배열 본문', [], null],
    ['newPassword만', { newPassword: NEW }, 'currentPassword'],
    ['currentPassword만', { currentPassword: OLD }, 'newPassword'],
    ['newPassword 7자', { currentPassword: OLD, newPassword: 'abc1234' }, 'newPassword'],
    ['newPassword 73바이트(한글 25자)', { currentPassword: OLD, newPassword: '가'.repeat(25) }, 'newPassword'],
    ['currentPassword 빈 문자열', { currentPassword: '', newPassword: NEW }, 'currentPassword'],
    ['name 공백뿐', { name: '   ' }, 'name'],
    ['name 51자', { name: 'a'.repeat(51) }, 'name'],
    ['정의되지 않은 필드', { status: 'x' }, 'status'],
  ];

  it.each(cases)('S-09 %s 는 400 VALIDATION_ERROR, DB 불변 (조건6)', async (_n, body, field) => {
    const u = await createUser();
    const before = await dbUser(u.id);
    const res = await patchAs(u, body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    if (field) expect(res.body.error.fields).toHaveProperty(field);
    expect(await dbUser(u.id)).toEqual(before);
  });

  it('S-09 본문이 없어도 400 VALIDATION_ERROR (조건6)', async () => {
    const u = await createUser();
    const res = await agentFor(u.id).patch('/api/me');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/me 인증', () => {
  it('S-11 쿠키 없이 호출하면 401 UNAUTHENTICATED (조건7)', async () => {
    const res = await request(app).patch('/api/me').send({ name: '새이름' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('PATCH /api/me 트랜잭션', () => {
  it('SEC-02 토큰 발급 실패 시 500, 이름·비밀번호·기존 토큰 모두 롤백 (조건8)', async () => {
    const { u, b1 } = await twoBrowsers();
    const before = await dbUser(u.id);
    const rowsBefore = await tokenRows(u.id);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(authRepo, 'insertRefreshToken').mockRejectedValueOnce(new Error('boom'));

    const res = await patchAs(u, { name: '바뀜', currentPassword: OLD, newPassword: NEW });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');

    const after = await dbUser(u.id);
    expect(after.name).toBe(before.name);
    expect(after.password_hash).toBe(before.password_hash);
    expect(await tokenRows(u.id)).toEqual(rowsBefore);
    expect((await refresh(b1.refresh_token.value)).status).toBe(204);
    expect((await login(u.email, OLD)).status).toBe(200);
  });
});
