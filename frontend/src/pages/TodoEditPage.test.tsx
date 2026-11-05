import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError, api } from '@/shared/api/client'
import type { Todo } from '@/shared/types'
import { me, renderApp } from '@/test/renderApp'

vi.mock('@/shared/api/client', async (orig) => ({
  ...(await orig<typeof import('@/shared/api/client')>()),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}))

const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
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
  sharedTeams: [{ id: 't1', name: '마케팅팀' }],
  canEdit: true,
  isOwner: true,
  ...over,
})

// t1: 일반 팀원, t2: 관리자
function setup(found: Todo | ApiError = todo()) {
  get.mockImplementation(async (path: string) => {
    if (path === '/api/me') return me
    if (path === '/api/teams')
      return { items: [{ id: 't1', name: '마케팅팀', role: 'MEMBER' }, { id: 't2', name: '영업팀', role: 'MANAGER' }] }
    if (path === '/api/teams/t2/members')
      return { items: [{ userId: '1', name: '홍길동', email: '', role: 'MANAGER' }, { userId: '2', name: '김영희', email: '', role: 'MEMBER' }] }
    if (path === '/api/categories') return { items: [{ id: 'c1', name: '기본', isDefault: true }, { id: 'c2', name: 'Work', isDefault: false }] }
    if (path === '/api/todos/a') {
      if (found instanceof ApiError) throw found
      return found
    }
    return { items: [], total: 0 }
  })
  post.mockResolvedValue(todo())
  patch.mockResolvedValue(todo())
  del.mockResolvedValue(undefined)
}

const place = () => screen.getByLabelText('현재 위치')
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const pick = async (label: string, option: string) => {
  await userEvent.click(screen.getByLabelText(label))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}
