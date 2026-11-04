import { Router } from 'express';
import { AppError } from '../domain/errors.js';
import * as authService from '../services/auth.service.js';
import * as usersService from '../services/users.service.js';
import { setTokenCookies } from './auth.routes.js';
import { bad, nameRule, ok, optional, passwordRule, timezoneRule, validate } from './validate.js';

export const usersRouter = Router();

const meRules = {
  name: optional(nameRule),
  timezone: optional(timezoneRule),
  currentPassword: optional((v) => (typeof v === 'string' && v ? ok(v) : bad('현재 비밀번호를 입력해 주세요.'))),
  newPassword: optional(passwordRule),
};

usersRouter.get('/me', async (req, res) => {
  res.json(await usersService.getMe(req.user.id));
});

usersRouter.patch('/me', async (req, res) => {
  const input = validate(req.body, meRules);
  if (!Object.keys(req.body).length) throw AppError.of('VALIDATION_ERROR');
  if ((input.newPassword === undefined) !== (input.currentPassword === undefined)) {
    const key = input.newPassword === undefined ? 'newPassword' : 'currentPassword';
    throw AppError.of('VALIDATION_ERROR', { [key]: '현재 비밀번호와 새 비밀번호를 함께 입력해 주세요.' });
  }
  const { me, tokens } = await authService.updateMe(req.user.id, input);
  if (tokens) setTokenCookies(res, tokens);
  res.json(me);
});
