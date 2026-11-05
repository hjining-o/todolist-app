import { afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool, withTransaction } from '../../src/config/db.js';

afterAll(() => pool.end());

describe('API-01', () => {
  it('GET /api/health는 쿠키 없이 200 { server: ok, db: ok }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ server: 'ok', db: 'ok' });
  });

  it('GET /api/health는 DB 연결이 실패하면 503 { server: ok, db: error }, 내부 정보 없음', async () => {
    const query = vi.spyOn(pool, 'query').mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ server: 'ok', db: 'error' });
    expect(log).toHaveBeenCalled();
    query.mockRestore();
    log.mockRestore();
  });

  it('풀 세션 시간대는 Asia/Seoul이다(W-01)', async () => {
    const { rows } = await pool.query('SHOW timezone');
    expect(rows[0].TimeZone).toBe('Asia/Seoul');
  });

  it('withTransaction은 예외 시 ROLLBACK 후 원래 에러를 던지고 연결을 반납한다', async () => {
    const boom = new Error('boom');
    const email = `rollback-${Date.now()}@x.com`;
    await expect(
      withTransaction(async (client) => {
        await client.query("INSERT INTO users (email, password_hash, name) VALUES ($1, 'h', 'R')", [email]);
        throw boom;
      }),
    ).rejects.toBe(boom);
    const { rowCount } = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    expect(rowCount).toBe(0);
    expect(pool.idleCount).toBe(pool.totalCount);
  });

  it('withTransaction은 성공 시 COMMIT하고 결과를 돌려준다', async () => {
    expect(await withTransaction(async (client) => (await client.query('SELECT 1 AS n')).rows[0].n)).toBe(1);
    expect(pool.idleCount).toBe(pool.totalCount);
  });
});
