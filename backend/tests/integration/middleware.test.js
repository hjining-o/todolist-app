import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { AppError, ERRORS } from '../../src/domain/errors.js';
import { authenticate } from '../../src/middleware/authenticate.js';
import { errorHandler } from '../../src/middleware/error-handler.js';

const INTERNAL = {
  error: { code: 'INTERNAL_ERROR', message: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
};
const UNAUTH = { error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' } };

const mini = express();
mini.use(express.json({ limit: '100kb' }));
mini.use(cookieParser());
mini.get('/me', authenticate, (req, res) => res.json(req.user));
mini.get('/boom', () => {
  const err = new Error('secret-internal');
  err.detail = 'Key (email)=(a@b.com)';
  throw err;
});
mini.get('/async-boom', async () => {
  const err = new Error('secret-internal');
  err.detail = 'Key (email)=(a@b.com)';
  throw err;
});
mini.get('/app-error', () => {
  throw AppError.of('VALIDATION_ERROR', { title: '필수입니다.' });
});
mini.get('/bad-code', () => {
  throw new AppError(400, 'NOT_IN_TABLE', '표에 없음');
});
mini.use(errorHandler);

const sign = (id = 'u1', key = env.jwtSecret, opts = { algorithm: 'HS384' }) => jwt.sign({ sub: id }, key, opts);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const withToken = (req, t) => req.set('Cookie', 'access_token=' + t);
// 모든 에러 응답의 code는 ERRORS 키여야 한다(N-16)
const expectKnownCode = (res) => expect(Object.keys(ERRORS)).toContain(res.body.error.code);

let errSpy;
const spyConsole = () => {
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
};

afterEach(() => vi.restoreAllMocks());

describe('authenticate - 조건1 (EX-05)', () => {
  it('쿠키 없이 GET /api/todos는 401 UNAUTHENTICATED', async () => {
    const res = await request(app).get('/api/todos');
    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTH);
  });

  it('/api/health는 쿠키 없이 200', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});

describe('authenticate - 조건2/3 잘못된 토큰', () => {
  const t = Math.floor(Date.now() / 1000);
  const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'u1' })}.`;
  const cases = [
    ['만료 토큰', () => jwt.sign({ sub: 'u1', exp: t - 60 }, env.jwtSecret, { algorithm: 'HS384' })],
    ['다른 키 서명', () => sign('u1', 'x'.repeat(48))],
    ['형식 깨진 토큰', () => 'abc'],
    ['HS256 토큰(W-07)', () => sign('u1', env.jwtSecret, { algorithm: 'HS256' })],
    ['alg none 토큰(W-07)', () => none],
  ];

  it.each(cases)('%s → 401 UNAUTHENTICATED (app, mini 모두)', async (_n, make) => {
    spyConsole();
    for (const [target, path] of [
      [app, '/api/todos'],
      [mini, '/me'],
    ]) {
      const res = await withToken(request(target).get(path), make());
      expect(res.status).toBe(401);
      expect(res.body).toEqual(UNAUTH);
    }
    expect(errSpy).not.toHaveBeenCalled();
  });
});

describe('authenticate - 대조군', () => {
  it('유효 HS384 토큰이면 mini GET /me는 200 { id }', async () => {
    const res = await withToken(request(mini).get('/me'), sign('user-123'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'user-123' });
  });

  it('유효 토큰이면 app GET /api/todos는 404 NOT_FOUND JSON', async () => {
    const res = await withToken(request(app).get('/api/todos'), sign());
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: '찾을 수 없습니다.' } });
  });
});

describe('errorHandler - 조건4 본문 파싱 오류', () => {
  it('101KB 초과 JSON은 쿠키 없어도 413 PAYLOAD_TOO_LARGE', async () => {
    spyConsole();
    const res = await request(app)
      .post('/api/todos')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ a: 'x'.repeat(101 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expectKnownCode(res);
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('잘못된 JSON은 400 VALIDATION_ERROR', async () => {
    spyConsole();
    const res = await request(app).post('/api/todos').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expectKnownCode(res);
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('지원하지 않는 charset은 400 VALIDATION_ERROR', async () => {
    spyConsole();
    const res = await request(app)
      .post('/api/todos')
      .set('Content-Type', 'application/json; charset=not-a-charset')
      .send('{"a":1}');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expectKnownCode(res);
    expect(errSpy).not.toHaveBeenCalled();
  });
});

describe('errorHandler - 조건5 500 응답 (P-06)', () => {
  it.each(['/boom', '/async-boom'])('%s는 내부 정보 없이 500 INTERNAL_ERROR', async (path) => {
    spyConsole();
    const res = await request(mini).get(path);
    expect(res.status).toBe(500);
    expect(res.body).toEqual(INTERNAL);
    for (const leak of ['secret-internal', '    at ', 'a@b.com']) expect(res.text).not.toContain(leak);
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(errSpy.mock.calls)).not.toContain('a@b.com');
  });
});

describe('errorHandler - 조건6 (N-16)', () => {
  it('AppError는 지정 상태와 fields를 그대로 응답한다', async () => {
    spyConsole();
    const res = await request(mini).get('/app-error');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: '입력값을 확인해 주세요.', fields: { title: '필수입니다.' } },
    });
    expectKnownCode(res);
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('ERRORS에 없는 코드의 AppError는 500 INTERNAL_ERROR', async () => {
    spyConsole();
    const res = await request(mini).get('/bad-code');
    expect(res.status).toBe(500);
    expect(res.body).toEqual(INTERNAL);
    expectKnownCode(res);
    expect(errSpy).toHaveBeenCalledTimes(1);
  });

  it('headersSent면 응답을 건드리지 않고 next(err)를 호출한다', () => {
    const err = new Error('x');
    const next = vi.fn();
    errorHandler(err, {}, { headersSent: true }, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
