import { toRequestDateTime } from '../todoDateTime'

/**
 * FullCalendar(timeZone:'UTC') 의 보이는 범위(시작 포함·끝 배타, 'YYYY-MM-DD') → API from·to.
 * 그 날짜 00:00 에 사용자 시간대의 그 날짜 오프셋을 붙인다(BD-09 의 + 인코딩은 api client 가 한다)
 */
export function toCalendarRange(startDate: string, endDate: string, timeZone: string) {
  return {
    from: toRequestDateTime(startDate, '00:00', timeZone)!,
    to: toRequestDateTime(endDate, '00:00', timeZone)!,
  }
}

/**
 * 서버 ISO → 오프셋을 뗀 벽시계 문자열(FE-10). FullCalendar 는 timeZone:'UTC' 로 그대로 그린다.
 * 종료 23:59 도 그대로 주면 end(배타) 가 그 날 00:00 이후라 그 날 칸까지 포함된다
 */
export function toWallClock(iso: string): string {
  return iso.replace(/(Z|[+-]\d{2}:\d{2})$/, '')
}
