import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@/shared/lib/dateTime'
import { Button } from '@/shared/components/ui/button'
import { FieldGroup } from '@/shared/components/ui/field'
import type { Todo } from '@/shared/types'
import { useGoBack } from '../useGoBack'
import { StatusBadge } from './StatusBadge'
import { TodoFormRow } from './TodoFormRow'

// 4.5.3: 값은 텍스트로만, 카테고리 행·저장·삭제·완료 없음(C-14, FE-07)
export function TodoReadOnly({ todo, timeZone }: { todo: Todo; timeZone: string }) {
  const { t } = useTranslation()
  const goBack = useGoBack()
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{t('todo.owner', { name: todo.owner.name })}</p>
      <FieldGroup className="gap-4">
        <TodoFormRow label={t('todo.form.title')}>
          <p className="text-sm">{todo.title}</p>
        </TodoFormRow>
        <TodoFormRow label={t('todo.form.description')}>
          <p className="text-sm whitespace-pre-wrap">{todo.description}</p>
        </TodoFormRow>
        <TodoFormRow label={t('todo.form.start')}>
          <p className="text-sm">{formatDateTime(todo.startAt, timeZone)}</p>
        </TodoFormRow>
        <TodoFormRow label={t('todo.form.end')}>
          <p className="text-sm">{formatDateTime(todo.endAt, timeZone)}</p>
        </TodoFormRow>
        <TodoFormRow label={t('todo.form.completed')}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm">{todo.completed ? t('common.completed') : t('todo.incomplete')}</p>
            <StatusBadge status={todo.status} />
          </div>
        </TodoFormRow>
        <TodoFormRow label={t('todo.form.sharedTeams')}>
          <p className="text-sm">{todo.sharedTeams.map((team) => team.name).join(', ')}</p>
        </TodoFormRow>
      </FieldGroup>
      <div className="flex justify-end">
        <Button variant="outline" onClick={goBack}>
          {t('common.backToList')}
        </Button>
      </div>
    </div>
  )
}
