import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../domain/errors.js';
import * as authService from '../services/auth.service.js';
import { authorizeUrl, fetchProfile, getProvider } from '../services/oauth.providers.js';
import { bad, emailRule, nameRule, ok, passwordRule, validate } from './validate.js';

export const authRouter = Router();

const COOKIE_BASE = { httpOnly: true, secure: true, sameSite: env.cookieSameSite };
const ACCESS_PATH = '/';
const REFRESH_PATH = '/api/auth';

export function setTokenCookies(res, tokens) {
  res.cookie('access_token', tokens.accessToken, { ...COOKIE_BASE, path: ACCESS_PATH, maxAge: env.accessTokenTtlMs });
  res.cookie('refresh_token', tokens.refreshToken, {
    ...COOKIE_BASE,
    path: REFRESH_PATH,
    expires: tokens.refreshExpiresAt,
  });
}

function clearTokenCookies(res) {
  res.clearCookie('access_token', { ...COOKIE_BASE, path: ACCESS_PATH });
  res.clearCookie('refresh_token', { ...COOKIE_BASE, path: REFRESH_PATH });
}

const signupRules = {
  email: emailRule(true),
  password: passwordRule,
  name: nameRule,
};

const loginRules = {
  email: emailRule(false),
  password: (v) => (typeof v === 'string' && v ? ok(v) : bad('비밀번호를 입력해 주세요.')),
};

authRouter.post('/signup', async (req, res) => {
  const { me, tokens } = await authService.signup(validate(req.body, signupRules));
  setTokenCookies(res, tokens);
  res.status(201).json(me);
});

authRouter.post('/login', async (req, res) => {
  const { me, tokens } = await authService.login(validate(req.body, loginRules));
  setTokenCookies(res, tokens);
  res.json(me);
});

authRouter.post('/refresh', async (req, res) => {
  try {
    setTokenCookies(res, await authService.refresh(req.cookies.refresh_token));
  } catch (err) {
    clearTokenCookies(res);
    throw err;
  }
  res.status(204).end();
});

authRouter.post('/logout', async (req, res) => {
  await authService.logout(req.cookies.refresh_token);
  clearTokenCookies(res);
  res.status(204).end();
});

// 소셜 로그인. 콜백은 최상위 GET 이동이라 lax 쿠키로 충분하다
const OAUTH_COOKIE = 'oauth_state';
const OAUTH_PATH = '/api/auth/oauth';

// 오픈 리다이렉트 방지: 같은 사이트 경로만 허용
const safeNext = (v) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : '/');

function sameState(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

authRouter.get('/oauth/:provider', (req, res) => {
  const provider = getProvider(req.params.provider);
  const state = randomBytes(32).toString('base64url');
  res.cookie(OAUTH_COOKIE, { state, next: safeNext(req.query.next) }, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: OAUTH_PATH,
    maxAge: 10 * 60 * 1000,
  });
  res.redirect(authorizeUrl(provider, state));
});

authRouter.get('/oauth/:provider/callback', async (req, res) => {
  const provider = getProvider(req.params.provider);
  const saved = req.cookies[OAUTH_COOKIE];
  res.clearCookie(OAUTH_COOKIE, { httpOnly: true, secure: true, sameSite: 'lax', path: OAUTH_PATH });
  const fail = (code) => res.redirect(`${env.appUrl}/login?error=${code}`);
  try {
    const { code, state } = req.query;
    if (typeof code !== 'string' || !code || !sameState(saved?.state, state)) return fail('OAUTH_FAILED');
    const { tokens } = await authService.oauthLogin(provider.name, await fetchProfile(provider, code));
    setTokenCookies(res, tokens);
    res.redirect(`${env.appUrl}${safeNext(saved.next)}`);
  } catch (err) {
    if (err instanceof AppError && err.code === 'OAUTH_EMAIL_REQUIRED') return fail(err.code);
    console.error(err.stack);
    fail('OAUTH_FAILED');
  }
});
