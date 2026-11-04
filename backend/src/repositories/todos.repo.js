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

// 이력용 전체 스냅숏: 공유 팀을 보는 사람 필터 없이 전부. lock은 불리언 상수 분기만
export async function findHistorySnapshot(client, todoId, { lock = false } = {}) {
  const { rows } = await client.query(
    `SELECT t.title, t.description, t.start_at, t.end_at, t.completed, c.id AS category_id, c.name AS category_name,
            ARRAY(SELECT s.team_id::text FROM todo_shares s WHERE s.todo_id = t.id ORDER BY 1) AS shared_team_ids
     FROM todos t JOIN categories c ON c.id = t.category_id
     WHERE t.id = $1${lock ? ' FOR UPDATE OF t' : ''}`,
    [todoId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    title: r.title,
    description: r.description,
    startAt: r.start_at,
    endAt: r.end_at,
    completed: r.completed,
    category: { id: r.category_id, name: r.category_name },
    sharedTeamIds: r.shared_team_ids,
  };
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

// 상태 SQL 정의는 여기 한 곳(API-03 #2). getStatus와 같은 순서(S1→S2→S3→S4)·같은 경계, now는 분 절삭
export const todoStatusSql = (n) => `(CASE WHEN t.completed THEN 'COMPLETED'
  WHEN date_trunc('minute', $${n}::timestamptz) > t.end_at THEN 'OVERDUE'
  WHEN date_trunc('minute', $${n}::timestamptz) < t.start_at THEN 'NOT_STARTED'
  ELSE 'IN_PROGRESS' END)`;

// 목록·캘린더 공용 1쿼리(OPS-17). 보는 사람 = $1. 자리표시자 번호만 템플릿에 끼운다(BE-07)
export async function listTodosForViewer(
  client,
  { viewerId, now, teamId, userId, categoryId, status, from, to, limit, offset },
) {
  const params = [viewerId];
  const where = [todoVisible(1)];
  // 보는 사람이 속하지 않은 팀은 빈 결과(S-04)
  if (teamId) {
    where.push(`EXISTS (SELECT 1 FROM todo_shares s JOIN teams tm ON tm.id = s.team_id
      WHERE s.todo_id = t.id AND s.team_id = $${params.push(teamId)} AND ${shareTeamVisible(1)})`);
  }
  if (userId) where.push(`u.id = $${params.push(userId)}`); // 소유자 필터. u.id는 t.owner_id와 같다(access.test 단일 출처 검사 회피)
  if (categoryId) where.push(`${todoIsOwner(1)} AND t.category_id = $${params.push(categoryId)}`); // 본인 할일에만(R2)
  if (status) where.push(`${todoStatusSql(params.push(now))} = $${params.push(status)}`);
  if (from) where.push(`t.start_at < $${params.push(to)} AND t.end_at >= $${params.push(from)}`); // R15 겹침
  const w = where.join(' AND ');
  // shortcut: COUNT(*) OVER()라 shared_teams 서브쿼리가 LIMIT 전 필터 결과 전체에 돈다, 사용자당 할일이 수천 건을 넘으면 id만 먼저 페이지네이션 후 조인
  const { rows } = await client.query(
    `SELECT ${viewCols(1)}, COUNT(*) OVER() AS total
     FROM todos t JOIN users u ON u.id = t.owner_id JOIN categories c ON c.id = t.category_id
     WHERE ${w} ORDER BY t.start_at, t.id LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`,
    params,
  );
  let total = rows.length ? Number(rows[0].total) : 0;
  // 마지막 쪽을 넘긴 offset은 행이 없어 창 함수로 total을 못 얻으므로 한 번 더 센다
  if (!rows.length && offset > 0) {
    total = (await client.query(`SELECT count(*)::int AS n FROM todos t WHERE ${w}`, params.slice(0, -2))).rows[0].n;
  }
  return { rows: rows.map(toRow), total };
}

// 보낸 열만 바꾼다(undefined → null → 기존 값 유지). 완료 시각은 DB 현재 값 기준으로 정해 CHECK todos_check1을 지킨다
export async function updateTodo(client, { todoId, title, description, startAt, endAt, completed, categoryId }) {
  const { rowCount } = await client.query(
    `UPDATE todos SET
       title        = COALESCE($2, title),
       description  = CASE WHEN $3::boolean THEN $4 ELSE description END,
       start_at     = COALESCE($5::timestamptz, start_at),
       end_at       = COALESCE($6::timestamptz, end_at),
       completed    = COALESCE($7::boolean, completed),
       completed_at = CASE WHEN $7::boolean IS NULL THEN completed_at
                           WHEN $7::boolean THEN COALESCE(completed_at, now()) END,
       category_id  = COALESCE($8::uuid, category_id),
       updated_at   = now()
     WHERE id = $1`,
    [
      todoId,
      title ?? null,
      description !== undefined,
      description ?? null,
      startAt ?? null,
      endAt ?? null,
      completed ?? null,
      categoryId ?? null,
    ],
  );
  return rowCount === 1;
}

// 공유 팀 전체 교체. 남는 팀은 shared_at 유지
export async function replaceShares(client, { todoId, teamIds }) {
  await client.query('DELETE FROM todo_shares WHERE todo_id = $1 AND NOT (team_id = ANY($2::uuid[]))', [
    todoId,
    teamIds,
  ]);
  await client.query(
    'INSERT INTO todo_shares (todo_id, team_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING',
    [todoId, teamIds],
  );
}

export async function deleteTodo(client, todoId) {
  const { rowCount } = await client.query('DELETE FROM todos WHERE id = $1', [todoId]);
  return rowCount === 1;
}
