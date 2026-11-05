import { useMe } from '@/features/auth/hooks'
import { useTeams } from '@/features/teams/hooks'
import { Badge } from '@/shared/components/ui/badge'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatDateTime } from '@/shared/lib/dateTime'
import type { TodoHistoryAction, TodoHistoryChanges } from '@/shared/types'
import { useTodoHistories } from '../hooks'

const ACTION_LABEL: Record<TodoHistoryAction, string> = {
  CREATED: '등록',
  UPDATED: '수정',
  COMPLETED: '완료',
  UNCOMPLETED: '완료 해제',
}
const NONE = '(없음)'

// 4.5.4: 서버가 준 필드만 입력란 라벨 순서로 그린다(비소유자 응답엔 category 가 없다, C-17)
export function HistoryList({ todoId }: { todoId: string }) {
  const { data, isPending } = useTodoHistories(todoId)
  const { data: me } = useMe()
  const { data: teams } = useTeams()

  if (isPending || !me) return <Skeleton className="h-16" aria-label="불러오는 중" />
  if (!data || data.items.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">표시할 변경 이력이 없습니다</p>

  const teamName = (id: string) => teams?.items.find((t) => t.id === id)?.name ?? '(알 수 없는 팀)'
  const text = (v: string | null) => (v === null || v === '' ? NONE : v)
  const time = (v: string | null) => (v === null ? NONE : formatDateTime(v, me.timezone))
  const lines = (c: TodoHistoryChanges): [string, string, string][] => {
    const rows: [string, string, string][] = []
    if (c.title) rows.push(['제목', text(c.title.old), text(c.title.new)])
    if (c.description) rows.push(['설명', text(c.description.old), text(c.description.new)])
    if (c.startAt) rows.push(['시작', time(c.startAt.old), time(c.startAt.new)])
    if (c.endAt) rows.push(['종료', time(c.endAt.old), time(c.endAt.new)])
    if (c.category) rows.push(['카테고리', text(c.category.old?.name ?? null), text(c.category.new.name)])
    if (c.completed) {
      const done = (v: boolean | null) => (v === null ? NONE : v ? '완료' : '미완료')
      rows.push(['완료 여부', done(c.completed.old), done(c.completed.new)])
    }
    if (c.sharedTeamIds) {
      const names = (ids: string[] | null) => (ids?.length ? ids.map(teamName).join(', ') : NONE)
      rows.push(['공유 팀', names(c.sharedTeamIds.old), names(c.sharedTeamIds.new)])
    }
    return rows
  }

  return (
    <ol className="divide-y">
      {data.items.map((h) => (
        <li key={h.id} className="space-y-1 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="tabular-nums text-muted-foreground">{formatDateTime(h.changedAt, me.timezone)}</span>
            <span className="font-medium">{h.actor.name}</span>
            <Badge variant="outline">{ACTION_LABEL[h.action]}</Badge>
          </div>
          <ul className="space-y-0.5 pl-4 text-sm text-muted-foreground">
            {lines(h.changes).map(([label, from, to]) => (
              <li key={label}>
                {label}: {from} → {to}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}
