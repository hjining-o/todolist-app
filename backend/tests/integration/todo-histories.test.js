import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import * as todoHistoriesRepo from '../../src/repositories/todo-histories.repo.js';
import { truncateAll, createUser, createCategory, createTodo, addMember } from './helpers/db.js';
import { setupScenario } from './helpers/scenario.js';
import { agentFor } from './helpers/agent.js';

// 실행 시각 비의존: 모든 할일은 2099년
const SPAN = { startAt: '2099-01-10T09:00+09:00', endAt: '2099-01-12T18:00+09:00' };
const mk = (o) => createTodo({ ...SPAN, ...o });
const post = async (u, body) => {
  const res = await agentFor(u.id)
    .post('/api/todos')
    .send({ ...SPAN, title: 't', ...body });
  expect(res.status).toBe(201);
  return res.body.id;
};
const patch = (u, id, body) => agentFor(u.id).patch(`/api/todos/${id}`).send(body);
const histRows = async (id) =>
  (
    await pool.query(
      'SELECT action, actor_id, changes FROM todo_histories WHERE todo_id = $1 ORDER BY changed_at, id',
      [id],
    )
  ).rows;
const countHist = async (id) => (await histRows(id)).length;
const hist = (u, id) => agentFor(u.id).get(`/api/todos/${id}/histories`);
const actions = (res) => res.body.items.map((i) => i.action);
const sorted = (a) => [...a].sort();
const expectError = (res, status, code) => {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
};

beforeEach(truncateAll);
afterEach(() => vi.restoreAllMocks());
afterAll(() => pool.end());

