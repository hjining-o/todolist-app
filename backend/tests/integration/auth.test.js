import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import * as categoriesService from '../../src/services/categories.service.js';
import { truncateAll, createUser } from './helpers/db.js';
import { agentFor } from './helpers/agent.js';
import { parseSetCookie } from './helpers/cookies.js';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const SIGNUP = { email: 'new@example.com', password: 'password123', name: '새사용자' };
const ME_KEYS = ['email', 'id', 'name', 'timezone'];

const signup = (body = SIGNUP) => request(app).post('/api/auth/signup').send(body);
const login = (email, password = 'password123') => request(app).post('/api/auth/login').send({ email, password });
const refresh = (raw) => {
  const req = request(app).post('/api/auth/refresh');
  return raw ? req.set('Cookie', 'refresh_token=' + raw) : req;
};
// supertest는 Secure 쿠키를 http에서 다시 보내지 않으므로 Cookie 헤더를 직접 만든다
const cookieHeader = (c) => `access_token=${c.access_token.value}; refresh_token=${c.refresh_token.value}`;
const tokenRows = async (userId) =>
  (await pool.query('SELECT * FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at', [userId])).rows;
const userIdOf = async (email) => (await pool.query('SELECT id FROM users WHERE email = $1', [email])).rows[0]?.id;
const userCount = async () => Number((await pool.query('SELECT count(*) FROM users')).rows[0].count);
const failCategory = () =>
  vi
    .spyOn(categoriesService, 'createDefaultCategory')
    .mockImplementationOnce((client, ownerId) =>
      client.query("INSERT INTO categories (owner_id, name, is_default) VALUES ($1, ' ', true)", [ownerId]),
    );

const expectDeleted = (c, path) => {
  expect(c.value).toBe('');
  expect(c.expires.getTime()).toBe(0);
  expect(c.path).toBe(path);
  expect(c.secure).toBe(true);
  expect(c.httpOnly).toBe(true);
};

beforeEach(truncateAll);
afterEach(() => vi.restoreAllMocks());
afterAll(() => pool.end());

describe('R1 쿠키 발급 (조건1, 2)', () => {
  it.each([
    ['가입', 201, () => signup()],
    ['로그인', 200, async () => (await createUser({ email: 'a@example.com' }), login('a@example.com'))],
  ])('R1 %s: access/refresh 쿠키 속성, HS384, DB expires_at 일치', async (_n, status, call) => {
    const res = await call();
    expect(res.status).toBe(status);
    const c = parseSetCookie(res);
    expect(Object.keys(c).sort()).toEqual(['access_token', 'refresh_token']);

    const a = c.access_token;
    expect(a).toMatchObject({ path: '/', maxAge: 900, httpOnly: true, secure: true, sameSite: 'lax' });
    expect(jwt.decode(a.value, { complete: true }).header.alg).toBe('HS384');

    const r = c.refresh_token;
    expect(r).toMatchObject({ path: '/api/auth', httpOnly: true, secure: true, sameSite: 'lax' });
    expect(Math.abs(r.expires.getTime() - (Date.now() + 7 * 86400e3))).toBeLessThan(60e3);
    const rows = await tokenRows(res.body.id);
    expect(rows).toHaveLength(1);
    expect(Math.abs(rows[0].expires_at.getTime() - r.expires.getTime())).toBeLessThan(1000);
  });
});

describe('SEC-03 액세스 토큰 페이로드 (조건15)', () => {
  it('SEC-03 페이로드는 exp, sub 뿐이고 exp는 약 15분 뒤', async () => {
    const res = await signup();
    const payload = jwt.decode(parseSetCookie(res).access_token.value);
    expect(Object.keys(payload).sort()).toEqual(['exp', 'sub']);
    expect(payload.sub).toBe(res.body.id);
    expect(Math.abs(payload.exp - Math.floor(Date.now() / 1000) - 900)).toBeLessThanOrEqual(5);
  });
});

