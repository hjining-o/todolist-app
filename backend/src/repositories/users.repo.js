export async function insertUser(client, { email, passwordHash, name }) {
  const { rows } = await client.query(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, timezone',
    [email, passwordHash, name],
  );
  return rows[0];
}

export async function findByEmail(client, email) {
  const { rows } = await client.query('SELECT id, email, name, timezone, password_hash FROM users WHERE email = $1', [
    email,
  ]);
  if (!rows[0]) return null;
  const { password_hash: passwordHash, ...user } = rows[0];
  return { ...user, passwordHash };
}

export async function findById(client, id) {
  const { rows } = await client.query('SELECT id, email, name, timezone FROM users WHERE id = $1', [id]);
  return rows[0] ?? null;
}
