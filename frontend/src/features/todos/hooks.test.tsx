import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createQueryClient } from '@/app/queryClient'
import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import { useUpdateTodo } from './hooks'

vi.mock('@/shared/api/client', async (orig) => ({
  ...(await orig<typeof import('@/shared/api/client')>()),
  api: { patch: vi.fn() },
}))

it('저장 성공 시 해당 할일의 이력 키를 invalidate 한다', async () => {
  vi.mocked(api.patch).mockResolvedValue({})
  const client = createQueryClient()
  client.setQueryData(queryKeys.histories('a'), { items: [] })
  client.setQueryData(queryKeys.histories('b'), { items: [] })
  const { result } = renderHook(() => useUpdateTodo(), {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
  await act(() => result.current.mutateAsync({ id: 'a', title: 'x' }))
  await waitFor(() => expect(client.getQueryState(queryKeys.histories('a'))?.isInvalidated).toBe(true))
  expect(client.getQueryState(queryKeys.histories('b'))?.isInvalidated).toBe(false)
})