describe('R3 리프레시 토큰 저장 (조건3)', () => {
  it('R3 token_hash는 sha256(raw)이고 어떤 컬럼에도 원문이 없다', async () => {
    const res = await signup();
    const raw = parseSetCookie(res).refresh_token.value;
    const [row] = await tokenRows(res.body.id);
    expect(row.token_hash).toBe(sha256(raw));
    for (const v of Object.values(row)) expect(String(v)).not.toBe(raw);
  });
});

describe('R4 리프레시 회전 (조건4)', () => {
  it('R4 refresh 204, 새 쿠키 2개, 옛 행 폐기·새 행 활성·만료 동일, 새 액세스로 /me 200', async () => {
    await createUser({ email: 'a@example.com' });
    const lres = await login('a@example.com');
    const old = parseSetCookie(lres);
    const res = await refresh(old.refresh_token.value);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    const fresh = parseSetCookie(res);
    expect(Object.keys(fresh).sort()).toEqual(['access_token', 'refresh_token']);
    expect(fresh.refresh_token.value).not.toBe(old.refresh_token.value);
    expect(fresh.refresh_token.path).toBe('/api/auth');

    const rows = await tokenRows(lres.body.id);
    expect(rows).toHaveLength(2);
    const oldRow = rows.find((r) => r.token_hash === sha256(old.refresh_token.value));
    const newRow = rows.find((r) => r.token_hash === sha256(fresh.refresh_token.value));
    expect(oldRow.revoked_at).not.toBeNull();
    expect(newRow.revoked_at).toBeNull();
    expect(newRow.expires_at.getTime()).toBe(oldRow.expires_at.getTime());

    const me = await request(app)
      .get('/api/me')
      .set('Cookie', 'access_token=' + fresh.access_token.value);
    expect(me.status).toBe(200);
  });
});

describe('R5 재사용 감지 (조건5)', () => {
  it('R5 폐기된 토큰 재사용 시 401, 쿠키 삭제, 사용자의 모든 토큰 폐기', async () => {
    await createUser({ email: 'a@example.com' });
    const r1 = parseSetCookie(await login('a@example.com')).refresh_token.value;
    const lres2 = await login('a@example.com');
    const r2 = parseSetCookie(lres2).refresh_token.value;

    expect((await refresh(r1)).status).toBe(204);
    const reuse = await refresh(r1);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('UNAUTHENTICATED');
    const c = parseSetCookie(reuse);
    expectDeleted(c.access_token, '/');
    expectDeleted(c.refresh_token, '/api/auth');

    const { rows } = await pool.query('SELECT 1 FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL', [
      lres2.body.id,
    ]);
    expect(rows).toHaveLength(0);
    expect((await refresh(r2)).status).toBe(401);
  });
});

