import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError, api } from '@/shared/api/client'
import { me, renderApp, unauthenticated } from '@/test/renderApp'

vi.mock('@/shared/api/client', async (orig) => ({
  ...(await orig<typeof import('@/shared/api/client')>()),
  api: { get: vi.fn(), post: vi.fn() },
}))

const get = vi.mocked(api.get)
const post = vi.mocked(api.post)

async function submit(password = 'pw123456') {
  await userEvent.type(await screen.findByLabelText('이메일'), 'a@example.com')
  await userEvent.type(screen.getByLabelText('비밀번호'), password)
  await userEvent.click(screen.getByRole('button', { name: '로그인' }))
}

beforeEach(() => {
  vi.resetAllMocks()
  get.mockRejectedValue(unauthenticated())
})

describe('LoginPage', () => {
  it('실패하면 서버 메시지를 폼 상단에 그대로 보이고 비밀번호를 비운다', async () => {
    post.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.'))
    renderApp('/login')
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('이메일 또는 비밀번호가 올바르지 않습니다.')
    expect(screen.getByLabelText('비밀번호')).toHaveValue('')
    expect(screen.getByLabelText('이메일')).toHaveValue('a@example.com')
    expect(screen.getByLabelText('현재 위치')).toHaveTextContent('/login')
  })

  it('성공하면 기본으로 /todos 로 이동한다', async () => {
    post.mockImplementation(async () => (get.mockResolvedValue(me), me))
    renderApp('/login')
    await submit()
    expect(await screen.findByRole('heading', { name: '할일 목록' })).toBeInTheDocument()
    expect(screen.getByLabelText('현재 위치')).toHaveTextContent(/^\/todos$/)
  })

  it('성공하면 ?next= 경로로 돌아간다(U-15)', async () => {
    post.mockImplementation(async () => (get.mockResolvedValue(me), me))
    renderApp('/login?next=%2Fcalendar')
    await submit()
    expect(await screen.findByRole('heading', { name: '캘린더' })).toBeInTheDocument()
    expect(screen.getByLabelText('현재 위치')).toHaveTextContent(/^\/calendar$/)
  })

  it('외부 next 는 무시하고 /todos 로 간다', async () => {
    post.mockImplementation(async () => (get.mockResolvedValue(me), me))
    renderApp('/login?next=https%3A%2F%2Fevil.example')
    await submit()
    expect(await screen.findByRole('heading', { name: '할일 목록' })).toBeInTheDocument()
    expect(screen.getByLabelText('현재 위치')).toHaveTextContent(/^\/todos$/)
  })

  it('제출 중에는 버튼이 비활성이다', async () => {
    post.mockReturnValue(new Promise(() => {}))
    renderApp('/login')
    await submit()
    expect(screen.getByRole('button', { name: /로그인/ })).toBeDisabled()
  })
})
