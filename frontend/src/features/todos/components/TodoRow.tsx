import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { TableCell, TableRow } from '@/shared/components/ui/table'
import type { Todo } from '@/shared/types'
import { PeriodText } from './PeriodText'
import { StatusBadge } from './StatusBadge'

interface RowProps {
  todo: Todo
  timeZone: string
  onToggle: (todo: Todo, completed: boolean) => void
  onDelete: (todo: Todo) => void
}

// 완료 체크·삭제는 canEdit 일 때만 그린다(FE-07, C-14)
function CompleteCheckbox({ todo, onToggle, className }: Pick<RowProps, 'todo' | 'onToggle'> & { className?: string }) {
  return <Checkbox aria-label="완료" className={className} checked={todo.completed} onCheckedChange={(c) => onToggle(todo, c === true)} />
}
function DeleteButton({ todo, onDelete }: Pick<RowProps, 'todo' | 'onDelete'>) {
  return (
    <Button variant="ghost" size="sm" className="text-destructive" aria-label={`${todo.title} 삭제`} onClick={() => onDelete(todo)}>
      삭제
    </Button>
  )
}

const ownerName = (t: Todo) => (t.isOwner ? '나' : t.owner.name)
const stop = (e: MouseEvent) => e.stopPropagation()

export function TodoRow({ todo, timeZone, onToggle, onDelete }: RowProps) {
  const navigate = useNavigate()
  return (
    <TableRow className="cursor-pointer" onClick={() => navigate(`/todos/${todo.id}`)}>
      <TableCell className="w-10" onClick={stop}>
        {todo.canEdit && <CompleteCheckbox todo={todo} onToggle={onToggle} />}
      </TableCell>
      <TableCell className="max-w-64 truncate">
        <Link to={`/todos/${todo.id}`} onClick={stop} className="underline-offset-4 hover:underline">
          {todo.title}
        </Link>
      </TableCell>
      <TableCell>
        <PeriodText todo={todo} timeZone={timeZone} />
      </TableCell>
      <TableCell>
        <StatusBadge status={todo.status} />
      </TableCell>
      <TableCell>{ownerName(todo)}</TableCell>
      <TableCell>{todo.category?.name ?? '(없음)'}</TableCell>
      <TableCell className="text-right" onClick={stop}>
        {todo.canEdit && <DeleteButton todo={todo} onDelete={onDelete} />}
      </TableCell>
    </TableRow>
  )
}

export function TodoMobileRow({ todo, timeZone, onToggle, onDelete }: RowProps) {
  return (
    <li className="flex items-start gap-3 py-3">
      {todo.canEdit && <CompleteCheckbox todo={todo} onToggle={onToggle} className="mt-0.5" />}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Link to={`/todos/${todo.id}`} className="truncate text-sm font-medium hover:underline">
            {todo.title}
          </Link>
          <StatusBadge status={todo.status} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <PeriodText todo={todo} timeZone={timeZone} />
          <span className="text-xs text-muted-foreground">{ownerName(todo)}</span>
          {todo.canEdit && <DeleteButton todo={todo} onDelete={onDelete} />}
        </div>
      </div>
    </li>
  )
}
