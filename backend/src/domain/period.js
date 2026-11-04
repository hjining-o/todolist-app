import { AppError } from './errors.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parts(date, tz) {
  const p = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .formatToParts(date)
    .forEach((x) => {
      if (x.type !== 'literal') p[x.type] = Number(x.value);
    });
  return p;
}

function offset(t, tz) {
  const p = parts(new Date(t), tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - t;
}

// 벽시계 -> 인스턴트. DST 경계에서 추정·실제 오프셋이 다를 수 있어 두 번 보정한다
// shortcut: 자정이 없는 시간대(DST가 00:00에 바뀌는 곳)는 01:00 근처로 밀린다, 해당 사용자가 생기면 보정
function wallToDate(y, mo, d, h, m, tz) {
  const g = Date.UTC(y, mo - 1, d, h, m);
  const t = g - offset(g, tz);
  return new Date(g - offset(t, tz));
}

function dayOf(date, tz) {
  const p = parts(date, tz);
  return [p.year, p.month, p.day];
}

export function normalizePeriod({ startAt, endAt }, timezone, now) {
  const toDate = (v, h, m) => {
    if (v == null) return null;
    if (typeof v === 'string' && DATE_ONLY.test(v)) {
      const [y, mo, d] = v.split('-').map(Number);
      return wallToDate(y, mo, d, h, m, timezone);
    }
    return typeof v === 'string' ? new Date(v) : v;
  };
  let start = toDate(startAt, 0, 0);
  let end = toDate(endAt, 23, 59);

  if (!start && !end) {
    start = wallToDate(...dayOf(now, timezone), 0, 0, timezone);
    end = wallToDate(...dayOf(now, timezone), 23, 59, timezone);
  } else if (!end) {
    end = wallToDate(...dayOf(start, timezone), 23, 59, timezone);
  } else if (!start) {
    const today0 = wallToDate(...dayOf(now, timezone), 0, 0, timezone);
    start = today0.getTime() < end.getTime() ? today0 : end;
  }

  if (end.getTime() < start.getTime()) throw AppError.of('INVALID_PERIOD');
  return { startAt: start, endAt: end };
}
