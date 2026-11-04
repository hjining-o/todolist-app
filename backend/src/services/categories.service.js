import * as categoriesRepo from '../repositories/categories.repo.js';

export async function createDefaultCategory(client, ownerId) {
  return categoriesRepo.insertCategory(client, { ownerId, name: '기본', isDefault: true });
}
