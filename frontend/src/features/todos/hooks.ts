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

export function useTodo(id: string) {
  return useQuery({ queryKey: queryKeys.todo(id), queryFn: () => api.get<Todo>(`/api/todos/${id}`), enabled: id !== '' })
}

// 요청 본문. 고르지 않은 값은 필드를 뺀다(BD-01). description 만 null 허용
export interface TodoWrite {
  title?: string
  description?: string | null
  startAt?: string
  endAt?: string
  categoryId?: string
  sharedTeamIds?: string[]
}
export interface TodoCreate extends TodoWrite {
  teamId?: string
  ownerId?: string
}

export function useCreateTodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: TodoCreate) => api.post<Todo>('/api/todos', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })
}

// 바뀐 필드만 보낸다(S-09)
export const useUpdateTodo = () =>
  useTodoMutation(
    ({ id, ...body }: TodoWrite & { id: string; completed?: boolean }) => api.patch<Todo>(`/api/todos/${id}`, body),
    (v) => v.id,
  )
export const useDeleteTodo = () =>
  useTodoMutation((id: string) => api.del(`/api/todos/${id}`), (id) => id)
