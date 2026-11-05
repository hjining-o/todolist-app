import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { api, ApiError } from '@/shared/api/client'
import { me, renderApp } from '@/test/renderApp'

vi.mock('@/shared/api/client', async (orig) => ({
  ...(await orig<typeof import('@/shared/api/client')>()),
  api: { get: vi.fn(), patch: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

const get = vi.mocked(api.get)
const patch = vi.mocked(api.patch)

beforeEach(() => {
  vi.resetAllMocks()
  get.mockImplementation(async (path: string) => (path === '/api/me' ? me : { items: [], total: 0 }))
})

const todoCalls = () => get.mock.calls.filter(([p]) => p === '/api/todos').length

describe('ProfilePage', () => {
  it('메뉴에 내 정보 링크가 있고 /me 에서 강조된다', async () => {
    renderApp('/me')
    const nav = within(await screen.findByRole('navigation', { name: '주 메뉴' }))
    expect(nav.getByRole('link', { name: '내 정보' })).toHaveAttribute('aria-current', 'page')
  })

  it('이메일은 입력란이 아니라 텍스트다', async () => {
    renderApp('/me')
    expect(await screen.findByText(me.email, { exact: false })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /이메일/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(1) // 이름뿐
  })

  it('바뀐 게 없으면 저장해도 요청하지 않는다', async () => {
    renderApp('/me')
    await userEvent.click(await screen.findByRole('button', { name: '저장' }))
    expect(patch).not.toHaveBeenCalled()
  })

  it('이름만 바꾸면 name 만 보내고, 헤더 이름이 새 값으로 바뀌며 todos 를 다시 조회한다', async () => {
    patch.mockResolvedValue({ ...me, name: '김철수' })
    renderApp('/todos')
    await screen.findByRole('heading', { name: '할일 목록' })
    await userEvent.click(screen.getByRole('link', { name: '내 정보' }))
    const name = await screen.findByLabelText(/이름/)
    await userEvent.clear(name)
    await userEvent.type(name, '김철수')
    const before = todoCalls()
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/me', { name: '김철수' }))
    expect(await within(screen.getByRole('banner')).findByText('김철수')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('저장했습니다.')
    // 활성 쿼리가 아니어도 무효화 대상이라 목록으로 돌아가면 다시 조회한다
    await userEvent.click(screen.getByRole('link', { name: '목록' }))
    await waitFor(() => expect(todoCalls()).toBeGreaterThan(before))
  })

  it('시간대를 검색해 고르면 timezone 만 보낸다', async () => {
    patch.mockResolvedValue({ ...me, timezone: 'America/New_York' })
    renderApp('/me')
    await userEvent.click(await screen.findByRole('combobox', { name: '시간대' }))
    await userEvent.type(screen.getByPlaceholderText('시간대 검색'), 'New_York')
    await userEvent.click(await screen.findByRole('option', { name: 'America/New_York' }))
    expect(screen.getByRole('combobox', { name: '시간대' })).toHaveTextContent('America/New_York')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/me', { timezone: 'America/New_York' }))
  })

  it('이름 검증 오류(fields)를 입력란 아래에 보여 준다', async () => {
    patch.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { name: '이름은 1~50자입니다.' }))
    renderApp('/me')
    const name = await screen.findByLabelText(/이름/)
    await userEvent.type(name, 'x')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('이름은 1~50자입니다.')).toBeInTheDocument()
  })

  it('현재 비밀번호가 틀리면 필드 오류를 보이고 로그인 화면으로 가지 않는다', async () => {
    patch.mockRejectedValue(new ApiError(400, 'WRONG_PASSWORD', '현재 비밀번호가 올바르지 않습니다.'))
    renderApp('/me')
    await userEvent.type(await screen.findByLabelText('현재 비밀번호'), 'wrong-pass')
    await userEvent.type(screen.getByLabelText(/새 비밀번호/), 'new-password-1')
    await userEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))

    const err = await screen.findByText('현재 비밀번호가 올바르지 않습니다.')
    expect(screen.getByLabelText('현재 비밀번호')).toHaveAttribute('aria-invalid', 'true')
    expect(err).toBeInTheDocument()
    expect(screen.getByLabelText('현재 위치')).toHaveTextContent(/^\/me$/)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('비밀번호 변경 성공 시 입력을 비우고 토스트를 띄운다', async () => {
    patch.mockResolvedValue(me)
    renderApp('/me')
    await userEvent.type(await screen.findByLabelText('현재 비밀번호'), 'old-password')
    await userEvent.type(screen.getByLabelText(/새 비밀번호/), 'new-password-1')
    await userEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/me', { currentPassword: 'old-password', newPassword: 'new-password-1' }))
    await waitFor(() => expect(screen.getByLabelText('현재 비밀번호')).toHaveValue(''))
    expect(screen.getByLabelText(/새 비밀번호/)).toHaveValue('')
    expect(toast.success).toHaveBeenCalledWith('비밀번호를 변경했습니다.')
  })

  it('새 비밀번호 필드 오류와 그 밖의 오류(폼 상단)를 구분해 보여 준다', async () => {
    patch.mockRejectedValueOnce(new ApiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { newPassword: '8자 이상이어야 합니다.' }))
    patch.mockRejectedValueOnce(new ApiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.'))
    renderApp('/me')
    await userEvent.type(await screen.findByLabelText('현재 비밀번호'), 'old-password')
    await userEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
    expect(await screen.findByText('8자 이상이어야 합니다.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
    expect(await screen.findByText('입력값을 확인해 주세요.')).toBeInTheDocument()
  })
})
