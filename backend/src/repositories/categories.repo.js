export async function insertCategory(client, { ownerId, name, isDefault }) {
  const { rows } = await client.query(
    'INSERT INTO categories (owner_id, name, is_default) VALUES ($1, $2, $3) RETURNING id, name, is_default',
    [ownerId, name, isDefault],
  );
  return { id: rows[0].id, name: rows[0].name, isDefault: rows[0].is_default };
}
