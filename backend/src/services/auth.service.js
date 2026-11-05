import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { withTransaction } from '../config/db.js';
import { AppError } from '../domain/errors.js';
import * as authRepo from '../repositories/auth.repo.js';
import * as identitiesRepo from '../repositories/identities.repo.js';
import * as categoriesService from './categories.service.js';
import * as usersService from './users.service.js';

const sha256 = (raw) => createHash('sha256').update(raw).digest('hex');
const toMe = ({ id, email, name, timezone, hasPassword }) => ({ id, email, name, timezone, hasPassword });

// 가입·로그인·갱신 공통. 갱신 시 expiresAt을 넘겨 리프레시 절대 만료를 유지한다
async function issueTokens(client, userId, expiresAt = new Date(Date.now() + env.refreshTokenTtlMs)) {
  const accessToken = jwt.sign({ sub: userId }, env.jwtSecret, {
    algorithm: 'HS384',
    expiresIn: env.accessTokenTtlMs / 1000,
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
  // 소셜 전용 계정(해시 없음)도 같은 오류로 계정 존재 여부를 숨긴다
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) throw AppError.of('INVALID_CREDENTIALS');
  return { me: toMe(user), tokens: await withTransaction((client) => issueTokens(client, user.id)) };
}

// 소셜 로그인 계정 결정(계획서 1.3): identity → 이메일 자동 연결 → 신규 가입
async function oauthAttempt(provider, { providerUserId, email, emailVerified, name }) {
  return withTransaction(async (client) => {
    let user = await identitiesRepo.findUserByIdentity(client, provider, providerUserId);
    if (!user) {
      if (!email || !emailVerified) throw AppError.of('OAUTH_EMAIL_REQUIRED');
      user = await usersService.findByEmail(client, email);
      if (!user) {
        const displayName = name.trim().slice(0, 50) || email.split('@')[0].slice(0, 50);
        user = await usersService.createUser(client, { email, passwordHash: null, name: displayName });
        await categoriesService.createDefaultCategory(client, user.id);
      }
      await identitiesRepo.insertIdentity(client, { provider, providerUserId, userId: user.id });
    }
    return { me: toMe(user), tokens: await issueTokens(client, user.id) };
  });
}

export async function oauthLogin(provider, profile) {
  try {
    return await oauthAttempt(provider, profile);
  } catch (err) {
    // 동시 가입으로 이메일·identity unique가 충돌하면 1회 재시도
    if (err.code === 'EMAIL_TAKEN' || err.code === '23505') return oauthAttempt(provider, profile);
    throw err;
  }
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
    const hash = await usersService.findPasswordHash(userId); // 소셜 전용 계정은 null
    if (!hash || !(await bcrypt.compare(currentPassword, hash))) throw AppError.of('WRONG_PASSWORD');
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
