import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '@/shared/api/client'
import type { Team, Todo } from '@/shared/types'
import { useCalendarStore } from '@/stores/calendarStore'
import { useTodoFilterStore } from '@/stores/todoFilterStore'
import { me, renderApp } from '@/test/renderApp'

vi.mock('@/shared/api/client', async (orig) => ({
  ...(await orig<typeof import('@/shared/api/client')>()),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}))

const get = vi.mocked(api.get)

const todo = (over: Partial<Todo> = {}): Todo => ({
  id: 'a',
  title: '워크숍 준비',
  description: null,
  startAt: '2026-11-03T00:00+09:00',
  endAt: '2026-11-05T23:59+09:00',
  completed: false,
  completedAt: null,
  status: 'IN_PROGRESS',
  owner: { id: '1', name: '홍길동' },
  category: { id: 'c1', name: '기본' },
  sharedTeams: [],
  canEdit: true,
  isOwner: true,
  ...over,
})

function setup(items: Todo[] = [todo()], truncated = false, teams: Team[] = [{ id: 't1', name: '마케팅팀', role: 'MEMBER', color: null }]) {
  get.mockImplementation(async (path: string) => {
    if (path === '/api/me') return me
    if (path === '/api/teams') return { items: teams }
    if (path === '/api/teams/t1/members') return { items: [{ userId: '1', name: '홍길동', email: '', role: 'OWNER' }] }
    if (path === '/api/todos/a') return items[0]
    if (path === '/api/todos/a/histories') return { items: [] }
    return { items, truncated }
  })
}
const calCalls = () => get.mock.calls.filter(([p]) => p === '/api/todos')
const lastQuery = () => calCalls().at(-1)![1]!

beforeEach(() => {
  vi.resetAllMocks()
  useTodoFilterStore.getState().reset()
  useCalendarStore.setState({ view: 'dayGridMonth', date: '2026-11-04' })
})

