import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { pool } from '../../src/config/db.js';
import { createCategory, createTodo, truncateAll } from './helpers/db.js';
import { agentFor } from './helpers/agent.js';
import { setupScenario } from './helpers/scenario.js';

beforeEach(truncateAll);
afterAll(() => pool.end());

const readEnvFile = (name) => parseEnv(readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8'));
const roleMap = async (teamId) =>
  Object.fromEntries(
    (
      await pool.query(
        'SELECT u.name, m.role FROM team_members m JOIN users u ON u.id = m.user_id WHERE m.team_id = $1',
        [teamId],
      )
    ).rows.map((r) => [r.name, r.role]),
  );

describe('API-05 테스트 DB 격리', () => {
  it('Q-02: env.databaseUrl은 .env.test의 DATABASE_URL이며 .env와 다르다', () => {
    expect(env.databaseUrl).toBe(readEnvFile('.env.test').DATABASE_URL);
    if (existsSync(new URL('../../.env', import.meta.url))) {
      expect(env.databaseUrl).not.toBe(readEnvFile('.env').DATABASE_URL);
    }
  });
});

describe('API-05 헬퍼', () => {
  it('Q-02: truncateAll은 users를 비우고 schema_migrations는 유지하며, 시나리오를 다시 만들 수 있다', async () => {
    await setupScenario();
    await truncateAll();
    expect((await pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n).toBeGreaterThanOrEqual(1);
    await setupScenario();
  });

  it('Q-08: setupScenario는 A–D, 기본 카테고리, 마케팅팀·영업팀 구성을 만든다', async () => {
    const s = await setupScenario();
    const emails = (await pool.query('SELECT email FROM users ORDER BY email')).rows.map((r) => r.email);
    expect(emails).toEqual(['a@example.com', 'b@example.com', 'c@example.com', 'd@example.com']);
    for (const u of [s.A, s.B, s.C, s.D]) {
      const { rows } = await pool.query(
        'SELECT count(*)::int AS n FROM categories WHERE owner_id = $1 AND is_default',
        [u.id],
      );
      expect(rows[0].n).toBe(1);
    }
    expect(await roleMap(s.marketing.id)).toEqual({ A: 'OWNER', B: 'MANAGER', C: 'MEMBER' });
    expect(await roleMap(s.sales.id)).toEqual({ D: 'OWNER', C: 'MEMBER' });
  });

  it('SEC-08: 비밀번호는 bcrypt 해시로 저장된다', async () => {
    const s = await setupScenario();
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [s.A.id]);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare(s.A.password, rows[0].password_hash)).toBe(true);
  });

  it('Q-08: agentFor는 인증 쿠키를 유지하고, 쿠키 없는 요청은 401이다', async () => {
    const s = await setupScenario();
    const agent = agentFor(s.A.id);
    for (let i = 0; i < 2; i++) {
      const res = await agent.get('/api/__none');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
    expect((await request(app).get('/api/__none')).status).toBe(401);
  });

  it('Q-08: createTodo는 기본 카테고리·공유·완료 시각을 처리한다', async () => {
    const s = await setupScenario();
    const t1 = await createTodo({ ownerId: s.A.id });
    expect(t1.categoryId).toBe(s.A.defaultCategoryId);
    const t2 = await createTodo({ ownerId: s.A.id, sharedTeamIds: [s.marketing.id], completed: true });
    const shares = await pool.query('SELECT 1 FROM todo_shares WHERE todo_id = $1', [t2.id]);
    expect(shares.rowCount).toBe(1);
    const { rows } = await pool.query('SELECT completed_at FROM todos WHERE id = $1', [t2.id]);
    expect(rows[0].completed_at).not.toBeNull();
  });

  it('Q-08: createCategory는 { id, ownerId, name, isDefault }를 돌려준다', async () => {
    const s = await setupScenario();
    const c = await createCategory({ ownerId: s.A.id });
    expect(c).toMatchObject({ ownerId: s.A.id, name: 'Work', isDefault: false });
    expect(c.id).toEqual(expect.any(String));
  });
});
