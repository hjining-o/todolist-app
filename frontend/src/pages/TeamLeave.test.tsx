import { screen, waitFor, within } from '@testing-library/react'
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

const owner: TeamMember = { userId: '1', name: '홍길동', email: 'a@example.com', role: 'OWNER' }
const others: TeamMember[] = [
  { userId: '2', name: '이관리', email: 'b@example.com', role: 'MANAGER' },
  { userId: '3', name: '김영희', email: 'c@example.com', role: 'MEMBER' },
]

// teamCalls: GET /api/teams 호출 횟수(invalidate 확인용)
function setup(role: Team['role'], members: TeamMember[], teams: Team[] = [{ id: '5', name: '마케팅팀', role, color: null }]) {
  const counter = { teamCalls: 0 }
  get.mockImplementation(async (path: string) => {
    if (path === '/api/me') return me
    if (path === '/api/teams') {
      counter.teamCalls++
      return { items: teams }
    }
    return { items: members }
  })
  return counter
}

async function openDialog() {
  await userEvent.click(await screen.findByRole('button', { name: '팀 나가기' }))
  return screen.findByRole('dialog', { name: '팀 나가기' })
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('팀 나가기(DLG-04)', () => {
  it.each(['MANAGER', 'MEMBER'] as const)('%s 에게는 팀 나가기 버튼이 없다(EX-40)', async (role) => {
    setup(role, [owner, ...others])
    renderApp('/teams/5')
    expect(await screen.findByText('이관리')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '팀 나가기' })).not.toBeInTheDocument()
  })

  it('다른 구성원이 없으면 확인 버튼이 비활성이고 안내를 보인다(EX-36)', async () => {
    setup('OWNER', [owner])
    renderApp('/teams/5')
    await screen.findByRole('cell', { name: '홍길동' })
    const dialog = await openDialog()
    expect(within(dialog).getByRole('button', { name: '지정하고 나가기' })).toBeDisabled()
    expect(within(dialog).getByText('다음 소유자로 지정할 구성원이 없습니다.')).toBeInTheDocument()
  })

  it('다음 소유자를 고르면 POST 하고 /teams 로 이동하며 teams 를 다시 불러온다', async () => {
    const teams: Team[] = [{ id: '5', name: '마케팅팀', role: 'OWNER', color: null }]
    const counter = setup('OWNER', [owner, ...others], teams)
    post.mockImplementation(async () => {
      teams.length = 0 // 서버에서 나간 뒤에는 목록에서 사라진다
      return {}
    })
    renderApp('/teams/5')
    await screen.findByRole('cell', { name: '이관리' })
    const dialog = await openDialog()
    // 나는 선택지에 없다
    await userEvent.click(within(dialog).getByRole('combobox', { name: /다음 소유자/ }))
    expect(screen.queryByRole('option', { name: '홍길동' })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('option', { name: '이관리' }))
    const before = counter.teamCalls
    await userEvent.click(within(dialog).getByRole('button', { name: '지정하고 나가기' }))
    expect(post).toHaveBeenCalledWith('/api/teams/5/leave', { nextOwnerId: '2' })
    expect(await screen.findByLabelText('현재 위치')).toHaveTextContent('/teams')
    expect(screen.getByLabelText('현재 위치')).not.toHaveTextContent('/teams/5')
    await waitFor(() => expect(counter.teamCalls).toBeGreaterThan(before))
    expect(await screen.findByText('속한 팀이 없습니다. 팀을 만들어 보세요.')).toBeInTheDocument()
  })

  it('409 메시지를 대화상자 안에 보이고 이동하지 않는다', async () => {
    setup('OWNER', [owner, ...others])
    post.mockRejectedValue(new ApiError(409, 'NO_NEXT_OWNER', '다음 소유자로 지정할 구성원이 없습니다.'))
    renderApp('/teams/5')
    await screen.findByRole('cell', { name: '이관리' })
    const dialog = await openDialog()
    await userEvent.click(within(dialog).getByRole('combobox', { name: /다음 소유자/ }))
    await userEvent.click(await screen.findByRole('option', { name: '김영희' }))
    await userEvent.click(within(dialog).getByRole('button', { name: '지정하고 나가기' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('다음 소유자로 지정할 구성원이 없습니다.')
    expect(screen.getByLabelText('현재 위치')).toHaveTextContent('/teams/5')
  })

  it('취소하면 대화상자가 닫히고 요청이 없다', async () => {
    setup('OWNER', [owner, ...others])
    renderApp('/teams/5')
    await screen.findByRole('cell', { name: '이관리' })
    const dialog = await openDialog()
    await userEvent.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })
})
