import { withTransaction } from '../config/db.js';
import { AppError } from '../domain/errors.js';
import { formatOffset, normalizePeriod } from '../domain/period.js';
import { getStatus } from '../domain/todo-status.js';
import * as todosRepo from '../repositories/todos.repo.js';
import * as categoriesService from './categories.service.js';
import * as teamsService from './teams.service.js';
import * as usersService from './users.service.js';

// 할일 응답은 반드시 이 함수로 만든다. 비소유자 category 제거는 여기 한 곳(SEC-06)
function toTodoResponse(row, timezone, now) {
  const { category, ...rest } = row;
  return {
    ...rest,
    startAt: formatOffset(row.startAt, timezone),
    endAt: formatOffset(row.endAt, timezone),
    completedAt: row.completedAt ? formatOffset(row.completedAt, timezone) : null,
    status: getStatus(row, now),
    ...(row.isOwner ? { category } : {}),
  };
}

export async function createTodo(requesterId, input) {
  const ownerId = input.ownerId ?? requesterId;
  const proxy = ownerId !== requesterId;
  const { teamId } = input;
  if (proxy && !teamId) {
    throw AppError.of('VALIDATION_ERROR', { ownerId: '팀을 고른 경우에만 다른 소유자를 지정할 수 있습니다.' });
  }
  if (proxy && input.sharedTeamIds !== undefined) {
    throw AppError.of('VALIDATION_ERROR', { sharedTeamIds: '대리 등록에서는 공유 팀을 지정할 수 없습니다.' });
  }

  // 없는 팀 ID도 비구성원과 같게 취급
  if (teamId) {
    const role = await teamsService.getRole(teamId, requesterId);
    if (!role) throw AppError.of('INVALID_SHARE_TEAM');
    if (proxy && role !== 'OWNER' && role !== 'MANAGER') throw AppError.of('FORBIDDEN');
    if (proxy && !(await teamsService.getRole(teamId, ownerId))) throw AppError.of('INVALID_OWNER');
  }

  let category;
  if (proxy) {
    if (input.categoryId !== undefined) throw AppError.of('FORBIDDEN');
    category = await categoriesService.getDefaultCategory(ownerId);
  } else {
    category = input.categoryId
      ? await categoriesService.assertOwnCategory(ownerId, input.categoryId)
      : await categoriesService.getDefaultCategory(ownerId);
  }

  const sharedTeamIds = proxy ? [teamId] : (input.sharedTeamIds ?? (teamId ? [teamId] : []));
  if (!proxy) await teamsService.assertAllMemberTeams(ownerId, sharedTeamIds);

  // '오늘'은 요청자 시간대 기준(R4, C-19)
  const { timezone } = await usersService.getMe(requesterId);
  const now = new Date();
  const { startAt, endAt } = normalizePeriod({ startAt: input.startAt, endAt: input.endAt }, timezone, now);

  // shortcut: 팀·카테고리 확인이 트랜잭션 밖이라 동시 구성원 제거·카테고리 삭제와 겹치면 공유가 남거나 23503으로 500(롤백, 손실 없음), 문제되면 트랜잭션 안 FOR SHARE로 이동
  const row = await withTransaction(async (client) => {
    const id = await todosRepo.insertTodo(client, {
      ownerId,
      categoryId: category.id,
      title: input.title,
      description: input.description,
      startAt,
      endAt,
    });
    await todosRepo.insertShares(client, { todoId: id, teamIds: sharedTeamIds });
    // API-13: CREATED 이력 INSERT 자리(같은 트랜잭션, actor = requesterId)
    return todosRepo.findTodoForViewer(client, { todoId: id, viewerId: requesterId });
  });
  return toTodoResponse(row, timezone, now);
}
