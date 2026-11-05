import { formatDateTime, formatPeriod } from './dateTime'

describe('formatDateTime', () => {
  it('Asia/Seoul은 약칭 없이 YYYY-MM-DD HH:mm', () => {
    expect(formatDateTime('2026-11-04T09:00+09:00', 'Asia/Seoul')).toBe('2026-11-04 09:00')
  })

  it('다른 오프셋 입력도 사용자 시간대로 변환한다', () => {
    expect(formatDateTime('2026-11-04T00:30Z', 'Asia/Seoul')).toBe('2026-11-04 09:30')
    expect(formatDateTime('2026-11-04T23:30-05:00', 'Asia/Seoul')).toBe('2026-11-05 13:30')
  })

  it('Asia/Seoul이 아니면 시간대 약칭을 붙인다', () => {
    expect(formatDateTime('2026-11-04T09:00+09:00', 'America/New_York')).toBe('2026-11-03 19:00 EST')
  })

  it('자정은 00:00', () => {
    expect(formatDateTime('2026-11-04T00:00+09:00', 'Asia/Seoul')).toBe('2026-11-04 00:00')
  })
})

describe('formatPeriod', () => {
  it('같은 날이면 종료 날짜를 생략한다', () => {
    expect(formatPeriod('2026-11-04T09:00+09:00', '2026-11-04T18:00+09:00', 'Asia/Seoul')).toBe(
      '2026-11-04 09:00 ~ 18:00',
    )
  })

  it('다른 날이면 종료 날짜를 쓴다', () => {
    expect(formatPeriod('2026-11-04T09:00+09:00', '2026-11-06T18:00+09:00', 'Asia/Seoul')).toBe(
      '2026-11-04 09:00 ~ 2026-11-06 18:00',
    )
  })

  it('오프셋이 달라도 사용자 시간대로 변환한 뒤 같은 날을 판정한다', () => {
    // 00:00Z = 서울 09:00, 08:00-05:00 = 13:00Z = 서울 22:00
    expect(formatPeriod('2026-11-04T00:00Z', '2026-11-04T08:00-05:00', 'Asia/Seoul')).toBe('2026-11-04 09:00 ~ 22:00')
  })

  it('다른 시간대는 약칭을 한 번만 붙인다(같은 날)', () => {
    expect(formatPeriod('2026-11-04T09:00+09:00', '2026-11-04T10:00+09:00', 'America/New_York')).toBe(
      '2026-11-03 19:00 ~ 20:00 EST',
    )
  })

  it('다른 시간대, 다른 날', () => {
    expect(formatPeriod('2026-11-04T09:00+09:00', '2026-11-06T18:00+09:00', 'America/New_York')).toBe(
      '2026-11-03 19:00 ~ 2026-11-06 04:00 EST',
    )
  })
})
