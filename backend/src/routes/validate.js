import { AppError } from '../domain/errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const bad = (error) => ({ error });
export const ok = (value) => ({ ok: value });

// 정의되지 않은 키는 거부하고, 필드 오류는 모아서 한 번에 던진다
export function validate(body, rules) {
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

export const nameRule = (v) => {
  const name = typeof v === 'string' ? v.trim() : '';
  return name.length >= 1 && name.length <= 50 ? ok(name) : bad('이름은 1~50자여야 합니다.');
};

export const emailRule = (strict) => (v) => {
  const email = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!email) return bad('이메일을 입력해 주세요.');
  if (strict && (email.length > 254 || !EMAIL_RE.test(email))) return bad('이메일 형식이 올바르지 않습니다.');
  return ok(email);
};

// uuid가 아니면 pg 22P02로 500이 되므로 미리 400 처리
export function uuidParam(value, field) {
  if (UUID_RE.test(value)) return value;
  throw AppError.of('VALIDATION_ERROR', { [field]: '형식이 올바르지 않습니다.' });
}

// typeof 검사로 ['<uuid>'] 같은 배열이 문자열로 변환돼 통과하는 것을 막는다. 비교·중복 판정을 위해 소문자화
export const uuidRule = (v) =>
  typeof v === 'string' && UUID_RE.test(v) ? ok(v.toLowerCase()) : bad('형식이 올바르지 않습니다.');
