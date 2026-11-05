import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '@/shared/api/client'
import type { Todo } from '@/shared/types'
import { useTodoFilterStore } from '@/stores/todoFilterStore'
import { me, renderApp } from '@/test/renderApp'

vi.mock('@/shared/api/client', async (orig) => ({
  ...(await orig<typeof import('@/shared/api/client')>()),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}))

const get = vi.mocked(api.get)
const patch = vi.mocked(api.patch)
const del = vi.mocked(api.del)

const todo = (over: Partial<Todo> = {}): Todo => ({
  id: 'a',
  title: '주간 보고서',
  description: null,
  startAt: '2026-11-04T09:00+09:00',
  endAt: '2026-11-04T18:00+09:00',
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

// 서버 응답을 흉내 낸다(목록은 items/total 고정)
function setup(items: Todo[] = [todo()], total = items.length) {
  get.mockImplementation(async (path: string) => {
    if (path === '/api/me') return me
    if (path === '/api/teams') return { items: [{ id: 't1', name: '마케팅팀', role: 'MEMBER' }] }
    if (path === '/api/teams/t1/members')
      return {
        items: [
          { userId: '1', name: '홍길동', email: '', role: 'OWNER' },
          { userId: '2', name: '김영희', email: '', role: 'MEMBER' },
        ],
      }
    if (path === '/api/categories') return { items: [{ id: 'c1', name: '기본', isDefault: true }] }
    if (path === '/api/todos/a') return items[0] // 행 클릭 후 이동한 SC-04 단건 조회
    return { items, total }
  })
}
const todoCalls = () => get.mock.calls.filter(([p]) => p === '/api/todos')
const lastTodoQuery = () => todoCalls().at(-1)![1]!
const findTable = () => screen.findByRole('table')

beforeEach(() => {
  vi.resetAllMocks()
  useTodoFilterStore.getState().reset()
})

describe('TodoListPage', () => {
  it('필터를 바꾸면 서버에 해당 파라미터로 재조회한다', async () => {
    setup()
    renderApp('/todos')
    await findTable()
    expect(lastTodoQuery()).toMatchObject({ limit: 50, offset: 0 })

    await userEvent.click(screen.getByLabelText('상태'))
    await userEvent.click(await screen.findByRole('option', { name: '기한 초과' }))
    await waitFor(() => expect(lastTodoQuery()).toMatchObject({ status: 'OVERDUE', offset: 0 }))

    await userEvent.click(screen.getByLabelText('카테고리'))
    await userEvent.click(await screen.findByRole('option', { name: '기본' }))
    await waitFor(() => expect(lastTodoQuery()).toMatchObject({ categoryId: 'c1', status: 'OVERDUE' }))

    await userEvent.click(screen.getByLabelText('보기'))
    await userEvent.click(await screen.findByRole('option', { name: '마케팅팀' }))
    await waitFor(() => expect(lastTodoQuery()).toMatchObject({ teamId: 't1' }))
  })

  it('보기 선택지는 팀 구성원을 중복 없이 보이고 사용자를 고르면 userId 로 조회한다', async () => {
    setup()
    renderApp('/todos')
    await findTable()
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/teams/t1/members'))
    await userEvent.click(screen.getByLabelText('보기'))
    await userEvent.click(await screen.findByRole('option', { name: '김영희' }))
    await waitFor(() => expect(lastTodoQuery()).toMatchObject({ userId: '2' }))
  })

  it('필터 초기화는 전체 조건으로 다시 조회한다', async () => {
    setup()
    useTodoFilterStore.getState().setStatus('COMPLETED')
    renderApp('/todos')
    await findTable()
    expect(lastTodoQuery().status).toBe('COMPLETED')
    await userEvent.click(screen.getByRole('button', { name: '필터 초기화' }))
    await waitFor(() => expect(lastTodoQuery().status).toBeUndefined())
  })

  it('상태 배지는 서버 status 로만 정해지고 Date 를 모킹해도 같다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
    setup([todo({ id: 'a', title: '가', status: 'NOT_STARTED' }), todo({ id: 'b', title: '나', status: 'COMPLETED' })])
    renderApp('/todos')
    const rows = within(await findTable()).getAllByRole('row')
    expect(within(rows[1]).getByText('시작 전')).toBeInTheDocument()
    expect(within(rows[2]).getByText('완료')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('canEdit=false 행에는 완료 체크·삭제가 없고 canEdit=true 행에는 있다(Q-04)', async () => {
    setup([
      todo({ id: 'a', title: '내 것' }),
      todo({ id: 'b', title: '남의 것', canEdit: false, isOwner: false, owner: { id: '2', name: '김영희' }, category: undefined }),
    ])
    renderApp('/todos')
    const [, mine, other] = within(await findTable()).getAllByRole('row')
    expect(within(mine).getByRole('checkbox', { name: '완료' })).toBeInTheDocument()
    expect(within(mine).getByRole('button', { name: '내 것 삭제' })).toBeInTheDocument()
    expect(within(mine).getByText('나')).toBeInTheDocument()
    expect(within(other).queryByRole('checkbox')).toBeNull()
    expect(within(other).queryByRole('button')).toBeNull()
    expect(within(other).getByText('김영희')).toBeInTheDocument()
    // 모바일 행도 같다
    const mobile = screen.getAllByRole('listitem')
    expect(within(mobile[0]).getByRole('checkbox')).toBeInTheDocument()
    expect(within(mobile[1]).queryByRole('checkbox')).toBeNull()
    expect(within(mobile[1]).queryByRole('button')).toBeNull()
  })

  it('삭제 확인 후 DELETE 하고 목록을 다시 조회한다', async () => {
    setup()
    del.mockResolvedValue(undefined)
    renderApp('/todos')
    await userEvent.click(within(await findTable()).getByRole('button', { name: '주간 보고서 삭제' }))
    const before = todoCalls().length
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '삭제' }))
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/todos/a'))
    await waitFor(() => expect(todoCalls().length).toBeGreaterThan(before))
  })

  it('삭제 확인 대화상자에서 취소하면 DELETE 하지 않는다', async () => {
    setup()
    renderApp('/todos')
    await userEvent.click(within(await findTable()).getByRole('button', { name: '주간 보고서 삭제' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '취소' }))
    expect(del).not.toHaveBeenCalled()
  })

  it('total=120 이면 1 / 3, 총 120건을 보이고 다음을 누르면 offset=50 으로 재조회한다', async () => {
    setup([todo()], 120)
    renderApp('/todos')
    expect(await screen.findByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByText('총 120건')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다음 쪽' }))
    await waitFor(() => expect(lastTodoQuery()).toMatchObject({ offset: 50 }))
    expect(await screen.findByText('2 / 3')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '이전 쪽' }))
    await waitFor(() => expect(lastTodoQuery()).toMatchObject({ offset: 0 }))
  })

  it('끝 쪽에서 이전·다음은 아무 일도 하지 않는다', async () => {
    setup([todo()], 10)
    renderApp('/todos')
    await screen.findByText('1 / 1')
    const n = todoCalls().length
    await userEvent.click(screen.getByRole('button', { name: '이전 쪽' }))
    await userEvent.click(screen.getByRole('button', { name: '다음 쪽' }))
    expect(todoCalls().length).toBe(n)
  })

  it('완료 체크를 누르면 PATCH {completed:true} 한다', async () => {
    setup()
    patch.mockResolvedValue(todo({ completed: true }))
    renderApp('/todos')
    await userEvent.click(within(await findTable()).getByRole('checkbox', { name: '완료' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/todos/a', { completed: true }))
  })

  it('완료된 할일의 체크를 풀면 PATCH {completed:false} 한다', async () => {
    setup([todo({ completed: true, status: 'COMPLETED' })])
    patch.mockResolvedValue(todo())
    renderApp('/todos')
    await userEvent.click(within(await findTable()).getByRole('checkbox', { name: '완료' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/todos/a', { completed: false }))
  })

  it('할일이 없으면 등록 안내, 필터 결과가 없으면 필터 초기화 안내를 보인다', async () => {
    setup([], 0)
    renderApp('/todos')
    expect(await screen.findByText('등록된 할일이 없습니다.')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('상태'))
    await userEvent.click(await screen.findByRole('option', { name: '완료' }))
    expect(await screen.findByText('조건에 맞는 할일이 없습니다.')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: '필터 초기화' })[1])
    expect(await screen.findByText('등록된 할일이 없습니다.')).toBeInTheDocument()
  })

  it('등록 버튼은 /todos/new, 보기가 팀이면 /todos/new?teamId= 로 이동한다', async () => {
    setup()
    renderApp('/todos')
    const [link] = await screen.findAllByRole('link', { name: '할일 등록' })
    expect(link).toHaveAttribute('href', '/todos/new')
    useTodoFilterStore.getState().setView({ type: 'TEAM', teamId: 't1' })
    await waitFor(() => expect(screen.getAllByRole('link', { name: '할일 등록' })[0]).toHaveAttribute('href', '/todos/new?teamId=t1'))
  })

  it('행을 누르면 할일 화면으로 이동한다', async () => {
    setup()
    renderApp('/todos')
    await userEvent.click(within(await findTable()).getByText('2026-11-04 09:00 ~ 18:00'))
    expect(await screen.findByLabelText('현재 위치')).toHaveTextContent('/todos/a')
  })
})
