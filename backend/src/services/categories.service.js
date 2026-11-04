import { pool, withTransaction } from '../config/db.js';
import { AppError } from '../domain/errors.js';
import * as categoriesRepo from '../repositories/categories.repo.js';

export async function createDefaultCategory(client, ownerId) {
  return categoriesRepo.insertCategory(client, { ownerId, name: '기본', isDefault: true });
}

// 대소문자 무시 이름 중복(uq_categories_owner_id_name_lower)을 409로 변환
function mapNameTaken(err) {
  if (err.code === '23505' && err.constraint === 'uq_categories_owner_id_name_lower') {
    return AppError.of('CATEGORY_NAME_TAKEN');
  }
  return err;
}

export function listCategories(ownerId) {
  return categoriesRepo.listByOwner(pool, ownerId);
}

export async function createCategory(ownerId, { name }) {
  try {
    return await categoriesRepo.insertCategory(pool, { ownerId, name, isDefault: false });
  } catch (err) {
    throw mapNameTaken(err);
  }
}

export async function assertOwnCategory(ownerId, categoryId) {
  const category = await categoriesRepo.findOwnedCategory(pool, { ownerId, categoryId });
  if (!category) throw AppError.of('NOT_FOUND');
  return category;
}

export async function renameCategory(ownerId, categoryId, { name }) {
  const category = await assertOwnCategory(ownerId, categoryId);
  if (category.isDefault) throw AppError.of('DEFAULT_CATEGORY_PROTECTED');
  try {
    return await categoriesRepo.updateCategoryName(pool, { ownerId, categoryId, name });
  } catch (err) {
    throw mapNameTaken(err);
  }
}

export async function deleteCategory(ownerId, categoryId) {
  const category = await assertOwnCategory(ownerId, categoryId);
  if (category.isDefault) throw AppError.of('DEFAULT_CATEGORY_PROTECTED');
  // shortcut: 404·403 검사가 트랜잭션 밖이라 동시 삭제·동시 할일 등록 경합 시 23503으로 500(전부 롤백, 데이터 손실 없음), 문제되면 트랜잭션 안으로 이동
  await withTransaction(async (client) => {
    const def = await categoriesRepo.findDefaultCategory(client, ownerId);
    await categoriesRepo.moveTodosToCategory(client, { ownerId, fromCategoryId: categoryId, toCategoryId: def.id });
    await categoriesRepo.deleteCategory(client, { ownerId, categoryId });
  });
}

export function getDefaultCategory(ownerId) {
  return categoriesRepo.findDefaultCategory(pool, ownerId);
}
