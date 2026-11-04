import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import * as todosRepo from '../../src/repositories/todos.repo.js';
import { truncateAll, createCategory, createTodo } from './helpers/db.js';
import { setupScenario } from './helpers/scenario.js';
import { agentFor } from './helpers/agent.js';

const URL = (id) => `/api/todos/${id}`;
const patch = (u, id, body) => agentFor(u.id).patch(URL(id)).send(body);
const del = (u, id) => agentFor(u.id).delete(URL(id));
// 실행 시각 비의존: 모든 할일은 2099년
const SPAN = { startAt: '2099-01-10T09:00+09:00', endAt: '2099-01-12T18:00+09:00' };
const mk = (o) => createTodo({ ...SPAN, ...o });
const todoRow = async (id) => (await pool.query('SELECT * FROM todos WHERE id = $1', [id])).rows[0];
const sharesOf = async (id) =>
  (await pool.query('SELECT team_id FROM todo_shares WHERE todo_id = $1 ORDER BY team_id', [id])).rows.map(
    (r) => r.team_id,
  );
const expectError = (res, status, code) => {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
};
const resetUpdatedAt = (id) => pool.query(`UPDATE todos SET updated_at = '2000-01-01' WHERE id = $1`, [id]);
const sorted = (a) => [...a].sort();

beforeEach(truncateAll);
afterEach(() => vi.restoreAllMocks());
afterAll(() => pool.end());

describe('PATCH /api/todos/:todoId 소유자 수정', () => {
  it('FR-07 #1 소유자 수정: trim 제목·기간·설명 반영, 완료 상태 유지', async () => {
    const { A } = await setupScenario();
    const T = await mk({ ownerId: A.id });
    const res = await patch(A, T.id, {
      title: '  분기 기획안 v2 ',
      startAt: '2099-01-11T10:00+09:00',
      endAt: '2099-01-11T18:00+09:00',
      description: '메모',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: T.id,
      title: '분기 기획안 v2',
      startAt: '2099-01-11T10:00+09:00',
      endAt: '2099-01-11T18:00+09:00',
      description: '메모',
      completed: false,
      status: 'NOT_STARTED',
      isOwner: true,
      category: { id: A.defaultCategoryId, name: '기본' },
    });
    const row = await todoRow(T.id);
    expect(row.title).toBe('분기 기획안 v2');
    expect(row.description).toBe('메모');
    expect(row.start_at.getTime()).toBe(new Date('2099-01-11T10:00+09:00').getTime());
    expect(row.end_at.getTime()).toBe(new Date('2099-01-11T18:00+09:00').getTime());
  });

  it('R3 한쪽만 바꿔도 저장값과 합쳐 검사: 실패 시 DB 불변, 같은 일시는 200', async () => {
    const { A } = await setupScenario();
    const T = await mk({ ownerId: A.id });
    const unchanged = async () => {
      const row = await todoRow(T.id);
      expect(row.start_at.getTime()).toBe(new Date(SPAN.startAt).getTime());
      expect(row.end_at.getTime()).toBe(new Date(SPAN.endAt).getTime());
    };
    expectError(await patch(A, T.id, { endAt: '2099-01-10T08:59+09:00' }), 400, 'INVALID_PERIOD');
    expectError(await patch(A, T.id, { startAt: '2099-01-12T18:01+09:00' }), 400, 'INVALID_PERIOD');
    await unchanged();
    expect((await patch(A, T.id, { startAt: '2099-01-12T18:00+09:00' })).status).toBe(200);
  });

  it('R3 둘 다 역전은 400, 날짜만 종료는 23:59로 보정되고 시작 유지', async () => {
    const { A } = await setupScenario();
    const T = await mk({ ownerId: A.id });
    const bad = { startAt: '2099-02-02T09:00+09:00', endAt: '2099-02-01T09:00+09:00' };
    expectError(await patch(A, T.id, bad), 400, 'INVALID_PERIOD');
    const res = await patch(A, T.id, { endAt: '2099-01-10' });
    expect(res.status).toBe(200);
    expect(res.body.endAt).toBe('2099-01-10T23:59+09:00');
    expect(res.body.startAt).toBe('2099-01-10T09:00+09:00');
  });

  it('FR-07 #2·R7 카테고리는 안 보내면 유지, 보내면 변경', async () => {
    const { A } = await setupScenario();
    const work = await createCategory({ ownerId: A.id, name: 'Work' });
    const T = await mk({ ownerId: A.id, categoryId: work.id });
    const res = await patch(A, T.id, { title: 'x' });
    expect(res.body.category).toEqual({ id: work.id, name: 'Work' });
    expect((await todoRow(T.id)).category_id).toBe(work.id);
    const res2 = await patch(A, T.id, { categoryId: A.defaultCategoryId });
    expect(res2.body.category).toEqual({ id: A.defaultCategoryId, name: '기본' });
    expect((await todoRow(T.id)).category_id).toBe(A.defaultCategoryId);
  });

  it.each([
    ['남의 카테고리', (s) => s.B.defaultCategoryId],
    ['없는 카테고리', () => randomUUID()],
  ])('EX-19 %s는 404 NOT_FOUND, DB 불변', async (_n, pick) => {
    const s = await setupScenario();
    const T = await mk({ ownerId: s.A.id });
    expectError(await patch(s.A, T.id, { categoryId: pick(s) }), 404, 'NOT_FOUND');
    expect((await todoRow(T.id)).category_id).toBe(s.A.defaultCategoryId);
  });

  it('description 비우기: null과 빈 문자열은 모두 null', async () => {
    const { A } = await setupScenario();
    const T = await mk({ ownerId: A.id, description: '메모' });
    const r1 = await patch(A, T.id, { description: null });
    expect(r1.status).toBe(200);
    expect(r1.body.description).toBeNull();
    await pool.query(`UPDATE todos SET description = '메모' WHERE id = $1`, [T.id]);
    const r2 = await patch(A, T.id, { description: '' });
    expect(r2.status).toBe(200);
    expect(r2.body.description).toBeNull();
    expect((await todoRow(T.id)).description).toBeNull();
  });
});

