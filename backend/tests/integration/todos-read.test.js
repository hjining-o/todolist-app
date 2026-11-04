import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { todoStatusSql } from '../../src/repositories/todos.repo.js';
import { getStatus } from '../../src/domain/todo-status.js';
import { truncateAll, createUser, createCategory, createTodo, addMember } from './helpers/db.js';
import { setupScenario } from './helpers/scenario.js';
import { agentFor } from './helpers/agent.js';

const get = (u, query) =>
  agentFor(u.id)
    .get('/api/todos')
    .query(query ?? {}); // supertest가 '+'를 %2B로 인코딩
const one = (u, id) => agentFor(u.id).get(`/api/todos/${id}`);
const PAST = { startAt: '2020-01-01T09:00+09:00', endAt: '2020-01-02T18:00+09:00' };
const FUTURE = { startAt: '2099-01-01T09:00+09:00', endAt: '2099-01-02T18:00+09:00' };
const NOW_SPAN = { startAt: '2020-01-01T00:00+09:00', endAt: '2099-12-31T23:59+09:00' };
const FROM = '2026-10-26T00:00+09:00';
const TO = '2026-12-07T00:00+09:00';
const NOV = { from: '2026-11-01T00:00+09:00', to: '2026-12-01T00:00+09:00' };

// 대량 삽입은 1쿼리(분 단위로 start를 벌려 순서 고정)
async function bulk({ ownerId, n, startAt, endAt, completed = false }) {
  await pool.query(
    `INSERT INTO todos (owner_id, category_id, title, start_at, end_at, completed, completed_at)
     SELECT $1, (SELECT id FROM categories WHERE owner_id = $1 AND is_default), 't' || g,
            $2::timestamptz + g * interval '1 minute', $3::timestamptz + g * interval '1 minute',
            $4, CASE WHEN $4 THEN now() END
     FROM generate_series(1, $5::int) g`,
    [ownerId, startAt, endAt, completed, n],
  );
}
const ids = (res) => res.body.items.map((i) => i.id);
const sorted = (a) => [...a].sort();
const expectError = (res, status, code) => {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
};

beforeEach(truncateAll);
afterEach(() => vi.restoreAllMocks());
afterAll(() => pool.end());

