import { Badge } from '@/shared/components/ui/badge'
import type { TodoStatus } from '@/shared/types'

// 서버가 준 status 만 표시한다(클라이언트 시계 판정 금지, FE-06)
const VARIANT = { COMPLETED: 'secondary', OVERDUE: 'destructive', NOT_STARTED: 'outline', IN_PROGRESS: 'default' } as const
const LABEL = { COMPLETED: '완료', OVERDUE: '기한 초과', NOT_STARTED: '시작 전', IN_PROGRESS: '진행 중' } as const

export function StatusBadge({ status }: { status: TodoStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>
}

export const STATUS_LABEL = LABEL