describe('PATCH /api/todos/:todoId 완료 처리', () => {
  it('FR-07 #4·R14 완료·재완료(시각 유지)·완료 해제, 시작 전이어도 완료 가능', async () => {
    const { A } = await setupScenario();
    const T = await mk({ ownerId: A.id });
    const r1 = await patch(A, T.id, { completed: true });
    expect(r1.status).toBe(200);
    expect(r1.body.completed).toBe(true);
    expect(r1.body.status).toBe('COMPLETED');
    expect(r1.body.completedAt).toMatch(/^2\d{3}-.*[+-]\d{2}:\d{2}$/);
    const first = (await todoRow(T.id)).completed_at;
    expect(first).not.toBeNull();

    expect((await patch(A, T.id, { completed: true })).status).toBe(200);
    expect((await todoRow(T.id)).completed_at.getTime()).toBe(first.getTime());

    const r3 = await patch(A, T.id, { completed: false });
    expect(r3.body.completed).toBe(false);
    expect(r3.body.completedAt).toBeNull();
    expect(r3.body.status).toBe('NOT_STARTED');
    expect((await todoRow(T.id)).completed_at).toBeNull();
  });
});

describe('PATCH /api/todos/:todoId 입력 검증', () => {
  it.each([
    ['title 빈 문자열', { title: '' }, 'title'],
    ['title 공백만', { title: '   ' }, 'title'],
    ['title null', { title: null }, 'title'],
    ['title 201자', { title: 'a'.repeat(201) }, 'title'],
    ['status 정의되지 않은 필드', { status: 'COMPLETED' }, 'status'],
    ['completedAt 정의되지 않은 필드', { completedAt: '2099-01-10T09:00+09:00' }, 'completedAt'],
    ['ownerId 정의되지 않은 필드', (s) => ({ ownerId: s.B.id }), 'ownerId'],
    ['teamId 정의되지 않은 필드', (s) => ({ teamId: s.marketing.id }), 'teamId'],
    ['completed 문자열', { completed: 'true' }, 'completed'],
    ['completed null', { completed: null }, 'completed'],
    ['startAt null', { startAt: null }, 'startAt'],
    ['startAt 오프셋 없음', { startAt: '2099-01-10T09:00' }, 'startAt'],
    ['sharedTeamIds 중복', (s) => ({ sharedTeamIds: [s.marketing.id, s.marketing.id] }), 'sharedTeamIds'],
    ['sharedTeamIds 문자열', { sharedTeamIds: 'x' }, 'sharedTeamIds'],
    ['categoryId null', { categoryId: null }, 'categoryId'],
  ])('EX-09 %s는 400 VALIDATION_ERROR, DB 불변', async (_n, body, field) => {
    const s = await setupScenario();
    const T = await mk({ ownerId: s.A.id, sharedTeamIds: [s.marketing.id] });
    const before = await todoRow(T.id);
    const res = await patch(s.A, T.id, typeof body === 'function' ? body(s) : body);
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty(field);
    expect(await todoRow(T.id)).toEqual(before);
  });

  it('S-08 빈 본문은 400 VALIDATION_ERROR', async () => {
    const { A } = await setupScenario();
    const T = await mk({ ownerId: A.id });
    expectError(await patch(A, T.id, {}), 400, 'VALIDATION_ERROR');
  });

  it('S-08 본문 없음·배열은 400 VALIDATION_ERROR', async () => {
    const { A } = await setupScenario();
    const T = await mk({ ownerId: A.id });
    expectError(await agentFor(A.id).patch(URL(T.id)), 400, 'VALIDATION_ERROR');
    expectError(await patch(A, T.id, []), 400, 'VALIDATION_ERROR');
  });

  it('SEC-11 경로 todoId가 uuid가 아니면 400, fields.todoId', async () => {
    const { A } = await setupScenario();
    const res = await patch(A, 'abc', { title: 'x' });
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty('todoId');
  });
});

