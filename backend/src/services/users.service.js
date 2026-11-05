import { pool } from '../config/db.js';
import { AppError } from '../domain/errors.js';
import * as usersRepo from '../repositories/users.repo.js';

export async function createUser(client, { email, passwordHash, name }) {
  try {
    return await usersRepo.insertUser(client, { email, passwordHash, name });
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'uq_users_email') throw AppError.of('EMAIL_TAKEN');
    throw err;
  }
}

export function findByEmail(client, email) {
  return usersRepo.findByEmail(client, email);
}

export function findByEmailWithHash(email) {
  return usersRepo.findByEmail(pool, email);
}

export async function getMe(userId) {
  const user = await usersRepo.findById(pool, userId);
  if (!user) throw AppError.of('UNAUTHENTICATED');
  return user;
}

export function findPasswordHash(userId) {
  return usersRepo.findPasswordHash(pool, userId);
}

export function updateUser(client, userId, fields) {
  return usersRepo.updateUser(client, userId, fields);
}
