// npm run db:reset:test: 테스트 DB의 public 스키마를 지우고 마이그레이션을 다시 적용한다.
// process.env가 아닌 .env.test 파일만 읽어 운영 URL로 실행되는 것을 막는다.
import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import pg from 'pg';
import { migrate } from './migrate.js';

const read = (name) => parseEnv(readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8')).DATABASE_URL;

if (!existsSync(new URL('../../.env.test', import.meta.url))) throw new Error('backend/.env.test가 없습니다');
const url = read('.env.test');
if (!url) throw new Error('.env.test에 DATABASE_URL이 없습니다');
if (existsSync(new URL('../../.env', import.meta.url)) && read('.env') === url) {
  throw new Error('.env.test의 DATABASE_URL이 .env와 같습니다');
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
} finally {
  await client.end();
}
await migrate(url);
