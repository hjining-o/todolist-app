import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { pool } from '../../src/config/db.js';
import { truncateAll, createUser } from './helpers/db.js';
import { parseSetCookie } from './helpers/cookies.js';

const start = (next) => request(app).get('/api/auth/oauth/google').query(next === undefined ? {} : { next });

// 시작 요청으로 state 쿠키를 받아 콜백까지 진행한다. 제공자 fetch는 mock
async function callback({ profile, next = '/todos', state, code = 'c1', tokenOk = true }) {
  const s = await start(next);
  const cookie = parseSetCookie(s).oauth_state.value; // 'j:{...}'
  const real = JSON.parse(cookie.slice(2)).state;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) =>
      String(url).includes('/token')
        ? { ok: tokenOk, json: async () => ({ access_token: 'at' }) }
        : { ok: true, json: async () => profile },
    ),
  );
  return request(app)
    .get('/api/auth/oauth/google/callback')
    .query({ code, state: state ?? real })
    .set('Cookie', `oauth_state=${encodeURIComponent(cookie)}`);
}

const P = { sub: 'g-1', email: 'Soc@Example.com', email_verified: true, name: '소셜이' };
const count = async (sql) => Number((await pool.query(sql)).rows[0].count);

const original = env.oauth.google;
beforeEach(async () => {
  env.oauth.google = { clientId: 'cid', clientSecret: 'secret' };
  await truncateAll();
});
afterEach(() => {
  env.oauth.google = original;
  vi.unstubAllGlobals();
});
afterAll(() => pool.end());

describe('SOC-02 OAuth 시작', () => {
  it('Google 인가 URL로 302하고 httpOnly state 쿠키를 심는다', async () => {
    const res = await start('/todos');
    expect(res.status).toBe(302);
    const url = new URL(res.headers.location);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('redirect_uri')).toBe(`${env.apiUrl}/api/auth/oauth/google/callback`);
    const c = parseSetCookie(res).oauth_state;
    expect(c).toMatchObject({ httpOnly: true, path: '/api/auth/oauth', maxAge: 600 });
    expect(JSON.parse(c.value.slice(2)).state).toBe(url.searchParams.get('state'));
  });

  it('키 미설정 제공자와 알 수 없는 제공자는 404', async () => {
    env.oauth.google = null;
    expect((await start('/')).status).toBe(404);
    expect((await request(app).get('/api/auth/oauth/google/callback')).status).toBe(404);
    env.oauth.google = original;
    expect((await request(app).get('/api/auth/oauth/github')).status).toBe(404);
    expect((await request(app).get('/api/auth/oauth/constructor')).status).toBe(404);
  });

  it.each([['//evil.com'], ['/\\evil.com'], ['https://evil.com'], ['todos']])('next=%s 는 /로 대체', async (next) => {
    const res = await callback({ profile: P, next });
    expect(res.headers.location).toBe(`${env.appUrl}/`);
  });
});

describe('SOC-02 OAuth 콜백', () => {
  it('state 불일치면 OAUTH_FAILED, 로그인 쿠키 없음', async () => {
    const res = await callback({ profile: P, state: 'wrong' });
    expect(res.headers.location).toBe(`${env.appUrl}/login?error=OAUTH_FAILED`);
    expect(parseSetCookie(res).access_token).toBeUndefined();
    expect(await count('SELECT count(*) FROM users')).toBe(0);
  });

  it('state 쿠키 없으면 OAUTH_FAILED', async () => {
    const res = await request(app).get('/api/auth/oauth/google/callback').query({ code: 'c', state: 'x' });
    expect(res.headers.location).toBe(`${env.appUrl}/login?error=OAUTH_FAILED`);
  });

  it('토큰 교환 실패면 OAUTH_FAILED', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await callback({ profile: P, tokenOk: false });
    expect(res.headers.location).toBe(`${env.appUrl}/login?error=OAUTH_FAILED`);
  });

  it('규칙3 신규 가입: 사용자·기본 카테고리·identity 생성, next로 이동, 쿠키 발급', async () => {
    const res = await callback({ profile: P, next: '/calendar' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${env.appUrl}/calendar`);
    const c = parseSetCookie(res);
    expect(c.access_token.httpOnly).toBe(true);
    expect(c.refresh_token).toBeDefined();
    const u = (await pool.query('SELECT * FROM users')).rows[0];
    expect(u).toMatchObject({ email: 'soc@example.com', name: '소셜이', password_hash: null });
    expect(await count('SELECT count(*) FROM categories WHERE is_default')).toBe(1);
    expect(await count("SELECT count(*) FROM user_identities WHERE provider_user_id = 'g-1'")).toBe(1);
  });

  it('규칙1 재로그인: 같은 사용자, 중복 생성 없음 (이메일이 바뀌어도)', async () => {
    await callback({ profile: P });
    const res = await callback({ profile: { ...P, email: 'changed@example.com' } });
    expect(res.headers.location).toBe(`${env.appUrl}/todos`);
    expect(await count('SELECT count(*) FROM users')).toBe(1);
    expect(await count('SELECT count(*) FROM user_identities')).toBe(1);
  });

  it('규칙2 자동 연결: 같은 이메일의 기존 비밀번호 계정에 identity만 추가', async () => {
    const u = await createUser({ email: 'soc@example.com' });
    const res = await callback({ profile: P });
    expect(res.headers.location).toBe(`${env.appUrl}/todos`);
    expect(await count('SELECT count(*) FROM users')).toBe(1);
    const row = (await pool.query('SELECT user_id FROM user_identities')).rows[0];
    expect(row.user_id).toBe(u.id);
    expect((await pool.query('SELECT password_hash FROM users')).rows[0].password_hash).not.toBeNull();
  });

  it.each([
    ['이메일 없음', { sub: 'g-2', name: 'x' }],
    ['이메일 미확인', { ...P, email_verified: false }],
  ])('규칙4 %s: OAUTH_EMAIL_REQUIRED, 가입·연결 없음', async (_, profile) => {
    await createUser({ email: 'soc@example.com' });
    const res = await callback({ profile });
    expect(res.headers.location).toBe(`${env.appUrl}/login?error=OAUTH_EMAIL_REQUIRED`);
    expect(await count('SELECT count(*) FROM user_identities')).toBe(0);
  });
});