describe('R6 만료 (조건6)', () => {
  it('R6 만료된 리프레시 토큰은 401', async () => {
    await createUser({ email: 'a@example.com' });
    const lres = await login('a@example.com');
    await pool.query("UPDATE refresh_tokens SET expires_at = now() - interval '1 second' WHERE user_id = $1", [
      lres.body.id,
    ]);
    const res = await refresh(parseSetCookie(lres).refresh_token.value);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('R7 동시 갱신 (조건7)', () => {
  it('R7 같은 raw 동시 갱신은 [204, 401], 토큰 행 2개', async () => {
    await createUser({ email: 'a@example.com' });
    const lres = await login('a@example.com');
    const raw = parseSetCookie(lres).refresh_token.value;
    // .then()으로 실행시켜야 두 요청이 동시에 나간다
    const results = await Promise.all([refresh(raw).then((r) => r), refresh(raw).then((r) => r)]);
    expect(results.map((r) => r.status).sort()).toEqual([204, 401]);
    expect(await tokenRows(lres.body.id)).toHaveLength(2);
  });
});

describe('EX-01 가입 트랜잭션 (조건8)', () => {
  it('EX-01 기본 카테고리 생성 실패 시 500 INTERNAL_ERROR, 사용자도 롤백', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const spy = failCategory();
    const res = await signup();
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(await userIdOf(SIGNUP.email)).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalled();
  });

  it('EX-01 성공 시 기본 카테고리가 정확히 1개(이름 기본, is_default)', async () => {
    const res = await signup();
    const { rows } = await pool.query('SELECT name, is_default FROM categories WHERE owner_id = $1', [res.body.id]);
    expect(rows).toEqual([{ name: '기본', is_default: true }]);
  });
});

describe('EX-02 이메일 정규화 중복 (조건9)', () => {
  it('EX-02 대소문자·공백만 다른 이메일은 409 EMAIL_TAKEN, 저장은 소문자', async () => {
    expect((await signup({ ...SIGNUP, email: 'a@example.com' })).status).toBe(201);
    const res = await signup({ ...SIGNUP, email: ' A@Example.COM ' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    const { rows } = await pool.query('SELECT email FROM users');
    expect(rows).toEqual([{ email: 'a@example.com' }]);
  });
});

describe('V 가입 입력 검증 (조건10)', () => {
  it.each([
    ['비밀번호 7자', { password: '1234567' }, 'password'],
    ['비밀번호 72바이트 초과(한글 25자)', { password: '가'.repeat(25) }, 'password'],
    ['이메일 a@', { email: 'a@' }, 'email'],
    ['이메일 255자', { email: 'a'.repeat(243) + '@example.com' }, 'email'],
    ['이름 공백만', { name: '   ' }, 'name'],
    ['이름 51자', { name: 'x'.repeat(51) }, 'name'],
    ['정의되지 않은 필드', { role: 'admin' }, 'role'],
  ])('V %s → 400 VALIDATION_ERROR, users 0행', async (_n, patch, field) => {
    const res = await signup({ ...SIGNUP, ...patch });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty(field);
    expect(await userCount()).toBe(0);
  });

  it.each([
    ['본문 없음', () => request(app).post('/api/auth/signup')],
    ['배열 본문', () => request(app).post('/api/auth/signup').send([])],
  ])('V %s → 400 VALIDATION_ERROR, users 0행', async (_n, call) => {
    const res = await call();
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await userCount()).toBe(0);
  });

  it('V 경계: 비밀번호 한글 24자(72바이트)는 201', async () => {
    expect((await signup({ ...SIGNUP, password: '가'.repeat(24) })).status).toBe(201);
  });
});

describe('R11 비밀번호 해시 (조건11)', () => {
  it('R11 password_hash는 bcrypt 비용 10이고 평문이 아니며 compare 통과', async () => {
    await signup();
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [SIGNUP.email]);
    const hash = rows[0].password_hash;
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    expect(hash).not.toBe(SIGNUP.password);
    expect(await bcrypt.compare(SIGNUP.password, hash)).toBe(true);
  });
});

describe('EX-04 로그인 실패 (조건12)', () => {
  it('EX-04 없는 이메일과 틀린 비밀번호는 같은 401 INVALID_CREDENTIALS, 쿠키 없음', async () => {
    await createUser({ email: 'a@example.com' });
    const none = await login('nobody@example.com');
    const wrong = await login('a@example.com', 'wrong-password');
    for (const res of [none, wrong]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.headers['set-cookie']).toBeUndefined();
    }
    expect(none.body).toEqual(wrong.body);
  });
});

describe('R16 이메일 대소문자 (조건13)', () => {
  it('R16 대문자 이메일로 로그인 200, 응답 email은 소문자', async () => {
    await createUser({ email: 'a@example.com' });
    const res = await login('A@Example.COM');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('a@example.com');
  });
});

describe('EX-06 로그아웃 (조건14)', () => {
  it('EX-06 로그아웃 후 쿠키 삭제, /me 401, 같은 refresh도 401', async () => {
    const user = await createUser({ email: 'a@example.com' });
    const raw = parseSetCookie(await login('a@example.com')).refresh_token.value;
    const agent = agentFor(user.id);
    expect((await agent.get('/api/me')).status).toBe(200);

    const out = await agent.post('/api/auth/logout').set('Cookie', 'refresh_token=' + raw);
    expect(out.status).toBe(204);
    const c = parseSetCookie(out);
    expectDeleted(c.access_token, '/');
    expectDeleted(c.refresh_token, '/api/auth');

    expect((await agent.get('/api/me')).status).toBe(401);
    expect((await refresh(raw)).status).toBe(401);
  });

  it('EX-06 쿠키 없음/무효 refresh로도 로그아웃은 204', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(204);
    expect((await request(app).post('/api/auth/logout').set('Cookie', 'refresh_token=garbage')).status).toBe(204);
  });
});

describe('추가 케이스', () => {
  it('GET /api/me는 키 4개만 200', async () => {
    const user = await createUser({ email: 'a@example.com', name: '앨리스' });
    const res = await agentFor(user.id).get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: user.id, email: 'a@example.com', name: '앨리스', timezone: 'Asia/Seoul' });
    expect(Object.keys(res.body).sort()).toEqual(ME_KEYS);
  });

  it('GET /api/me 쿠키 없으면 401', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('refresh 쿠키 없음/무효는 401 UNAUTHENTICATED', async () => {
    for (const res of [await refresh(), await refresh('garbage')]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('가입·로그인 본문은 { id, email, name, timezone }만', async () => {
    const s = await signup();
    expect(s.body).toEqual({ id: s.body.id, email: SIGNUP.email, name: SIGNUP.name, timezone: 'Asia/Seoul' });
    const l = await login(SIGNUP.email);
    expect(l.body).toEqual(s.body);
  });
});

describe('SEC 비밀 미노출 (조건16)', () => {
  it('SEC 응답 본문과 로그에 비밀번호·해시·토큰이 없다', async () => {
    const logs = [];
    for (const m of ['log', 'info', 'warn', 'error']) {
      vi.spyOn(console, m).mockImplementation((...args) => logs.push(...args));
    }
    const password = 'S3cret-pw-' + 'z'.repeat(8);
    const texts = [];
    const secrets = [password, 'wrong-pw-' + 'q'.repeat(8)];
    const keep = (res) => (texts.push(res.text), res);

    const s = keep(await signup({ ...SIGNUP, password }));
    keep(await login(SIGNUP.email, secrets[1]));
    const l = keep(await login(SIGNUP.email, password));
    const c = parseSetCookie(l);
    const c2 = parseSetCookie(keep(await refresh(c.refresh_token.value)));
    keep(await refresh(c.refresh_token.value)); // 재사용
    keep(await request(app).post('/api/auth/logout').set('Cookie', cookieHeader(c2)));
    keep(await request(app).get('/api/me').set('Cookie', cookieHeader(c2)));
    failCategory();
    const boom = keep(await signup({ ...SIGNUP, email: 'boom@example.com', password }));
    expect(boom.status).toBe(500);

    for (const body of [s.body, l.body]) {
      expect(body).toEqual({ id: body.id, email: SIGNUP.email, name: SIGNUP.name, timezone: 'Asia/Seoul' });
    }

    const { rows } = await pool.query('SELECT password_hash FROM users');
    for (const t of [...Object.values(c), ...Object.values(parseSetCookie(s)), ...Object.values(c2)]) {
      secrets.push(t.value, sha256(t.value));
    }
    secrets.push(...rows.map((r) => r.password_hash));
    const logText = logs.map((a) => a?.stack ?? String(a)).join('\n');
    for (const secret of secrets.filter(Boolean)) {
      for (const t of texts) expect(t).not.toContain(secret);
      expect(logText).not.toContain(secret);
    }
  });
});

describe('추가 분기', () => {
  it('토큰은 유효하지만 사용자가 없으면 /api/me 401', async () => {
    const res = await agentFor('00000000-0000-4000-8000-000000000000').get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it.each([
    [{ password: 'password123' }, 'email'],
    [{ email: 'a@example.com' }, 'password'],
    [{ email: '   ', password: '' }, 'email'],
  ])('로그인 필수값 누락 %j → 400 VALIDATION_ERROR', async (body, field) => {
    const res = await request(app).post('/api/auth/login').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty(field);
  });

  it('가입 이메일 누락 → 400 fields.email', async () => {
    const res = await signup({ password: 'password123', name: '이름' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('email');
  });
});