describe('GET /api/todos/:todoId 단건 조회', () => {
  it('EX-21·FR-11 #2 공유 없는 남의 할일은 404 NOT_FOUND, 목록에도 없음', async () => {
    const { A, B, D } = await setupScenario();
    const T = await createTodo({ ownerId: A.id, ...PAST });
    for (const u of [B, D]) {
      expectError(await one(u, T.id), 404, 'NOT_FOUND');
      const list = await get(u);
      expect(ids(list)).not.toContain(T.id);
      expect(list.body.total).toBe(0);
    }
    expect((await one(A, T.id)).status).toBe(200);
  });

  it('EX-21 비구성원은 공유된 할일도 404, 구성원은 200', async () => {
    const { A, C, D, marketing } = await setupScenario();
    const T = await createTodo({ ownerId: A.id, ...PAST, sharedTeamIds: [marketing.id] });
    expectError(await one(D, T.id), 404, 'NOT_FOUND');
    expect((await one(C, T.id)).status).toBe(200);
  });

  it('EX-25 관리자도 공유되지 않은 구성원 할일은 404, 목록에도 없음', async () => {
    const { B, C } = await setupScenario();
    const T = await createTodo({ ownerId: C.id, ...PAST });
    expectError(await one(B, T.id), 404, 'NOT_FOUND');
    expect(ids(await get(B))).not.toContain(T.id);
  });

  it('404 동일: 없는 ID와 삭제된 할일은 공유 없는 할일과 같은 본문', async () => {
    const { A, B } = await setupScenario();
    const T = await createTodo({ ownerId: A.id, ...PAST });
    const hidden = await one(B, T.id);
    const missing = await one(A, randomUUID());
    await pool.query('DELETE FROM todos WHERE id = $1', [T.id]);
    const deleted = await one(A, T.id);
    expectError(hidden, 404, 'NOT_FOUND');
    expect(typeof hidden.body.error.message).toBe('string');
    expect(missing.status).toBe(404);
    expect(deleted.status).toBe(404);
    expect(missing.body).toEqual(hidden.body);
    expect(deleted.body).toEqual(hidden.body);
  });

  it('경로 형식: uuid가 아니면 400 fields.todoId, 대문자 UUID는 200', async () => {
    const { A } = await setupScenario();
    const T = await createTodo({ ownerId: A.id, ...PAST });
    const bad = await one(A, 'abc');
    expectError(bad, 400, 'VALIDATION_ERROR');
    expect(bad.body.error.fields).toHaveProperty('todoId');
    expect((await one(A, T.id.toUpperCase())).status).toBe(200);
  });

  it('R2·SEC-06 category는 소유자 본인에게만 내려간다', async () => {
    const { A, B, C, marketing } = await setupScenario();
    const work = await createCategory({ ownerId: C.id, name: 'Work' });
    const T = await createTodo({ ownerId: C.id, categoryId: work.id, ...PAST, sharedTeamIds: [marketing.id] });
    const b = await one(B, T.id);
    expect(b.status).toBe(200);
    expect(b.body).not.toHaveProperty('category');
    expect(b.body.isOwner).toBe(false);
    expect(b.body.canEdit).toBe(true);
    const aItem = (await get(A)).body.items.find((i) => i.id === T.id);
    expect(aItem).toBeDefined();
    expect(aItem).not.toHaveProperty('category');
    const c = await one(C, T.id);
    expect(c.body.category).toEqual({ id: work.id, name: 'Work' });
    expect(c.body.isOwner).toBe(true);
    expect(c.body.canEdit).toBe(true);
  });

  it('R19 canEdit는 MEMBER false·MANAGER true, 응답 키 집합 고정', async () => {
    const { A, B, C, marketing } = await setupScenario();
    const T = await createTodo({ ownerId: A.id, ...PAST, sharedTeamIds: [marketing.id] });
    const c = await one(C, T.id);
    expect(c.body.canEdit).toBe(false);
    expect((await one(B, T.id)).body.canEdit).toBe(true);
    expect(Object.keys(c.body).sort()).toEqual(
      [
        'id',
        'title',
        'description',
        'startAt',
        'endAt',
        'completed',
        'completedAt',
        'status',
        'owner',
        'sharedTeams',
        'canEdit',
        'isOwner',
      ].sort(),
    );
    expect(Object.keys((await one(A, T.id)).body)).toContain('category');
  });

  it('FR-11 #6 sharedTeams는 보는 사람 팀만, 이름순 (단건·목록)', async () => {
    const { A, C, D, marketing, sales } = await setupScenario();
    const T = await createTodo({ ownerId: C.id, ...PAST, sharedTeamIds: [marketing.id, sales.id] });
    const m = [{ id: marketing.id, name: '마케팅팀' }];
    const s = [{ id: sales.id, name: '영업팀' }];
    const cases = [
      [A, m],
      [D, s],
      [C, [...m, ...s]],
    ];
    for (const [u, expected] of cases) {
      expect((await one(u, T.id)).body.sharedTeams).toEqual(expected);
      expect((await get(u)).body.items.find((i) => i.id === T.id).sharedTeams).toEqual(expected);
    }
  });

  it('응답 오프셋은 보는 사람 시간대, completedAt도 오프셋 형식', async () => {
    const { A, marketing } = await setupScenario();
    const E = await createUser({ timezone: 'America/New_York' });
    await addMember({ teamId: marketing.id, userId: E.id });
    const period = { startAt: '2099-01-10T09:00+09:00', endAt: '2099-01-10T18:00+09:00' };
    const T = await createTodo({ ownerId: A.id, ...period, sharedTeamIds: [marketing.id] });
    const Done = await createTodo({ ownerId: A.id, ...period, completed: true, sharedTeamIds: [marketing.id] });
    expect((await one(A, T.id)).body.startAt).toBe('2099-01-10T09:00+09:00');
    expect((await one(E, T.id)).body.startAt).toBe('2099-01-09T19:00-05:00');
    for (const u of [A, E]) expect((await one(u, Done.id)).body.completedAt).toMatch(/[+-]\d{2}:\d{2}$/);
  });
});

