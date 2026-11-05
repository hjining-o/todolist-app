import { toCalendarRange, toWallClock } from './calendarRange'

describe('toCalendarRange', () => {
  it('Asia/Seoul: 11월 월 뷰 10/26–12/06 → +09:00 00:00', () => {
    expect(toCalendarRange('2026-10-25', '2026-12-06', 'Asia/Seoul')).toEqual({
      from: '2026-10-25T00:00+09:00',
      to: '2026-12-06T00:00+09:00',
    })
  })

  it('America/New_York: 11월 월 뷰는 11/01 DST 종료를 걸쳐 -04:00 → -05:00', () => {
    expect(toCalendarRange('2026-10-25', '2026-12-06', 'America/New_York')).toEqual({
      from: '2026-10-25T00:00-04:00',
      to: '2026-12-06T00:00-05:00',
    })
  })

  it('America/New_York: 3월 월 뷰는 03/08 DST 시작을 걸쳐 -05:00 → -04:00', () => {
    expect(toCalendarRange('2026-03-01', '2026-04-12', 'America/New_York')).toEqual({
      from: '2026-03-01T00:00-05:00',
      to: '2026-04-12T00:00-04:00',
    })
  })
})

describe('toWallClock', () => {
  it('+09:00, -05:00, Z 의 오프셋을 뗀다', () => {
    expect(toWallClock('2026-11-04T09:00+09:00')).toBe('2026-11-04T09:00')
    expect(toWallClock('2026-11-04T23:59-05:00')).toBe('2026-11-04T23:59')
    expect(toWallClock('2026-11-04T09:00Z')).toBe('2026-11-04T09:00')
  })
})
