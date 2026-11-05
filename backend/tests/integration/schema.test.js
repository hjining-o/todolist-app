import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/config/db.js';
import { createCategory, createTeam, createTodo, createUser, addMember, truncateAll } from './helpers/db.js';

beforeEach(truncateAll);
afterAll(() => pool.end());

const names = async (sql) => new Set((await pool.query(sql)).rows.map((r) => r.name));

const insertTodo = (ownerId, categoryId, startAt, endAt, completed = false, completedAt = null) =>
  pool.query(
    `INSERT INTO todos (owner_id, category_id, title, start_at, end_at, completed, completed_at)
     VALUES ($1, $2, 't', $3, $4, $5, $6)`,
    [ownerId, categoryId, startAt, endAt, completed, completedAt],
  );

describe('DB-04 스키마 구조', () => {
  it('E-09: 테이블 9개가 존재한다', async () => {
    const tables = await names(
      "SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'",
    );
    expect(tables).toEqual(
      new Set([
        'users',
        'teams',
        'team_members',
        'categories',
        'todos',
        'todo_shares',
        'todo_histories',
        'refresh_tokens',
        'user_identities',
      ]),
    );
  });

  it('E-09: uq_·idx_ 인덱스 13개가 존재한다', async () => {
    const indexes = await names(
      "SELECT indexname AS name FROM pg_indexes WHERE schemaname = 'public' AND indexname ~ '^(uq|idx)_'",
    );
    expect(indexes).toEqual(
      new Set([
        'uq_users_email',
        'uq_teams_name_lower',
        'uq_team_members_team_id_owner',
        'idx_team_members_user_id',
        'uq_categories_id_owner_id',
        'uq_categories_owner_id_name_lower',
        'uq_categories_owner_id_default',
        'idx_todos_owner_id_start_at_end_at',
        'idx_todos_category_id',
        'idx_todo_shares_team_id_todo_id',
        'idx_todo_histories_todo_id_changed_at',
        'uq_refresh_tokens_token_hash',
        'idx_refresh_tokens_user_id',
      ]),
    );
  });
});

describe('DB-04 제약', () => {
  it('R3: end_at < start_at 할일은 거부되고, end_at = start_at은 허용된다(EX-07)', async () => {
    const u = await createUser();
    await expect(
      insertTodo(u.id, u.defaultCategoryId, '2026-11-04T10:00:00+09:00', '2026-11-04T09:59:00+09:00'),
    ).rejects.toMatchObject({ code: '23514', constraint: 'todos_check' });
    await insertTodo(u.id, u.defaultCategoryId, '2026-11-04T10:00:00+09:00', '2026-11-04T10:00:00+09:00');
  });

  it('E-02: 사용자당 기본 카테고리는 1개뿐이다', async () => {
    const u = await createUser();
    await expect(
      pool.query("INSERT INTO categories (owner_id, name, is_default) VALUES ($1, '또다른기본', true)", [u.id]),
    ).rejects.toMatchObject({ code: '23505', constraint: 'uq_categories_owner_id_default' });
  });

  it('OPS-23 ④: 팀당 OWNER는 1명뿐이고 MANAGER는 여러 명 가능하다', async () => {
    const [a, b, c] = [
      await createUser({ email: 'a@example.com', name: 'A' }),
      await createUser({ email: 'b@example.com', name: 'B' }),
      await createUser({ email: 'c@example.com', name: 'C' }),
    ];
    const team = await createTeam({ ownerId: a.id, name: '팀' });
    await expect(
      pool.query("INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'OWNER')", [team.id, b.id]),
    ).rejects.toMatchObject({ code: '23505', constraint: 'uq_team_members_team_id_owner' });
    await addMember({ teamId: team.id, userId: b.id, role: 'MANAGER' });
    await addMember({ teamId: team.id, userId: c.id, role: 'MANAGER' });
  });

  it('R7: 다른 사용자의 카테고리를 할일에 쓸 수 없다', async () => {
    const a = await createUser({ email: 'a@example.com', name: 'A' });
    const b = await createUser({ email: 'b@example.com', name: 'B' });
    await expect(
      insertTodo(a.id, b.defaultCategoryId, '2026-11-04T00:00:00+09:00', '2026-11-04T23:59:00+09:00'),
    ).rejects.toMatchObject({ code: '23503', constraint: 'todos_category_id_owner_id_fkey' });
  });

  it('R12/R20: 할일 삭제 시 공유와 이력이 함께 삭제된다', async () => {
    const u = await createUser();
    const team = await createTeam({ ownerId: u.id, name: '팀' });
    const todo = await createTodo({ ownerId: u.id, sharedTeamIds: [team.id] });
    await pool.query(
      "INSERT INTO todo_histories (todo_id, actor_id, action, changes) VALUES ($1, $2, 'CREATED', '{}')",
      [todo.id, u.id],
    );
    await pool.query('DELETE FROM todos WHERE id = $1', [todo.id]);
    const count = async (t) =>
      (await pool.query(`SELECT count(*)::int AS n FROM ${t} WHERE todo_id = $1`, [todo.id])).rows[0].n;
    expect(await count('todo_shares')).toBe(0);
    expect(await count('todo_histories')).toBe(0);
  });

  it('R10: 사용자 내 카테고리 이름은 대소문자·공백 무시로 유일하고, 다른 사용자는 같은 이름 가능(EX-16)', async () => {
    const a = await createUser({ email: 'a@example.com', name: 'A' });
    const b = await createUser({ email: 'b@example.com', name: 'B' });
    await createCategory({ ownerId: a.id, name: 'Work' });
    await expect(
      pool.query("INSERT INTO categories (owner_id, name) VALUES ($1, ' work ')", [a.id]),
    ).rejects.toMatchObject({ code: '23505', constraint: 'uq_categories_owner_id_name_lower' });
    await createCategory({ ownerId: b.id, name: 'Work' });
  });

  it('E-05: completed = true인데 completed_at이 null이면 거부된다', async () => {
    const u = await createUser();
    await expect(
      insertTodo(u.id, u.defaultCategoryId, '2026-11-04T00:00:00+09:00', '2026-11-04T23:59:00+09:00', true, null),
    ).rejects.toMatchObject({ code: '23514', constraint: 'todos_check1' });
  });
});