const save = () => userEvent.click(screen.getByRole('button', { name: '저장' }))
const body = (fn: typeof post | typeof patch) => JSON.parse(JSON.stringify(fn.mock.calls[0]![1])) as Record<string, unknown> // JSON 으로 undefined 필드를 뺀다
const confirmDelete = async () => {
  const dialog = await screen.findByRole('alertdialog')
  await userEvent.click(dialog.querySelector('button[data-variant="destructive"]') as HTMLElement)
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('TodoEditPage 등록', () => {
  it('일시를 비우고 저장하면 POST 본문에 startAt/endAt 이 없다(FR-04 #3)', async () => {
    setup()
    renderApp('/todos/new')
    await userEvent.type(await screen.findByLabelText(/제목/), '  새 할일  ')
    await save()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(post.mock.calls[0]![0]).toBe('/api/todos')
    const b = body(post)
    expect(b).toMatchObject({ title: '새 할일', sharedTeamIds: [] })
    expect(b).not.toHaveProperty('startAt')
    expect(b).not.toHaveProperty('endAt')
    expect(b).not.toHaveProperty('teamId')
    expect(b).not.toHaveProperty('ownerId')
    expect(b).not.toHaveProperty('description')
    await waitFor(() => expect(place()).toHaveTextContent('/todos'))
  })

  it('날짜+시각은 오프셋을 붙이고 날짜만이면 날짜만 보낸다', async () => {
    setup()
    renderApp('/todos/new')
    await userEvent.type(await screen.findByLabelText(/제목/), 'x')
    expect(screen.getByLabelText('시작 시각')).toBeDisabled()
    type('시작', '2026-11-10')
    type('시작 시각', '09:00')
    type('종료', '2026-11-11')
    await save()
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(body(post)).toMatchObject({ startAt: '2026-11-10T09:00+09:00', endAt: '2026-11-11' })
  })

  it('날짜를 지우면 시각도 비우고 비활성이 된다', async () => {
    setup()
    renderApp('/todos/new')
    await screen.findByLabelText(/제목/)
    type('시작', '2026-11-10')
    type('시작 시각', '09:00')
    type('시작', '')
    expect(screen.getByLabelText('시작 시각')).toHaveValue('')
    expect(screen.getByLabelText('시작 시각')).toBeDisabled()
  })

  it('종료 < 시작이면 저장해도 POST 가 없고 필드 오류가 보인다(EX-07)', async () => {
    setup()
    renderApp('/todos/new')
    await userEvent.type(await screen.findByLabelText(/제목/), 'x')
    type('시작', '2026-11-10')
    type('종료', '2026-11-09')
    await save()
    expect(await screen.findByText('종료 일시는 시작 일시보다 빠를 수 없습니다.')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })

  it('제목이 공백이면 POST 없이 필드 오류가 보인다', async () => {
    setup()
    renderApp('/todos/new')
    await userEvent.type(await screen.findByLabelText(/제목/), '   ')
    await save()
    expect(await screen.findByText('제목을 입력해 주세요.')).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })

  it('팀을 고르면 그 팀이 공유 팀으로 기본 체크된다(FR-11 #3)', async () => {
    setup()
    renderApp('/todos/new')
    expect(await screen.findByRole('checkbox', { name: '마케팅팀' })).not.toBeChecked()
    await pick('팀', '마케팅팀')
    expect(screen.getByRole('checkbox', { name: '마케팅팀' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: '영업팀' })).not.toBeChecked()
    await userEvent.type(screen.getByLabelText(/제목/), 'x')
    await save()
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(body(post)).toMatchObject({ teamId: 't1', sharedTeamIds: ['t1'] })
  })

  it('쿼리 teamId 가 기본 팀이다', async () => {
    setup()
    renderApp('/todos/new?teamId=t1')
    expect(await screen.findByRole('checkbox', { name: '마케팅팀' })).toBeChecked()
  })

  it('고른 팀의 관리자일 때만 소유자 선택이 보이고, 남을 고르면 대리 등록(공유 팀 숨김·미전송, 카테고리 비활성)이다(FR-09 #10)', async () => {
    setup()
    renderApp('/todos/new')
    await screen.findByLabelText(/제목/)
    expect(screen.queryByLabelText('소유자')).not.toBeInTheDocument()
    await pick('팀', '마케팅팀') // 일반 팀원
    expect(screen.queryByLabelText('소유자')).not.toBeInTheDocument()
    await pick('팀', '영업팀') // 관리자
    expect(await screen.findByLabelText('소유자')).toBeInTheDocument()
    expect(screen.getByLabelText('소유자')).toHaveTextContent('나 (홍길동)')

    await pick('소유자', '김영희')
    expect(screen.queryByText('공유 팀')).not.toBeInTheDocument()
    expect(screen.getByLabelText('카테고리')).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/제목/), 'x')
    await save()
    await waitFor(() => expect(post).toHaveBeenCalled())
    const b = body(post)
    expect(b).toMatchObject({ teamId: 't2', ownerId: '2' })
    expect(b).not.toHaveProperty('sharedTeamIds')
    expect(b).not.toHaveProperty('categoryId')
  })

  it('서버 오류: INVALID_PERIOD 는 종료 필드 아래, fields 는 각 필드 아래, 그 외 400 은 폼 상단에 서버 메시지로 보인다', async () => {
    setup()
    renderApp('/todos/new')
    await userEvent.type(await screen.findByLabelText(/제목/), 'x')

    post.mockRejectedValueOnce(new ApiError(400, 'INVALID_PERIOD', '서버: 기간 오류'))
    await save()
    expect(await screen.findByText('종료 일시는 시작 일시보다 빠를 수 없습니다.')).toBeInTheDocument()

    post.mockRejectedValueOnce(new ApiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { title: '서버: 제목 오류' }))
    await save()
    expect(await screen.findByText('서버: 제목 오류')).toBeInTheDocument()
    expect(screen.queryByText('종료 일시는 시작 일시보다 빠를 수 없습니다.')).not.toBeInTheDocument()

    post.mockRejectedValueOnce(new ApiError(400, 'INVALID_SHARE_TEAM', '속한 팀에만 공유할 수 있습니다.'))
    await save()
    expect(await screen.findByText('속한 팀에만 공유할 수 있습니다.')).toBeInTheDocument()
    expect(screen.getByLabelText(/제목/)).toHaveValue('x') // 입력 보존
    expect(place()).toHaveTextContent('/todos/new')
  })

  it('제출 중에는 저장 버튼이 비활성이고 Spinner 가 보인다', async () => {
    setup()
    post.mockReturnValue(new Promise(() => {}))
    renderApp('/todos/new')
    await userEvent.type(await screen.findByLabelText(/제목/), 'x')
    await save()
    const button = await screen.findByRole('button', { name: /저장/ })
    expect(button).toBeDisabled()
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('바꾼 것이 없으면 취소가 바로 이동한다', async () => {
    setup()
    renderApp('/todos/new')
    await screen.findByLabelText(/제목/)
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    await waitFor(() => expect(place()).not.toHaveTextContent('/todos/new'))
  })

  it('변경 후 취소하면 확인 대화상자가 뜨고 [나가기]로 이동한다', async () => {
    setup()
    renderApp('/todos/new')
    await userEvent.type(await screen.findByLabelText(/제목/), 'x')
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(await screen.findByText('저장하지 않은 변경이 있습니다. 나가시겠어요?')).toBeInTheDocument()
    expect(place()).toHaveTextContent('/todos/new')
    await userEvent.click(screen.getByRole('button', { name: '나가기' }))
    await waitFor(() => expect(place()).not.toHaveTextContent('/todos/new'))
  })
})

describe('TodoEditPage 편집·읽기 전용', () => {
  it('수정은 바뀐 필드만 PATCH 한다', async () => {
    setup()
    renderApp('/todos/a')
    const title = await screen.findByLabelText(/제목/)
    expect(title).toHaveValue('주간 보고서')
    expect(screen.getByLabelText('시작')).toHaveValue('2026-11-04')
    expect(screen.getByLabelText('시작 시각')).toHaveValue('09:00')
    expect(await screen.findByRole('checkbox', { name: '마케팅팀' })).toBeChecked()
    expect(screen.queryByLabelText('팀')).not.toBeInTheDocument()

    await userEvent.clear(title)
    await userEvent.type(title, '새 제목')
    await userEvent.click(screen.getByRole('checkbox', { name: '완료' }))
    await userEvent.click(screen.getByRole('checkbox', { name: '영업팀' }))
    type('종료 시각', '19:30')
    await save()
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
    expect(patch).toHaveBeenCalledWith('/api/todos/a', {
      title: '새 제목',
      completed: true,
      sharedTeamIds: ['t1', 't2'],
      endAt: '2026-11-04T19:30+09:00',
    })
  })

  it('바뀐 것이 없으면 요청 없이 돌아간다', async () => {
    setup()
    renderApp('/todos/a')
    await screen.findByLabelText(/제목/)
    await save()
    await waitFor(() => expect(place()).not.toHaveTextContent('/todos/a'))
    expect(patch).not.toHaveBeenCalled()
  })

  it('설명을 지우면 description: null 로 보낸다', async () => {
    setup(todo({ description: '내용' }))
    renderApp('/todos/a')
    await userEvent.clear(await screen.findByLabelText('설명'))
    await save()
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/todos/a', { description: null }))
  })

  it('isOwner=false(canEdit=true)면 소유자 텍스트·카테고리 비활성 (비공개)·공유 팀 읽기 전용이다(FR-07 #6)', async () => {
    setup(todo({ isOwner: false, owner: { id: '9', name: '김영희' }, category: undefined }))
    renderApp('/todos/a')
    await screen.findByLabelText(/제목/)
    expect(screen.getByText('소유자: 김영희 (읽기 전용)')).toBeInTheDocument()
    expect(screen.getByLabelText('카테고리')).toBeDisabled()
    expect(screen.getByLabelText('카테고리')).toHaveTextContent('(비공개)')
    expect(screen.queryByRole('checkbox', { name: '영업팀' })).not.toBeInTheDocument()
    expect(screen.getByText('마케팅팀')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument()
    // 소유자가 아니면 카테고리·공유 팀은 보내지 않는다
    await userEvent.click(screen.getByRole('checkbox', { name: '완료' }))
    await save()
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/todos/a', { completed: true }))
  })

  it('canEdit=false 면 읽기 전용이다: 입력·완료·저장·삭제가 없고 카테고리 행이 없다(Q-04)', async () => {
    setup(todo({ canEdit: false, isOwner: false, category: undefined, owner: { id: '9', name: '김영희' }, description: '내용' }))
    renderApp('/todos/a')
    expect(await screen.findByText('할일 보기 (읽기 전용)')).toBeInTheDocument()
    expect(screen.getByText('주간 보고서')).toBeInTheDocument()
    expect(screen.getByText('2026-11-04 09:00')).toBeInTheDocument()
    expect(screen.getByText('미완료')).toBeInTheDocument()
    expect(screen.getByText('소유자: 김영희')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText('카테고리', { selector: 'label' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
    await waitFor(() => expect(place()).not.toHaveTextContent('/todos/a'))
  })

  it('없는·볼 수 없는 할일은 ST-02 이고 [목록으로]로 이동한다', async () => {
    setup(new ApiError(404, 'NOT_FOUND', '찾을 수 없습니다.'))
    renderApp('/todos/a')
    expect(await screen.findByText('찾을 수 없습니다.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '목록으로' }))
    await waitFor(() => expect(place()).not.toHaveTextContent('/todos/a'))
  })

  it('삭제 확인에서 취소하면 요청이 없고, 삭제 중 404 는 ST-02 가 된다', async () => {
    setup()
    renderApp('/todos/a')
    await userEvent.click(await screen.findByRole('button', { name: '삭제' }))
    await userEvent.click(await screen.findByRole('button', { name: '취소' }))
    expect(del).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    del.mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', '찾을 수 없습니다.'))
    await confirmDelete()
    expect(await screen.findByText('찾을 수 없습니다.')).toBeInTheDocument()
  })

  it('삭제를 확인하면 DELETE 후 이전 화면으로 이동한다', async () => {
    setup()
    renderApp('/todos/a')
    await userEvent.click(await screen.findByRole('button', { name: '삭제' }))
    await confirmDelete()
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/todos/a'))
    await waitFor(() => expect(place()).not.toHaveTextContent('/todos/a'))
  })
})

describe('TodoEditPage 변경 이력 탭', () => {
  it('편집 모드에 탭이 있고, 탭을 바꿔도 입력한 폼 값이 유지된다', async () => {
    setup()
    renderApp('/todos/a')
    const title = (await screen.findByLabelText(/제목/)) as HTMLInputElement
    type(/제목/, '바꾼 제목')
    await userEvent.click(screen.getByRole('tab', { name: '변경 이력' }))
    expect(await screen.findByText('표시할 변경 이력이 없습니다')).toBeVisible()
    await userEvent.click(screen.getByRole('tab', { name: '상세' }))
    expect(title).toBeVisible()
    expect(title.value).toBe('바꾼 제목')
  })

  it('읽기 전용 모드에도 탭이 있고, 등록 모드에는 없다', async () => {
    setup(todo({ canEdit: false }))
    renderApp('/todos/a')
    expect(await screen.findByRole('tab', { name: '변경 이력' })).toBeInTheDocument()
  })

  it('등록 모드에는 탭이 없다', async () => {
    setup()
    renderApp('/todos/new')
    await screen.findByLabelText(/제목/)
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })
})
