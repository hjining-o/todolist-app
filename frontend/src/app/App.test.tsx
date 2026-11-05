import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api } from '@/shared/api/client'
import { me, renderApp, unauthenticated } from '@/test/renderApp'

vi.mock('@/shared/api/client', async (orig) => ({
  ...(await orig<typeof import('@/shared/api/client')>()),
  api: { get: vi.fn(), post: vi.fn() },
}))

const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const location = () => screen.getByLabelText('현재 위치')

beforeEach(() => {
  vi.resetAllMocks()
  // 할일 목록 화면이 부르는 다른 경로는 빈 목록으로 답한다
  get.mockImplementation(async (path: string) => (path === '/api/me' ? me : { items: [], total: 0 }))
})

describe('AuthGuard', () => {
  it('비로그인(401)으로 /todos 에 가면 /login?next=/todos 로 간다(U-15)', async () => {
    get.mockRejectedValue(unauthenticated())
    renderApp('/todos')
    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument()
    expect(location()).toHaveTextContent('/login?next=%2Ftodos')
    expect(screen.queryByRole('heading', { name: '할일 목록' })).not.toBeInTheDocument()
  })

  it('내 정보가 확정되기 전에는 보호 화면을 그리지 않는다', () => {
    get.mockReturnValue(new Promise(() => {}))
    renderApp('/todos')
    expect(screen.queryByRole('heading', { name: '할일 목록' })).not.toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  })

  it('로그인 상태로 /login 에 오면 /todos 로 간다', async () => {
    renderApp('/login')
    expect(await screen.findByRole('heading', { name: '할일 목록' })).toBeInTheDocument()
    expect(location()).toHaveTextContent(/^\/todos$/)
  })

  it('로그인 상태로 /signup 에 오면 /todos 로 간다', async () => {
    renderApp('/signup')
    expect(await screen.findByRole('heading', { name: '할일 목록' })).toBeInTheDocument()
  })

  it('/ 와 모르는 경로는 /todos 로 간다', async () => {
    renderApp('/nowhere')
    expect(await screen.findByRole('heading', { name: '할일 목록' })).toBeInTheDocument()
    expect(location()).toHaveTextContent(/^\/todos$/)
  })
})

describe('AppLayout', () => {
  it('현재 메뉴를 강조한다(/todos/new 는 목록)', async () => {
    renderApp('/todos/new')
    const nav = within(await screen.findByRole('navigation', { name: '주 메뉴' }))
    expect(nav.getByRole('link', { name: '목록' })).toHaveAttribute('aria-current', 'page')
    expect(nav.getByRole('link', { name: '목록' })).toHaveAttribute('data-variant', 'secondary')
    expect(nav.getByRole('link', { name: '캘린더' })).toHaveAttribute('data-variant', 'ghost')
    expect(screen.getByText('홍길동')).toBeInTheDocument()
  })

  it('로그아웃하면 logout 을 호출하고 /login 으로 가며 보호 화면이 보이지 않는다(EX-06)', async () => {
    post.mockResolvedValue(undefined)
    renderApp('/todos')
    await screen.findByRole('heading', { name: '할일 목록' })
    get.mockRejectedValue(unauthenticated()) // 로그아웃 후 서버는 401
    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument()
    expect(post).toHaveBeenCalledWith('/api/auth/logout')
    expect(location()).toHaveTextContent(/^\/login$/)
    expect(screen.queryByRole('heading', { name: '할일 목록' })).not.toBeInTheDocument()
  })

  it('햄버거 버튼으로 Sheet 가 열리고 항목을 고르면 이동하며 닫힌다', async () => {
    renderApp('/todos')
    await userEvent.click(await screen.findByRole('button', { name: '메뉴 열기' }))
    const sheet = within(await screen.findByRole('dialog'))
    expect(sheet.getByText('홍길동')).toBeInTheDocument()
    expect(sheet.getByRole('button', { name: '로그아웃' })).toBeInTheDocument()
    await userEvent.click(sheet.getByRole('link', { name: '캘린더' }))
    expect(await screen.findByRole('heading', { name: '캘린더' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
