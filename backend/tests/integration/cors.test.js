import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';

afterAll(() => pool.end());

// .env.test의 CORS_ORIGINS=http://localhost:5173
const FRONT = 'http://localhost:5173';
const EVIL = 'https://evil.example.com';

describe('CORS (SEC-07)', () => {
  it('허용 출처의 preflight는 204와 메서드·헤더·자격 증명 허용', async () => {
    const res = await request(app)
      .options('/api/todos')
      .set('Origin', FRONT)
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(FRONT);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type');
    expect(res.headers.vary).toContain('Origin');
  });

  it('허용 출처의 실제 요청에도 허용 헤더가 붙는다(401 응답 포함)', async () => {
    const res = await request(app).get('/api/me').set('Origin', FRONT);
    expect(res.status).toBe(401);
    expect(res.headers['access-control-allow-origin']).toBe(FRONT);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('허용 목록 밖 출처에는 허용 헤더가 없다', async () => {
    const pre = await request(app)
      .options('/api/todos')
      .set('Origin', EVIL)
      .set('Access-Control-Request-Method', 'POST');
    expect(pre.headers['access-control-allow-origin']).toBeUndefined();
    const res = await request(app).get('/api/health').set('Origin', EVIL);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('허용 목록 밖 출처의 상태 변경 요청은 403(CSRF 방어)', async () => {
    for (const origin of [EVIL, 'null']) {
      const res = await request(app).post('/api/auth/logout').set('Origin', origin);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('같은 출처(개발 Swagger UI)와 Origin 없는 요청(curl)은 통과', async () => {
    const same = await request(app)
      .post('/api/auth/logout')
      .set('Host', 'localhost:3000')
      .set('Origin', 'http://localhost:3000');
    expect(same.status).toBe(204);
    expect(same.headers['access-control-allow-origin']).toBeUndefined();
    expect((await request(app).post('/api/auth/logout')).status).toBe(204);
  });

  it('인증 쿠키는 기본 SameSite=Lax', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.headers['set-cookie'].join()).toMatch(/SameSite=Lax/);
  });
});
