export async function findUserByIdentity(client, provider, providerUserId) {
  const { rows } = await client.query(
    `SELECT u.id, u.email, u.name, u.timezone
       FROM user_identities i JOIN users u ON u.id = i.user_id
      WHERE i.provider = $1 AND i.provider_user_id = $2`,
    [provider, providerUserId],
  );
  return rows[0] ?? null;
}

export async function insertIdentity(client, { provider, providerUserId, userId }) {
  await client.query('INSERT INTO user_identities (provider, provider_user_id, user_id) VALUES ($1, $2, $3)', [
    provider,
    providerUserId,
    userId,
  ]);
}
