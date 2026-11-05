// SC-05
import { cn } from '@/shared/lib/utils'
import koLocale from '@fullcalendar/core/locales/ko'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { DatesSetArg, EventClickArg, EventContentArg } from '@fullcalendar/core'
import { ChevronLeft, ChevronRight, Plus, TriangleAlert, Users } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMe } from '@/features/auth/hooks'
import { useTeams } from '@/features/teams/hooks'
import { resolveTeamColor, todoBarColor } from '@/features/teams/teamColors'
import { countTodosByDate, toCalendarRange, toWallClock } from '@/features/todos/calendar/calendarRange'
import { useCalendarTodos } from '@/features/todos/calendar/useCalendarTodos'
import { ViewSelect } from '@/features/todos/components/FilterBar'
import type { Todo } from '@/shared/types'
import { useMediaQuery } from '@/shared/lib/useMediaQuery'
import { PageHeader } from '@/shared/components/PageHeader'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { browserToday, useCalendarStore, type CalendarView } from '@/stores/calendarStore'
import { useTodoFilterStore } from '@/stores/todoFilterStore'

// 시작 전·완료는 연한 배경 + 색 테두리·글자(CL-05). 노랑은 글자를 검정 쪽으로 어둡게 한다
const tint = (hex: string) => `color-mix(in srgb, ${hex} 15%, transparent)`
const darken = (hex: string, fg: string) => (fg === '#000000' ? `color-mix(in srgb, ${hex} 40%, black)` : hex)
// 상태별 막대 모양. 색은 FullCalendar 이벤트 색 속성(인라인)으로, 나머지는 클래스로 준다
const STATUS_CLASS = {
  IN_PROGRESS: '',
  NOT_STARTED: '',
  COMPLETED: 'opacity-50', // 취소선은 제목 span에 건다(FullCalendar가 a.fc-event의 text-decoration을 none으로 덮음)
  OVERDUE: 'border-l-4! border-l-destructive!',
} as const

function barProps(t: Todo, colors: ReturnType<typeof resolveTeamColor>) {
  const bar = todoBarColor(t, colors)
  const light = t.status === 'NOT_STARTED' || t.status === 'COMPLETED'
  // 색이 없으면(개인 할일) 기본색 --primary
  const hex = bar.hex ?? 'var(--primary)'
  const fg = bar.fg ?? 'var(--primary-foreground)'
  const color = light
    ? { backgroundColor: tint(hex), borderColor: hex, textColor: bar.fg ? darken(hex, bar.fg) : hex }
    : { backgroundColor: hex, borderColor: hex, textColor: fg }
  // 툴팁은 공유 팀만(상세는 클릭하면 SC-04). 공유 팀이 없으면 툴팁 없음
  const title = t.sharedTeams.length > 0 ? `공유 팀: ${t.sharedTeams.map((x) => x.name).join(', ')}` : undefined
  return { ...color, classNames: ['bar-' + t.status.toLowerCase(), STATUS_CLASS[t.status]], extendedProps: { title, multi: bar.multi, overdue: t.status === 'OVERDUE', completed: t.status === 'COMPLETED' } }
}

function BarContent({ arg }: { arg: EventContentArg }) {
  const { title, multi, overdue, completed } = arg.event.extendedProps
  return (
    <div title={title} className="flex w-full items-center gap-1 overflow-hidden px-1">
      {overdue && <TriangleAlert className="size-3 shrink-0" aria-hidden />}
      {multi && <Users className="size-3 shrink-0" aria-hidden />}
      <span className={cn('fc-event-title truncate font-semibold', completed && 'line-through')}>{arg.event.title}</span>
    </div>
  )
}

const ymd = (d: Date) => d.toISOString().slice(0, 10) // timeZone:'UTC' 라 UTC 날짜가 곧 벽시계 날짜

