import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { App } from '@/app/App'
import { createQueryClient } from '@/app/queryClient'
import { ApiError } from '@/shared/api/client'
import type { Me } from '@/shared/types'

export const me: Me = { id: '1', email: 'a@example.com', name: '홍길동', timezone: 'Asia/Seoul' }
export const unauthenticated = () => new ApiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')

function Probe() {
  const { pathname, search } = useLocation()
  return <output aria-label="현재 위치">{pathname + search}</output>
}

// App 전체를 MemoryRouter 안에 그린다. api 모듈은 각 테스트에서 vi.mock 한다
export function renderApp(path: string) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Probe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
