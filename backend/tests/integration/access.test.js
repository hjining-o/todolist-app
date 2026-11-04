import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../../src/config/db.js';
import { categoryOwned, todoCanEdit, todoIsOwner, todoVisible } from '../../src/repositories/sql/access.js';

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let client;
const u = {}; // A~D 사용자 id
const cat = {}; // 사용자별 카테고리 id
const todo = {}; // T1~T7 id
const team = {};

const one = async (sql, params) => (await client.query(sql, params)).rows[0].id;

// 사용자 uid 기준으로 보이는 할일의 {제목: 컬럼값}
async function mapFor(uid, expr, col) {
  const { rows } = await client.query(
    `SELECT t.title, ${expr} AS ${col} FROM todos t WHERE ${todoVisible(1)} AND t.id = ANY($2)`,
    [uid, Object.values(todo)],
  );
  return { rows, map: Object.fromEntries(rows.map((r) => [r.title, r[col]])) };
}

beforeAll(async () => {
  client = await pool.connect();
  await client.query('BEGIN');
  for (const k of ['A', 'B', 'C', 'D']) {
    u[k] = await one("INSERT INTO users (email, password_hash, name) VALUES ($1, 'h', $2) RETURNING id", [
      `${k.toLowerCase()}-${run}@x.com`,
      k,
    ]);
    cat[k] = await one("INSERT INTO categories (owner_id, name, is_default) VALUES ($1, '기본', true) RETURNING id", [
      u[k],
    ]);
  }
  for (const [k, name] of [
    ['mkt', `마케팅팀-${run}`],
    ['sales', `영업팀-${run}`],
  ]) {
    team[k] = await one('INSERT INTO teams (name) VALUES ($1) RETURNING id', [name]);
  }
  const members = [
    ['mkt', 'A', 'OWNER'],
    ['mkt', 'B', 'MANAGER'],
    ['mkt', 'C', 'MEMBER'],
    ['sales', 'D', 'OWNER'],
    ['sales', 'C', 'MEMBER'],
  ];
  for (const [t, k, role] of members) {
    await client.query('INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)', [team[t], u[k], role]);
  }
  const todos = [
    ['T1', 'A', ['mkt']],
    ['T2', 'A', []],
    ['T3', 'C', ['mkt']],
    ['T4', 'C', ['sales']],
    ['T5', 'C', []],
    ['T6', 'B', ['mkt']],
    ['T7', 'C', ['mkt', 'sales']],
  ];
  for (const [title, owner, shared] of todos) {
    todo[title] = await one(
      'INSERT INTO todos (owner_id, category_id, title, start_at, end_at) VALUES ($1, $2, $3, now(), now()) RETURNING id',
      [u[owner], cat[owner], title],
    );
    for (const t of shared) {
      await client.query('INSERT INTO todo_shares (todo_id, team_id) VALUES ($1, $2)', [todo[title], team[t]]);
    }
  }
});

afterAll(async () => {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
});

describe('API-04 권한 SQL 조각 (통합)', () => {
  const expected = {
    A: { T1: true, T2: true, T3: true, T6: true, T7: true },
    B: { T1: true, T3: true, T6: true, T7: true },
    C: { T1: false, T3: true, T4: true, T5: true, T6: false, T7: true },
    D: { T4: true, T7: true },
  };

  it.each(Object.entries(expected))(
    '사용자 %s: 조회 가능 범위와 수정 권한이 권한 표와 일치, 중복 행 없음 (R19, R21, US-14, EX-20)',
    async (k, exp) => {
      const { rows, map } = await mapFor(u[k], todoCanEdit(1), 'can_edit');
      expect(map).toEqual(exp);
      expect(rows).toHaveLength(Object.keys(exp).length);
    },
  );

  it('todoIsOwner: C는 T3,T4,T5,T7만 소유자 (R19, EX-21)', async () => {
    const { map } = await mapFor(u.C, todoIsOwner(1), 'is_owner');
    expect(map).toMatchObject({ T3: true, T4: true, T5: true, T7: true, T1: false, T6: false });
  });

  it('파라미터 위치: todoVisible(2) — B는 비공유 T2 0행(404 근거), 공유 T1 1행 (EX-25)', async () => {
    const q = `SELECT t.id FROM todos t WHERE t.id = $1 AND ${todoVisible(2)}`;
    expect((await client.query(q, [todo.T2, u.B])).rowCount).toBe(0);
    expect((await client.query(q, [todo.T1, u.B])).rowCount).toBe(1);
  });

  it('categoryOwned: A는 자기 카테고리 1개, B로 A의 카테고리는 0개 (R2)', async () => {
    const q = `SELECT c.id FROM categories c WHERE ${categoryOwned(1)} AND c.id = ANY($2)`;
    const ids = Object.values(cat);
    expect((await client.query(q, [u.A, ids])).rows).toEqual([{ id: cat.A }]);
    expect((await client.query(q, [u.B, [cat.A]])).rowCount).toBe(0);
  });

  it('역할 변경은 같은 트랜잭션에서 즉시 반영: B를 MEMBER로 내리면 T3 can_edit false (R19, EX-20)', async () => {
    await client.query('SAVEPOINT role_change');
    try {
      await client.query("UPDATE team_members SET role = 'MEMBER' WHERE team_id = $1 AND user_id = $2", [
        team.mkt,
        u.B,
      ]);
      const { map } = await mapFor(u.B, todoCanEdit(1), 'can_edit');
      expect(map.T3).toBe(false);
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT role_change');
    }
  });
});
