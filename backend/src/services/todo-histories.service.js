import { pool } from '../config/db.js';
import { AppError } from '../domain/errors.js';
import { diffTodo, filterChanges } from '../domain/history-diff.js';
import { formatOffset } from '../domain/period.js';
import * as todoHistoriesRepo from '../repositories/todo-histories.repo.js';
import * as teamsService from './teams.service.js';
import * as usersService from './users.service.js';

// 트랜잭션 client를 받아 같은 트랜잭션에서 기록. 변경 없으면 아무것도 안 함
export async function recordHistory(client, { todoId, actorId, before, after }) {
  const d = diffTodo(before, after);
  if (d) await todoHistoriesRepo.insertHistory(client, { todoId, actorId, ...d });
}

// startAt·endAt의 old/new를 보는 사람 시간대 오프셋 표기로
function withOffsets(changes, timezone) {
  const out = { ...changes };
  const conv = (v) => (v === null ? null : formatOffset(new Date(v), timezone));
  for (const f of ['startAt', 'endAt']) {
    if (out[f]) out[f] = { old: conv(out[f].old), new: conv(out[f].new) };
  }
  return out;
}

export async function listHistories(requesterId, todoId) {
  const access = await todoHistoriesRepo.findAccess(pool, { todoId, viewerId: requesterId });
  if (!access) throw AppError.of('NOT_FOUND'); // 없음과 볼 수 없음을 구분하지 않는다(R2, EX-21)
  const { timezone } = await usersService.getMe(requesterId);
  const teamIds = (await teamsService.listMyTeams(requesterId)).map((t) => t.id);
  const items = [];
  for (const h of await todoHistoriesRepo.listByTodo(pool, todoId)) {
    const changes = filterChanges(h.changes, { isOwner: access.isOwner, teamIds });
    if (changes) {
      items.push({
        id: h.id,
        action: h.action,
        actor: h.actor,
        changedAt: formatOffset(h.changedAt, timezone),
        changes: withOffsets(changes, timezone),
      });
    }
  }
  return { items };
}
