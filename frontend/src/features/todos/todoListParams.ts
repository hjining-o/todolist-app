import { ALL_CATEGORIES } from '@/features/categories/components/CategorySelect'
import { ALL_STATUS, type TodoView } from '@/stores/todoFilterStore'
import type { TodoStatus } from '@/shared/types'

export const PAGE_SIZE = 50

interface Filter {
  view: TodoView
  categoryId: string
  status: TodoStatus | typeof ALL_STATUS
  offset: number
}

// 필터 상태 → GET /api/todos 쿼리. 고르지 않은 항목은 보내지 않는다(undefined)
export function toTodoListParams({ view, categoryId, status, offset }: Filter) {
  return {
    teamId: view.type === 'TEAM' ? view.teamId : undefined,
    userId: view.type === 'USER' ? view.userId : undefined,
    categoryId: categoryId === ALL_CATEGORIES ? undefined : categoryId,
    status: status === ALL_STATUS ? undefined : status,
    limit: PAGE_SIZE,
    offset,
  }
}
export type TodoListParams = ReturnType<typeof toTodoListParams>
