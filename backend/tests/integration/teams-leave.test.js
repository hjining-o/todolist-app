import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import * as teamsRepo from '../../src/repositories/teams.repo.js';
import { truncateAll, createTeam, addMember, createTodo } from './helpers/db.js';
import { setupScenario } from './helpers/scenario.js';
import { agentFor } from './helpers/agent.js';

const leave = (t) => `/api/teams/${t}/leave`;
const memberRows = async (teamId) =>
  (await pool.query('SELECT user_id, role FROM team_members WHERE team_id = $1 ORDER BY user_id', [teamId])).rows;
const roleOf = async (teamId, userId) =>
  (await pool.query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId])).rows[0]
    ?.role;
const ownersOf = async (teamId) =>
  (await pool.query("SELECT user_id FROM team_members WHERE team_id = $1 AND role = 'OWNER'", [teamId])).rows.map(
    (r) => r.user_id,
  );
const countRows = async (table) => Number((await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
const sharesOf = async (todoId) =>
  (await pool.query('SELECT team_id FROM todo_shares WHERE todo_id = $1', [todoId])).rows.map((r) => r.team_id);
const expectError = (res, status, code) => {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
};

// A를 영업팀 MEMBER로 넣고, a1(마케팅·영업) a2(마케팅) a3(비공유) c1(C, 마케팅) 할일을 만든다
async function seedLeave(s) {
  const { A, C, marketing, sales } = s;
  await addMember({ teamId: sales.id, userId: A.id });
  return {
    a1: await createTodo({ ownerId: A.id, title: 'a1', sharedTeamIds: [marketing.id, sales.id] }),
    a2: await createTodo({ ownerId: A.id, title: 'a2', sharedTeamIds: [marketing.id] }),
    a3: await createTodo({ ownerId: A.id, title: 'a3' }),
    c1: await createTodo({ ownerId: C.id, title: 'c1', sharedTeamIds: [marketing.id] }),
  };
}

beforeEach(truncateAll);
afterEach(() => vi.restoreAllMocks());
afterAll(() => pool.end());

describe('소유자의 팀 나가기 POST /api/teams/:teamId/leave', () => {
  it('EX-36 나 혼자인 팀은 지정 여부·대상과 무관하게 409 NO_NEXT_OWNER', async () => {
    const s = await setupScenario();
    const solo = await createTeam({ ownerId: s.A.id, name: '혼자팀' });
    const agent = agentFor(s.A.id);
    const bodies = [undefined, {}, { nextOwnerId: s.B.id }, { nextOwnerId: s.A.id }];
    for (const body of bodies) {
      const req = agent.post(leave(solo.id));
      expectError(await (body ? req.send(body) : req), 409, 'NO_NEXT_OWNER');
    }
    expect(await ownersOf(solo.id)).toEqual([s.A.id]);
  });

  it('EX-29 ② 다른 구성원이 있는데 nextOwnerId를 안 주면 409 OWNER_MUST_TRANSFER', async () => {
    const s = await setupScenario();
    const before = await memberRows(s.marketing.id);
    const agent = agentFor(s.A.id);
    expectError(await agent.post(leave(s.marketing.id)), 409, 'OWNER_MUST_TRANSFER');
    expectError(await agent.post(leave(s.marketing.id)).send({}), 409, 'OWNER_MUST_TRANSFER');
    expect(await memberRows(s.marketing.id)).toEqual(before);
  });

  it('EX-41 지정 대상이 비구성원·없는 사용자·자기 자신이면 400 INVALID_OWNER', async () => {
    const s = await setupScenario();
    const before = await memberRows(s.marketing.id);
    const agent = agentFor(s.A.id);
    for (const nextOwnerId of [s.D.id, randomUUID(), s.A.id]) {
      expectError(await agent.post(leave(s.marketing.id)).send({ nextOwnerId }), 400, 'INVALID_OWNER');
    }
    expect(await memberRows(s.marketing.id)).toEqual(before);
  });

  it('EX-40 소유자가 아닌 구성원(MEMBER·MANAGER)은 409보다 먼저 403 FORBIDDEN, 변화 없음', async () => {
    const s = await setupScenario();
    const before = await memberRows(s.marketing.id);
    const c = agentFor(s.C.id);
    expectError(await c.post(leave(s.marketing.id)).send({ nextOwnerId: s.B.id }), 403, 'FORBIDDEN');
    expectError(await c.post(leave(s.marketing.id)), 403, 'FORBIDDEN');
    expectError(await agentFor(s.B.id).post(leave(s.marketing.id)).send({ nextOwnerId: s.C.id }), 403, 'FORBIDDEN');
    expect(await memberRows(s.marketing.id)).toEqual(before);
  });

  it('EX-40 비구성원·없는 팀은 404 NOT_FOUND', async () => {
    const s = await setupScenario();
    expectError(await agentFor(s.D.id).post(leave(s.marketing.id)).send({ nextOwnerId: s.B.id }), 404, 'NOT_FOUND');
    expectError(await agentFor(s.A.id).post(leave(randomUUID())), 404, 'NOT_FOUND');
  });

  it('V 입력 검증: 형식 오류는 400 VALIDATION_ERROR이며 비구성원이어도 404보다 먼저', async () => {
    const s = await setupScenario();
    const agent = agentFor(s.A.id);
    const before = await memberRows(s.marketing.id);

    const badTeam = await agent.post(leave('abc')).send({ nextOwnerId: s.B.id });
    expectError(badTeam, 400, 'VALIDATION_ERROR');
    expect(badTeam.body.error.fields).toHaveProperty('teamId');

    const bad = [
      [{ nextOwnerId: 'x' }, 'nextOwnerId'],
      [{ nextOwnerId: 1 }, 'nextOwnerId'],
      [{ nextOwnerId: [s.B.id] }, 'nextOwnerId'],
      [{ nextOwnerId: null }, 'nextOwnerId'],
      [{ nextOwnerId: s.B.id, foo: 1 }, 'foo'],
    ];
    for (const [body, field] of bad) {
      const res = await agent.post(leave(s.marketing.id)).send(body);
      expectError(res, 400, 'VALIDATION_ERROR');
      expect(res.body.error.fields).toHaveProperty(field);
    }

    expectError(await agentFor(s.D.id).post(leave(s.marketing.id)).send({ nextOwnerId: 'x' }), 400, 'VALIDATION_ERROR');
    expect(await memberRows(s.marketing.id)).toEqual(before);
  });

  it('성공(MEMBER 승격) + R21 이 팀 공유만 해제, 204 본문 없음', async () => {
    const s = await setupScenario();
    const { a1, a2, a3, c1 } = await seedLeave(s);
    const todosBefore = await countRows('todos');

    const res = await agentFor(s.A.id).post(leave(s.marketing.id)).send({ nextOwnerId: s.C.id });
    expect(res.status).toBe(204);
    expect(res.text ?? '').toBe('');

    expect(await ownersOf(s.marketing.id)).toEqual([s.C.id]);
    expect(await roleOf(s.marketing.id, s.A.id)).toBeUndefined();
    expect(await roleOf(s.marketing.id, s.B.id)).toBe('MANAGER');
    expect(await roleOf(s.sales.id, s.D.id)).toBe('OWNER');

    expect(await sharesOf(a1.id)).toEqual([s.sales.id]);
    expect(await sharesOf(a2.id)).toEqual([]);
    expect(await sharesOf(a3.id)).toEqual([]);
    expect(await sharesOf(c1.id)).toEqual([s.marketing.id]);
    expect(await countRows('todos')).toBe(todosBefore);

    const aTeams = await agentFor(s.A.id).get('/api/teams');
    expect(aTeams.body.items.map((t) => t.name)).toEqual(['영업팀']);
    const cTeams = await agentFor(s.C.id).get('/api/teams');
    expect(cTeams.body.items.find((t) => t.id === s.marketing.id).role).toBe('OWNER');
  });

  it('성공(MANAGER 승격) 대문자 uuid도 통과, 나머지 역할은 그대로', async () => {
    const s = await setupScenario();
    const res = await agentFor(s.A.id).post(leave(s.marketing.id)).send({ nextOwnerId: s.B.id.toUpperCase() });
    expect(res.status).toBe(204);
    expect(await ownersOf(s.marketing.id)).toEqual([s.B.id]);
    expect(await roleOf(s.marketing.id, s.C.id)).toBe('MEMBER');
  });

  it.each(['updateMemberRole', 'deleteOwnerSharesInTeam'])(
    '롤백: %s 실패 시 500 INTERNAL_ERROR, 소유자·구성원·공유 원래대로',
    async (fn) => {
      const s = await setupScenario();
      const { a1, a2 } = await seedLeave(s);
      const before = await memberRows(s.marketing.id);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(teamsRepo, fn).mockRejectedValueOnce(new Error('boom'));

      const res = await agentFor(s.A.id).post(leave(s.marketing.id)).send({ nextOwnerId: s.C.id });
      expectError(res, 500, 'INTERNAL_ERROR');

      expect(await roleOf(s.marketing.id, s.A.id)).toBe('OWNER');
      expect(await roleOf(s.marketing.id, s.C.id)).toBe('MEMBER');
      expect(await ownersOf(s.marketing.id)).toEqual([s.A.id]);
      expect(await memberRows(s.marketing.id)).toEqual(before);
      expect((await sharesOf(a1.id)).sort()).toEqual([s.marketing.id, s.sales.id].sort());
      expect(await sharesOf(a2.id)).toEqual([s.marketing.id]);
    },
  );

  it('경합 가드: 승격 대상이 사라져 UPDATE가 null이면 400 INVALID_OWNER, 삭제도 롤백', async () => {
    const s = await setupScenario();
    vi.spyOn(teamsRepo, 'updateMemberRole').mockResolvedValueOnce(null);

    const res = await agentFor(s.A.id).post(leave(s.marketing.id)).send({ nextOwnerId: s.C.id });
    expectError(res, 400, 'INVALID_OWNER');
    expect(await ownersOf(s.marketing.id)).toEqual([s.A.id]);
  });

  it('경합 가드: 내 구성원 행 DELETE가 0행이면 404 NOT_FOUND', async () => {
    const s = await setupScenario();
    vi.spyOn(teamsRepo, 'deleteMember').mockResolvedValueOnce(0);

    const res = await agentFor(s.A.id).post(leave(s.marketing.id)).send({ nextOwnerId: s.C.id });
    expectError(res, 404, 'NOT_FOUND');
    expect(await ownersOf(s.marketing.id)).toEqual([s.A.id]);
  });

  it('동시 leave 2건은 [204, 404], OWNER는 정확히 1명이고 A는 없다', async () => {
    const s = await setupScenario();
    const a = agentFor(s.A.id);
    const results = await Promise.all([
      a.post(leave(s.marketing.id)).send({ nextOwnerId: s.B.id }),
      a.post(leave(s.marketing.id)).send({ nextOwnerId: s.C.id }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([204, 404]);
    const owners = await ownersOf(s.marketing.id);
    expect(owners).toHaveLength(1);
    expect([s.B.id, s.C.id]).toContain(owners[0]);
    expect(await roleOf(s.marketing.id, s.A.id)).toBeUndefined();
  });

  it('인증 없이 호출하면 401', async () => {
    const s = await setupScenario();
    expectError(await request(app).post(leave(s.marketing.id)), 401, 'UNAUTHENTICATED');
  });
});
