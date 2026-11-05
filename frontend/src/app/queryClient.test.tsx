import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { ApiError } from '@/shared/api/client'
import { useBannerStore } from '@/stores/bannerStore'
import { GlobalErrorBanner } from './GlobalErrorBanner'
import { createQueryClient } from './queryClient'

const fail = (status: number, message = '서버 메시지') => () => Promise.reject(new ApiError(status, 'X', message))
const assign = vi.fn()

function setLocation(pathname: string, search = '') {
  vi.stubGlobal('location', { pathname, search, assign })
}

async function run(queryFn: () => Promise<unknown>) {
  await createQueryClient().fetchQuery({ queryKey: ['a'], queryFn, retry: false }).catch(() => {})
}

beforeEach(() => {
  assign.mockReset()
  useBannerStore.getState().clear()
  setLocation('/todos', '?page=2')
})
afterEach(() => vi.unstubAllGlobals())

describe('전역 에러 처리', () => {
  it('401이면 /login?next=현재 경로+쿼리로 이동한다', async () => {
    await run(fail(401))
    expect(assign).toHaveBeenCalledWith('/login?next=%2Ftodos%3Fpage%3D2')
  })

  it('/login 화면에서는 이동하지 않는다', async () => {
    setLocation('/login')
    await run(fail(401))
    expect(assign).not.toHaveBeenCalled()
  })

  it('403은 권한 없음 배너', async () => {
    await run(fail(403))
    expect(useBannerStore.getState().banner).toMatchObject({ message: '권한이 없습니다.', onRetry: undefined })
  })

  it.each([413, 500, 0])('%i은 서버 메시지 배너(다시 시도 포함)', async (status) => {
    await run(fail(status))
    const { banner } = useBannerStore.getState()
    expect(banner?.message).toBe('서버 메시지')
    expect(banner?.onRetry).toBeTypeOf('function')
  })

  it.each([400, 404, 409])('%i은 전역 처리하지 않는다', async (status) => {
    await run(fail(status))
    expect(useBannerStore.getState().banner).toBeNull()
    expect(assign).not.toHaveBeenCalled()
  })

  it('ApiError가 아닌 에러는 무시한다', async () => {
    await run(() => Promise.reject(new Error('x')))
    expect(useBannerStore.getState().banner).toBeNull()
  })

  it('뮤테이션 500은 배너(다시 시도 없음)', async () => {
    const client = createQueryClient()
    await client
      .getMutationCache()
      .build(client, { mutationFn: fail(500) })
      .execute(undefined)
      .catch(() => {})
    expect(useBannerStore.getState().banner).toMatchObject({ message: '서버 메시지', onRetry: undefined })
  })

  it('retry는 5xx·네트워크 오류에서만 1회', () => {
    const retry = createQueryClient().getDefaultOptions().queries!.retry as (n: number, e: Error) => boolean
    expect(retry(0, new ApiError(500, 'X', ''))).toBe(true)
    expect(retry(0, new ApiError(0, 'X', ''))).toBe(true)
    expect(retry(1, new ApiError(500, 'X', ''))).toBe(false)
    expect(retry(0, new ApiError(404, 'X', ''))).toBe(false)
    expect(retry(0, new Error('x'))).toBe(false)
  })
})

describe('GlobalErrorBanner', () => {
  it('ST-04 배너의 다시 시도는 실패한 쿼리를 무효화하고 배너를 닫는다', async () => {
    const client = createQueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <GlobalErrorBanner />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await client.fetchQuery({ queryKey: ['todos'], queryFn: fail(500, '일시적인 오류'), retry: false }).catch(() => {})
    expect(await screen.findByText('일시적인 오류')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['todos'] })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('403 배너에는 다시 시도 버튼이 없다', async () => {
    render(
      <MemoryRouter>
        <GlobalErrorBanner />
      </MemoryRouter>,
    )
    useBannerStore.getState().show('권한이 없습니다.')
    expect(await screen.findByText('권한이 없습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
