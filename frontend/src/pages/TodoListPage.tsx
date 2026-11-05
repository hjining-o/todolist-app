// SC-03
import { Plus } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { useMe } from '@/features/auth/hooks'
import { FilterBar } from '@/features/todos/components/FilterBar'
import { TodoMobileRow, TodoRow } from '@/features/todos/components/TodoRow'
import { useDeleteTodo, useTodos, useUpdateTodo } from '@/features/todos/hooks'
import { PAGE_SIZE, toTodoListParams } from '@/features/todos/todoListParams'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { PageHeader } from '@/shared/components/PageHeader'
import { Button } from '@/shared/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader } from '@/shared/components/ui/empty'
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/shared/components/ui/pagination'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import type { Todo } from '@/shared/types'
import { ALL_STATUS, useTodoFilterStore } from '@/stores/todoFilterStore'

export function TodoListPage() {
  const filter = useTodoFilterStore()
  const { data: me } = useMe()
  const { data, isPending } = useTodos(toTodoListParams(filter))
  const update = useUpdateTodo()
  const remove = useDeleteTodo()
  const [target, setTarget] = useState<Todo | null>(null)

  const timeZone = me?.timezone ?? 'Asia/Seoul'
  const filtered = filter.view.type !== 'ALL' || filter.categoryId !== 'ALL' || filter.status !== ALL_STATUS
  const total = data?.total ?? 0
  const page = Math.floor(filter.offset / PAGE_SIZE) + 1
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const newPath = filter.view.type === 'TEAM' ? `/todos/new?teamId=${filter.view.teamId}` : '/todos/new'
  const register = (
    <Button asChild>
      <Link to={newPath}>
        <Plus /> 할일 등록
      </Link>
    </Button>
  )
  const rowProps = { timeZone, onToggle: (t: Todo, completed: boolean) => update.mutate({ id: t.id, completed }), onDelete: setTarget }
  // 링크 모양 버튼이라 기본 이동(#)을 막고, 끝 쪽에서는 아무 일도 하지 않는다
  const move = (enabled: boolean, offset: number) => (e: MouseEvent) => {
    e.preventDefault()
    if (enabled) filter.setOffset(offset)
  }
  const first = page <= 1
  const last = page >= pages

  return (
    <div className="grid gap-4">
      <PageHeader title="할일 목록" actions={register} />
      <FilterBar />
      {isPending ? (
        <div className="grid gap-2" aria-label="불러오는 중">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : data?.items.length ? (
        <>
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>제목</TableHead>
                <TableHead>기간</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>소유자</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((t) => (
                <TodoRow key={t.id} todo={t} {...rowProps} />
              ))}
            </TableBody>
          </Table>
          <ul className="divide-y md:hidden">
            {data.items.map((t) => (
              <TodoMobileRow key={t.id} todo={t} {...rowProps} />
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    role="button"
                    aria-label="이전 쪽"
                    text="이전"
                    aria-disabled={first}
                    className={first ? 'pointer-events-none opacity-50' : undefined}
                    onClick={move(!first, filter.offset - PAGE_SIZE)}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm tabular-nums">
                    {page} / {pages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    role="button"
                    aria-label="다음 쪽"
                    text="다음"
                    aria-disabled={last}
                    className={last ? 'pointer-events-none opacity-50' : undefined}
                    onClick={move(!last, filter.offset + PAGE_SIZE)}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
            <span className="text-sm text-muted-foreground">총 {total}건</span>
          </div>
        </>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyDescription>{filtered ? '조건에 맞는 할일이 없습니다.' : '등록된 할일이 없습니다.'}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {filtered ? (
              <Button variant="outline" onClick={filter.reset}>
                필터 초기화
              </Button>
            ) : (
              register
            )}
          </EmptyContent>
        </Empty>
      )}
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title="할일 삭제"
        description={`'${target?.title ?? ''}' 할일을 삭제할까요? 삭제하면 복구할 수 없습니다.`}
        confirmLabel="삭제"
        onConfirm={() => target && remove.mutate(target.id)}
      />
    </div>
  )
}
