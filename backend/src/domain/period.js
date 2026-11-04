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

// 요청자 시간대 달력 날짜 수. [from, to) 반열린 구간이라 to 직전 순간의 날짜까지 센다(S-03, 서머타임에도 시간 수로 세지 않음)
export function calendarDays(from, to, tz) {
  const [y1, m1, d1] = dayOf(from, tz);
  const [y2, m2, d2] = dayOf(new Date(to.getTime() - 1), tz);
  return (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000 + 1;
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

// swagger DateTimeOffset 형식. UTC도 +00:00으로 통일
export function formatOffset(date, tz) {
  // 분 절삭 먼저: parts()가 초를 버려 초가 있는 값은 offset()이 초만큼 틀어진다
  const t = Math.floor(date.getTime() / 60000) * 60000;
  const p = parts(new Date(t), tz);
  const off = offset(t, tz) / 60000;
  const a = Math.abs(off);
  const two = (n) => String(n).padStart(2, '0');
  return (
    `${String(p.year).padStart(4, '0')}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}` +
    `${off < 0 ? '-' : '+'}${two(Math.floor(a / 60))}:${two(a % 60)}`
  );
}
