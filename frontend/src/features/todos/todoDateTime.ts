import { parts } from '@/shared/lib/dateTime'

// 해당 시각(ms)에 timeZone 이 UTC 보다 몇 분 앞서는지(분 단위 벽시계 기준)
function offsetMinutes(ms: number, timeZone: string): number {
  const p = parts(new Date(ms).toISOString(), timeZone)
  return (Date.parse(`${p.date}T${p.time}:00Z`) - ms) / 60000
}

/**
 * 폼의 날짜·시각 → 요청 값(BD-01). 날짜 없음: undefined(필드 생략), 시각 없음: 'YYYY-MM-DD',
 * 둘 다 있음: 그 시간대의 그 날짜 오프셋을 붙인 'YYYY-MM-DDTHH:mm+09:00'. 현재 시각은 쓰지 않는다(FE-06).
 */
export function toRequestDateTime(date: string, time: string, timeZone: string): string | undefined {
  if (!date) return undefined
  if (!time) return date
  // 벽시계를 UTC 로 본 값에서 오프셋을 두 번 보정한다(DST 경계에서도 그 날짜의 오프셋이 맞는다)
  const wall = Date.parse(`${date}T${time}:00Z`)
  const offset = offsetMinutes(wall - offsetMinutes(wall, timeZone) * 60000, timeZone)
  const abs = Math.abs(offset)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${date}T${time}${offset < 0 ? '-' : '+'}${hh}:${mm}`
}

/** 응답 ISO → 사용자 시간대 기준 date·time 입력값 */
export function toFormDateTime(iso: string, timeZone: string): { date: string; time: string } {
  const { date, time } = parts(iso, timeZone)
  return { date, time }
}

/** 종료 < 시작이면 true. 시각을 비우면 시작 00:00, 종료 23:59 로 본다. 날짜가 하나라도 없으면 false(서버가 채운다) */
export function isEndBeforeStart(sd: string, st: string, ed: string, et: string): boolean {
  if (!sd || !ed) return false
  return `${ed}T${et || '23:59'}` < `${sd}T${st || '00:00'}`
}
