import { describe, expect, it } from 'vitest';
import { TodoStatus, getStatus } from '../../src/domain/todo-status.js';

const d = (s) => new Date(s);

describe('getStatus: 기한 초과 경계 (EX-10, Q-01)', () => {
  const todo = {
    completed: false,
    startAt: d('2026-11-05T00:00+09:00'),
    endAt: d('2026-11-05T23:59+09:00'),
  };

  it('종료 23:59:30은 분 단위 절삭으로 IN_PROGRESS다', () => {
    expect(getStatus(todo, d('2026-11-05T23:59:30+09:00'))).toBe('IN_PROGRESS');
  });

  it('종료 23:59:59.999도 IN_PROGRESS다', () => {
    expect(getStatus(todo, d('2026-11-05T23:59:59.999+09:00'))).toBe('IN_PROGRESS');
  });

  it('다음날 00:00은 OVERDUE다', () => {
    expect(getStatus(todo, d('2026-11-06T00:00+09:00'))).toBe('OVERDUE');
  });
});

describe('getStatus: 시작 전 경계 (EX-11, Q-01)', () => {
  const todo = {
    completed: false,
    startAt: d('2026-11-10T09:00+09:00'),
    endAt: d('2026-11-10T18:00+09:00'),
  };

  it('08:59는 NOT_STARTED다', () => {
    expect(getStatus(todo, d('2026-11-10T08:59+09:00'))).toBe('NOT_STARTED');
  });

  it('08:59:59는 분 단위 절삭으로 NOT_STARTED다', () => {
    expect(getStatus(todo, d('2026-11-10T08:59:59+09:00'))).toBe('NOT_STARTED');
  });

  it('09:00은 IN_PROGRESS다', () => {
    expect(getStatus(todo, d('2026-11-10T09:00+09:00'))).toBe('IN_PROGRESS');
  });
});

describe('getStatus: 완료 우선 (EX-12, S1)', () => {
  it('기한이 지난 뒤 완료한 할일은 COMPLETED다', () => {
    const todo = {
      completed: true,
      startAt: d('2026-11-03T00:00+09:00'),
      endAt: d('2026-11-03T23:59+09:00'),
    };
    expect(getStatus(todo, d('2026-11-04T10:00+09:00'))).toBe('COMPLETED');
  });

  it('시작 전인 완료 할일도 COMPLETED다', () => {
    const todo = {
      completed: true,
      startAt: d('2026-11-10T09:00+09:00'),
      endAt: d('2026-11-10T18:00+09:00'),
    };
    expect(getStatus(todo, d('2026-11-04T10:00+09:00'))).toBe('COMPLETED');
  });
});

describe('getStatus: 4개 상태 (EX-14, N-09)', () => {
  const now = d('2026-11-10T12:00+09:00');
  const period = (s, e) => ({ startAt: d(s), endAt: d(e) });

  it('서로 다른 4건이 각각 하나의 상태로 분류된다', () => {
    expect(getStatus({ completed: false, ...period('2026-11-11T09:00+09:00', '2026-11-11T18:00+09:00') }, now)).toBe(
      'NOT_STARTED',
    );
    expect(getStatus({ completed: false, ...period('2026-11-10T09:00+09:00', '2026-11-10T18:00+09:00') }, now)).toBe(
      'IN_PROGRESS',
    );
    expect(getStatus({ completed: true, ...period('2026-11-10T09:00+09:00', '2026-11-10T18:00+09:00') }, now)).toBe(
      'COMPLETED',
    );
    expect(getStatus({ completed: false, ...period('2026-11-09T00:00+09:00', '2026-11-09T23:59+09:00') }, now)).toBe(
      'OVERDUE',
    );
  });

  it('TodoStatus는 4개 값을 갖는 frozen 객체다', () => {
    expect(Object.values(TodoStatus).sort()).toEqual(['COMPLETED', 'IN_PROGRESS', 'NOT_STARTED', 'OVERDUE']);
    expect(Object.isFrozen(TodoStatus)).toBe(true);
  });
});

describe('getStatus: 시작=종료 경계 (Q-01)', () => {
  const todo = {
    completed: false,
    startAt: d('2026-11-06T14:00+09:00'),
    endAt: d('2026-11-06T14:00+09:00'),
  };

  it('14:00:30은 IN_PROGRESS다', () => {
    expect(getStatus(todo, d('2026-11-06T14:00:30+09:00'))).toBe('IN_PROGRESS');
  });

  it('14:01은 OVERDUE다', () => {
    expect(getStatus(todo, d('2026-11-06T14:01+09:00'))).toBe('OVERDUE');
  });
});
