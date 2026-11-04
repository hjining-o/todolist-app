import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { withTransaction } from '../config/db.js';
import { AppError } from '../domain/errors.js';
import * as authRepo from '../repositories/auth.repo.js';
import * as categoriesService from './categories.service.js';
import * as usersService from './users.service.js';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sha256 = (raw) => createHash('sha256').update(raw).digest('hex');
const toMe = ({ id, email, name, timezone }) => ({ id, email, name, timezone });

// 가입·로그인·갱신 공통. 갱신 시 expiresAt을 넘겨 7일 절대 만료를 유지한다
async function issueTokens(client, userId, expiresAt = new Date(Date.now() + REFRESH_TTL_MS)) {
  const accessToken = jwt.sign({ sub: userId }, env.jwtSecret, {
    algorithm: 'HS384',
    expiresIn: '15m',
    noTimestamp: true,
  });
  const refreshToken = randomBytes(32).toString('base64url');
  await authRepo.insertRefreshToken(client, { userId, tokenHash: sha256(refreshToken), expiresAt });
  return { accessToken, refreshToken, refreshExpiresAt: expiresAt };
}

export async function signup({ email, password, name }) {
  const passwordHash = await bcrypt.hash(password, 10); // 트랜잭션 밖에서 계산해 연결 점유 방지
  return withTransaction(async (client) => {
    const user = await usersService.createUser(client, { email, passwordHash, name });
    await categoriesService.createDefaultCategory(client, user.id);
    return { me: toMe(user), tokens: await issueTokens(client, user.id) };
  });
}

export async function login({ email, password }) {
  const user = await usersService.findByEmailWithHash(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw AppError.of('INVALID_CREDENTIALS');
  return { me: toMe(user), tokens: await withTransaction((client) => issueTokens(client, user.id)) };
}

export async function refresh(rawToken) {
  if (typeof rawToken !== 'string' || !rawToken) throw AppError.of('UNAUTHENTICATED');
  const hash = sha256(rawToken);
  const tokens = await withTransaction(async (client) => {
    const row = await authRepo.rotateRevoke(client, hash);
    if (!row) {
      await authRepo.revokeAllIfReused(client, hash); // 폐기는 커밋돼야 하므로 여기서 던지지 않는다
      return null;
    }
    return issueTokens(client, row.userId, row.expiresAt);
  });
  if (!tokens) throw AppError.of('UNAUTHENTICATED');
  return tokens;
}

export async function logout(rawToken) {
  if (typeof rawToken !== 'string' || !rawToken) return;
  await withTransaction((client) => authRepo.revokeByHash(client, sha256(rawToken)));
}

export async function updateMe(userId, { name, timezone, currentPassword, newPassword }) {
  let passwordHash;
  if (newPassword !== undefined) {
    const hash = await usersService.findPasswordHash(userId);
    if (!hash) throw AppError.of('UNAUTHENTICATED');
    if (!(await bcrypt.compare(currentPassword, hash))) throw AppError.of('WRONG_PASSWORD');
    passwordHash = await bcrypt.hash(newPassword, 10); // 트랜잭션 밖에서 계산해 연결 점유 방지
  }
  return withTransaction(async (client) => {
    const me = await usersService.updateUser(client, userId, { name, timezone, passwordHash });
    if (!me) throw AppError.of('UNAUTHENTICATED');
    if (!passwordHash) return { me, tokens: null };
    await authRepo.deleteAllByUser(client, userId);
    return { me, tokens: await issueTokens(client, userId) };
  });
}