describe('CalendarPage', () => {
  it('11월 월 뷰 범위(11/01–12/13, 6주 42일)를 사용자 시간대 오프셋으로 조회하고 11/03–11/05 세 칸에 보인다', async () => {
    setup()
    renderApp('/calendar')
    expect(await screen.findByText('2026년 11월')).toBeInTheDocument()
    await waitFor(() => expect(calCalls().length).toBeGreaterThan(0))
    expect(lastQuery()).toMatchObject({ from: '2026-11-01T00:00+09:00', to: '2026-12-13T00:00+09:00' })
    // 11/03–11/05 는 같은 주 행의 막대 하나로 이어진다(11/04 에서 끊기지 않음). 칸별 확인은 브라우저에서
    await waitFor(() => expect(document.querySelectorAll('.fc-daygrid-event').length).toBe(1))
    expect(document.querySelector('.fc-event-end')).not.toBeNull() // 종료 23:59 가 11/05 칸 안에서 끝난다(다음 주로 넘어가지 않음)
    expect(document.querySelector('.fc-event-start')).not.toBeNull()
    // 일요일 시작
    expect(document.querySelector('.fc-col-header-cell')).toHaveTextContent('일')
  })

  it('truncated:true 면 안내 띠를 보이고 false 면 없다', async () => {
    setup([todo()], true)
    renderApp('/calendar')
    expect(await screen.findByText('일부 할일만 표시됩니다. 필터를 좁혀 주세요.')).toBeInTheDocument()
  })

  it('truncated:false 면 안내 띠가 없다', async () => {
    setup()
    renderApp('/calendar')
    await waitFor(() => expect(document.querySelectorAll('.fc-daygrid-event').length).toBeGreaterThan(0))
    expect(screen.queryByText('일부 할일만 표시됩니다. 필터를 좁혀 주세요.')).toBeNull()
  })

  it('이벤트를 누르면 /todos/:id 로 이동한다', async () => {
    setup()
    renderApp('/calendar')
    await waitFor(() => expect(document.querySelector('.fc-daygrid-event')).not.toBeNull())
    await userEvent.click(document.querySelector('.fc-daygrid-event')!)
    expect(await screen.findByLabelText('현재 위치')).toHaveTextContent('/todos/a')
  })

  it('이전·다음·오늘과 월·주·일 전환으로 범위가 바뀌어 재조회한다', async () => {
    setup()
    renderApp('/calendar')
    await screen.findByText('2026년 11월')
    await userEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(await screen.findByText('2026년 12월')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '이전' }))
    expect(await screen.findByText('2026년 11월')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: '주' }))
    await waitFor(() => expect(useCalendarStore.getState().view).toBe('timeGridWeek'))
    await waitFor(() => expect(lastQuery()).toMatchObject({ from: '2026-11-01T00:00+09:00', to: '2026-11-08T00:00+09:00' }))
    await userEvent.click(screen.getByRole('radio', { name: '일' }))
    await waitFor(() => expect(lastQuery()).toMatchObject({ from: '2026-11-01T00:00+09:00', to: '2026-11-02T00:00+09:00' })) // 월 이동 후 기준일은 11/01

    await userEvent.click(screen.getByRole('button', { name: '오늘' }))
    await waitFor(() => expect(useCalendarStore.getState().date).toMatch(/^\d{4}-\d{2}-\d{2}$/))
    await userEvent.click(screen.getByRole('radio', { name: '월' }))
    await waitFor(() => expect(useCalendarStore.getState().view).toBe('dayGridMonth'))
  })

  it('한 칸에 4건 이상이면 3개와 +N(5건이면 +2) 을 보이고 +N 을 누르면 일 뷰로 간다', async () => {
    setup([1, 2, 3, 4, 5].map((i) => todo({ id: `t${i}`, title: `일정${i}`, startAt: '2026-11-04T09:00+09:00', endAt: '2026-11-04T10:00+09:00' })))
    renderApp('/calendar')
    const more = await screen.findByText('+2')
    await userEvent.click(more)
    await waitFor(() => expect(useCalendarStore.getState().view).toBe('timeGridDay'))
  })

  it('보기를 팀으로 바꾸면 teamId 로 재조회하고 등록 링크에 teamId 가 붙는다', async () => {
    setup()
    renderApp('/calendar')
    await screen.findByText('2026년 11월')
    expect(screen.getByRole('link', { name: '할일 등록' })).toHaveAttribute('href', '/todos/new')
    await userEvent.click(screen.getByLabelText('보기'))
    await userEvent.click(await screen.findByRole('option', { name: '마케팅팀' }))
    await waitFor(() => expect(lastQuery()).toMatchObject({ teamId: 't1' }))
    expect(screen.getByRole('link', { name: '할일 등록' })).toHaveAttribute('href', '/todos/new?teamId=t1')
  })

  it('모바일 월 뷰는 막대 없이 날짜 칸에 개수만 보이고 칸을 누르면 그 날의 일 뷰로 간다', async () => {
    const mm = vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList)
    try {
      setup()
      renderApp('/calendar')
      expect(await screen.findAllByText('1건')).toHaveLength(3) // 11/03–11/05
      expect(document.querySelectorAll('.fc-daygrid-event').length).toBe(0)
      await userEvent.click(document.querySelector('[data-date="2026-11-04"]')!)
      await waitFor(() => expect(useCalendarStore.getState()).toMatchObject({ view: 'timeGridDay', date: '2026-11-04' }))
    } finally {
      mm.mockRestore()
    }
  })

  it('일 뷰에서 할일이 없으면 빈 상태 문구를 보인다', async () => {
    useCalendarStore.setState({ view: 'timeGridDay', date: '2026-11-04' })
    setup([])
    renderApp('/calendar')
    expect(await screen.findByText('이 날 할일이 없습니다.')).toBeInTheDocument()
  })

  describe('막대 색·상태(UI-13)', () => {
    const bar = () => document.querySelector<HTMLElement>('.fc-daygrid-event')!
    const main = () => bar().querySelector<HTMLElement>('.fc-event-main')!
    const teams: Team[] = [
      { id: 't1', name: '마케팅팀', role: 'MEMBER', color: 'BLUE' },
      { id: 't2', name: '영업팀', role: 'MEMBER', color: 'YELLOW' },
    ]
    const shared = (...ids: string[]) => ids.map((id) => ({ id, name: id === 't1' ? '마케팅팀' : '영업팀' }))
    const render = async (t: Todo, ts = teams) => {
      setup([t], false, ts)
      renderApp('/calendar')
      await waitFor(() => expect(bar()).not.toBeNull())
    }

    it('진행 중은 팀 색 채움 + 채움 글자색, 굵은 제목만 있고 시각은 없으며 툴팁은 공유 팀만', async () => {
      await render(todo({ sharedTeams: shared('t1') }))
      await waitFor(() => expect(bar().style.backgroundColor).toBe('rgb(37, 99, 235)'))
      expect(main().style.color).toBe('rgb(255, 255, 255)')
      expect(bar().classList).toContain('bar-in_progress')
      expect(bar().querySelector('[title]')).toHaveAttribute('title', '공유 팀: 마케팅팀')
      expect(bar().querySelector('.fc-event-title')).toHaveClass('font-semibold')
      expect(bar().querySelector('.fc-event-time')).toBeNull()
      expect(bar()).toHaveTextContent(/^워크숍 준비$/)
    })

    it('개인 할일은 기본색(--primary)이고 툴팁이 없다', async () => {
      await render(todo())
      expect(bar().style.backgroundColor).toBe('var(--primary)')
      expect(bar().querySelector('[title]')).toBeNull()
    })

    it('시작 전은 연한 배경 + 색 테두리, 노랑은 글자를 어둡게 한다', async () => {
      await render(todo({ status: 'NOT_STARTED', sharedTeams: shared('t2') }))
      await waitFor(() => expect(bar().classList).toContain('bar-not_started'))
      expect(bar().style.backgroundColor).toContain('color-mix')
      expect(bar().style.borderColor).toBe('rgb(250, 204, 21)')
      expect(main().style.color).toContain('black')
    })

    it('완료는 취소선 + 흐림', async () => {
      await render(todo({ status: 'COMPLETED', completed: true, sharedTeams: shared('t1') }))
      await waitFor(() => expect(bar().classList).toContain('bar-completed'))
      // a.fc-event의 text-decoration은 FullCalendar CSS가 덮으므로 제목 span에 건다
      expect(bar().querySelector('.fc-event-title')!.classList).toContain('line-through')
      expect(bar().classList).toContain('opacity-50')
    })

    it('기한 초과는 채움 + 왼쪽 띠 클래스 + 경고 아이콘', async () => {
      await render(todo({ status: 'OVERDUE', sharedTeams: shared('t1') }))
      await waitFor(() => expect(bar().classList).toContain('bar-overdue'))
      expect(bar().classList).toContain('border-l-destructive!')
      expect(bar().querySelector('svg.lucide-triangle-alert')).not.toBeNull()
    })

    it('여러 팀이면 슬레이트 + Users 아이콘, 툴팁에 팀 목록', async () => {
      await render(todo({ sharedTeams: shared('t1', 't2') }))
      await waitFor(() => expect(bar().style.backgroundColor).toBe('rgb(100, 116, 139)'))
      expect(bar().querySelector('svg.lucide-users')).not.toBeNull()
      expect(bar().querySelector('[title]')).toHaveAttribute('title', '공유 팀: 마케팅팀, 영업팀')
    })
  })
})
