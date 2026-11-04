import { AppError, ERRORS } from '../domain/errors.js';

const send = (res, code) => res.status(ERRORS[code].status).json({ error: { code, message: ERRORS[code].message } });

// 인자 4개여야 Express가 에러 핸들러로 인식
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof AppError && err.code in ERRORS) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, fields: err.fields } });
  }
  if (err.type === 'entity.too.large') return send(res, 'PAYLOAD_TOO_LARGE');
  // body-parser 클라이언트 오류(잘못된 JSON 등). err.message는 본문 일부를 담으므로 쓰지 않는다
  if (err.type && err.status >= 400 && err.status < 500) return send(res, 'VALIDATION_ERROR');
  // 스택만 기록(pg detail 등 개인정보가 든 객체 전체는 금지)
  console.error(err.stack);
  return send(res, 'INTERNAL_ERROR');
}
