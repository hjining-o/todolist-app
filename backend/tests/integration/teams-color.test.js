import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/config/db.js';
import { TEAM_COLORS } from '../../src/domain/team-color.js';
import { truncateAll } from './helpers/db.js';
import { setupScenario } from './helpers/scenario.js';
import { agentFor } from './helpers/agent.js';

const colorUrl = (t) => `/api/teams/${t}/color`;
const expectError = (res, status, code) => {
  expect(res.status).toBe(status);
  expect(res.body.error.code).toBe(code);
};
const colorsOf = async (agent) => Object.fromEntries((await agent.get('/api/teams')).body.items.map((t) => [t.name, t.color]));

beforeEach(truncateAll);
afterAll(() => pool.end());

describe('팀 캘린더 색상 API-15 / DB-06', () => {
  it('GET /api/teams 항목에 color가 있고 기본은 null이다', async () => {
    const s = await setupScenario();
    const res = await agentFor(s.C.id).get('/api/teams');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      { id: s.marketing.id, name: '마케팅팀', role: 'MEMBER', color: null },
      { id: s.sales.id, name: '영업팀', role: 'MEMBER', color: null },
    ]);
  });

  it('일반 팀원(MEMBER)도 자기 색을 바꾸고 갱신된 Team을 받는다', async () => {
    const s = await setupScenario();
    const agent = agentFor(s.C.id);
    const res = await agent.patch(colorUrl(s.marketing.id)).send({ color: 'TEAL' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: s.marketing.id, name: '마케팅팀', role: 'MEMBER', color: 'TEAL' });
    expect(await colorsOf(agent)).toEqual({ 마케팅팀: 'TEAL', 영업팀: null });
  });

  it('A가 바꾼 색은 같은 팀 B의 GET /api/teams에 영향을 주지 않는다', async () => {
    const s = await setupScenario();
    await agentFor(s.A.id).patch(colorUrl(s.marketing.id)).send({ color: 'PINK' }).expect(200);
    expect(await colorsOf(agentFor(s.A.id))).toEqual({ 마케팅팀: 'PINK' });
    expect(await colorsOf(agentFor(s.B.id))).toEqual({ 마케팅팀: null });
    await agentFor(s.B.id).patch(colorUrl(s.marketing.id)).send({ color: 'BLUE' }).expect(200);
    expect(await colorsOf(agentFor(s.A.id))).toEqual({ 마케팅팀: 'PINK' });
  });

  it('비구성원·없는 팀은 404 NOT_FOUND이고 색이 바뀌지 않는다', async () => {
    const s = await setupScenario();
    expectError(await agentFor(s.D.id).patch(colorUrl(s.marketing.id)).send({ color: 'RED' }), 404, 'NOT_FOUND');
    expectError(await agentFor(s.A.id).patch(colorUrl(randomUUID())).send({ color: 'RED' }), 404, 'NOT_FOUND');
    const { rows } = await pool.query('SELECT 1 FROM team_members WHERE color IS NOT NULL');
    expect(rows).toHaveLength(0);
  });

  it('teamId가 uuid가 아니면 400 VALIDATION_ERROR', async () => {
    const s = await setupScenario();
    const res = await agentFor(s.A.id).patch(colorUrl('abc')).send({ color: 'RED' });
    expectError(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.fields.teamId).toBeDefined();
  });

  it.each([
    ['허용 목록 밖(PURPLE)', { color: 'PURPLE' }],
    ['소문자', { color: 'red' }],
    ['null', { color: null }],
    ['누락', {}],
    ['추가 필드', { color: 'RED', role: 'OWNER' }],
  ])('color %s는 400 VALIDATION_ERROR(fields.color)', async (_, body) => {
    const s = await setupScenario();
    const res = await agentFor(s.A.id).patch(colorUrl(s.marketing.id)).send(body);
    expectError(res, 400, 'VALIDATION_ERROR');
    if (!('role' in body)) expect(res.body.error.fields.color).toBeDefined();
    expect(await colorsOf(agentFor(s.A.id))).toEqual({ 마케팅팀: null });
  });

  it('허용 색 8개는 모두 저장된다', async () => {
    const s = await setupScenario();
    for (const color of TEAM_COLORS) {
      const res = await agentFor(s.A.id).patch(colorUrl(s.marketing.id)).send({ color });
      expect(res.body.color).toBe(color);
    }
  });

  it('DB CHECK가 허용 목록 밖 값을 거부한다', async () => {
    const s = await setupScenario();
    await expect(
      pool.query('UPDATE team_members SET color = $1 WHERE team_id = $2 AND user_id = $3', [
        'PURPLE',
        s.marketing.id,
        s.A.id,
      ]),
    ).rejects.toMatchObject({ code: '23514', constraint: 'team_members_color_check' });
  });
});
