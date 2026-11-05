import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { Todo, TodoPage } from '@/shared/types'
import type { TodoListParams } from './todoListParams'

export function useTodos(params: TodoListParams) {
  return useQuery({
    queryKey: queryKeys.todos(params),
    queryFn: () => api.get<TodoPage>('/api/todos', params),
    placeholderData: keepPreviousData,
  })
}

// 목록·캘린더 전부(['todos'])와 해당 할일 단건을 다시 조회한다
function useTodoMutation<V>(mutationFn: (v: V) => Promise<unknown>, idOf: (v: V) => string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (_data, v) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['todos'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.todo(idOf(v)) }),
      ]),
  })
}

export const useUpdateTodo = () =>
  useTodoMutation(
    ({ id, completed }: { id: string; completed: boolean }) => api.patch<Todo>(`/api/todos/${id}`, { completed }),
    (v) => v.id,
  )
export const useDeleteTodo = () =>
  useTodoMutation((id: string) => api.del(`/api/todos/${id}`), (id) => id)