describe('PATCH·DELETE 권한', () => {
  it('EX-20 일반 팀원은 수정·완료·삭제 모두 403, DB 불변', async () => {
    const { A, C, marketing } = await setupScenario();
    const T = await mk({ ownerId: A.id, title: '원본', sharedTeamIds: [marketing.id] });
    expectError(await patch(C, T.id, { title: 'x' }), 403, 'FORBIDDEN');
    expectError(await patch(C, T.id, { completed: true }), 403, 'FORBIDDEN');
    expectError(await del(C, T.id), 403, 'FORBIDDEN');
    const row = await todoRow(T.id);
    expect(row.title).toBe('원본');
    expect(row.completed).toBe(false);
  });

  it('US-14 #1·#2 관리자가 구성원 할일의 기간·완료를 수정, category 비노출, 공유·카테고리 유지', async () => {
    const { B, C, marketing, sales } = await setupScenario();
    const work = await createCategory({ ownerId: C.id, name: 'Work' });
    const T = await mk({
      ownerId: C.id,
      title: '경쟁사 조사',
      categoryId: work.id,
      sharedTeamIds: [marketing.id, sales.id],
    });
    const r1 = await patch(B, T.id, { startAt: '2099-01-09T09:00+09:00', endAt: '2099-01-09T18:00+09:00' });
    expect(r1.status).toBe(200);
    const res = await patch(B, T.id, { completed: true });
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
    expect(res.body).not.toHaveProperty('category');
    expect(res.body).toMatchObject({
      isOwner: false,
      canEdit: true,
      owner: { id: C.id, name: 'C' },
      sharedTeams: [{ id: marketing.id, name: '마케팅팀' }],
    });
    expect(await sharesOf(T.id)).toEqual(sorted([marketing.id, sales.id]));
    expect((await todoRow(T.id)).category_id).toBe(work.id);
  });

  it('US-14 #3·#4 관리자는 팀 소유자 할일을, 팀 소유자는 관리자 할일을 수정', async () => {
    const { A, B, marketing } = await setupScenario();
    const Ta = await mk({ ownerId: A.id, sharedTeamIds: [marketing.id] });
    const Tb = await mk({ ownerId: B.id, sharedTeamIds: [marketing.id] });
    expect((await patch(B, Ta.id, { title: '캠페인 일정 v2' })).status).toBe(200);
    expect((await patch(A, Tb.id, { title: 'y' })).status).toBe(200);
  });

  it('US-14 #5·FR-06 #2 관리자 삭제는 204, 공유·이력도 함께 삭제', async () => {
    const { B, C, marketing, sales } = await setupScenario();
    const T = await mk({ ownerId: C.id, title: '보도자료 초안', sharedTeamIds: [marketing.id, sales.id] });
    await pool.query(
      `INSERT INTO todo_histories (todo_id, actor_id, action, changes) VALUES ($1, $2, 'CREATED', '{}')`,
      [T.id, C.id],
    );
    const res = await del(B, T.id);
    expect(res.status).toBe(204);
    expect(res.text).toBeFalsy();
    expectError(await agentFor(C.id).get(URL(T.id)), 404, 'NOT_FOUND');
    expect(await sharesOf(T.id)).toEqual([]);
    expect((await pool.query('SELECT 1 FROM todo_histories WHERE todo_id = $1', [T.id])).rowCount).toBe(0);
    const list = await agentFor(C.id)
      .get('/api/todos')
      .query({ from: '2099-01-01T00:00+09:00', to: '2099-02-01T00:00+09:00' });
    expect(list.body.items.map((i) => i.id)).not.toContain(T.id);
  });

  it('EX-23 비소유자의 sharedTeamIds는 값과 무관하게 403(400보다 먼저), 공유 불변', async () => {
    const { A, B, C, marketing } = await setupScenario();
    const T = await mk({ ownerId: C.id, sharedTeamIds: [marketing.id] });
    expectError(await patch(B, T.id, { sharedTeamIds: [marketing.id] }), 403, 'FORBIDDEN');
    expectError(await patch(A, T.id, { sharedTeamIds: [] }), 403, 'FORBIDDEN');
    expectError(await patch(B, T.id, { sharedTeamIds: [randomUUID()] }), 403, 'FORBIDDEN');
    expect(await sharesOf(T.id)).toEqual([marketing.id]);
  });

  it('EX-24 비소유자의 categoryId는 403, 다른 필드와 함께여도 전부 미반영', async () => {
    const { B, C, marketing } = await setupScenario();
    const T = await mk({ ownerId: C.id, title: '원본', sharedTeamIds: [marketing.id] });
    expectError(await patch(B, T.id, { categoryId: C.defaultCategoryId }), 403, 'FORBIDDEN');
    expectError(await patch(B, T.id, { title: 'z', categoryId: C.defaultCategoryId }), 403, 'FORBIDDEN');
    expect((await todoRow(T.id)).title).toBe('원본');
  });

  it('EX-25 관리자도 공유되지 않은 구성원 할일은 404 (수정·삭제)', async () => {
    const { B, C } = await setupScenario();
    const T = await mk({ ownerId: C.id });
    expectError(await patch(B, T.id, { title: 'x' }), 404, 'NOT_FOUND');
    expectError(await del(B, T.id), 404, 'NOT_FOUND');
    expect(await todoRow(T.id)).toBeDefined();
  });

  it('SEC-03 비구성원·없는 할일은 404, 403보다 404가 먼저', async () => {
    const { A, D, marketing } = await setupScenario();
    const T = await mk({ ownerId: A.id, sharedTeamIds: [marketing.id] });
    expectError(await patch(D, T.id, { title: 'x' }), 404, 'NOT_FOUND');
    expectError(await patch(D, T.id, { categoryId: D.defaultCategoryId }), 404, 'NOT_FOUND');
    expectError(await patch(A, randomUUID(), { title: 'x' }), 404, 'NOT_FOUND');
  });

  it('US-15 #2 역할을 MEMBER로 바꾼 직후, 토큰 재발급 없이 같은 agent의 수정·완료·삭제는 403', async () => {
    const { A, B, C, marketing } = await setupScenario();
    const T = await mk({ ownerId: C.id, title: '원본', sharedTeamIds: [marketing.id] });
    const b = agentFor(B.id); // 끝까지 재사용
    expect((await b.patch(URL(T.id)).send({ title: '수정1' })).status).toBe(200);
    const demote = await agentFor(A.id).patch(`/api/teams/${marketing.id}/members/${B.id}`).send({ role: 'MEMBER' });
    expect(demote.status).toBe(200);
    expectError(await b.patch(URL(T.id)).send({ title: '수정2' }), 403, 'FORBIDDEN');
    expectError(await b.patch(URL(T.id)).send({ completed: true }), 403, 'FORBIDDEN');
    expectError(await b.delete(URL(T.id)), 403, 'FORBIDDEN');
    const row = await todoRow(T.id);
    expect(row.title).toBe('수정1');
    expect(row.completed).toBe(false);
  });
});

