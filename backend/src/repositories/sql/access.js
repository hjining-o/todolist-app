// 할일·카테고리 권한 조건의 유일한 정의 (P-03, BE-05). 다른 곳에서 권한 SQL을 직접 쓰지 않는다.
// 별칭 가정: 할일 `todos t`, 카테고리 `categories c`, 내부 서브쿼리 `acc_s`(todo_shares)/`acc_m`(team_members).
// BE-07: 템플릿으로 끼우는 값은 정수로 검증한 자리표시자 번호뿐이며, 사용자 입력은 항상 `$n` 파라미터로만 전달된다.

// 문자열 주입 방지를 위해 1 이상 정수만 허용
function param(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new TypeError('자리표시자 번호는 1 이상의 정수여야 합니다.');
  }
  return `$${n}`;
}

// 공유된 팀의 구성원 여부 (roleFilter는 이 파일 내부 상수만 전달)
function sharedTo(p, roleFilter) {
  return (
    'EXISTS (SELECT 1 FROM todo_shares acc_s JOIN team_members acc_m ON acc_m.team_id = acc_s.team_id ' +
    `WHERE acc_s.todo_id = t.id AND acc_m.user_id = ${p}${roleFilter})`
  );
}

// 소유자 또는 공유받은 팀 구성원 (R2, R21)
export function todoVisible(n) {
  const p = param(n);
  return `(t.owner_id = ${p} OR ${sharedTo(p, '')})`;
}

// 소유자 또는 공유된 팀의 OWNER/MANAGER (R19: 관리자는 그 팀에 공유된 할일만)
export function todoCanEdit(n) {
  const p = param(n);
  return `(t.owner_id = ${p} OR ${sharedTo(p, " AND acc_m.role IN ('OWNER', 'MANAGER')")})`;
}

export function todoIsOwner(n) {
  return `(t.owner_id = ${param(n)})`;
}

export function categoryOwned(n) {
  return `(c.owner_id = ${param(n)})`;
}
