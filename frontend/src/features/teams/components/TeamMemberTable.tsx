import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import type { TeamMember } from '@/shared/types'
import { ROLE_LABEL } from '../hooks'

interface Props {
  members: TeamMember[]
  myUserId?: string
  isOwner: boolean // 소유자일 때만 관리 버튼을 그린다(EX-28)
  onToggleManager: (m: TeamMember) => void
  onRemove: (m: TeamMember) => void
}

export function TeamMemberTable({ members, myUserId, isOwner, onToggleManager, onRemove }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead className="hidden md:table-cell">이메일</TableHead>
          <TableHead>역할</TableHead>
          {isOwner && <TableHead className="text-right">관리</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => (
          <TableRow key={m.userId}>
            <TableCell className="max-w-32 truncate md:max-w-none">{m.name}</TableCell>
            <TableCell className="hidden md:table-cell">{m.email}</TableCell>
            <TableCell>
              <Badge variant="outline">{ROLE_LABEL[m.role]}</Badge>
            </TableCell>
            {isOwner && (
              <TableCell className="text-right">
                {m.role !== 'OWNER' && (
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => onToggleManager(m)}>
                      {m.role === 'MANAGER' ? '관리자 해제' : '관리자 지정'}
                    </Button>
                    {m.userId !== myUserId && (
                      <Button variant="outline" size="sm" onClick={() => onRemove(m)}>
                        제거
                      </Button>
                    )}
                  </div>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
