import bcrypt from 'bcryptjs';
import { pool } from '../../../src/config/db.js';

let n = 0;

export async function truncateAll() {
  // 나머지 테이블은 FK CASCADE로 비워진다. schema_migrations는 남긴다
  await pool.query('TRUNCATE users, teams CASCADE');
}

export async function createUser({
  email = `user${++n}@example.com`,
  name = `사용자${n}`,
  password = 'password123',
  timezone,
} = {}) {
  // 비용 4는 테스트 속도용이다. compare는 해시에 박힌 비용을 쓰므로 영향 없다
  const passwordHash = await bcrypt.hash(password, 4);
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, name, timezone)
     VALUES ($1, $2, $3, COALESCE($4, 'Asia/Seoul')) RETURNING id, timezone`,
    [email, passwordHash, name, timezone],
  );
  const { id } = rows[0];
  const cat = await pool.query(
    `INSERT INTO categories (owner_id, name, is_default) VALUES ($1, '기본', true) RETURNING id`,
    [id],
  );
  return { id, email, name, timezone: rows[0].timezone, password, defaultCategoryId: cat.rows[0].id };
}

export async function createCategory({ ownerId, name = 'Work', isDefault = false }) {
  const { rows } = await pool.query(
    'INSERT INTO categories (owner_id, name, is_default) VALUES ($1, $2, $3) RETURNING id',
    [ownerId, name, isDefault],
  );
  return { id: rows[0].id, ownerId, name, isDefault };
}

export async function addMember({ teamId, userId, role = 'MEMBER' }) {
  await pool.query('INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)', [teamId, userId, role]);
}

export async function createTeam({ ownerId, name = `팀${++n}` }) {
  const { rows } = await pool.query('INSERT INTO teams (name) VALUES ($1) RETURNING id', [name]);
  await addMember({ teamId: rows[0].id, userId: ownerId, role: 'OWNER' });
  return { id: rows[0].id, name };
}

export async function createTodo({
  ownerId,
  categoryId,
  title = '할일',
  description = null,
  startAt = '2026-11-04T00:00:00+09:00',
  endAt = '2026-11-04T23:59:00+09:00',
  completed = false,
  sharedTeamIds = [],
}) {
  const { rows } = await pool.query(
    `INSERT INTO todos (owner_id, category_id, title, description, start_at, end_at, completed, completed_at)
     VALUES ($1,
             COALESCE($2::uuid, (SELECT id FROM categories WHERE owner_id = $1 AND is_default)),
             $3, $4, $5, $6, $7, CASE WHEN $7::boolean THEN now() END)
     RETURNING id, category_id`,
    [ownerId, categoryId ?? null, title, description, startAt, endAt, completed],
  );
  for (const teamId of sharedTeamIds) {
    await pool.query('INSERT INTO todo_shares (todo_id, team_id) VALUES ($1, $2)', [rows[0].id, teamId]);
  }
  return { id: rows[0].id, ownerId, categoryId: rows[0].category_id, title };
}
