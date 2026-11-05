// SC-04: /todos/new 는 등록, /todos/:todoId 는 응답의 canEdit 로 편집·읽기 전용을 정한다(FE-07)
import { useParams, useSearchParams } from 'react-router'
import { useMe } from '@/features/auth/hooks'
import { HistoryList } from '@/features/todo-histories/components/HistoryList'
import { TodoForm } from '@/features/todos/components/TodoForm'
import { TodoNotFound } from '@/features/todos/components/TodoNotFound'
import { TodoReadOnly } from '@/features/todos/components/TodoReadOnly'
import { useTodo } from '@/features/todos/hooks'
import { ApiError } from '@/shared/api/client'
import { PageHeader } from '@/shared/components/PageHeader'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

export function TodoEditPage() {
  const { todoId = '' } = useParams()
  const [search] = useSearchParams()
  const { data: me } = useMe()
  const { data: todo, error } = useTodo(todoId)

  const title = !todoId ? '할일 등록' : todo && !todo.canEdit ? '할일 보기 (읽기 전용)' : '할일 편집'
  let body
  if (error instanceof ApiError && error.status === 404) body = <TodoNotFound />
  else if (!me || (todoId && !todo))
    body = (
      <div className="grid gap-4" aria-label="불러오는 중">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
    )
  else if (!todo) body = <TodoForm defaultTeamId={search.get('teamId') ?? undefined} />
  else if (todo.canEdit) body = <TodoForm key={todo.id} todo={todo} />
  else body = <TodoReadOnly todo={todo} timeZone={me.timezone} />

  // 두 탭을 모두 마운트해 둬서 탭을 바꿔도 편집 중 폼 값이 남는다(style-guide 3.2)
  if (todo && me)
    body = (
      <Tabs defaultValue="detail">
        <TabsList>
          <TabsTrigger value="detail">상세</TabsTrigger>
          <TabsTrigger value="history">변경 이력</TabsTrigger>
        </TabsList>
        <TabsContent value="detail" forceMount className="data-[state=inactive]:hidden">
          {body}
        </TabsContent>
        <TabsContent value="history" forceMount className="data-[state=inactive]:hidden">
          <HistoryList todoId={todo.id} />
        </TabsContent>
      </Tabs>
    )

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <PageHeader title={title} />
      {body}
    </div>
  )
}
