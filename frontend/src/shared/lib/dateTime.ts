const SEOUL = 'Asia/Seoul'

// 서버 ISO 문자열을 지정 시간대의 날짜·시각·약칭으로 나눈다(현재 시각은 쓰지 않는다, FE-06)
export function parts(iso: string, timeZone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'short',
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  )
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, zone: p.timeZoneName }
}

const withZone = (text: string, timeZone: string, zone: string) => (timeZone === SEOUL ? text : `${text} ${zone}`)

/** 'YYYY-MM-DD HH:mm' (Asia/Seoul이 아니면 시간대 약칭을 덧붙인다, U-19) */
export function formatDateTime(iso: string, timeZone: string): string {
  const s = parts(iso, timeZone)
  return withZone(`${s.date} ${s.time}`, timeZone, s.zone)
}

/** '시작 ~ 종료' (같은 날이면 종료의 날짜를 생략한다) */
export function formatPeriod(startIso: string, endIso: string, timeZone: string): string {
  const s = parts(startIso, timeZone)
  const e = parts(endIso, timeZone)
  const end = s.date === e.date ? e.time : `${e.date} ${e.time}`
  return withZone(`${s.date} ${s.time} ~ ${end}`, timeZone, e.zone)
}
