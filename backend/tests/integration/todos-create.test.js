import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import * as todosRepo from '../../src/repositories/todos.repo.js';
import { truncateAll, createUser, createCategory, addMember } from './helpers/db.js';
import { setupScenario } from './helpers/scenario.js';
import { agentFor } from './helpers/agent.js';

const URL = '/api/todos';
const post = (u, body) => agentFor(u.id).post(URL).send(body);
const countRows = async (table) => Number((await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
const todoRow = async (id) => (await pool.query('SELECT * FROM todos WHERE id = $1', [id])).rows[0];
const sharesOf = async (todoId) =>
  (await pool.query('SELECT team_id FROM todo_shares WHERE todo_id = $1 ORDER BY team_id', [todoId])).rows.map(
    (r) => r.team_id,
  );
const expectError = (res, status, code) => {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
};
const expectNoTodo = async () => expect(await countRows('todos')).toBe(0);

// now 비의존: '오늘'은 요청 전후로 두 번 구해 자정 경계를 허용한다
const today = (tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
// DB를 독립 오라클로: 저장값을 지정 시간대 벽시계로
const local = async (id, tz) =>
  (
    await pool.query(
      `SELECT to_char(start_at AT TIME ZONE $2, 'YYYY-MM-DD"T"HH24:MI') AS s,
              to_char(end_at   AT TIME ZONE $2, 'YYYY-MM-DD"T"HH24:MI') AS e FROM todos WHERE id = $1`,
      [id, tz],
    )
  ).rows[0];
async function withToday(tz, run) {
  const before = today(tz);
  const result = await run();
  return { result, days: [before, today(tz)] };
}

beforeEach(truncateAll);
afterEach(() => vi.restoreAllMocks());
afterAll(() => pool.end());

describe('POST /api/todos 개인 할일 등록', () => {
  it('FR-02 #1 trim 제목, 기본 카테고리, 정확한 응답 키, 공유 0행', async () => {
    const { A } = await setupScenario();
    const res = await post(A, {
      title: '  주간 보고서  ',
      startAt: '2099-01-10T09:00+09:00',
      endAt: '2099-01-10T18:00+09:00',
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: res.body.id,
      title: '주간 보고서',
      description: null,
      startAt: '2099-01-10T09:00+09:00',
      endAt: '2099-01-10T18:00+09:00',
      completed: false,
      completedAt: null,
      status: 'NOT_STARTED',
      owner: { id: A.id, name: 'A' },
      category: { id: A.defaultCategoryId, name: '기본' },
      sharedTeams: [],
      canEdit: true,
      isOwner: true,
    });
    expect((await todoRow(res.body.id)).category_id).toBe(A.defaultCategoryId);
    expect(await countRows('todo_shares')).toBe(0);
  });

  it('카테고리 지정은 대문자 UUID로 보내도 201, 응답과 DB에 반영', async () => {
    const { A } = await setupScenario();
    const work = await createCategory({ ownerId: A.id, name: 'Work' });
    const res = await post(A, { title: 't', categoryId: work.id.toUpperCase() });
    expect(res.status).toBe(201);
    expect(res.body.category).toEqual({ id: work.id, name: 'Work' });
    expect((await todoRow(res.body.id)).category_id).toBe(work.id);
  });

  it.each([
    ['남의 카테고리', (s) => s.B.defaultCategoryId],
    ['없는 카테고리', () => randomUUID()],
  ])('카테고리 지정: %s는 404 NOT_FOUND, 0행', async (_n, pick) => {
    const s = await setupScenario();
    expectError(await post(s.A, { title: 't', categoryId: pick(s) }), 404, 'NOT_FOUND');
    await expectNoTodo();
  });
});

describe('POST /api/todos 기간', () => {
  it('FR-04 #3 기간 생략은 요청자 시간대의 오늘 00:00~23:59', async () => {
    const { A } = await setupScenario();
    const { result: res, days } = await withToday('Asia/Seoul', () => post(A, { title: 't' }));
    expect(res.status).toBe(201);
    const saved = await local(res.body.id, 'Asia/Seoul');
    const d = days.find((x) => saved.s === `${x}T00:00`);
    expect(d).toBeDefined();
    expect(saved).toEqual({ s: `${d}T00:00`, e: `${d}T23:59` });
    expect(res.body.startAt).toBe(`${d}T00:00+09:00`);
    expect(res.body.endAt).toBe(`${d}T23:59+09:00`);
  });

  it('EX-07 종료가 시작보다 이르면 400 INVALID_PERIOD, 0행', async () => {
    const { A } = await setupScenario();
    const res = await post(A, { title: 't', startAt: '2099-11-10T09:00+09:00', endAt: '2099-11-09T23:59+09:00' });
    expectError(res, 400, 'INVALID_PERIOD');
    await expectNoTodo();
  });

  it('R3 시작과 종료가 같은 일시는 201', async () => {
    const { A } = await setupScenario();
    const t = '2099-11-10T09:00+09:00';
    expect((await post(A, { title: 't', startAt: t, endAt: t })).status).toBe(201);
  });

  it('SEC-11 오프셋 없는 일시는 400 VALIDATION_ERROR, fields.startAt', async () => {
    const { A } = await setupScenario();
    const res = await post(A, { title: 't', startAt: '2026-11-04T09:00' });
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty('startAt');
  });

  it.each([
    '2026-02-30',
    '2026-02-30T09:00+09:00',
    '2027-02-29',
    '2026-13-01',
    '2026-11-00',
    '2026-11-04T09:00:30+09:00',
    '2026-11-04T09:00:00.000+09:00',
    '2026-11-04T24:00+09:00',
    '2026-11-04T09:60+09:00',
    '2026-11-04 09:00+09:00',
    '2026-11-04t09:00z',
    '2026-11-04T09:00+0900',
    '20261104',
    1793750400000,
    null,
  ])('SEC-11 startAt %j는 400 VALIDATION_ERROR, fields.startAt', async (startAt) => {
    const { A } = await setupScenario();
    const res = await post(A, { title: 't', startAt });
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty('startAt');
    await expectNoTodo();
  });

  it('SEC-11 endAt 오프셋 없는 일시는 400, fields.endAt', async () => {
    const { A } = await setupScenario();
    const res = await post(A, { title: 't', endAt: '2026-11-04T09:00' });
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty('endAt');
  });

  it('SEC-11 허용 형식: Z·초 :00·윤일 날짜만', async () => {
    const { A } = await setupScenario();
    // 계약 원안의 end 09:00+09:00는 start(09:30 KST)보다 이르러 INVALID_PERIOD가 되므로 10:00으로 조정
    const res = await post(A, { title: 't', startAt: '2099-01-10T00:30Z', endAt: '2099-01-10T10:00:00+09:00' });
    expect(res.status).toBe(201);
    expect(res.body.startAt).toBe('2099-01-10T09:30+09:00');
    expect(res.body.endAt).toBe('2099-01-10T10:00+09:00');
    expect((await post(A, { title: 't', startAt: '2028-02-29' })).status).toBe(201);
  });

  it('R5·S-06 날짜만 값은 시작 00:00, 종료 23:59 (요청자 시간대)', async () => {
    const { A } = await setupScenario();
    const res = await post(A, { title: 't', startAt: '2026-11-04', endAt: '2026-11-05' });
    expect(res.status).toBe(201);
    expect(res.body.startAt).toBe('2026-11-04T00:00+09:00');
    expect(res.body.endAt).toBe('2026-11-05T23:59+09:00');
    const row = await todoRow(res.body.id);
    expect(row.start_at.getTime()).toBe(new Date('2026-11-03T15:00Z').getTime());
    expect(row.end_at.getTime()).toBe(new Date('2026-11-05T14:59Z').getTime());
  });

  it('R4 시작만 주면 종료는 그날 23:59', async () => {
    const { A } = await setupScenario();
    const res = await post(A, { title: 't', startAt: '2099-01-10T09:00+09:00' });
    expect(res.status).toBe(201);
    expect(res.body.endAt).toBe('2099-01-10T23:59+09:00');
    expect(res.body.status).toBe('NOT_STARTED');
  });

  it('EX-08 과거 종료만 주면 시작=종료=그날 23:59, OVERDUE', async () => {
    const { A } = await setupScenario();
    const res = await post(A, { title: 't', endAt: '2020-11-01' });
    expect(res.status).toBe(201);
    expect(res.body.startAt).toBe('2020-11-01T23:59+09:00');
    expect(res.body.endAt).toBe('2020-11-01T23:59+09:00');
    expect(res.body.status).toBe('OVERDUE');
  });

  it('R4 미래 종료만 주면 시작은 오늘 00:00', async () => {
    const { A } = await setupScenario();
    const { result: res, days } = await withToday('Asia/Seoul', () => post(A, { title: 't', endAt: '2099-01-10' }));
    expect(res.status).toBe(201);
    expect(res.body.endAt).toBe('2099-01-10T23:59+09:00');
    expect(days.map((d) => `${d}T00:00+09:00`)).toContain(res.body.startAt);
  });

  it('요청자 시간대 오프셋으로 응답한다 (뉴욕 -05:00)', async () => {
    await setupScenario();
    const E = await createUser({ timezone: 'America/New_York' });
    const res = await post(E, { title: 't', startAt: '2099-01-10T09:00+09:00' });
    expect(res.status).toBe(201);
    expect(res.body.startAt).toBe('2099-01-09T19:00-05:00');
  });
});

describe('POST /api/todos 필드 검증', () => {
  const m = (s) => s.marketing.id;
  it.each([
    ['title 누락', () => ({}), 'title'],
    ['title 공백만', () => ({ title: '   ' }), 'title'],
    ['title 201자', () => ({ title: '가'.repeat(201) }), 'title'],
    ['title 숫자', () => ({ title: 123 }), 'title'],
    ['description 2001자', () => ({ title: 't', description: '가'.repeat(2001) }), 'description'],
    ['completed 정의되지 않은 필드', () => ({ title: 't', completed: true }), 'completed'],
    ['status 정의되지 않은 필드', () => ({ title: 't', status: 'COMPLETED' }), 'status'],
    ['categoryId 형식', () => ({ title: 't', categoryId: 'abc' }), 'categoryId'],
    ['ownerId null', () => ({ title: 't', ownerId: null }), 'ownerId'],
    ['sharedTeamIds 문자열', () => ({ title: 't', sharedTeamIds: 'x' }), 'sharedTeamIds'],
    ['sharedTeamIds 잘못된 원소', () => ({ title: 't', sharedTeamIds: ['abc'] }), 'sharedTeamIds'],
    ['sharedTeamIds 중복', (s) => ({ title: 't', sharedTeamIds: [m(s), m(s)] }), 'sharedTeamIds'],
    [
      'sharedTeamIds 대소문자만 다른 중복',
      (s) => ({ title: 't', sharedTeamIds: [m(s), m(s).toUpperCase()] }),
      'sharedTeamIds',
    ],
    ['sharedTeamIds null', () => ({ title: 't', sharedTeamIds: null }), 'sharedTeamIds'],
  ])('SEC-11 %s는 400 VALIDATION_ERROR', async (_n, body, field) => {
    const s = await setupScenario();
    const res = await post(s.A, body(s));
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty(field);
    await expectNoTodo();
  });

  it('SEC-11 본문이 배열이면 400 VALIDATION_ERROR', async () => {
    const { A } = await setupScenario();
    expectError(await post(A, []), 400, 'VALIDATION_ERROR');
  });

  it('경계 허용: 제목 200자·설명 2000자는 201', async () => {
    const { A } = await setupScenario();
    const res = await post(A, { title: '가'.repeat(200), description: '가'.repeat(2000) });
    expect(res.status).toBe(201);
    expect(res.body.description).toBe('가'.repeat(2000));
  });

  it('경계 허용: 공백만 설명은 null로 저장', async () => {
    const { A } = await setupScenario();
    const res = await post(A, { title: 't', description: '  ' });
    expect(res.status).toBe(201);
    expect(res.body.description).toBeNull();
    expect((await todoRow(res.body.id)).description).toBeNull();
  });

  it('경계 허용: teamId null은 공유 0행 개인 할일 201', async () => {
    const { A } = await setupScenario();
    const res = await post(A, { title: 't', teamId: null });
    expect(res.status).toBe(201);
    expect(res.body.sharedTeams).toEqual([]);
    expect(await countRows('todo_shares')).toBe(0);
  });
});

describe('POST /api/todos 팀 공유', () => {
  it('US-12 #1 teamId를 고르면 그 팀에 기본 공유', async () => {
    const { A, marketing } = await setupScenario();
    const res = await post(A, { title: 't', teamId: marketing.id });
    expect(res.status).toBe(201);
    expect(res.body.sharedTeams).toEqual([{ id: marketing.id, name: '마케팅팀' }]);
    expect(await sharesOf(res.body.id)).toEqual([marketing.id]);
  });

  it('US-12 #3 복수 공유는 이름 오름차순, DB 2행', async () => {
    const { C, marketing, sales } = await setupScenario();
    const res = await post(C, { title: 't', sharedTeamIds: [sales.id, marketing.id] });
    expect(res.status).toBe(201);
    expect(res.body.sharedTeams).toEqual([
      { id: marketing.id, name: '마케팅팀' },
      { id: sales.id, name: '영업팀' },
    ]);
    expect(await sharesOf(res.body.id)).toHaveLength(2);
  });

  it.each([
    ['비구성원 팀을 sharedTeamIds로', (s) => [s.A, { title: 't', sharedTeamIds: [s.sales.id] }]],
    ['비구성원 팀을 teamId로', (s) => [s.A, { title: 't', teamId: s.sales.id }]],
    ['없는 teamId', (s) => [s.A, { title: 't', teamId: randomUUID() }]],
  ])('EX-22 %s는 400 INVALID_SHARE_TEAM, 0행', async (_n, make) => {
    const s = await setupScenario();
    const [u, body] = make(s);
    expectError(await post(u, body), 400, 'INVALID_SHARE_TEAM');
    await expectNoTodo();
    expect(await countRows('todo_shares')).toBe(0);
  });
});

describe('POST /api/todos 대리 등록', () => {
  it('US-13·FR-09 #5 관리자가 구성원 소유로 등록, 응답에 category 없음', async () => {
    const { B, C, marketing } = await setupScenario();
    const res = await post(B, {
      teamId: marketing.id,
      ownerId: C.id,
      title: '보도자료 초안',
      startAt: '2099-11-01T09:00+09:00',
      endAt: '2099-11-07',
    });
    expect(res.status).toBe(201);
    expect(res.body.owner).toEqual({ id: C.id, name: 'C' });
    expect(res.body).not.toHaveProperty('category');
    expect(res.body.isOwner).toBe(false);
    expect(res.body.canEdit).toBe(true);
    expect(res.body.sharedTeams).toEqual([{ id: marketing.id, name: '마케팅팀' }]);
    const row = await todoRow(res.body.id);
    expect(row.owner_id).toBe(C.id);
    expect(row.category_id).toBe(C.defaultCategoryId);
    expect(row.completed).toBe(false);
    expect(await sharesOf(res.body.id)).toEqual([marketing.id]);
  });

  it('C-19 대리 등록의 오늘은 소유자가 아니라 요청자 시간대', async () => {
    const { C, marketing } = await setupScenario();
    const M = await createUser({ timezone: 'America/New_York' });
    await addMember({ teamId: marketing.id, userId: M.id, role: 'MANAGER' });
    const tz = 'America/New_York';
    const { result: res, days } = await withToday(tz, () =>
      post(M, { teamId: marketing.id, ownerId: C.id, title: 't' }),
    );
    expect(res.status).toBe(201);
    const saved = await local(res.body.id, tz);
    const d = days.find((x) => saved.s === `${x}T00:00`);
    expect(d).toBeDefined();
    expect(saved.e).toBe(`${d}T23:59`);
  });

  it('EX-38 팀 소유자(OWNER)도 대리 등록 가능', async () => {
    const { A, C, marketing } = await setupScenario();
    const res = await post(A, { teamId: marketing.id, ownerId: C.id, title: 't' });
    expect(res.status).toBe(201);
    expect(res.body.owner.id).toBe(C.id);
  });

  it.each([
    ['빈 배열', false],
    ['[고른 팀]', true],
  ])('S-07 대리 등록에 sharedTeamIds %s는 400, fields.sharedTeamIds', async (_n, withTeam) => {
    const { B, C, marketing } = await setupScenario();
    const sharedTeamIds = withTeam ? [marketing.id] : [];
    const res = await post(B, { teamId: marketing.id, ownerId: C.id, title: 't', sharedTeamIds });
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty('sharedTeamIds');
    await expectNoTodo();
  });

  it('S-07 teamId 없는 대리 등록은 400, fields.ownerId', async () => {
    const { B, C } = await setupScenario();
    const res = await post(B, { ownerId: C.id, title: 't' });
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty('ownerId');
  });

  it('ownerId에 본인 명시는 본인 등록 취급 (공유 0행)', async () => {
    const { A, marketing } = await setupScenario();
    const res = await post(A, { teamId: marketing.id, ownerId: A.id, title: 't', sharedTeamIds: [] });
    expect(res.status).toBe(201);
    expect(res.body.isOwner).toBe(true);
    expect(res.body).toHaveProperty('category');
    expect(await countRows('todo_shares')).toBe(0);
  });

  it.each([
    ['팀 비구성원 D', (s) => s.D.id],
    ['없는 사용자', () => randomUUID()],
  ])('EX-26 지정 소유자가 %s이면 400 INVALID_OWNER, 0행', async (_n, pick) => {
    const s = await setupScenario();
    expectError(await post(s.B, { teamId: s.marketing.id, ownerId: pick(s), title: 't' }), 400, 'INVALID_OWNER');
    await expectNoTodo();
  });

  it('EX-38 일반 팀원(MEMBER)의 소유자 지정은 403 FORBIDDEN, 0행', async () => {
    const { A, C, marketing } = await setupScenario();
    expectError(await post(C, { teamId: marketing.id, ownerId: A.id, title: 't' }), 403, 'FORBIDDEN');
    await expectNoTodo();
  });

  it('C-15 대리 등록에 categoryId는 403 FORBIDDEN, 0행', async () => {
    const { B, C, marketing } = await setupScenario();
    const res = await post(B, { teamId: marketing.id, ownerId: C.id, title: 't', categoryId: C.defaultCategoryId });
    expectError(res, 403, 'FORBIDDEN');
    await expectNoTodo();
  });
});

describe('POST /api/todos 검사 순서', () => {
  it('팀 검사(INVALID_SHARE_TEAM) > 소유자(INVALID_OWNER) > 카테고리(404) > 공유 팀 > 기간, 형식 400이 최우선', async () => {
    const { A, B, C, D, marketing, sales } = await setupScenario();
    const m = marketing.id;
    const x = randomUUID();
    expectError(await post(D, { teamId: m, ownerId: C.id, title: 't', categoryId: x }), 400, 'INVALID_SHARE_TEAM');
    expectError(await post(B, { teamId: m, ownerId: D.id, title: 't', categoryId: x }), 400, 'INVALID_OWNER');
    expectError(
      await post(A, { title: 't', categoryId: B.defaultCategoryId, sharedTeamIds: [sales.id] }),
      404,
      'NOT_FOUND',
    );
    expectError(
      await post(A, { title: 't', sharedTeamIds: [sales.id], startAt: '2099-01-02', endAt: '2099-01-01' }),
      400,
      'INVALID_SHARE_TEAM',
    );
    expectError(await post(C, { teamId: m, ownerId: A.id, title: '' }), 400, 'VALIDATION_ERROR');
    await expectNoTodo();
  });
});

describe('POST /api/todos 트랜잭션·인증', () => {
  it('공유 INSERT 실패 시 500 INTERNAL_ERROR, todos·todo_shares 모두 롤백', async () => {
    const { A, marketing } = await setupScenario();
    vi.spyOn(todosRepo, 'insertShares').mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expectError(await post(A, { title: 't', teamId: marketing.id }), 500, 'INTERNAL_ERROR');
    await expectNoTodo();
    expect(await countRows('todo_shares')).toBe(0);
  });

  it('인증 없이 POST하면 401', async () => {
    expect((await request(app).post(URL).send({ title: 't' })).status).toBe(401);
  });
});
