import { Router } from 'express';
import { AppError } from '../domain/errors.js';
import * as svc from '../services/todos.service.js';
import { bad, ok, uuidParam, uuidRule, validate } from './validate.js';

export const todosRouter = Router();

const optional = (rule) => (v) => (v === undefined ? ok(undefined) : rule(v));

const titleRule = (v) => {
  const title = typeof v === 'string' ? v.trim() : '';
  return title.length >= 1 && title.length <= 200 ? ok(title) : bad('제목은 1~200자여야 합니다.');
};

// 빈 문자열은 null로 저장
const descriptionRule = (v) => {
  if (v === undefined || v === null) return ok(null);
  const text = typeof v === 'string' ? v.trim() : null;
  return text !== null && text.length <= 2000 ? ok(text || null) : bad('설명은 2,000자 이하여야 합니다.');
};

const teamIdRule = (v) => (v === undefined || v === null ? ok(null) : uuidRule(v));

const uuidListRule = (v) => {
  const results = Array.isArray(v) ? v.map(uuidRule) : [{ error: true }];
  const ids = results.map((r) => r.ok);
  return results.every((r) => !r.error) && new Set(ids).size === ids.length
    ? ok(ids)
    : bad('팀 ID 목록 형식이 올바르지 않습니다.');
};

// swagger DateTimeOrDateInput pattern에 캡처 그룹만 추가
const DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::00)?(?:Z|[+-](\d{2}):(\d{2})))?$/;

const dateTimeRule = (v) => {
  const m = typeof v === 'string' ? DATE_TIME_RE.exec(v) : null;
  if (m) {
    const [y, mo, d, hh, mm, oh, om] = m.slice(1).map((x) => (x === undefined ? 0 : Number(x)));
    const u = new Date(Date.UTC(y, mo - 1, d));
    // Date.UTC 왕복으로 존재하지 않는 날짜(2/30 등)와 0000~0099년을 거부
    if (
      u.getUTCFullYear() === y &&
      u.getUTCMonth() === mo - 1 &&
      u.getUTCDate() === d &&
      hh <= 23 &&
      mm <= 59 &&
      oh <= 23 &&
      om <= 59
    ) {
      return ok(v);
    }
  }
  return bad('일시는 YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm+09:00 형식이어야 합니다.');
};

// null은 teamId·description만 허용(swagger nullable). 나머지는 생략해야 한다
const createRules = {
  teamId: teamIdRule,
  ownerId: optional(uuidRule),
  title: titleRule,
  description: descriptionRule,
  startAt: optional(dateTimeRule),
  endAt: optional(dateTimeRule),
  categoryId: optional(uuidRule),
  sharedTeamIds: optional(uuidListRule),
};

todosRouter.post('/', async (req, res) => {
  res.status(201).json(await svc.createTodo(req.user.id, validate(req.body, createRules)));
});

// 허용 목록(SEC-12). routes는 domain/todo-status를 가져오지 않아 값을 여기 둔다
const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'];
const statusRule = (v) => (STATUSES.includes(v) ? ok(v) : bad('상태 값이 올바르지 않습니다.'));
const intRule = (min, max) => (v) =>
  typeof v === 'string' && /^\d{1,9}$/.test(v) && +v >= min && +v <= max
    ? ok(+v)
    : bad(`${min}~${max} 사이 정수여야 합니다.`);
// from·to는 시각+오프셋 필수. 날짜만은 받지 않는다
const offsetDateTimeRule = (v) =>
  typeof v === 'string' && v.length > 10 ? dateTimeRule(v) : bad('일시는 YYYY-MM-DDTHH:mm+09:00 형식이어야 합니다.');

const listRules = {
  teamId: optional(uuidRule),
  userId: optional(uuidRule),
  categoryId: optional(uuidRule),
  status: optional(statusRule),
  limit: optional(intRule(1, 100)),
  offset: optional(intRule(0, 999999999)),
  from: optional(offsetDateTimeRule),
  to: optional(offsetDateTimeRule),
};

// DB 없이 판정 가능한 교차 검사(S-03, S-04). 42일 판정은 요청자 시간대가 필요해 service
function checkListQuery(q) {
  const fields = {};
  if (q.teamId && q.userId) fields.userId = 'teamId와 함께 쓸 수 없습니다.';
  if ((q.from === undefined) !== (q.to === undefined)) {
    fields[q.from ? 'to' : 'from'] = 'from과 to를 함께 보내야 합니다.';
  } else if (q.from && new Date(q.from) >= new Date(q.to)) {
    fields.to = 'to는 from보다 뒤여야 합니다.';
  }
  if (q.from !== undefined || q.to !== undefined) {
    if (q.limit !== undefined) fields.limit = '캘린더 조회에는 쓸 수 없습니다.';
    if (q.offset !== undefined) fields.offset = '캘린더 조회에는 쓸 수 없습니다.';
  }
  if (Object.keys(fields).length) throw AppError.of('VALIDATION_ERROR', fields);
}

todosRouter.get('/', async (req, res) => {
  const q = validate(req.query, listRules);
  checkListQuery(q);
  res.json(await svc.listTodos(req.user.id, q));
});

todosRouter.get('/:todoId', async (req, res) => {
  res.json(await svc.getTodo(req.user.id, uuidParam(req.params.todoId, 'todoId')));
});