export function CalendarPage() {
  const navigate = useNavigate()
  const calendarRef = useRef<FullCalendar>(null)
  const { data: me } = useMe()
  const view = useTodoFilterStore((s) => s.view)
  // 값별 selector: 같은 값을 다시 저장해도 재렌더하지 않는다(datesSet 재호출 루프 방지)
  const calView = useCalendarStore((s) => s.view)
  const setCalendar = useCalendarStore((s) => s.setCalendar)
  const [initial] = useState(() => ({ view: calView, date: useCalendarStore.getState().date })) // 초기값만 쓴다(이후는 FullCalendar 가 주도)
  const [dates, setDates] = useState<{ start: string; end: string; title: string } | null>(null)
  const timeZone = me?.timezone
  const { data: teams } = useTeams()
  const teamColors = useMemo(() => resolveTeamColor(teams?.items ?? []), [teams])
  // 사용자 시간대를 알아야 from·to 오프셋을 정할 수 있다
  const range = dates && timeZone ? toCalendarRange(dates.start, dates.end, timeZone) : null
  const { data, isPending } = useCalendarTodos(range, view)
  // 모바일(<768px) 월 뷰는 막대 대신 날짜 칸에 개수만 보인다(PRD 5.4)
  const mobileMonth = !useMediaQuery('(min-width: 768px)') && calView === 'dayGridMonth'
  const mobileMonthRef = useRef(mobileMonth)
  mobileMonthRef.current = mobileMonth
  const counts = useMemo(
    () => (dates ? countTodosByDate(data?.items ?? [], dates.start, dates.end) : new Map<string, number>()),
    [data, dates],
  )

  const events = useMemo(
    () =>
      (mobileMonth ? [] : data?.items ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        start: toWallClock(t.startAt),
        end: toWallClock(t.endAt),
        ...barProps(t, teamColors),
      })),
    [data, mobileMonth, teamColors],
  )
  const api = () => calendarRef.current!.getApi()
  const onDatesSet = (arg: DatesSetArg) => {
    const next = { start: ymd(arg.start), end: ymd(arg.end), title: arg.view.title }
    // 같은 값이면 상태를 바꾸지 않는다(datesSet 이 재렌더마다 다시 불려 무한 갱신이 되는 것을 막는다)
    setDates((prev) => (prev && prev.start === next.start && prev.end === next.end && prev.title === next.title ? prev : next))
    setCalendar(arg.view.type as CalendarView, ymd(arg.view.calendar.getDate()))
  }
  const newPath = view.type === 'TEAM' ? `/todos/new?teamId=${view.teamId}` : '/todos/new'

  return (
    <div className="grid gap-4">
      <PageHeader title="캘린더" />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="이전" onClick={() => api().prev()}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" onClick={() => api().gotoDate(browserToday())}>
          오늘
        </Button>
        <Button variant="outline" size="icon" aria-label="다음" onClick={() => api().next()}>
          <ChevronRight />
        </Button>
        <span className="text-lg font-semibold" aria-live="polite">
          {dates?.title}
        </span>
        <ToggleGroup
          type="single"
          variant="outline"
          aria-label="보기 단위"
          value={calView}
          // 같은 항목을 다시 누르면 빈 값이 오므로 무시한다
          onValueChange={(v) => v && api().changeView(v)}
        >
          <ToggleGroupItem value="dayGridMonth">월</ToggleGroupItem>
          <ToggleGroupItem value="timeGridWeek">주</ToggleGroupItem>
          <ToggleGroupItem value="timeGridDay">일</ToggleGroupItem>
        </ToggleGroup>
        <Button asChild className="ml-auto">
          <Link to={newPath}>
            <Plus /> 할일 등록
          </Link>
        </Button>
      </div>
      <div>
        <ViewSelect />
      </div>
      {data?.truncated && (
        <Alert>
          <AlertDescription>일부 할일만 표시됩니다. 필터를 좁혀 주세요.</AlertDescription>
        </Alert>
      )}
      {isPending && dates && <p className="text-sm text-muted-foreground">불러오는 중...</p>}
      {calView === 'timeGridDay' && data && data.items.length === 0 && (
        <p className="text-sm text-muted-foreground">이 날 할일이 없습니다.</p>
      )}
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        locales={[koLocale]}
        locale="ko"
        timeZone="UTC"
        firstDay={0}
        dayMaxEvents={3}
        // 기간이 긴 할일이 위 줄을 먼저 차지한다. 시작 시각 순이면 늦게 시작한 여러 날 할일이 +N에 숨었다가 다음 날부터 첫 줄로 올라와 끊겨 보인다
        eventOrder="-duration,start,title"
        // 'day' 문자열은 dayGridDay 로 가므로 일 뷰(timeGridDay)로 직접 보낸다(U-13)
        moreLinkClick={(arg) => api().changeView('timeGridDay', arg.date)}
        moreLinkContent={({ num }) => `+${num}`}
        headerToolbar={false}
        height="auto"
        initialView={initial.view}
        initialDate={initial.date}
        events={events}
        eventDisplay="block"
        eventContent={(arg) => <BarContent arg={arg} />}
        dayCellContent={
          mobileMonth
            ? (arg) => {
                const n = counts.get(ymd(arg.date))
                return (
                  <>
                    {arg.dayNumberText}
                    {n ? <div className="text-xs text-muted-foreground">{n}건</div> : null}
                  </>
                )
              }
            : undefined
        }
        // dateClick 은 좌표로 칸을 찾아 jsdom 에서 안 되므로 칸 요소에 직접 건다. 칸은 뷰 이동 때 다시 만들어져 리스너가 쌓이지 않는다
        dayCellDidMount={(arg) => arg.el.addEventListener('click', () => mobileMonthRef.current && api().changeView('timeGridDay', arg.date))}
        datesSet={onDatesSet}
        eventClick={(arg: EventClickArg) => {
          arg.jsEvent.preventDefault()
          navigate(`/todos/${arg.event.id}`)
        }}
      />
    </div>
  )
}