describe('PATCH /api/todos/:todoId 공유 팀 교체', () => {
  it('R21·FR-11 #4 공유 팀 전체 교체: 응답·DB·가시성 반영, [] 는 전체 해제', async () => {
    const { A, C, D, marketing, sales } = await setupScenario();
    const T = await mk({ ownerId: C.id, sharedTeamIds: [marketing.id] });
    const r1 = await patch(C, T.id, { sharedTeamIds: [sales.id] });
    expect(r1.status).toBe(200);
    expect(r1.body.sharedTeams).toEqual([{ id: sales.id, name: '영업팀' }]);
    expect(await sharesOf(T.id)).toEqual([sales.id]);
    expectError(await agentFor(A.id).get(URL(T.id)), 404, 'NOT_FOUND');
    expect((await agentFor(D.id).get(URL(T.id))).status).toBe(200);

    const r2 = await patch(C, T.id, { sharedTeamIds: [marketing.id, sales.id] });
    expect(r2.body.sharedTeams).toEqual([
      { id: marketing.id, name: '마케팅팀' },
      { id: sales.id, name: '영업팀' },
    ]);
    expect(await sharesOf(T.id)).toHaveLength(2);

    expect((await patch(C, T.id, { sharedTeamIds: [] })).status).toBe(200);
    expect(await sharesOf(T.id)).toEqual([]);
  });

  it('남는 팀의 shared_at은 유지, 빠진 팀 행은 삭제', async () => {
    const { C, marketing, sales } = await setupScenario();
    const T = await mk({ ownerId: C.id, sharedTeamIds: [marketing.id, sales.id] });
    await pool.query(`UPDATE todo_shares SET shared_at = '2000-01-01T00:00Z' WHERE todo_id = $1`, [T.id]);
    expect((await patch(C, T.id, { sharedTeamIds: [marketing.id] })).status).toBe(200);
    const { rows } = await pool.query('SELECT team_id, shared_at FROM todo_shares WHERE todo_id = $1', [T.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].team_id).toBe(marketing.id);
    expect(rows[0].shared_at.getTime()).toBe(new Date('2000-01-01T00:00Z').getTime());
  });

  it('EX-22 속하지 않은 팀이 섞이면 400 INVALID_SHARE_TEAM, 공유 불변', async () => {
    const { A, marketing, sales } = await setupScenario();
    const T = await mk({ ownerId: A.id, sharedTeamIds: [marketing.id] });
    expectError(await patch(A, T.id, { sharedTeamIds: [sales.id] }), 400, 'INVALID_SHARE_TEAM');
    expectError(await patch(A, T.id, { sharedTeamIds: [marketing.id, randomUUID()] }), 400, 'INVALID_SHARE_TEAM');
    expect(await sharesOf(T.id)).toEqual([marketing.id]);
  });

  it('API-11 #1 검사 순서: 카테고리 404 > 공유 팀 400 > 기간 400, 실패 시 DB 불변', async () => {
    const { A, marketing, sales } = await setupScenario();
    const work = await createCategory({ ownerId: A.id, name: 'Work' });
    const T = await mk({ ownerId: A.id });
    const before = await todoRow(T.id);
    const endAt = '2099-01-01T00:00+09:00';
    expectError(await patch(A, T.id, { categoryId: randomUUID(), sharedTeamIds: [sales.id], endAt }), 404, 'NOT_FOUND');
    expectError(
      await patch(A, T.id, { categoryId: work.id, sharedTeamIds: [sales.id], endAt }),
      400,
      'INVALID_SHARE_TEAM',
    );
    expectError(
      await patch(A, T.id, { categoryId: work.id, sharedTeamIds: [marketing.id], endAt }),
      400,
      'INVALID_PERIOD',
    );
    expect(await todoRow(T.id)).toEqual(before);
    expect(await sharesOf(T.id)).toEqual([]);
  });
});

