import { create } from 'zustand'

// SC-05 뷰·기준일 UI 상태(FE-05). 서버 데이터는 넣지 않는다
export type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'

// 초기 기준일·'오늘' 이동만 브라우저 시계를 쓴다(FE-06 예외). 'YYYY-MM-DD'
export function browserToday(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface CalendarState {
  view: CalendarView
  date: string
  setCalendar: (view: CalendarView, date: string) => void
}

export const useCalendarStore = create<CalendarState>((set) => ({
  view: 'dayGridMonth',
  date: browserToday(),
  setCalendar: (view, date) => set({ view, date }),
}))
