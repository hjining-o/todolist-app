import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/components/ui/badge'
import type { TodoStatus } from '@/shared/types'

// 서버가 준 status 만 표시한다(클라이언트 시계 판정 금지, FE-06)
const VARIANT = { COMPLETED: 'secondary', OVERDUE: 'destructive', NOT_STARTED: 'outline', IN_PROGRESS: 'default' } as const
const KEY = {
  COMPLETED: 'todo.status.COMPLETED',
  OVERDUE: 'todo.status.OVERDUE',
  NOT_STARTED: 'todo.status.NOT_STARTED',
  IN_PROGRESS: 'todo.status.IN_PROGRESS',
} as const

export function StatusBadge({ status }: { status: TodoStatus }) {
  const { t } = useTranslation()
  return <Badge variant={VARIANT[status]}>{t(KEY[status])}</Badge>
}

export const STATUS_KEY = KEY