describe('이력 기록: 요청마다 정확히 1건', () => {
  it('FR-10 #1~#3 POST·제목 수정·완료·완료 해제가 각각 1건, actor는 모두 A', async () => {
    const { A } = await setupScenario();
    const id = await post(A, {});
    await patch(A, id, { title: '새 제목' });
    await patch(A, id, { completed: true });
    await patch(A, id, { completed: false });
    const rows = await histRows(id);
    expect(rows.map((r) => r.action)).toEqual(['CREATED', 'UPDATED', 'COMPLETED', 'UNCOMPLETED']);
    expect(rows.every((r) => r.actor_id === A.id)).toBe(true);
    expect(rows[0].changes.title).toEqual({ old: null, new: 't' });
    expect(rows[1].changes).toEqual({ title: { old: 't', new: '새 제목' } });
  });

  it('변경 없는 PATCH(같은 title, 이미 완료인데 completed true)는 200이지만 이력 증가 0', async () => {
    const { A } = await setupScenario();
    const id = await post(A, { title: '같은 제목' });
    await patch(A, id, { completed: true });
    const n = await countHist(id);
    expect((await patch(A, id, { title: '같은 제목' })).status).toBe(200);
    expect((await patch(A, id, { completed: true })).status).toBe(200);
    expect((await patch(A, id, { description: '' })).status).toBe(200); // null -> 빈 설명도 변경 아님
    expect(await countHist(id)).toBe(n);
  });

  it('400(INVALID_PERIOD)·403(C의 수정)은 이력 증가 0', async () => {
    const { A, C, marketing } = await setupScenario();
    const id = await post(A, { teamId: marketing.id });
    const n = await countHist(id);
    expectError(await patch(A, id, { endAt: '2099-01-10T08:59+09:00' }), 400, 'INVALID_PERIOD');
    expectError(await patch(C, id, { title: 'x' }), 403, 'FORBIDDEN');
    expect(await countHist(id)).toBe(n);
  });

  it('US-17 #3·US-13 B가 C 할일을 완료하거나 대리 등록하면 actor는 B', async () => {
    const { B, C, marketing } = await setupScenario();
    const id = await post(C, { teamId: marketing.id });
    expect((await patch(B, id, { completed: true })).status).toBe(200);
    const rows = await histRows(id);
    expect(rows.map((r) => [r.action, r.actor_id])).toEqual([
      ['CREATED', C.id],
      ['COMPLETED', B.id],
    ]);

    const proxyId = await post(B, { teamId: marketing.id, ownerId: C.id });
    const proxy = await histRows(proxyId);
    expect(proxy.map((r) => [r.action, r.actor_id])).toEqual([['CREATED', B.id]]);
  });

  it('sharedTeamIds만 바꾸면 UPDATED, changes 키는 sharedTeamIds만', async () => {
    const { A, marketing } = await setupScenario();
    const id = await post(A, {});
    await patch(A, id, { sharedTeamIds: [marketing.id] });
    const rows = await histRows(id);
    expect(rows[1].action).toBe('UPDATED');
    expect(rows[1].changes).toEqual({ sharedTeamIds: { old: [], new: [marketing.id] } });
  });

  // 한계: 이 테스트는 FOR UPDATE 잠금이 빠져도 요청 타이밍에 따라 우연히 통과할 수 있다(경합이 재현되지 않으면 순차 실행과 같다).
  // 잠금 유무를 결정적으로 검증하려면 별도 트랜잭션으로 행을 잡고 대기를 관찰하는 테스트가 필요하다.
  it('FOR UPDATE 같은 할일에 completed true 동시 PATCH 2건은 모두 200, COMPLETED는 정확히 1건', async () => {
    const { A } = await setupScenario();
    const id = await post(A, {});
    const [r1, r2] = await Promise.all([patch(A, id, { completed: true }), patch(A, id, { completed: true })]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    const rows = await histRows(id);
    expect(rows.filter((r) => r.action === 'COMPLETED')).toHaveLength(1);
    expect(rows).toHaveLength(2);
  });

  it('T-04 title과 completed를 함께 바꾸면 1건 COMPLETED, changes에 둘 다', async () => {
    const { A } = await setupScenario();
    const id = await post(A, {});
    await patch(A, id, { title: '새 제목', completed: true });
    const rows = await histRows(id);
    expect(rows).toHaveLength(2);
    expect(rows[1].action).toBe('COMPLETED');
    expect(Object.keys(rows[1].changes).sort()).toEqual(['completed', 'title']);
  });
});

describe('이력 기록 실패', () => {
  it('EX-33 이력 INSERT 실패 시 PATCH는 500, 할일 변경 롤백, 이력 증가 0', async () => {
    const { A } = await setupScenario();
    const T = await mk({ ownerId: A.id, title: '원본' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(todoHistoriesRepo, 'insertHistory').mockRejectedValueOnce(new Error('boom'));
    expectError(await patch(A, T.id, { title: '롤백' }), 500, 'INTERNAL_ERROR');
    expect((await pool.query('SELECT title FROM todos WHERE id = $1', [T.id])).rows[0].title).toBe('원본');
    expect(await countHist(T.id)).toBe(0);
  });

  it('EX-33 이력 INSERT 실패 시 POST도 500, todos 행 없음', async () => {
    const { A, marketing } = await setupScenario();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(todoHistoriesRepo, 'insertHistory').mockRejectedValueOnce(new Error('boom'));
    const res = await agentFor(A.id).post('/api/todos').send({ title: 't', teamId: marketing.id });
    expectError(res, 500, 'INTERNAL_ERROR');
    expect((await pool.query('SELECT count(*) FROM todos')).rows[0].count).toBe('0');
    expect((await pool.query('SELECT count(*) FROM todo_shares')).rows[0].count).toBe('0');
  });
});

describe('GET /api/todos/:todoId/histories 필터', () => {
  it('C-17 US-17 재현: 소유자는 4건 전부, 팀원 B는 category 전용 이력을 못 보고 공유 변경은 sharedTeamIds만', async () => {
    const { A, B, marketing } = await setupScenario();
    const work = await createCategory({ ownerId: A.id, name: 'Work' });
    const id = await post(A, {});
    await patch(A, id, { categoryId: work.id, sharedTeamIds: [marketing.id] });
    await patch(B, id, { completed: true });
    await patch(A, id, { categoryId: A.defaultCategoryId });

    const mine = await hist(A, id);
    expect(mine.status).toBe(200);
    expect(actions(mine)).toEqual(['UPDATED', 'COMPLETED', 'UPDATED', 'CREATED']);
    expect(mine.body.items[0].changes.category).toEqual({
      old: { id: work.id, name: 'Work' },
      new: { id: A.defaultCategoryId, name: '기본' },
    });
    expect(mine.body.items[3].changes).toHaveProperty('category');

    const seen = await hist(B, id);
    expect(seen.status).toBe(200);
    expect(actions(seen)).toEqual(['COMPLETED', 'UPDATED', 'CREATED']);
    expect(Object.keys(seen.body.items[1].changes)).toEqual(['sharedTeamIds']);
    expect(seen.body.items[2].changes).not.toHaveProperty('category');
    expect(seen.body.items[2].changes).toHaveProperty('title');
  });

  it('팀 필터: 마케팅만 속한 A에게 영업팀 제거 이력은 숨김, 응답 어디에도 영업팀 ID 없음', async () => {
    const { A, C, D, marketing, sales } = await setupScenario();
    await addMember({ teamId: marketing.id, userId: D.id }); // D는 두 팀 모두 소속
    const id = await post(C, { sharedTeamIds: [marketing.id, sales.id] });
    await patch(C, id, { sharedTeamIds: [marketing.id] });

    const a = await hist(A, id);
    expect(a.status).toBe(200);
    expect(actions(a)).toEqual(['CREATED']);
    expect(a.body.items[0].changes.sharedTeamIds.new).toEqual([marketing.id]);
    expect(JSON.stringify(a.body)).not.toContain(sales.id);

    const d = await hist(D, id);
    expect(actions(d)).toEqual(['UPDATED', 'CREATED']);
    const { old, new: now } = d.body.items[0].changes.sharedTeamIds;
    expect(sorted(old)).toEqual(sorted([marketing.id, sales.id]));
    expect(now).toEqual([marketing.id]);
  });
});

describe('GET /api/todos/:todoId/histories 응답·권한', () => {
  it('응답 형태: 최신순, actor {id,name}, changedAt과 changes 일시는 +09:00 분 단위', async () => {
    const { A, B, marketing } = await setupScenario();
    const id = await post(A, { teamId: marketing.id });
    await patch(B, id, { startAt: '2099-01-11T10:00+09:00' });
    const res = await hist(A, id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: expect.any(Array) });
    expect(actions(res)).toEqual(['UPDATED', 'CREATED']);
    const [last, first] = res.body.items;
    expect(last.actor).toEqual({ id: B.id, name: 'B' });
    expect(first.actor).toEqual({ id: A.id, name: 'A' });
    expect(typeof last.id).toBe('string');
    for (const i of res.body.items) expect(i.changedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}\+09:00$/);
    expect(last.changes.startAt).toEqual({ old: '2099-01-10T09:00+09:00', new: '2099-01-11T10:00+09:00' });
    expect(first.changes.startAt).toEqual({ old: null, new: '2099-01-10T09:00+09:00' });
    expect(first.changes.endAt.new).toBe('2099-01-12T18:00+09:00');
  });

  it('시간대: 뉴욕 사용자가 조회하면 changedAt·startAt은 -05:00 (changedAt은 실행 시기에 따라 -04:00 허용)', async () => {
    const { A, marketing } = await setupScenario();
    const N = await createUser({ timezone: 'America/New_York' });
    await addMember({ teamId: marketing.id, userId: N.id });
    const id = await post(A, { teamId: marketing.id });
    const res = await hist(N, id);
    expect(res.status).toBe(200);
    expect(res.body.items[0].changedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}-0[45]:00$/);
    expect(res.body.items[0].changes.startAt.new).toBe('2099-01-09T19:00-05:00');
  });

  it('조회 권한: 볼 수 없는 할일·없는 uuid는 404, uuid 아님은 400, 무인증은 401', async () => {
    const { A, D } = await setupScenario();
    const id = await post(A, {});
    expectError(await hist(D, id), 404, 'NOT_FOUND');
    expectError(await hist(A, randomUUID()), 404, 'NOT_FOUND');
    const bad = await hist(A, 'abc');
    expectError(bad, 400, 'VALIDATION_ERROR');
    expect(bad.body.error.fields).toHaveProperty('todoId');
    expect((await request(app).get(`/api/todos/${id}/histories`)).status).toBe(401);
  });

  it('FR-10 #5 할일 삭제 후 이력 0행, 조회는 404', async () => {
    const { A } = await setupScenario();
    const id = await post(A, {});
    await patch(A, id, { title: 'x' });
    expect(await countHist(id)).toBe(2);
    expect((await agentFor(A.id).delete(`/api/todos/${id}`)).status).toBe(204);
    expect(await countHist(id)).toBe(0);
    expectError(await hist(A, id), 404, 'NOT_FOUND');
  });

  it('EX-32 이력 수정·삭제 경로는 404', async () => {
    const { A } = await setupScenario();
    const id = await post(A, {});
    const a = agentFor(A.id);
    expectError(await a.patch(`/api/todos/${id}/histories`).send({ title: 'x' }), 404, 'NOT_FOUND');
    expectError(await a.delete(`/api/todos/${id}/histories`), 404, 'NOT_FOUND');
    expectError(await a.delete(`/api/todos/${id}/histories/${randomUUID()}`), 404, 'NOT_FOUND');
    expect(await countHist(id)).toBe(1);
  });
});
