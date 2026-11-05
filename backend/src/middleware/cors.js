import { env } from '../config/env.js';
import { AppError } from '../domain/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// CORS(SEC-07): 허용 목록(CORS_ORIGINS)의 출처에만 쿠키 포함 응답을 연다
export function cors(req, res, next) {
  const origin = req.headers.origin;
  if (!origin) return next();
  res.vary('Origin');
  const allowed = env.corsOrigins.includes(origin);
  if (allowed) {
    res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' });
    if (req.method === 'OPTIONS' && req.headers['access-control-request-method']) {
      res.set({
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
      });
      return res.status(204).end();
    }
    return next();
  }
  // 허용 목록 밖 출처의 상태 변경은 쿠키가 실려 와도 거부(CSRF 방어, SameSite=None 대비).
  // 같은 출처(개발 Swagger UI 등)는 브라우저가 Origin을 붙여도 허용
  const sameOrigin = URL.canParse(origin) && new URL(origin).host === req.headers.host;
  if (!sameOrigin && !SAFE_METHODS.has(req.method)) return next(AppError.of('FORBIDDEN'));
  next();
}
