import { categoryOwned } from './sql/access.js';

const COLS = 'c.id, c.name, c.is_default';
const toCategory = (r) => ({ id: r.id, name: r.name, isDefault: r.is_default });

export async function insertCategory(client, { ownerId, name, isDefault }) {
  const { rows } = await client.query(
    'INSERT INTO categories (owner_id, name, is_default) VALUES ($1, $2, $3) RETURNING id, name, is_default',
    [ownerId, name, isDefault],
  );
  return toCategory(rows[0]);
}

export async function listByOwner(client, ownerId) {
  const { rows } = await client.query(
    `SELECT ${COLS} FROM categories c WHERE ${categoryOwned(1)} ORDER BY c.is_default DESC, c.name, c.id`,
    [ownerId],
  );
  return rows.map(toCategory);
}

export async function findOwnedCategory(client, { ownerId, categoryId }) {
  const { rows } = await client.query(`SELECT ${COLS} FROM categories c WHERE c.id = $1 AND ${categoryOwned(2)}`, [
    categoryId,
    ownerId,
  ]);
  return rows[0] ? toCategory(rows[0]) : null;
}

export async function findDefaultCategory(client, ownerId) {
  const { rows } = await client.query(`SELECT ${COLS} FROM categories c WHERE ${categoryOwned(1)} AND c.is_default`, [
    ownerId,
  ]);
  return rows[0] ? toCategory(rows[0]) : null;
}

export async function updateCategoryName(client, { ownerId, categoryId, name }) {
  const { rows } = await client.query(
    `UPDATE categories c SET name = $3 WHERE c.id = $1 AND ${categoryOwned(2)} RETURNING ${COLS}`,
    [categoryId, ownerId, name],
  );
  return rows[0] ? toCategory(rows[0]) : null;
}

export async function deleteCategory(client, { ownerId, categoryId }) {
  await client.query(`DELETE FROM categories c WHERE c.id = $1 AND ${categoryOwned(2)}`, [categoryId, ownerId]);
}

// 카테고리 삭제 전용. todos.repo에 두면 categories.service→todos 의존이 생겨 API-09의 todos.service→categories.service와 순환(BE-06, BE-09)
export async function moveTodosToCategory(client, { ownerId, fromCategoryId, toCategoryId }) {
  await client.query('UPDATE todos SET category_id = $3, updated_at = now() WHERE owner_id = $1 AND category_id = $2', [
    ownerId,
    fromCategoryId,
    toCategoryId,
  ]);
}
