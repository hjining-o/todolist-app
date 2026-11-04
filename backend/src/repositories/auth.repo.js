export async function insertRefreshToken(client, { userId, tokenHash, expiresAt }) {
  await client.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [
    userId,
    tokenHash,
    expiresAt,
  ]);
}

// 한 번만 성공하는 원자적 폐기(회전)
export async function rotateRevoke(client, tokenHash) {
  const { rows } = await client.query(
    `UPDATE refresh_tokens SET revoked_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
      RETURNING user_id, expires_at`,
    [tokenHash],
  );
  return rows[0] ? { userId: rows[0].user_id, expiresAt: rows[0].expires_at } : null;
}

// 이미 폐기된 토큰의 재사용이면 그 사용자의 살아 있는 토큰을 모두 폐기
export async function revokeAllIfReused(client, tokenHash) {
  const { rowCount } = await client.query(
    `UPDATE refresh_tokens SET revoked_at = now()
      WHERE revoked_at IS NULL
        AND user_id = (SELECT user_id FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NOT NULL)`,
    [tokenHash],
  );
  return rowCount;
}

export async function revokeByHash(client, tokenHash) {
  await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [
    tokenHash,
  ]);
}

// revoked_at으로 남기면 다른 기기의 갱신이 재사용 감지에 걸려 새 토큰까지 폐기되므로 지운다(EX-44)
export async function deleteAllByUser(client, userId) {
  await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
}
