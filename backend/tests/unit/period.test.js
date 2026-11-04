import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/domain/errors.js';
import { formatOffset, normalizePeriod } from '../../src/domain/period.js';
import { getStatus } from '../../src/domain/todo-status.js';

const d = (s) => new Date(s);
const SEOUL = 'Asia/Seoul';
const NOW = d('2026-11-04T12:00+09:00');

const iso = (p) => ({ startAt: p.startAt.toISOString(), endAt: p.endAt.toISOString() });
const run = (input, tz = SEOUL, now = NOW) => iso(normalizePeriod(input, tz, now));

describe('normalizePeriod: 빈 값 채우기 (R4, EX-08)', () => {
  it('둘 다 없으면 오늘 00:00–23:59다', () => {
    expect(run({})).toEqual({ startAt: '2026-11-03T15:00:00.000Z', endAt: '2026-11-04T14:59:00.000Z' });
  });

  it('null도 빈 값으로 취급한다', () => {
    expect(run({ startAt: null, endAt: null })).toEqual(run({}));
  });

  it('시작만 일시로 주면 종료는 시작 날짜 23:59다', () => {
    expect(run({ startAt: '2026-11-10T09:00+09:00' })).toEqual({
      startAt: '2026-11-10T00:00:00.000Z',
      endAt: '2026-11-10T14:59:00.000Z',
    });
  });

  it('시작만 날짜로 주면 시작 00:00, 종료 23:59다', () => {
    expect(run({ startAt: '2026-11-10' })).toEqual({
      startAt: '2026-11-09T15:00:00.000Z',
      endAt: '2026-11-10T14:59:00.000Z',
    });
  });

  it('종료만 과거 날짜(11/01)면 시작 = min(오늘 00:00, 종료)로 둘 다 종료와 같고 OVERDUE다', () => {
    const p = normalizePeriod({ endAt: '2026-11-01' }, SEOUL, NOW);
    expect(iso(p)).toEqual({ startAt: '2026-11-01T14:59:00.000Z', endAt: '2026-11-01T14:59:00.000Z' });
    expect(getStatus({ completed: false, ...p }, NOW)).toBe('OVERDUE');
  });

  it('종료만 미래 일시면 시작은 오늘 00:00이다', () => {
    expect(run({ endAt: '2026-11-07T18:00+09:00' })).toEqual({
      startAt: '2026-11-03T15:00:00.000Z',
      endAt: '2026-11-07T09:00:00.000Z',
    });
  });

  it('둘 다 날짜면 시작 00:00, 종료 23:59다', () => {
    expect(run({ startAt: '2026-11-04', endAt: '2026-11-05' })).toEqual({
      startAt: '2026-11-03T15:00:00.000Z',
      endAt: '2026-11-05T14:59:00.000Z',
    });
  });

  it('Date 입력은 그대로 통과한다', () => {
    const startAt = d('2026-11-10T09:00+09:00');
    const endAt = d('2026-11-10T18:00+09:00');
    expect(run({ startAt, endAt })).toEqual({ startAt: startAt.toISOString(), endAt: endAt.toISOString() });
  });
});

describe('normalizePeriod: 종료 < 시작 검증 (R3, EX-07)', () => {
  const expectInvalid = (input) => {
    let err;
    try {
      normalizePeriod(input, SEOUL, NOW);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: 'INVALID_PERIOD', status: 400 });
  };

  it('종료 일시가 시작 일시보다 빠르면 INVALID_PERIOD다', () => {
    expectInvalid({ startAt: '2026-11-10T09:00+09:00', endAt: '2026-11-09T23:59+09:00' });
  });

  it('날짜만 줘도 종료 날짜가 빠르면 INVALID_PERIOD다', () => {
    expectInvalid({ startAt: '2026-11-10', endAt: '2026-11-09' });
  });

  it('Date 입력에서 종료가 1분 빠르면 INVALID_PERIOD다', () => {
    expectInvalid({ startAt: d('2026-11-06T14:00+09:00'), endAt: d('2026-11-06T13:59+09:00') });
  });

  it('시작 = 종료는 허용한다', () => {
    expect(run({ startAt: '2026-11-06T14:00+09:00', endAt: '2026-11-06T14:00+09:00' })).toEqual({
      startAt: '2026-11-06T05:00:00.000Z',
      endAt: '2026-11-06T05:00:00.000Z',
    });
  });

  it('종료가 1분 늦으면 허용한다', () => {
    expect(() =>
      normalizePeriod({ startAt: d('2026-11-06T14:00+09:00'), endAt: d('2026-11-06T14:01+09:00') }, SEOUL, NOW),
    ).not.toThrow();
  });
});

describe('normalizePeriod: 시간대 (R4, 완료 조건 6)', () => {
  const now = d('2026-11-04T02:00Z');

  it('같은 순간이라도 America/New_York 기준 오늘은 11/03이다', () => {
    expect(run({}, 'America/New_York', now)).toEqual({
      startAt: '2026-11-03T05:00:00.000Z',
      endAt: '2026-11-04T04:59:00.000Z',
    });
  });

  it('Asia/Seoul 기준 오늘은 11/04다', () => {
    expect(run({}, SEOUL, now)).toEqual({
      startAt: '2026-11-03T15:00:00.000Z',
      endAt: '2026-11-04T14:59:00.000Z',
    });
  });

  it('DST 해제일(뉴욕 11/01)은 UTC 오프셋이 하루 안에서 바뀌어도 00:00–23:59다', () => {
    expect(run({}, 'America/New_York', d('2026-11-01T16:00Z'))).toEqual({
      startAt: '2026-11-01T04:00:00.000Z',
      endAt: '2026-11-02T04:59:00.000Z',
    });
  });

  it('DST 시작일(뉴욕 03/08) 날짜 입력도 해당 날짜 00:00–23:59다', () => {
    expect(run({ startAt: '2026-03-08', endAt: '2026-03-08' }, 'America/New_York', now)).toEqual({
      startAt: '2026-03-08T05:00:00.000Z',
      endAt: '2026-03-09T03:59:00.000Z',
    });
  });

  it('시작만 오프셋 일시면 종료는 시작 인스턴트의 요청자 시간대 날짜 23:59다', () => {
    expect(run({ startAt: '2026-11-10T09:00+09:00' }, 'America/New_York', now)).toMatchObject({
      endAt: '2026-11-10T04:59:00.000Z',
    });
  });
});

describe('formatOffset', () => {
  it('초는 분 단위로 절삭한다', () => {
    expect(formatOffset(d('2026-11-04T00:00:30Z'), SEOUL)).toBe('2026-11-04T09:00+09:00');
  });

  it('DST 종료 경계에서 오프셋이 바뀐다', () => {
    expect(formatOffset(d('2026-11-01T05:30Z'), 'America/New_York')).toBe('2026-11-01T01:30-04:00');
    expect(formatOffset(d('2026-11-01T06:30Z'), 'America/New_York')).toBe('2026-11-01T01:30-05:00');
  });

  it('UTC도 Z가 아니라 +00:00', () => {
    expect(formatOffset(d('2026-11-04T00:00Z'), 'UTC')).toBe('2026-11-04T00:00+00:00');
  });
});