describe('GET /api/todos 목록 필터', () => {
  it('EX-12·13·14 status 필터와 표시 status가 일치', async () => {
    const { A } = await setupScenario();
    const T1 = await createTodo({ ownerId: A.id, ...PAST, completed: true });
    const T2 = await createTodo({ ownerId: A.id, ...PAST });
    const T3 = await createTodo({ ownerId: A.id, ...FUTURE });
    const T4 = await createTodo({ ownerId: A.id, ...NOW_SPAN });
    const cases = [
      ['COMPLETED', T1],
      ['OVERDUE', T2],
      ['NOT_STARTED', T3],
      ['IN_PROGRESS', T4],
    ];
    for (const [status, T] of cases) {
      const res = await get(A, { status });
      expect(ids(res)).toEqual([T.id]);
      expect(res.body.total).toBe(1);
    }
    const all = (await get(A)).body.items;
    for (const [status, T] of cases) expect(all.find((i) => i.id === T.id).status).toBe(status);
  });

  it('F3 카테고리 + 상태 조합', async () => {
    const { A, C, marketing } = await setupScenario();
    const work = await createCategory({ ownerId: A.id, name: 'Work' });
    const W1 = await createTodo({ ownerId: A.id, categoryId: work.id, ...PAST });
    const W2 = await createTodo({ ownerId: A.id, categoryId: work.id, ...FUTURE });
    await createTodo({ ownerId: A.id, ...PAST });
    await createTodo({ ownerId: C.id, ...PAST, sharedTeamIds: [marketing.id] });
    expect(ids(await get(A, { categoryId: work.id }))).toEqual([W1.id, W2.id]);
    const res = await get(A, { categoryId: work.id, status: 'OVERDUE' });
    expect(ids(res)).toEqual([W1.id]);
    expect(res.body.total).toBe(1);
  });

  it('S-04 남의·없는 카테고리 ID는 200 빈 결과', async () => {
    const { A, C, marketing } = await setupScenario();
    await createTodo({ ownerId: C.id, ...PAST, sharedTeamIds: [marketing.id] });
    for (const categoryId of [C.defaultCategoryId, randomUUID()]) {
      const res = await get(A, { categoryId });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], total: 0 });
    }
  });

  describe('팀·사용자 필터', () => {
    async function seed() {
      const s = await setupScenario();
      const { A, C, marketing: m, sales } = s;
      const mk = (ownerId, sharedTeamIds, startAt) =>
        createTodo({ ownerId, sharedTeamIds, startAt, endAt: '2026-11-30T00:00+09:00' });
      const P = await mk(A.id, [], '2026-11-01T00:00+09:00');
      const Am = await mk(A.id, [m.id], '2026-11-02T00:00+09:00');
      const Cms = await mk(C.id, [m.id, sales.id], '2026-11-03T00:00+09:00');
      const Cs = await mk(C.id, [sales.id], '2026-11-04T00:00+09:00');
      return { ...s, P, Am, Cms, Cs };
    }

    it('F4 teamId는 공유된 팀이면서 보는 사람이 구성원인 팀만 (S-04)', async () => {
      const { A, C, marketing, sales, Am, Cms, Cs } = await seed();
      expect(ids(await get(A, { teamId: marketing.id }))).toEqual([Am.id, Cms.id]);
      const hidden = await get(A, { teamId: sales.id });
      expect(hidden.status).toBe(200);
      expect(hidden.body).toEqual({ items: [], total: 0 });
      expect(ids(await get(A, { teamId: randomUUID() }))).toEqual([]);
      expect(ids(await get(C, { teamId: sales.id }))).toEqual([Cms.id, Cs.id]);
    });

    it('F4 userId는 소유자 필터, 볼 수 없는 사용자·없는 ID는 빈 결과', async () => {
      const { A, C, D, P, Am, Cms } = await seed();
      expect(ids(await get(A, { userId: C.id }))).toEqual([Cms.id]);
      expect(ids(await get(A, { userId: A.id }))).toEqual([P.id, Am.id]);
      expect(ids(await get(A, { userId: D.id }))).toEqual([]);
    });

    it('캘린더 + teamId 조합', async () => {
      const { A, marketing, Am, Cms } = await seed();
      const res = await get(A, { teamId: marketing.id, ...NOV });
      expect(res.status).toBe(200);
      expect(ids(res)).toEqual([Am.id, Cms.id]);
    });
  });
});

describe('GET /api/todos 페이지·정렬', () => {
  it('OPS-15 total은 필터 후 전체, offset 페이지 합집합 중복 없음, 범위 밖 offset도 total 유지', async () => {
    const { A } = await setupScenario();
    await bulk({ ownerId: A.id, n: 70, ...PAST });
    await bulk({ ownerId: A.id, n: 50, ...FUTURE });
    const p1 = await get(A, { status: 'OVERDUE' });
    const p2 = await get(A, { status: 'OVERDUE', offset: 50 });
    expect(p1.body.total).toBe(70);
    expect(p1.body.items).toHaveLength(50);
    expect(p2.body.items).toHaveLength(20);
    expect(p2.body.total).toBe(70);
    const all = [...p1.body.items, ...p2.body.items];
    expect(new Set(all.map((i) => i.id)).size).toBe(70);
    const starts = all.map((i) => i.startAt);
    expect(starts).toEqual([...starts].sort());
    const far = await get(A, { status: 'OVERDUE', offset: 200 });
    expect(far.body).toEqual({ items: [], total: 70 });
  });

  it('S-05 같은 startAt은 id 오름차순, 기본 limit은 50', async () => {
    const { A } = await setupScenario();
    const same = [];
    for (let i = 0; i < 3; i++) same.push((await createTodo({ ownerId: A.id, ...PAST })).id);
    expect(ids(await get(A))).toEqual(sorted(same));
    await bulk({ ownerId: A.id, n: 48, ...FUTURE });
    const res = await get(A);
    expect(res.body.items).toHaveLength(50);
    expect(res.body.total).toBe(51);
  });
});

