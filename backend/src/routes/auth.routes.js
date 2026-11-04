import { Router } from 'express';
import { AppError } from '../domain/errors.js';
import * as authService from '../services/auth.service.js';

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

const bad = (error) => ({ error });
const ok = (value) => ({ ok: value });

// 정의되지 않은 키는 거부하고, 필드 오류는 모아서 한 번에 던진다
function validate(body, rules) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw AppError.of('VALIDATION_ERROR');
  const fields = {};
  const out = {};
  for (const key of Object.keys(body)) if (!(key in rules)) fields[key] = '허용되지 않는 필드입니다.';
  for (const [key, rule] of Object.entries(rules)) {
    const result = rule(body[key]);
    if (result.error) fields[key] = result.error;
    else out[key] = result.ok;
  }
  if (Object.keys(fields).length) throw AppError.of('VALIDATION_ERROR', fields);
  return out;
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
  name: (v) => {
    const name = typeof v === 'string' ? v.trim() : '';
    return name.length >= 1 && name.length <= 50 ? ok(name) : bad('이름은 1~50자여야 합니다.');
  },
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
