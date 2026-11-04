import { Router } from 'express';
import * as authService from '../services/auth.service.js';
import { bad, nameRule, ok, validate } from './validate.js';

export const authRouter = Router();

const COOKIE_BASE = { httpOnly: true, secure: true, sameSite: 'lax' };
const ACCESS_PATH = '/';
const REFRESH_PATH = '/api/auth';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setTokenCookies(res, tokens) {
  res.cookie('access_token', tokens.accessToken, { ...COOKIE_BASE, path: ACCESS_PATH, maxAge: 15 * 60 * 1000 });
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

const emailRule = (strict) => (v) => {
  const email = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!email) return bad('이메일을 입력해 주세요.');
  if (strict && (email.length > 254 || !EMAIL_RE.test(email))) return bad('이메일 형식이 올바르지 않습니다.');
  return ok(email);
};

const signupRules = {
  email: emailRule(true),
  password: (v) =>
    typeof v === 'string' && v.length >= 8 && Buffer.byteLength(v, 'utf8') <= 72
      ? ok(v)
      : bad('비밀번호는 8자 이상, 72바이트 이하여야 합니다.'),
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
