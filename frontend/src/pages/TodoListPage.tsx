// SC-03
import { Plus } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
        <Plus /> {t('todo.register')}
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
    // 데스크톱은 화면 높이에 맞추고 할일 행만 안에서 스크롤해 페이지 바가 항상 보인다: 100svh - 헤더(h-14) - main 여백(py-6)
    <div className="flex flex-col gap-4 md:h-[calc(100svh-6.5rem)]">
      <PageHeader title={t('todo.list.title')} actions={register} />
      <FilterBar />
      {isPending ? (
        <div className="grid gap-2" aria-label={t('common.loading')}>
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : data?.items.length ? (
        <>
          {/* shadcn Table 의 래퍼(table-container)가 세로 스크롤 영역이어야 머리 고정(sticky)이 동작한다 */}
          <div className="hidden md:flex md:min-h-0 md:flex-1 md:flex-col [&>[data-slot=table-container]]:min-h-0 [&>[data-slot=table-container]]:flex-1">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead />
                <TableHead>{t('todo.form.title')}</TableHead>
                <TableHead>{t('todo.list.period')}</TableHead>
                <TableHead>{t('todo.filter.status')}</TableHead>
                <TableHead>{t('todo.form.owner')}</TableHead>
                <TableHead>{t('todo.form.category')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((todo) => (
                <TodoRow key={todo.id} todo={todo} {...rowProps} />
              ))}
            </TableBody>
          </Table>
          </div>
          <ul className="divide-y md:hidden">
            {data.items.map((todo) => (
              <TodoMobileRow key={todo.id} todo={todo} {...rowProps} />
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    role="button"
                    aria-label={t('todo.list.prevPage')}
                    text={t('todo.list.prev')}
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
                    aria-label={t('todo.list.nextPage')}
                    text={t('todo.list.next')}
                    aria-disabled={last}
                    className={last ? 'pointer-events-none opacity-50' : undefined}
                    onClick={move(!last, filter.offset + PAGE_SIZE)}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
            <span className="text-sm text-muted-foreground">{t('todo.list.total', { count: total })}</span>
          </div>
        </>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyDescription>{filtered ? t('todo.list.emptyFiltered') : t('todo.list.empty')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {filtered ? (
              <Button variant="outline" onClick={filter.reset}>
                {t('todo.filter.reset')}
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
        title={t('todo.form.deleteTitle')}
        description={t('todo.form.deleteDescription', { title: target?.title ?? '' })}
        confirmLabel={t('common.delete')}
        onConfirm={() => target && remove.mutate(target.id)}
      />
    </div>
  )
}
