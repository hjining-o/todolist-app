import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../domain/errors.js';

export function authenticate(req, res, next) {
  try {
    const payload = jwt.verify(req.cookies.access_token, env.jwtSecret, { algorithms: ['HS384'] });
    req.user = { id: payload.sub };
    next();
  } catch {
    next(AppError.of('UNAUTHENTICATED'));
  }
}
