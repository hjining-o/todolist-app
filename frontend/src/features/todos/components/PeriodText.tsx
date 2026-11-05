import { formatPeriod } from '@/shared/lib/dateTime'
import type { Todo } from '@/shared/types'

export function PeriodText({ todo, timeZone }: { todo: Pick<Todo, 'startAt' | 'endAt'>; timeZone: string }) {
  return <span className="text-sm text-muted-foreground tabular-nums">{formatPeriod(todo.startAt, todo.endAt, timeZone)}</span>
}