describe('API-03 #2 SQL CASE = getStatus', () => {
  it('경계 시각마다 SQL 상태와 getStatus가 같고 대표값이 맞다', async () => {
    const { A } = await setupScenario();
    const mk = (startAt, endAt, completed = false) => createTodo({ ownerId: A.id, startAt, endAt, completed });
    const X1 = await mk('2026-11-05T00:00+09:00', '2026-11-05T23:59+09:00');
    const X2 = await mk('2026-11-10T09:00+09:00', '2026-11-10T18:00+09:00');
    const X3 = await mk('2026-11-01T00:00+09:00', '2026-11-03T23:59+09:00', true);
    const X4 = await mk('2026-11-10T09:00+09:00', '2026-11-10T09:00+09:00');
    const nows = [
      ['2026-11-05T23:59:30+09:00', { [X1.id]: 'IN_PROGRESS' }],
      ['2026-11-06T00:00+09:00', { [X1.id]: 'OVERDUE' }],
      ['2026-11-10T08:59:59+09:00', { [X2.id]: 'NOT_STARTED' }],
      ['2026-11-10T09:00+09:00', { [X2.id]: 'IN_PROGRESS', [X4.id]: 'IN_PROGRESS' }],
      ['2026-11-10T09:00:59+09:00', {}],
    ];
    for (const [now, expected] of nows) {
      const { rows } = await pool.query(
        `SELECT t.id, t.completed, t.start_at, t.end_at, ${todoStatusSql(1)} AS s FROM todos t`,
        [new Date(now)],
      );
      expect(rows).toHaveLength(4);
      for (const r of rows) {
        const js = getStatus({ completed: r.completed, startAt: r.start_at, endAt: r.end_at }, new Date(now));
        expect(r.s, `${now} ${r.id}`).toBe(js);
        if (expected[r.id]) expect(r.s).toBe(expected[r.id]);
        if (r.id === X3.id) expect(r.s).toBe('COMPLETED');
      }
    }
  });
});

describe('GET /api/todos 파라미터 검증', () => {
  const m = (s) => s.marketing.id;
  it.each([
    ['limit=101', () => 'limit=101', 'limit'],
    ['limit=0', () => 'limit=0', 'limit'],
    ['limit=-1', () => 'limit=-1', 'limit'],
    ['limit=1.5', () => 'limit=1.5', 'limit'],
    ['limit=abc', () => 'limit=abc', 'limit'],
    ['offset=-1', () => 'offset=-1', 'offset'],
    ['status=DONE', () => 'status=DONE', 'status'],
    ['status=overdue', () => 'status=overdue', 'status'],
    ['status= (빈 값)', () => 'status=', 'status'],
    ['teamId=abc', () => 'teamId=abc', 'teamId'],
    ['userId= (빈 값)', () => 'userId=', 'userId'],
    ['정의 안 된 키 sort', () => 'sort=title', 'sort'],
    ['teamId 반복(배열)', (s) => `teamId=${m(s)}&teamId=${m(s)}`, 'teamId'],
    ['teamId와 userId 동시', (s) => `teamId=${m(s)}&userId=${s.A.id}`, 'userId'],
  ])('S-05 %s는 400 VALIDATION_ERROR', async (_n, q, field) => {
    const s = await setupScenario();
    const res = await get(s.A, q(s));
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty(field);
  });

  it.each(['limit=100', 'limit=1', 'offset=0', ''])('허용 경계 "%s"는 200 {items,total}', async (q) => {
    const { A } = await setupScenario();
    const res = await get(A, q);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['items', 'total']);
  });
});

