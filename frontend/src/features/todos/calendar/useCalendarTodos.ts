import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { TodoCalendar } from '@/shared/types'
import type { TodoView } from '@/stores/todoFilterStore'

// 캘린더 모드 조회. 키가 ['todos', …] 라 목록 변경 시 함께 무효화된다. 범위를 알기 전(null)에는 조회하지 않는다
export function useCalendarTodos(range: { from: string; to: string } | null, view: TodoView) {
  const params = {
    ...range,
    teamId: view.type === 'TEAM' ? view.teamId : undefined,
    userId: view.type === 'USER' ? view.userId : undefined,
  }
  return useQuery({
    queryKey: queryKeys.todos(params),
    queryFn: () => api.get<TodoCalendar>('/api/todos', params),
    enabled: range !== null,
    placeholderData: keepPreviousData,
  })
}
