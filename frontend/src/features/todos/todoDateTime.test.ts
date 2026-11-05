import { isEndBeforeStart, toFormDateTime, toRequestDateTime } from './todoDateTime'

describe('toRequestDateTime', () => {
  it('날짜가 없으면 필드를 생략한다(undefined)', () => {
    expect(toRequestDateTime('', '', 'Asia/Seoul')).toBeUndefined()
    expect(toRequestDateTime('', '09:00', 'Asia/Seoul')).toBeUndefined()
  })
  it('시각을 비우면 날짜만 보낸다', () => {
    expect(toRequestDateTime('2026-11-10', '', 'Asia/Seoul')).toBe('2026-11-10')
  })
  it('Asia/Seoul 은 +09:00', () => {
    expect(toRequestDateTime('2026-11-10', '09:00', 'Asia/Seoul')).toBe('2026-11-10T09:00+09:00')
    expect(toRequestDateTime('2026-11-10', '00:00', 'Asia/Seoul')).toBe('2026-11-10T00:00+09:00')
  })
  it('America/New_York 은 날짜에 따라 여름 -04:00, 겨울 -05:00', () => {
    expect(toRequestDateTime('2026-07-01', '09:00', 'America/New_York')).toBe('2026-07-01T09:00-04:00')
    expect(toRequestDateTime('2026-12-01', '09:00', 'America/New_York')).toBe('2026-12-01T09:00-05:00')
  })
  it('DST 전환일에도 그 시각의 오프셋을 쓴다', () => {
    expect(toRequestDateTime('2026-03-08', '01:30', 'America/New_York')).toBe('2026-03-08T01:30-05:00')
    expect(toRequestDateTime('2026-03-08', '12:00', 'America/New_York')).toBe('2026-03-08T12:00-04:00')
  })
  it('30분 단위 오프셋(+05:30)도 맞춘다', () => {
    expect(toRequestDateTime('2026-11-10', '09:00', 'Asia/Kolkata')).toBe('2026-11-10T09:00+05:30')
  })
})

describe('toFormDateTime', () => {
  it('응답 ISO 를 사용자 시간대의 date·time 으로 바꾼다', () => {
    expect(toFormDateTime('2026-11-10T00:30+09:00', 'Asia/Seoul')).toEqual({ date: '2026-11-10', time: '00:30' })
    expect(toFormDateTime('2026-11-10T00:30+09:00', 'America/New_York')).toEqual({ date: '2026-11-09', time: '10:30' })
  })
})

describe('isEndBeforeStart', () => {
  it('종료가 시작보다 빠르면 true, 같으면 false', () => {
    expect(isEndBeforeStart('2026-11-10', '10:00', '2026-11-10', '09:59')).toBe(true)
    expect(isEndBeforeStart('2026-11-10', '10:00', '2026-11-10', '10:00')).toBe(false)
  })
  it('시각을 비우면 시작 00:00, 종료 23:59 로 본다', () => {
    expect(isEndBeforeStart('2026-11-10', '', '2026-11-10', '')).toBe(false)
    expect(isEndBeforeStart('2026-11-10', '23:59', '2026-11-10', '')).toBe(false)
    expect(isEndBeforeStart('2026-11-11', '', '2026-11-10', '23:59')).toBe(true)
  })
  it('날짜가 하나라도 없으면 비교하지 않는다', () => {
    expect(isEndBeforeStart('', '', '2026-11-10', '')).toBe(false)
    expect(isEndBeforeStart('2026-11-10', '', '', '')).toBe(false)
  })
})
