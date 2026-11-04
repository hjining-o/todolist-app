// npm run db:migrate: migrations/*.sql을 파일명 순서대로 적용하고 적용한 파일은 건너뛴다
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

const dir = new URL('./migrations/', import.meta.url);

export async function migrate(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const applied = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files.filter((f) => !applied.has(f))) {
      // 각 파일은 자체 BEGIN … COMMIT. 실패하면 그 파일 전체가 롤백된다
      await client.query(await readFile(new URL(file, dir), 'utf8'));
      // shortcut: 파일 COMMIT과 기록 INSERT 사이에 끊기면 재실행 시 중복 적용 오류. 마이그레이션이 늘면 기록을 파일 트랜잭션 안으로 옮긴다
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    }
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  const { env } = await import('../config/env.js');
  await migrate(env.databaseUrl);
}
