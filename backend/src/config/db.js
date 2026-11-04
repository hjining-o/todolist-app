import pg from 'pg';
import { env } from './env.js';

// 세션 시간대는 DB 기본값(Asia/Seoul)을 쓴다. SET TIME ZONE 하지 않는다(W-01)
export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

export async function withTransaction(fn) {
  const client = await pool.connect();
  let broken;
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      broken = rollbackErr; // 깨진 연결은 풀에 돌려보내지 않고 폐기
    }
    throw err;
  } finally {
    client.release(broken);
  }
}