describe('GET /api/todos 캘린더', () => {
  it('FR-08 #3 겹침 구간 [from,to), 키는 items·truncated, 시작순', async () => {
    const { A } = await setupScenario();
    const mk = (startAt, endAt) => createTodo({ ownerId: A.id, startAt, endAt });
    const K1 = await mk('2026-10-30T09:00+09:00', '2026-11-02T18:00+09:00');
    const K2 = await mk('2026-10-24T00:00+09:00', FROM);
    await mk(TO, '2026-12-08T00:00+09:00');
    await mk('2026-10-20T00:00+09:00', '2026-10-25T23:59+09:00');
    const res = await get(A, { from: FROM, to: TO });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['items', 'truncated']);
    expect(ids(res)).toEqual([K2.id, K1.id]);
    expect(res.body.truncated).toBe(false);
  });

  it('EX-39 43일 범위는 400 fields.to', async () => {
    const { A } = await setupScenario();
    const res = await get(A, { from: FROM, to: '2026-12-08T00:00+09:00' });
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty('to');
  });

  it('S-03 42일 판정은 요청자 시간대의 달력 날짜 (서머타임 포함)', async () => {
    await setupScenario();
    const E = await createUser({ timezone: 'America/New_York' });
    expect((await get(E, { from: '2026-10-25T00:00-04:00', to: '2026-12-06T00:00-05:00' })).status).toBe(200);
    expectError(await get(E, { from: FROM, to: TO }), 400, 'VALIDATION_ERROR');
    expectError(
      await get(E, { from: '2026-10-25T00:00-04:00', to: '2026-12-07T00:00-05:00' }),
      400,
      'VALIDATION_ERROR',
    );
  });

  it.each([
    ['from만', { from: FROM }],
    ['to만', { to: TO }],
    ['from = to', { from: FROM, to: FROM }],
    ['from > to', { from: TO, to: FROM }],
    ['날짜만 from', { from: '2026-10-26', to: TO }],
    ['오프셋 없는 from', { from: '2026-10-26T00:00', to: TO }],
    ['limit 동반', { from: FROM, to: '2026-11-02T00:00+09:00', limit: 10 }],
    ['offset 동반', { from: FROM, to: '2026-11-02T00:00+09:00', offset: 0 }],
  ])('S-03 %s는 400 VALIDATION_ERROR', async (_n, q) => {
    const { A } = await setupScenario();
    expectError(await get(A, q), 400, 'VALIDATION_ERROR');
  });

  it('OPS-16 501건이면 500건 + truncated true, 500건이면 false', async () => {
    const { A } = await setupScenario();
    await bulk({
      ownerId: A.id,
      n: 501,
      startAt: '2026-11-01T00:00+09:00',
      endAt: '2026-11-01T00:01+09:00',
    });
    const res = await get(A, NOV);
    expect(res.body.items).toHaveLength(500);
    expect(res.body.truncated).toBe(true);
    expect(res.body.items[499].title).toBe('t500');
    await pool.query(`DELETE FROM todos WHERE title = 't501'`);
    const again = await get(A, NOV);
    expect(again.body.items).toHaveLength(500);
    expect(again.body.truncated).toBe(false);
  });
});

describe('GET /api/todos 쿼리 수·인증', () => {
  it('OPS-17 쿼리 수는 건수와 무관하고 2 이하 (목록·캘린더)', async () => {
    const { A, marketing } = await setupScenario();
    const count = async (query) => {
      const spy = vi.spyOn(pool, 'query');
      spy.mockClear();
      expect((await get(A, query)).status).toBe(200);
      const n = spy.mock.calls.length;
      spy.mockRestore();
      return n;
    };
    const mk = (title) =>
      createTodo({
        ownerId: A.id,
        title,
        startAt: '2026-11-04T00:00+09:00',
        endAt: '2026-11-04T23:59+09:00',
        sharedTeamIds: [marketing.id],
      });
    await mk('a');
    await mk('b');
    const small = { list: await count(), cal: await count(NOV) };
    await bulk({ ownerId: A.id, n: 40, startAt: '2026-11-05T00:00+09:00', endAt: '2026-11-05T01:00+09:00' });
    await pool.query(
      `INSERT INTO todo_shares (todo_id, team_id) SELECT id, $1 FROM todos WHERE owner_id = $2 AND title LIKE 't%'`,
      [marketing.id, A.id],
    );
    const big = { list: await count(), cal: await count(NOV) };
    expect(big).toEqual(small);
    expect(small.list).toBeLessThanOrEqual(2);
    expect(small.cal).toBeLessThanOrEqual(2);
  });

  it('인증 없이 목록·단건은 401', async () => {
    expect((await request(app).get('/api/todos')).status).toBe(401);
    expect((await request(app).get(`/api/todos/${randomUUID()}`)).status).toBe(401);
  });
});
