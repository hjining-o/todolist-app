import { pool, withTransaction } from '../config/db.js';
import { AppError } from '../domain/errors.js';
import { calendarDays, formatOffset, normalizePeriod } from '../domain/period.js';
import { getStatus } from '../domain/todo-status.js';
import * as todosRepo from '../repositories/todos.repo.js';
import * as categoriesService from './categories.service.js';
import * as todoHistoriesService from './todo-histories.service.js';
import * as teamsService from './teams.service.js';
import * as usersService from './users.service.js';

const CALENDAR_MAX = 500;

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
    const after = await todosRepo.findHistorySnapshot(client, id);
    await todoHistoriesService.recordHistory(client, { todoId: id, actorId: requesterId, before: null, after });
    return todosRepo.findTodoForViewer(client, { todoId: id, viewerId: requesterId });
  });
  return toTodoResponse(row, timezone, now);
}

export async function listTodos(requesterId, q) {
  const { timezone } = await usersService.getMe(requesterId);
  const now = new Date();
  const calendar = q.from !== undefined;
  const from = calendar ? new Date(q.from) : undefined;
  const to = calendar ? new Date(q.to) : undefined;
  if (calendar && calendarDays(from, to, timezone) > 42) {
    throw AppError.of('VALIDATION_ERROR', { to: '조회 기간은 42일 이하여야 합니다.' }); // EX-39, S-03
  }
  const { rows, total } = await todosRepo.listTodosForViewer(pool, {
    viewerId: requesterId,
    now,
    teamId: q.teamId,
    userId: q.userId,
    categoryId: q.categoryId,
    status: q.status,
    from,
    to,
    limit: calendar ? CALENDAR_MAX + 1 : (q.limit ?? 50),
    offset: calendar ? 0 : (q.offset ?? 0),
  });
  // 필터(SQL)와 표시(getStatus)가 같은 now를 써서 한 요청 안에서 어긋나지 않는다
  const items = rows.slice(0, CALENDAR_MAX).map((r) => toTodoResponse(r, timezone, now));
  return calendar ? { items, truncated: rows.length > CALENDAR_MAX } : { items, total };
}

export async function getTodo(requesterId, todoId) {
  const { timezone } = await usersService.getMe(requesterId);
  const row = await todosRepo.findTodoForViewer(pool, { todoId, viewerId: requesterId });
  if (!row) throw AppError.of('NOT_FOUND'); // 없음과 볼 수 없음을 구분하지 않는다(R2, EX-21)
  return toTodoResponse(row, timezone, new Date());
}

// 검사 순서: 404 → 403 → 소유자 전용 필드 403 → 카테고리 404 → 공유 팀 400 → 기간 400
export async function updateTodo(requesterId, todoId, input) {
  const { timezone } = await usersService.getMe(requesterId);
  const now = new Date();
  const before = await todosRepo.findTodoForViewer(pool, { todoId, viewerId: requesterId });
  if (!before) throw AppError.of('NOT_FOUND');
  if (!before.canEdit) throw AppError.of('FORBIDDEN');
  // 비소유자가 보내면 값과 관계없이 403
  if (!before.isOwner && (input.categoryId !== undefined || input.sharedTeamIds !== undefined)) {
    throw AppError.of('FORBIDDEN');
  }
  if (input.categoryId !== undefined) await categoriesService.assertOwnCategory(requesterId, input.categoryId);
  if (input.sharedTeamIds !== undefined) await teamsService.assertAllMemberTeams(requesterId, input.sharedTeamIds);

  // 한쪽만 바꿔도 저장값과 합쳐 검사. 날짜만 입력은 요청자 시간대
  let { startAt, endAt } = input;
  if (startAt !== undefined || endAt !== undefined) {
    const p = normalizePeriod({ startAt: startAt ?? before.startAt, endAt: endAt ?? before.endAt }, timezone, now);
    startAt = input.startAt !== undefined ? p.startAt : undefined; // 안 보낸 쪽은 덮어쓰지 않는다
    endAt = input.endAt !== undefined ? p.endAt : undefined;
  }

  // 위 검사는 pool 연결이라 트랜잭션 전에 끝낸다(트랜잭션 연결을 쥔 채 pool 재대여 금지)
  try {
    const row = await withTransaction(async (client) => {
      // 행 잠금: 동시 수정을 직렬화해 old 값과 '이미 완료' 판정을 정확히
      const prev = await todosRepo.findHistorySnapshot(client, todoId, { lock: true });
      if (!prev) throw AppError.of('NOT_FOUND'); // 그 사이 삭제됨
      const updated = await todosRepo.updateTodo(client, { todoId, ...input, startAt, endAt });
      if (!updated) throw AppError.of('NOT_FOUND'); // 그 사이 삭제됨
      if (input.sharedTeamIds !== undefined) {
        await todosRepo.replaceShares(client, { todoId, teamIds: input.sharedTeamIds });
      }
      const next = await todosRepo.findHistorySnapshot(client, todoId);
      await todoHistoriesService.recordHistory(client, { todoId, actorId: requesterId, before: prev, after: next });
      return todosRepo.findTodoForViewer(client, { todoId, viewerId: requesterId });
    });
    return toTodoResponse(row, timezone, now);
  } catch (err) {
    // 동시 수정으로 기간이 뒤집히면 DB CHECK가 막는다 → 같은 400
    if (err.code === '23514' && err.constraint === 'todos_check') throw AppError.of('INVALID_PERIOD');
    throw err;
  }
}

export async function deleteTodo(requesterId, todoId) {
  const todo = await todosRepo.findTodoForViewer(pool, { todoId, viewerId: requesterId });
  if (!todo) throw AppError.of('NOT_FOUND');
  if (!todo.canEdit) throw AppError.of('FORBIDDEN');
  // 공유·이력은 FK CASCADE. 먼저 지운 요청이 있으면 0행 → 404
  if (!(await todosRepo.deleteTodo(pool, todoId))) throw AppError.of('NOT_FOUND');
}
