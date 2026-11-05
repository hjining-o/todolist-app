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

async function submit() {
  await userEvent.type(await screen.findByLabelText(/이메일/), 'a@example.com')
  await userEvent.type(screen.getByLabelText(/비밀번호/), 'pw123456')
  await userEvent.type(screen.getByLabelText(/이름/), '홍길동')
  await userEvent.click(screen.getByRole('button', { name: '가입' }))
}

beforeEach(() => {
  vi.resetAllMocks()
  get.mockRejectedValue(unauthenticated())
})

describe('SignupPage', () => {
  it('가입 성공 시 별도 로그인 없이 /todos 로 이동한다(C-01)', async () => {
    post.mockImplementation(async () => (get.mockResolvedValue(me), me))
    renderApp('/signup')
    await submit()
    expect(await screen.findByRole('heading', { name: '할일 목록' })).toBeInTheDocument()
    expect(post).toHaveBeenCalledWith('/api/auth/signup', { email: 'a@example.com', password: 'pw123456', name: '홍길동' })
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('입력 길이가 제한된다(이메일 254, 비밀번호 72, 이름 50)', async () => {
    renderApp('/signup')
    expect(await screen.findByLabelText(/이메일/)).toHaveAttribute('maxlength', '254')
    expect(screen.getByLabelText(/비밀번호/)).toHaveAttribute('maxlength', '72')
    expect(screen.getByLabelText(/이름/)).toHaveAttribute('maxlength', '50')
  })

  it('EMAIL_TAKEN 은 이메일 필드 아래에만 보인다', async () => {
    post.mockRejectedValue(new ApiError(409, 'EMAIL_TAKEN', '이미 가입된 이메일입니다.'))
    renderApp('/signup')
    await submit()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('이미 가입된 이메일입니다.')
    expect(screen.getByLabelText(/이메일/).closest('[data-slot="field"]')).toContainElement(alert)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('VALIDATION_ERROR 는 상단 Alert 와 각 필드 아래 메시지를 보인다', async () => {
    post.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { password: '8자 이상이어야 합니다.' }))
    renderApp('/signup')
    await submit()
    expect(await screen.findByText('입력값을 확인해 주세요.')).toBeInTheDocument()
    expect(screen.getByText('8자 이상이어야 합니다.')).toBeInTheDocument()
  })
})
