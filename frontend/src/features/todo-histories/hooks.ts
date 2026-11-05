import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { TodoHistoryList } from '@/shared/types'

export function useTodoHistories(todoId: string) {
  return useQuery({
    queryKey: queryKeys.histories(todoId),
    queryFn: () => api.get<TodoHistoryList>(`/api/todos/${todoId}/histories`),
    enabled: todoId !== '',
  })
}
