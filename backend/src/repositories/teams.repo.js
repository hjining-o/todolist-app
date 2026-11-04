import { todoIsOwner } from './sql/access.js';

const toMember = (r) => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role });

export async function insertTeam(client, name) {
  const { rows } = await client.query('INSERT INTO teams (name) VALUES ($1) RETURNING id, name', [name]);
  return { id: rows[0].id, name: rows[0].name };
}

export async function insertMember(client, { teamId, userId, role }) {
  await client.query('INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)', [teamId, userId, role]);
}

export async function findRole(client, { teamId, userId }) {
  const { rows } = await client.query('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [
    teamId,
    userId,
  ]);
  return rows[0]?.role ?? null;
}

export async function listTeamsOfUser(client, userId) {
  const { rows } = await client.query(
    'SELECT t.id, t.name, m.role FROM team_members m JOIN teams t ON t.id = m.team_id WHERE m.user_id = $1 ORDER BY t.name, t.id',
    [userId],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, role: r.role }));
}

// users 조인은 목록 1쿼리용 읽기(N+1 방지)
export async function listMembers(client, teamId) {
  const { rows } = await client.query(
    `SELECT u.id AS user_id, u.name, u.email, m.role FROM team_members m JOIN users u ON u.id = m.user_id
     WHERE m.team_id = $1
     ORDER BY CASE m.role WHEN 'OWNER' THEN 0 WHEN 'MANAGER' THEN 1 ELSE 2 END, u.name, u.id`,
    [teamId],
  );
  return rows.map(toMember);
}

export async function updateMemberRole(client, { teamId, userId, role }) {
  const { rows } = await client.query(
    `UPDATE team_members m SET role = $3 FROM users u
     WHERE m.team_id = $1 AND m.user_id = $2 AND u.id = m.user_id
     RETURNING u.id AS user_id, u.name, u.email, m.role`,
    [teamId, userId, role],
  );
  return rows[0] ? toMember(rows[0]) : null;
}

export async function deleteMember(client, { teamId, userId }) {
  const { rowCount } = await client.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [
    teamId,
    userId,
  ]);
  return rowCount;
}

// todos.repo가 아니라 여기 두는 이유: teams.service→todos 모듈 의존은 API-09의 todos.service→teams.service와 순환(BE-06, BE-09)
export async function deleteOwnerSharesInTeam(client, { teamId, ownerId }) {
  const { rowCount } = await client.query(
    `DELETE FROM todo_shares s USING todos t WHERE s.todo_id = t.id AND s.team_id = $1 AND ${todoIsOwner(2)}`,
    [teamId, ownerId],
  );
  return rowCount;
}
