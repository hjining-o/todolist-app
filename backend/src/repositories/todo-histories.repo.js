import { todoIsOwner, todoVisible } from './sql/access.js';

// changed_at은 clock_timestamp(): FOR UPDATE 대기 뒤 INSERT한 요청이 최신순에서 밀리지 않게(now()는 트랜잭션 시작 시각)
export async function insertHistory(client, { todoId, actorId, action, changes }) {
  await client.query(
    `INSERT INTO todo_histories (todo_id, actor_id, action, changes, changed_at)
     VALUES ($1, $2, $3, $4::jsonb, clock_timestamp())`,
    [todoId, actorId, action, JSON.stringify(changes)],
  );
}

// 보는 사람 = $2. 볼 수 없거나 없으면 null
export async function findAccess(client, { todoId, viewerId }) {
  const { rows } = await client.query(
    `SELECT ${todoIsOwner(2)} AS is_owner FROM todos t WHERE t.id = $1 AND ${todoVisible(2)}`,
    [todoId, viewerId],
  );
  return rows[0] ? { isOwner: rows[0].is_owner } : null;
}

export async function listByTodo(client, todoId) {
  const { rows } = await client.query(
    `SELECT h.id, h.action, h.changes, h.changed_at, u.id AS actor_id, u.name AS actor_name
     FROM todo_histories h JOIN users u ON u.id = h.actor_id
     WHERE h.todo_id = $1 ORDER BY h.changed_at DESC, h.id DESC`,
    [todoId],
  );
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    changes: r.changes,
    changedAt: r.changed_at,
    actor: { id: r.actor_id, name: r.actor_name },
  }));
}
