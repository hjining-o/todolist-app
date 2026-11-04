// 이력 diff 순수 함수. 외부 import 금지
const FIELDS = ['title', 'description', 'startAt', 'endAt', 'completed', 'category', 'sharedTeamIds'];

// 저장 형태: 일시는 UTC ISO 문자열, 공유 팀은 정렬된 ID 배열
const plain = (s) => ({
  title: s.title,
  description: s.description,
  startAt: s.startAt.toISOString(),
  endAt: s.endAt.toISOString(),
  completed: s.completed,
  category: { id: s.category.id, name: s.category.name },
  sharedTeamIds: [...s.sharedTeamIds].sort(),
});

// 카테고리는 id로만 비교
const key = (f, v) => (f === 'category' ? v.id : JSON.stringify(v));

// before = null이면 등록. 변경이 없으면 null(이력 미기록)
export function diffTodo(before, after) {
  const a = plain(after);
  const b = before ? plain(before) : null;
  const changes = {};
  for (const f of FIELDS) {
    if (!b || key(f, b[f]) !== key(f, a[f])) changes[f] = { old: b ? b[f] : null, new: a[f] };
  }
  if (!b) return { action: 'CREATED', changes };
  if (!Object.keys(changes).length) return null;
  if (changes.completed) return { action: a.completed ? 'COMPLETED' : 'UNCOMPLETED', changes };
  return { action: 'UPDATED', changes };
}

// 보는 사람 기준 필터. 남는 필드가 없으면 null(숨김)
export function filterChanges(changes, { isOwner, teamIds }) {
  const out = { ...changes };
  if (!isOwner) delete out.category;
  if (out.sharedTeamIds) {
    const keep = (ids) => (ids === null ? null : ids.filter((id) => teamIds.includes(id)));
    const old = keep(out.sharedTeamIds.old);
    const next = keep(out.sharedTeamIds.new);
    if (JSON.stringify(old) === JSON.stringify(next)) delete out.sharedTeamIds;
    else out.sharedTeamIds = { old, new: next };
  }
  return Object.keys(out).length ? out : null;
}
