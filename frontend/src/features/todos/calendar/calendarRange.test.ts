import { countTodosByDate, toCalendarRange, toWallClock } from './calendarRange'

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

describe('countTodosByDate', () => {
  const t = (startAt: string, endAt: string) => ({ startAt, endAt })
  it('하루짜리는 그 날짜에 1', () => {
    const m = countTodosByDate([t('2026-11-04T09:00+09:00', '2026-11-04T10:00+09:00')], '2026-11-01', '2026-12-13')
    expect([...m]).toEqual([['2026-11-04', 1]])
  })
  it('여러 날 걸치면 각 날짜에 1씩, 같은 날 겹치면 합산', () => {
    const m = countTodosByDate(
      [t('2026-11-03T00:00+09:00', '2026-11-05T23:59+09:00'), t('2026-11-04T09:00+09:00', '2026-11-04T10:00+09:00')],
      '2026-11-01',
      '2026-12-13',
    )
    expect([m.get('2026-11-03'), m.get('2026-11-04'), m.get('2026-11-05'), m.get('2026-11-06')]).toEqual([1, 2, 1, undefined])
  })
  it('범위 밖 날짜는 세지 않는다(끝은 배타)', () => {
    const m = countTodosByDate([t('2026-10-30T00:00+09:00', '2026-11-02T23:59+09:00')], '2026-11-01', '2026-11-02')
    expect([...m]).toEqual([['2026-11-01', 1]])
  })
})
