import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import type { TeamMember } from '@/shared/types'
import { ROLE_KEY } from '../hooks'

interface Props {
  members: TeamMember[]
  myUserId?: string
  isOwner: boolean // 소유자일 때만 관리 버튼을 그린다(EX-28)
  onToggleManager: (m: TeamMember) => void
  onRemove: (m: TeamMember) => void
}

export function TeamMemberTable({ members, myUserId, isOwner, onToggleManager, onRemove }: Props) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('team.member.name')}</TableHead>
          <TableHead className="hidden md:table-cell">{t('auth.email')}</TableHead>
          <TableHead>{t('team.member.role')}</TableHead>
          {isOwner && <TableHead className="text-right">{t('team.member.manage')}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => (
          <TableRow key={m.userId}>
            <TableCell className="max-w-32 truncate md:max-w-none">{m.name}</TableCell>
            <TableCell className="hidden md:table-cell">{m.email}</TableCell>
            <TableCell>
              <Badge variant="outline">{t(ROLE_KEY[m.role])}</Badge>
            </TableCell>
            {isOwner && (
              <TableCell className="text-right">
                {m.role !== 'OWNER' && (
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => onToggleManager(m)}>
                      {m.role === 'MANAGER' ? t('team.member.demote') : t('team.member.promote')}
                    </Button>
                    {m.userId !== myUserId && (
                      <Button variant="outline" size="sm" onClick={() => onRemove(m)}>
                        {t('team.member.remove')}
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
