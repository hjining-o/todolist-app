// SC-09
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { useMe } from '@/features/auth/hooks'
import { LeaveTeamDialog } from '@/features/teams/components/LeaveTeamDialog'
import { TeamColorPicker } from '@/features/teams/components/TeamColorPicker'
import { TeamMemberTable } from '@/features/teams/components/TeamMemberTable'
import {
  ROLE_KEY,
  useAddTeamMember,
  useRemoveTeamMember,
  useTeamMembers,
  useTeams,
  useUpdateTeamMemberRole,
} from '@/features/teams/hooks'
import { resolveTeamColor } from '@/features/teams/teamColors'
import { ApiError } from '@/shared/api/client'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { PageHeader } from '@/shared/components/PageHeader'
import { RequiredMark } from '@/shared/components/RequiredMark'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader } from '@/shared/components/ui/empty'
import { Field, FieldError, FieldLabel } from '@/shared/components/ui/field'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Spinner } from '@/shared/components/ui/spinner'
import type { TeamMember, TeamRole } from '@/shared/types'

function AddMemberForm({ teamId }: { teamId: string }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('MEMBER')
  const add = useAddTeamMember(teamId)
  const error = add.error instanceof ApiError && add.error.status > 0 && add.error.status < 500 ? add.error : null
  const emailError =
    error?.fields?.email ?? (error?.code === 'USER_NOT_FOUND' || error?.code === 'ALREADY_MEMBER' ? error.message : undefined)
  const roleError = error?.fields?.role
  // 필드 오류가 아닌 그 밖의 4xx(403 등)는 폼 아래에 보인다
  const formError = error && !emailError && !roleError ? error.message : undefined

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    add.mutate(
      { email, role },
      {
        onSuccess: () => {
          setEmail('')
          setRole('MEMBER')
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('team.addMember.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 md:flex-row md:items-start">
          <Field data-invalid={!!emailError} className="md:flex-1">
            <FieldLabel htmlFor="member-email">
              {t('auth.email')} <RequiredMark />
            </FieldLabel>
            <Input
              id="member-email"
              type="email"
              maxLength={254}
              value={email}
              aria-invalid={!!emailError}
              onChange={(e) => setEmail(e.target.value)}
            />
            <FieldError>{emailError}</FieldError>
          </Field>
          <Field data-invalid={!!roleError} className="md:w-40">
            <FieldLabel htmlFor="member-role">{t('team.member.role')}</FieldLabel>
            <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
              <SelectTrigger id="member-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">{t(ROLE_KEY.MEMBER)}</SelectItem>
                <SelectItem value="MANAGER">{t(ROLE_KEY.MANAGER)}</SelectItem>
              </SelectContent>
            </Select>
            <FieldError>{roleError}</FieldError>
          </Field>
          <Button type="submit" disabled={add.isPending} className="md:mt-6.5">
            {add.isPending && <Spinner />}
            {t('team.addMember.submit')}
          </Button>
        </form>
        {formError && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {formError}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function TeamDetailPage() {
  const { t } = useTranslation()
  const { teamId = '' } = useParams()
  const teams = useTeams()
  const members = useTeamMembers(teamId)
  const me = useMe()
  const updateRole = useUpdateTeamMemberRole(teamId)
  const remove = useRemoveTeamMember(teamId)
  const [removing, setRemoving] = useState<TeamMember | null>(null)
  const [leaving, setLeaving] = useState(false)
  const navigate = useNavigate()

  const team = teams.data?.items.find((t) => t.id === teamId)
  const notFound = (members.error instanceof ApiError && members.error.status === 404) || (teams.isSuccess && !team)

  if (notFound) {
    // ST-02
    return (
      <Empty>
        <EmptyHeader>
          <EmptyDescription>{t('common.notFound')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" asChild>
            <Link to="/teams">{t('team.backToList')}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const isOwner = team?.role === 'OWNER'

  return (
    <div className="grid gap-4">
      <Link to="/teams" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        {t('team.backLink')}
      </Link>
      <PageHeader
        title={team?.name ?? t('team.title')}
        actions={
          team && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">{t('team.myRoleBadge', { role: t(ROLE_KEY[team.role]) })}</Badge>
              {isOwner && (
                <Button variant="outline" onClick={() => setLeaving(true)}>
                  {t('team.leave.title')}
                </Button>
              )}
            </div>
          )
        }
      />
      {team && <TeamColorPicker teamId={teamId} current={resolveTeamColor(teams.data!.items).get(teamId)} />}
      {isOwner && <AddMemberForm teamId={teamId} />}
      <h2 className="text-lg font-semibold">{t('team.members')}</h2>
      {members.isPending || !team ? (
        <div className="grid gap-2" aria-label={t('common.loading')}>
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <TeamMemberTable
          members={members.data?.items ?? []}
          myUserId={me.data?.id}
          isOwner={isOwner}
          onToggleManager={(m) => updateRole.mutate({ userId: m.userId, role: m.role === 'MANAGER' ? 'MEMBER' : 'MANAGER' })}
          onRemove={setRemoving}
        />
      )}
      {isOwner && (
        <ConfirmDialog
          open={!!removing}
          onOpenChange={(o) => !o && setRemoving(null)}
          title={t('team.removeMember.title')}
          description={t('team.removeMember.description', { name: removing?.name, teamName: team.name })}
          confirmLabel={t('team.member.remove')}
          onConfirm={() => removing && remove.mutate(removing.userId)}
        />
      )}
      {leaving && (
        <LeaveTeamDialog
          teamId={teamId}
          candidates={(members.data?.items ?? []).filter((m) => m.userId !== me.data?.id)}
          onOpenChange={setLeaving}
          onLeft={() => navigate('/teams')}
        />
      )}
    </div>
  )
}
