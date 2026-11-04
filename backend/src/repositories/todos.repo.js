import { shareTeamVisible, todoCanEdit, todoIsOwner, todoVisible } from './sql/access.js';

// 보는 사람 = $n. 공유 팀은 보는 사람이 속한 팀만(R21). 목록 쿼리도 재사용한다(N+1 방지)
export const viewCols = (n) => `
  t.id, t.title, t.description, t.start_at, t.end_at, t.completed, t.completed_at,
  u.id AS owner_id, u.name AS owner_name, c.id AS category_id, c.name AS category_name,
  ${todoCanEdit(n)} AS can_edit, ${todoIsOwner(n)} AS is_owner,
  COALESCE((SELECT json_agg(json_build_object('id', tm.id, 'name', tm.name) ORDER BY tm.name, tm.id)
            FROM todo_shares s JOIN teams tm ON tm.id = s.team_id
            WHERE s.todo_id = t.id AND ${shareTeamVisible(n)}), '[]') AS shared_teams`;

// category는 항상 담고, 비소유자 제거는 service가 한다(SEC-06)
export const toRow = (r) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  startAt: r.start_at,
  endAt: r.end_at,
  completed: r.completed,
  completedAt: r.completed_at,
  owner: { id: r.owner_id, name: r.owner_name },
  category: { id: r.category_id, name: r.category_name },
  sharedTeams: r.shared_teams,
  canEdit: r.can_edit,
  isOwner: r.is_owner,
});

export async function insertTodo(client, { ownerId, categoryId, title, description, startAt, endAt }) {
  const { rows } = await client.query(
    `INSERT INTO todos (owner_id, category_id, title, description, start_at, end_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [ownerId, categoryId, title, description, startAt, endAt],
  );
  return rows[0].id;
}

// 빈 배열이면 0행
export async function insertShares(client, { todoId, teamIds }) {
  await client.query('INSERT INTO todo_shares (todo_id, team_id) SELECT $1, unnest($2::uuid[])', [todoId, teamIds]);
}

export async function findTodoForViewer(client, { todoId, viewerId }) {
  const { rows } = await client.query(
    `SELECT ${viewCols(2)}
     FROM todos t JOIN users u ON u.id = t.owner_id JOIN categories c ON c.id = t.category_id
     WHERE t.id = $1 AND ${todoVisible(2)}`,
    [todoId, viewerId],
  );
  return rows[0] ? toRow(rows[0]) : null;
}