describe('PATCH·DELETE 부수 동작', () => {
  it('E-11 updated_at 갱신: 일반 수정과 공유 팀만 바꾼 수정 모두', async () => {
    const { A, marketing } = await setupScenario();
    const T = await mk({ ownerId: A.id });
    const old = new Date('2000-01-01').getTime();
    await resetUpdatedAt(T.id);
    expect((await patch(A, T.id, { title: 'x' })).status).toBe(200);
    expect((await todoRow(T.id)).updated_at.getTime()).toBeGreaterThan(old);
    await resetUpdatedAt(T.id);
    expect((await patch(A, T.id, { sharedTeamIds: [marketing.id] })).status).toBe(200);
    expect((await todoRow(T.id)).updated_at.getTime()).toBeGreaterThan(old);
  });

  it('동시 삭제로 UPDATE·DELETE가 0행이면 404', async () => {
    const { A } = await setupScenario();
    const T = await mk({ ownerId: A.id });
    vi.spyOn(todosRepo, 'deleteTodo').mockResolvedValueOnce(false);
    expectError(await del(A, T.id), 404, 'NOT_FOUND');
    vi.spyOn(todosRepo, 'updateTodo').mockResolvedValueOnce(false);
    expectError(await patch(A, T.id, { title: 'x' }), 404, 'NOT_FOUND');
  });

  it('저장 시 todos_check 위반(23514)은 400 INVALID_PERIOD로 매핑', async () => {
    const { A } = await setupScenario();
    const T = await mk({ ownerId: A.id });
    const err = Object.assign(new Error('chk'), { code: '23514', constraint: 'todos_check' });
    vi.spyOn(todosRepo, 'updateTodo').mockRejectedValueOnce(err);
    expectError(await patch(A, T.id, { title: 'x' }), 400, 'INVALID_PERIOD');
  });

  it('BE-08 공유 교체 실패 시 500, todos 수정도 롤백', async () => {
    const { A, marketing } = await setupScenario();
    const T = await mk({ ownerId: A.id, title: '원본', sharedTeamIds: [marketing.id] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(todosRepo, 'replaceShares').mockRejectedValueOnce(new Error('boom'));
    expectError(await patch(A, T.id, { title: '롤백', sharedTeamIds: [] }), 500, 'INTERNAL_ERROR');
    expect((await todoRow(T.id)).title).toBe('원본');
    expect(await sharesOf(T.id)).toEqual([marketing.id]);
  });
});

describe('DELETE /api/todos/:todoId', () => {
  it('FR-06 #3 삭제 후 재요청은 404, 비구성원은 404, uuid 아님은 400', async () => {
    const { A, D, marketing } = await setupScenario();
    const T = await mk({ ownerId: A.id });
    const Ts = await mk({ ownerId: A.id, sharedTeamIds: [marketing.id] });
    expect((await del(A, T.id)).status).toBe(204);
    expectError(await del(A, T.id), 404, 'NOT_FOUND');
    expectError(await del(D, Ts.id), 404, 'NOT_FOUND');
    expect(await todoRow(Ts.id)).toBeDefined();
    expectError(await del(A, 'abc'), 400, 'VALIDATION_ERROR');
  });
});

describe('PATCH·DELETE 인증', () => {
  it('SEC-01 인증 없이 PATCH·DELETE하면 401', async () => {
    const id = randomUUID();
    expect((await request(app).patch(URL(id)).send({ title: 'x' })).status).toBe(401);
    expect((await request(app).delete(URL(id))).status).toBe(401);
  });
});
