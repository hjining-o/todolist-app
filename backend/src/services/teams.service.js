import { pool, withTransaction } from '../config/db.js';
import { AppError } from '../domain/errors.js';
import * as teamsRepo from '../repositories/teams.repo.js';
import * as usersService from './users.service.js';

// 매 요청 DB 조회라 역할 변경이 즉시 반영된다(SEC-03)
export function getRole(teamId, userId) {
  return teamsRepo.findRole(pool, { teamId, userId });
}

async function assertMember(teamId, userId) {
  const role = await getRole(teamId, userId);
  if (!role) throw AppError.of('NOT_FOUND');
  return role;
}

async function assertOwner(teamId, userId) {
  if ((await assertMember(teamId, userId)) !== 'OWNER') throw AppError.of('FORBIDDEN');
}

export async function assertAllMemberTeams(userId, teamIds) {
  const mine = new Set(await teamsRepo.listTeamIdsOfUser(pool, userId));
  if (teamIds.some((id) => !mine.has(id))) throw AppError.of('INVALID_SHARE_TEAM');
}

export function listMyTeams(userId) {
  return teamsRepo.listTeamsOfUser(pool, userId);
}

export async function createTeam(userId, { name }) {
  try {
    return await withTransaction(async (client) => {
      const team = await teamsRepo.insertTeam(client, name);
      await teamsRepo.insertMember(client, { teamId: team.id, userId, role: 'OWNER' });
      return { ...team, role: 'OWNER' };
    });
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'uq_teams_name_lower') throw AppError.of('TEAM_NAME_TAKEN');
    throw err;
  }
}

export async function listMembers(requesterId, teamId) {
  await assertMember(teamId, requesterId);
  return teamsRepo.listMembers(pool, teamId);
}

export async function addMember(requesterId, teamId, { email, role }) {
  await assertOwner(teamId, requesterId);
  const user = await usersService.findByEmailWithHash(email);
  if (!user) throw AppError.of('USER_NOT_FOUND');
  try {
    await teamsRepo.insertMember(pool, { teamId, userId: user.id, role });
  } catch (err) {
    // 사전 SELECT 없이 PK로 판정해 동시 추가에도 안전
    if (err.code === '23505' && err.constraint === 'team_members_pkey') throw AppError.of('ALREADY_MEMBER');
    throw err;
  }
  return { userId: user.id, name: user.name, email: user.email, role };
}

export async function changeMemberRole(requesterId, teamId, userId, role) {
  await assertOwner(teamId, requesterId);
  if (userId === requesterId) {
    throw AppError.of('VALIDATION_ERROR', { userId: '소유자 자신의 역할은 바꿀 수 없습니다.' });
  }
  const member = await teamsRepo.updateMemberRole(pool, { teamId, userId, role });
  if (!member) throw AppError.of('NOT_FOUND');
  return member;
}

export async function removeMember(requesterId, teamId, userId) {
  await assertOwner(teamId, requesterId);
  if (userId === requesterId) {
    throw AppError.of('VALIDATION_ERROR', { userId: '자기 자신은 팀 나가기로만 나갈 수 있습니다.' });
  }
  // shortcut: 소유자 확인이 트랜잭션 밖이라 API-14 소유권 이전과 동시에 오면 옛 소유자의 제거가 통과할 수 있음, 문제되면 findRole을 트랜잭션 client로 FOR UPDATE 조회
  await withTransaction(async (client) => {
    if (!(await teamsRepo.deleteMember(client, { teamId, userId }))) throw AppError.of('NOT_FOUND');
    await teamsRepo.deleteOwnerSharesInTeam(client, { teamId, ownerId: userId });
  });
}
