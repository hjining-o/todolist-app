import { Router } from 'express';
import { env } from '../config/env.js';
import * as authService from '../services/auth.service.js';
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
