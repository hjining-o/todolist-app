export const TodoStatus = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  OVERDUE: 'OVERDUE',
});

// 상태는 저장하지 않고 조회 시점에 계산한다. now만 분 단위로 절삭(기간 값은 이미 분 단위)
export function getStatus({ completed, startAt, endAt }, now) {
  const n = Math.floor(now.getTime() / 60000) * 60000;
  if (completed) return TodoStatus.COMPLETED;
  if (n > endAt.getTime()) return TodoStatus.OVERDUE;
  if (n < startAt.getTime()) return TodoStatus.NOT_STARTED;
  return TodoStatus.IN_PROGRESS;
}
