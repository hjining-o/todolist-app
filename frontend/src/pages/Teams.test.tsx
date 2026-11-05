import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError, api } from '@/shared/api/client'
import type { Team, TeamMember } from '@/shared/types'
import { me, renderApp } from '@/test/renderApp'

vi.mock('@/shared/api/client', async (orig) => ({
  ...(await orig<typeof import('@/shared/api/client')>()),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}))

const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const patch = vi.mocked(api.patch)
const del = vi.mocked(api.del)

const members: TeamMember[] = [
  { userId: '1', name: '홍길동', email: 'a@example.com', role: 'OWNER' },
  { userId: '2', name: '이관리', email: 'b@example.com', role: 'MANAGER' },
  { userId: '3', name: '김영희', email: 'c@example.com', role: 'MEMBER' },
]

// 서버 상태를 흉내 낸다. teams 가 바뀌면 이후 GET 에 반영된다
function setup(teams: Team[], memberResult: TeamMember[] | ApiError = members) {
  get.mockImplementation(async (path: string) => {
    if (path === '/api/me') return me
    if (path === '/api/teams') return { items: teams }
    if (memberResult instanceof ApiError) throw memberResult
    return { items: memberResult }
  })
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('TeamsPage', () => {
  it('팀이 없으면 빈 상태 문구를 보인다', async () => {
    setup([])
    renderApp('/teams')
    expect(await screen.findByText('속한 팀이 없습니다. 팀을 만들어 보세요.')).toBeInTheDocument()
  })

  it('팀 표에서 행을 누르면 팀 상세로 이동한다', async () => {
    setup([{ id: '9', name: '영업팀', role: 'MEMBER', color: null }])
    renderApp('/teams')
    const row = (await screen.findByText('영업팀')).closest('tr')!
    expect(within(row).getByText('일반 팀원')).toBeInTheDocument()
    await userEvent.click(row)
    expect(await screen.findByLabelText('현재 위치')).toHaveTextContent('/teams/9')
  })

  it('팀 생성 성공 시 /teams/:id 로 이동하고 내가 소유자로 보인다', async () => {
    const teams: Team[] = []
    setup(teams)
    post.mockImplementation(async () => {
      teams.push({ id: '7', name: '마케팅팀', role: 'OWNER', color: null })
      return teams[0]
    })
    renderApp('/teams')
    await userEvent.click(await screen.findByRole('button', { name: '팀 만들기' }))
    const input = screen.getByLabelText(/팀 이름/)
    expect(input).toHaveAttribute('maxlength', '50')
    await userEvent.type(input, '마케팅팀')
    await userEvent.click(screen.getByRole('button', { name: '생성' }))
    expect(await screen.findByRole('heading', { name: '마케팅팀' })).toBeInTheDocument()
    expect(screen.getByLabelText('현재 위치')).toHaveTextContent('/teams/7')
    expect(post).toHaveBeenCalledWith('/api/teams', { name: '마케팅팀' })
    expect(screen.getByText('내 역할: 소유자')).toBeInTheDocument()
  })

  it('TEAM_NAME_TAKEN 은 대화상자 입력란 아래에 보이고 대화상자가 열려 있다', async () => {
    setup([])
    post.mockRejectedValue(new ApiError(409, 'TEAM_NAME_TAKEN', '같은 이름의 팀이 있습니다.'))
    renderApp('/teams')
    await userEvent.click(await screen.findByRole('button', { name: '팀 만들기' }))
    await userEvent.type(screen.getByLabelText(/팀 이름/), '마케팅팀')
    await userEvent.click(screen.getByRole('button', { name: '생성' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('같은 이름의 팀이 있습니다.')
    expect(screen.getByLabelText(/팀 이름/).closest('[data-slot="field"]')).toContainElement(alert)
    expect(screen.getByLabelText('현재 위치')).toHaveTextContent('/teams')
  })

  it('fields 오류(VALIDATION_ERROR)를 입력란 아래에 보이고, 취소하면 대화상자가 닫힌다', async () => {
    setup([])
    post.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { name: '팀 이름을 입력해 주세요.' }))
    renderApp('/teams')
    await userEvent.click(await screen.findByRole('button', { name: '팀 만들기' }))
    await userEvent.click(screen.getByRole('button', { name: '생성' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('팀 이름을 입력해 주세요.')
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.queryByLabelText(/팀 이름/)).not.toBeInTheDocument()
  })
})

describe('TeamDetailPage', () => {
  it.each(['MANAGER', 'MEMBER'] as const)('%s 에게는 추가 폼·제거·역할 변경 버튼이 없다(EX-28)', async (role) => {
    setup([{ id: '5', name: '마케팅팀', role, color: null }])
    renderApp('/teams/5')
    expect(await screen.findByText('이관리')).toBeInTheDocument()
    expect(screen.getByText(`내 역할: ${role === 'MANAGER' ? '관리자' : '일반 팀원'}`)).toBeInTheDocument()
    expect(screen.queryByText('구성원 추가')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/이메일/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /제거|관리자 지정|관리자 해제|추가/ })).not.toBeInTheDocument()
  })

  it('소유자에게는 자기 자신 행에 제거 버튼이 없고 다른 행에는 있다', async () => {
    setup([{ id: '5', name: '마케팅팀', role: 'OWNER', color: null }])
    renderApp('/teams/5')
    const own = (await screen.findByRole('cell', { name: '홍길동' })).closest('tr')!
    expect(within(own).queryByRole('button')).not.toBeInTheDocument()
    const manager = screen.getByText('이관리').closest('tr')!
    expect(within(manager).getByRole('button', { name: '관리자 해제' })).toBeInTheDocument()
    expect(within(manager).getByRole('button', { name: '제거' })).toBeInTheDocument()
    expect(within(screen.getByText('김영희').closest('tr')!).getByRole('button', { name: '관리자 지정' })).toBeInTheDocument()
  })

  it('관리자 지정은 확인 없이 PATCH 한다', async () => {
    setup([{ id: '5', name: '마케팅팀', role: 'OWNER', color: null }])
    patch.mockResolvedValue({})
    renderApp('/teams/5')
    const row = (await screen.findByText('김영희')).closest('tr')!
    await userEvent.click(within(row).getByRole('button', { name: '관리자 지정' }))
    expect(patch).toHaveBeenCalledWith('/api/teams/5/members/3', { role: 'MANAGER' })
  })

  it('구성원 추가 성공 시 POST 하고 입력란을 비운다', async () => {
    setup([{ id: '5', name: '마케팅팀', role: 'OWNER', color: null }])
    post.mockResolvedValue({})
    renderApp('/teams/5')
    const input = await screen.findByLabelText(/이메일/)
    await userEvent.type(input, 'd@example.com')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(post).toHaveBeenCalledWith('/api/teams/5/members', { email: 'd@example.com', role: 'MEMBER' })
    expect(input).toHaveValue('')
  })

  it.each([
    ['USER_NOT_FOUND', 404, '가입된 사용자가 아닙니다.'],
    ['ALREADY_MEMBER', 409, '이미 팀 구성원입니다.'],
  ])('%s 는 추가 폼 이메일 입력란 아래에 보인다', async (code, status, message) => {
    setup([{ id: '5', name: '마케팅팀', role: 'OWNER', color: null }])
    post.mockRejectedValue(new ApiError(status, code, message))
    renderApp('/teams/5')
    await userEvent.type(await screen.findByLabelText(/이메일/), 'x@example.com')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(message)
    expect(screen.getByLabelText(/이메일/).closest('[data-slot="field"]')).toContainElement(alert)
  })

  it('필드 오류가 아닌 4xx 는 폼 아래 메시지로 보인다', async () => {
    setup([{ id: '5', name: '마케팅팀', role: 'OWNER', color: null }])
    post.mockRejectedValue(new ApiError(403, 'FORBIDDEN', '권한이 없습니다.'))
    renderApp('/teams/5')
    await userEvent.type(await screen.findByLabelText(/이메일/), 'x@example.com')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('권한이 없습니다.')
  })

  it('제거 확인에서 취소하면 DELETE 요청이 나가지 않는다(U-10)', async () => {
    setup([{ id: '5', name: '마케팅팀', role: 'OWNER', color: null }])
    renderApp('/teams/5')
    const row = (await screen.findByText('김영희')).closest('tr')!
    await userEvent.click(within(row).getByRole('button', { name: '제거' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('김영희님을 마케팅팀에서 제거할까요?')
    await userEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(del).not.toHaveBeenCalled()
  })

  it('제거 확인하면 DELETE 한다', async () => {
    setup([{ id: '5', name: '마케팅팀', role: 'OWNER', color: null }])
    del.mockResolvedValue(undefined)
    renderApp('/teams/5')
    const row = (await screen.findByText('김영희')).closest('tr')!
    await userEvent.click(within(row).getByRole('button', { name: '제거' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '제거' }))
    expect(del).toHaveBeenCalledWith('/api/teams/5/members/3')
  })

  it('구성원 목록이 404 이면 ST-02 를 보인다', async () => {
    setup([{ id: '5', name: '마케팅팀', role: 'MEMBER', color: null }], new ApiError(404, 'NOT_FOUND', '찾을 수 없습니다.'))
    renderApp('/teams/5')
    expect(await screen.findByText('찾을 수 없습니다.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: '팀 목록으로' }))
    expect(await screen.findByRole('heading', { name: '팀' })).toBeInTheDocument()
  })

  it('내 팀 목록에 없는 팀이면 ST-02 를 보인다', async () => {
    setup([])
    renderApp('/teams/404')
    expect(await screen.findByText('찾을 수 없습니다.')).toBeInTheDocument()
  })

  it('일반 팀원에게도 내 캘린더 색 견본이 보이고, 현재 색이 체크되며, 누르면 PATCH 한다', async () => {
    setup([{ id: '5', name: '마케팅팀', role: 'MEMBER', color: 'GREEN' }])
    patch.mockResolvedValue({})
    renderApp('/teams/5')
    const group = await screen.findByRole('radiogroup', { name: '내 캘린더 색상' })
    expect(within(group).getAllByRole('radio')).toHaveLength(8)
    expect(within(group).getByRole('radio', { name: '초록' })).toHaveAttribute('aria-checked', 'true')
    expect(within(group).getByRole('radio', { name: '빨강' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('나에게만 적용됩니다')).toBeInTheDocument()
    await userEvent.click(within(group).getByRole('radio', { name: '파랑' }))
    expect(patch).toHaveBeenCalledWith('/api/teams/5/color', { color: 'BLUE' })
  })

  it('색 미설정이면 자동 배정된 색이 체크되고, 저장 실패(4xx)는 오류 문구를 보인다', async () => {
    setup([{ id: '5', name: '마케팅팀', role: 'MEMBER', color: null }])
    patch.mockRejectedValue(new ApiError(404, 'NOT_FOUND', '찾을 수 없습니다.'))
    renderApp('/teams/5')
    expect(await screen.findByRole('radio', { name: '빨강' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: '파랑' }))
    expect(await screen.findByText('색을 저장하지 못했습니다.')).toBeInTheDocument()
  })
})
