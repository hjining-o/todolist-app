import { formatDateTime } from '@/shared/lib/dateTime'
import { Button } from '@/shared/components/ui/button'
import { FieldGroup } from '@/shared/components/ui/field'
import type { Todo } from '@/shared/types'
import { useGoBack } from '../useGoBack'
import { StatusBadge } from './StatusBadge'
import { TodoFormRow } from './TodoFormRow'

// 4.5.3: 값은 텍스트로만, 카테고리 행·저장·삭제·완료 없음(C-14, FE-07)
export function TodoReadOnly({ todo, timeZone }: { todo: Todo; timeZone: string }) {
  const goBack = useGoBack()
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">소유자: {todo.owner.name}</p>
      <FieldGroup className="gap-4">
        <TodoFormRow label="제목">
          <p className="text-sm">{todo.title}</p>
        </TodoFormRow>
        <TodoFormRow label="설명">
          <p className="text-sm whitespace-pre-wrap">{todo.description}</p>
        </TodoFormRow>
        <TodoFormRow label="시작">
          <p className="text-sm">{formatDateTime(todo.startAt, timeZone)}</p>
        </TodoFormRow>
        <TodoFormRow label="종료">
          <p className="text-sm">{formatDateTime(todo.endAt, timeZone)}</p>
        </TodoFormRow>
        <TodoFormRow label="완료 여부">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm">{todo.completed ? '완료' : '미완료'}</p>
            <StatusBadge status={todo.status} />
          </div>
        </TodoFormRow>
        <TodoFormRow label="공유 팀">
          <p className="text-sm">{todo.sharedTeams.map((t) => t.name).join(', ')}</p>
        </TodoFormRow>
      </FieldGroup>
      <div className="flex justify-end">
        <Button variant="outline" onClick={goBack}>
          목록으로
        </Button>
      </div>
    </div>
  )
}
