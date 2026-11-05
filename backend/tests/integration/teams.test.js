import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import * as teamsRepo from '../../src/repositories/teams.repo.js';
import { todoCanEdit } from '../../src/repositories/sql/access.js';
import { truncateAll, createUser, createTodo } from './helpers/db.js';
import { setupScenario } from './helpers/scenario.js';
import { agentFor } from './helpers/agent.js';

const TEAMS = '/api/teams';
const members = (t, u) => `${TEAMS}/${t}/members${u ? '/' + u : ''}`;
const memberRows = async (teamId) =>
  (await pool.query('SELECT user_id, role FROM team_members WHERE team_id = $1 ORDER BY user_id', [teamId])).rows;
const roleOf = async (teamId, userId) =>
  (await pool.query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId])).rows[0]
    ?.role;
const countRows = async (table) => Number((await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
const sharesOf = async (todoId) =>
  (await pool.query('SELECT team_id FROM todo_shares WHERE todo_id = $1', [todoId])).rows.map((r) => r.team_id);
const expectError = (res, status, code) => {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
};

// C의 할일: 경쟁사 조사(마케팅·영업), 고객 인터뷰(마케팅), 비공유 / A의 할일(마케팅)
async function seedShares(s) {
  const { A, C, marketing, sales } = s;
  return {
    t1: await createTodo({ ownerId: C.id, title: '경쟁사 조사', sharedTeamIds: [marketing.id, sales.id] }),
    t2: await createTodo({ ownerId: C.id, title: '고객 인터뷰', sharedTeamIds: [marketing.id] }),
    t3: await createTodo({ ownerId: C.id, title: '비공유' }),
    tA: await createTodo({ ownerId: A.id, title: 'A 할일', sharedTeamIds: [marketing.id] }),
  };
}

beforeEach(truncateAll);
afterEach(() => vi.restoreAllMocks());
afterAll(() => pool.end());

describe('팀 목록·생성', () => {
  it('S-13 내 팀만 이름 오름차순, 키는 id·name·role·color, 팀 없으면 빈 배열', async () => {
    const s = await setupScenario();
    const res = await agentFor(s.C.id).get(TEAMS);
    expect(res.status).toBe(200);
    expect(res.body.items.map((t) => [t.name, t.role])).toEqual([
      ['마케팅팀', 'MEMBER'],
      ['영업팀', 'MEMBER'],
    ]);
    for (const t of res.body.items) expect(Object.keys(t).sort()).toEqual(['color', 'id', 'name', 'role']);

    const e = await createUser();
    const empty = await agentFor(e.id).get(TEAMS);
    expect(empty.status).toBe(200);
    expect(empty.body.items).toEqual([]);
  });

  it('FR-09 #1 생성은 trim 이름으로 201, 생성자 OWNER 1행, 내 팀 목록에 포함', async () => {
    const s = await setupScenario();
    const agent = agentFor(s.A.id);
    const res = await agent.post(TEAMS).send({ name: '  디자인팀  ' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: res.body.id, name: '디자인팀', role: 'OWNER', color: null });
    expect(await memberRows(res.body.id)).toEqual([{ user_id: s.A.id, role: 'OWNER' }]);
    const list = await agent.get(TEAMS);
    expect(list.body.items).toContainEqual({ id: res.body.id, name: '디자인팀', role: 'OWNER', color: null });
  });

  it('EX-35 시스템 전체에서 대소문자·공백만 다른 팀 이름은 409 TEAM_NAME_TAKEN', async () => {
    const s = await setupScenario();
    const before = await countRows('teams');
    expectError(await agentFor(s.D.id).post(TEAMS).send({ name: ' 마케팅팀 ' }), 409, 'TEAM_NAME_TAKEN');

    const agent = agentFor(s.A.id);
    expect((await agent.post(TEAMS).send({ name: 'Alpha' })).status).toBe(201);
    expectError(await agent.post(TEAMS).send({ name: 'ALPHA' }), 409, 'TEAM_NAME_TAKEN');
    expect(await countRows('teams')).toBe(before + 1);
  });

  it('V 팀 이름 경계: 50자만 201, 공백만·51자·누락·숫자·정의 안 된 필드·배열은 400', async () => {
    const s = await setupScenario();
    const agent = agentFor(s.A.id);
    const before = await countRows('teams');

    expect((await agent.post(TEAMS).send({ name: '가'.repeat(50) })).status).toBe(201);

    const bad = [
      ['   ', { name: '   ' }, 'name'],
      ['51자', { name: '가'.repeat(51) }, 'name'],
      ['누락', {}, 'name'],
      ['숫자', { name: 1 }, 'name'],
      ['role 필드', { name: 'X', role: 'OWNER' }, 'role'],
    ];
    for (const [, body, field] of bad) {
      const res = await agent.post(TEAMS).send(body);
      expectError(res, 400, 'VALIDATION_ERROR');
      expect(res.body.error.fields).toHaveProperty(field);
    }
    expectError(await agent.post(TEAMS).send([]), 400, 'VALIDATION_ERROR');
    expect(await countRows('teams')).toBe(before + 1);
  });

  it('롤백: 생성 중 구성원 INSERT 실패 시 500 INTERNAL_ERROR, 팀 행도 남지 않는다', async () => {
    const s = await setupScenario();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(teamsRepo, 'insertMember').mockRejectedValueOnce(new Error('boom'));

    expectError(await agentFor(s.A.id).post(TEAMS).send({ name: '롤백팀' }), 500, 'INTERNAL_ERROR');
    expect(errSpy).toHaveBeenCalled();
    expect((await pool.query("SELECT 1 FROM teams WHERE name = '롤백팀'")).rowCount).toBe(0);
  });

  it('인증 없이 GET·POST는 401', async () => {
    expectError(await request(app).get(TEAMS), 401, 'UNAUTHENTICATED');
    expectError(await request(app).post(TEAMS).send({ name: 'X' }), 401, 'UNAUTHENTICATED');
  });
});

describe('구성원 목록', () => {
  it('구성원이면 역할 무관 200, OWNER→MANAGER→MEMBER 순 역할 안 이름순, 키는 userId·name·email·role', async () => {
    const s = await setupScenario();
    const e = await createUser({ email: 'e@example.com', name: '가나다' });
    await pool.query("INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'MEMBER')", [
      s.marketing.id,
      e.id,
    ]);

    const res = await agentFor(s.C.id).get(members(s.marketing.id));
    expect(res.status).toBe(200);
    expect(res.body.items.map((m) => m.userId)).toEqual([s.A.id, s.B.id, s.C.id, e.id]);
    expect(res.body.items.map((m) => m.role)).toEqual(['OWNER', 'MANAGER', 'MEMBER', 'MEMBER']);
    for (const m of res.body.items) expect(Object.keys(m).sort()).toEqual(['email', 'name', 'role', 'userId']);
    expect(res.body.items[3].email).toBe('e@example.com');
  });

  it('비구성원·없는 팀은 404 NOT_FOUND, uuid 형식이 아니면 400', async () => {
    const s = await setupScenario();
    const agent = agentFor(s.D.id);
    expectError(await agent.get(members(s.marketing.id)), 404, 'NOT_FOUND');
    expectError(await agent.get(members(randomUUID())), 404, 'NOT_FOUND');
    expectError(await agent.get(members('abc')), 400, 'VALIDATION_ERROR');
  });
});

describe('구성원 추가', () => {
  it('기본 역할 MEMBER, 이메일은 trim·소문자 후 조회해 201', async () => {
    const s = await setupScenario();
    const e = await createUser({ email: 'e@example.com', name: 'E' });
    const res = await agentFor(s.A.id).post(members(s.marketing.id)).send({ email: ' E@Example.com ' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ userId: e.id, name: 'E', email: 'e@example.com', role: 'MEMBER' });
    expect(await roleOf(s.marketing.id, e.id)).toBe('MEMBER');
  });

  it('role MANAGER 지정 시 201 MANAGER', async () => {
    const s = await setupScenario();
    const e = await createUser({ email: 'e@example.com', name: 'E' });
    const res = await agentFor(s.A.id).post(members(s.marketing.id)).send({ email: 'e@example.com', role: 'MANAGER' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('MANAGER');
    expect(await roleOf(s.marketing.id, e.id)).toBe('MANAGER');
  });

  it('EX-27 가입하지 않은 이메일은 404 USER_NOT_FOUND', async () => {
    const s = await setupScenario();
    const res = await agentFor(s.A.id).post(members(s.marketing.id)).send({ email: 'nobody@example.com' });
    expectError(res, 404, 'USER_NOT_FOUND');
  });

  it('EX-34 이미 구성원(타인·자기 자신)이면 409 ALREADY_MEMBER, 역할 불변', async () => {
    const s = await setupScenario();
    const agent = agentFor(s.A.id);
    for (const email of ['c@example.com', 'a@example.com']) {
      expectError(await agent.post(members(s.marketing.id)).send({ email }), 409, 'ALREADY_MEMBER');
    }
    expect(await roleOf(s.marketing.id, s.C.id)).toBe('MEMBER');
    expect(await roleOf(s.marketing.id, s.A.id)).toBe('OWNER');
  });

  it('V 추가 입력 검증: email·role·정의 안 된 필드는 400 VALIDATION_ERROR', async () => {
    const s = await setupScenario();
    const agent = agentFor(s.A.id);
    const before = await memberRows(s.marketing.id);
    const cases = [
      [{}, 'email'],
      [{ email: 'x' }, 'email'],
      [{ email: `${'a'.repeat(250)}@e.com` }, 'email'],
      [{ email: 'e@example.com', role: 'OWNER' }, 'role'],
      [{ email: 'e@example.com', role: 'manager' }, 'role'],
      [{ email: 'e@example.com', foo: 1 }, 'foo'],
    ];
    for (const [body, field] of cases) {
      const res = await agent.post(members(s.marketing.id)).send(body);
      expectError(res, 400, 'VALIDATION_ERROR');
      expect(res.body.error.fields).toHaveProperty(field);
    }
    expect(await memberRows(s.marketing.id)).toEqual(before);
  });
});

describe('권한: 소유자 전용', () => {
  it.each([
    ['B(관리자)', 'B'],
    ['C(일반)', 'C'],
  ])('EX-28 %s의 추가·역할 변경·제거는 403 FORBIDDEN, DB 변화 없음', async (_n, who) => {
    const s = await setupScenario();
    await createUser({ email: 'e@example.com', name: 'E' });
    const before = await memberRows(s.marketing.id);
    const agent = agentFor(s[who].id);

    expectError(await agent.post(members(s.marketing.id)).send({ email: 'e@example.com' }), 403, 'FORBIDDEN');
    expectError(await agent.patch(members(s.marketing.id, s.C.id)).send({ role: 'MANAGER' }), 403, 'FORBIDDEN');
    expectError(await agent.delete(members(s.marketing.id, s.C.id)), 403, 'FORBIDDEN');
    expect(await memberRows(s.marketing.id)).toEqual(before);
  });

  it('SEC-12 비구성원 D는 추가·역할 변경·제거 모두 404 NOT_FOUND, 400 검증이 먼저', async () => {
    const s = await setupScenario();
    await createUser({ email: 'e@example.com', name: 'E' });
    const before = await memberRows(s.marketing.id);
    const agent = agentFor(s.D.id);

    expectError(await agent.post(members(s.marketing.id)).send({ email: 'e@example.com' }), 404, 'NOT_FOUND');
    expectError(await agent.patch(members(s.marketing.id, s.C.id)).send({ role: 'MANAGER' }), 404, 'NOT_FOUND');
    expectError(await agent.delete(members(s.marketing.id, s.C.id)), 404, 'NOT_FOUND');
    expectError(await agent.patch(members(s.marketing.id, s.C.id)).send({ role: 'OWNER' }), 400, 'VALIDATION_ERROR');
    expect(await memberRows(s.marketing.id)).toEqual(before);
  });
});

describe('역할 변경', () => {
  it('US-15 #1 소유자가 B→MEMBER, C→MANAGER 200, DB 반영, OWNER는 A 1명 그대로', async () => {
    const s = await setupScenario();
    const agent = agentFor(s.A.id);

    const r1 = await agent.patch(members(s.marketing.id, s.B.id)).send({ role: 'MEMBER' });
    expect(r1.status).toBe(200);
    expect(r1.body).toEqual({ userId: s.B.id, name: 'B', email: 'b@example.com', role: 'MEMBER' });
    const r2 = await agent.patch(members(s.marketing.id, s.C.id)).send({ role: 'MANAGER' });
    expect(r2.status).toBe(200);
    expect(r2.body.role).toBe('MANAGER');

    expect(await roleOf(s.marketing.id, s.B.id)).toBe('MEMBER');
    expect(await roleOf(s.marketing.id, s.C.id)).toBe('MANAGER');
    const owners = (await memberRows(s.marketing.id)).filter((m) => m.role === 'OWNER');
    expect(owners).toEqual([{ user_id: s.A.id, role: 'OWNER' }]);
  });

  it('SEC-12 role OWNER·누락은 400 fields.role, C는 MEMBER 그대로', async () => {
    const s = await setupScenario();
    const agent = agentFor(s.A.id);
    for (const body of [{ role: 'OWNER' }, {}]) {
      const res = await agent.patch(members(s.marketing.id, s.C.id)).send(body);
      expectError(res, 400, 'VALIDATION_ERROR');
      expect(res.body.error.fields).toHaveProperty('role');
    }
    expect(await roleOf(s.marketing.id, s.C.id)).toBe('MEMBER');
  });

  it('S-14 소유자 자신은 400, 비구성원 대상은 404, uuid 아니면 400', async () => {
    const s = await setupScenario();
    const agent = agentFor(s.A.id);
    const self = await agent.patch(members(s.marketing.id, s.A.id)).send({ role: 'MEMBER' });
    expectError(self, 400, 'VALIDATION_ERROR');
    expect(self.body.error.fields).toHaveProperty('userId');
    expect(await roleOf(s.marketing.id, s.A.id)).toBe('OWNER');

    expectError(await agent.patch(members(s.marketing.id, s.D.id)).send({ role: 'MEMBER' }), 404, 'NOT_FOUND');
    expectError(await agent.patch(members(s.marketing.id, 'abc')).send({ role: 'MEMBER' }), 400, 'VALIDATION_ERROR');
  });

  it('같은 역할 재지정은 200(멱등)', async () => {
    const s = await setupScenario();
    const res = await agentFor(s.A.id).patch(members(s.marketing.id, s.C.id)).send({ role: 'MEMBER' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('MEMBER');
  });

  it('US-15 #2 역할 변경이 토큰 재발급 없이 즉시 반영된다', async () => {
    const s = await setupScenario();
    const todo = await createTodo({ ownerId: s.C.id, sharedTeamIds: [s.marketing.id] });
    const agentB = agentFor(s.B.id); // 변경 전에 만든 토큰을 변경 후에도 그대로 쓴다
    const canEdit = async () =>
      (await pool.query(`SELECT ${todoCanEdit(1)} AS can_edit FROM todos t WHERE t.id = $2`, [s.B.id, todo.id])).rows[0]
        .can_edit;
    const roleInList = async () => (await agentB.get(TEAMS)).body.items.find((t) => t.id === s.marketing.id).role;

    expect(await roleInList()).toBe('MANAGER');
    expect(await canEdit()).toBe(true);

    const res = await agentFor(s.A.id).patch(members(s.marketing.id, s.B.id)).send({ role: 'MEMBER' });
    expect(res.status).toBe(200);

    expect(await roleInList()).toBe('MEMBER');
    expect(await canEdit()).toBe(false);
    // 실제 HTTP 403(할일 수정 거부)은 API-08에 관리자 전용 동작이 없어 API-11 테스트에서 검증한다
  });
});

describe('구성원 제거', () => {
  it('EX-29 ① 소유자 자신 제거는 400 VALIDATION_ERROR, A는 여전히 OWNER', async () => {
    const s = await setupScenario();
    const res = await agentFor(s.A.id).delete(members(s.marketing.id, s.A.id));
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty('userId');
    expect(await roleOf(s.marketing.id, s.A.id)).toBe('OWNER');
  });

  it('FR-11 #5 / US-15 #3-#6 C 제거 시 C 할일의 마케팅 공유만 해제, 영업팀 공유·할일·타인 공유는 유지', async () => {
    const base = await setupScenario();
    const s = { ...base, t: await seedShares(base) };
    const todosBefore = await countRows('todos');

    const res = await agentFor(s.A.id).delete(members(s.marketing.id, s.C.id));
    expect(res.status).toBe(204);

    expect(await roleOf(s.marketing.id, s.C.id)).toBeUndefined();
    expect(await roleOf(s.sales.id, s.C.id)).toBe('MEMBER');
    expect(await sharesOf(s.t.t1.id)).toEqual([s.sales.id]);
    expect(await sharesOf(s.t.t2.id)).toEqual([]);
    expect(await sharesOf(s.t.t3.id)).toEqual([]);
    expect(await sharesOf(s.t.tA.id)).toEqual([s.marketing.id]);
    expect(await countRows('todos')).toBe(todosBefore);
    for (const who of ['A', 'B']) {
      const list = await agentFor(s[who].id).get(members(s.marketing.id));
      expect(list.body.items.map((m) => m.userId)).not.toContain(s.C.id);
    }
  });

  it('비구성원·없는 uuid는 404 NOT_FOUND, uuid 형식이 아니면 400', async () => {
    const s = await setupScenario();
    const agent = agentFor(s.A.id);
    expectError(await agent.delete(members(s.marketing.id, s.D.id)), 404, 'NOT_FOUND');
    expectError(await agent.delete(members(s.marketing.id, randomUUID())), 404, 'NOT_FOUND');
    expectError(await agent.delete(members(s.marketing.id, 'abc')), 400, 'VALIDATION_ERROR');
  });

  it('롤백: 공유 해제 중 실패 시 500 INTERNAL_ERROR, 구성원 삭제도 되돌려진다', async () => {
    const s = await setupScenario();
    const t = await seedShares(s);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(teamsRepo, 'deleteOwnerSharesInTeam').mockRejectedValueOnce(new Error('boom'));

    expectError(await agentFor(s.A.id).delete(members(s.marketing.id, s.C.id)), 500, 'INTERNAL_ERROR');
    expect(errSpy).toHaveBeenCalled();
    expect(await roleOf(s.marketing.id, s.C.id)).toBe('MEMBER');
    expect(await sharesOf(t.t1.id)).toHaveLength(2);
    expect(await sharesOf(t.t2.id)).toEqual([s.marketing.id]);
  });

  it('소유자는 관리자도 제거할 수 있다 204', async () => {
    const s = await setupScenario();
    const res = await agentFor(s.A.id).delete(members(s.marketing.id, s.B.id));
    expect(res.status).toBe(204);
    expect(await roleOf(s.marketing.id, s.B.id)).toBeUndefined();
  });
});
