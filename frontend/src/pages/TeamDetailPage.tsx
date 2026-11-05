// SC-09
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useMe } from '@/features/auth/hooks'
import { TeamMemberTable } from '@/features/teams/components/TeamMemberTable'
import {
  ROLE_LABEL,
  useAddTeamMember,
  useRemoveTeamMember,
  useTeamMembers,
  useTeams,
  useUpdateTeamMemberRole,
} from '@/features/teams/hooks'
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
        <CardTitle>구성원 추가</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 md:flex-row md:items-start">
          <Field data-invalid={!!emailError} className="md:flex-1">
            <FieldLabel htmlFor="member-email">
              이메일 <RequiredMark />
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
            <FieldLabel htmlFor="member-role">역할</FieldLabel>
            <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
              <SelectTrigger id="member-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">{ROLE_LABEL.MEMBER}</SelectItem>
                <SelectItem value="MANAGER">{ROLE_LABEL.MANAGER}</SelectItem>
              </SelectContent>
            </Select>
            <FieldError>{roleError}</FieldError>
          </Field>
          <Button type="submit" disabled={add.isPending} className="md:mt-6.5">
            {add.isPending && <Spinner />}
            추가
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
  const { teamId = '' } = useParams()
  const teams = useTeams()
  const members = useTeamMembers(teamId)
  const me = useMe()
  const updateRole = useUpdateTeamMemberRole(teamId)
  const remove = useRemoveTeamMember(teamId)
  const [removing, setRemoving] = useState<TeamMember | null>(null)

  const team = teams.data?.items.find((t) => t.id === teamId)
  const notFound = (members.error instanceof ApiError && members.error.status === 404) || (teams.isSuccess && !team)

  if (notFound) {
    // ST-02
    return (
      <Empty>
        <EmptyHeader>
          <EmptyDescription>찾을 수 없습니다.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" asChild>
            <Link to="/teams">팀 목록으로</Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const isOwner = team?.role === 'OWNER'

  return (
    <div className="grid gap-4">
      <Link to="/teams" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        &lt; 팀 목록
      </Link>
      <PageHeader title={team?.name ?? '팀'} actions={team && <Badge variant="outline">내 역할: {ROLE_LABEL[team.role]}</Badge>} />
      {isOwner && <AddMemberForm teamId={teamId} />}
      <h2 className="text-lg font-semibold">구성원</h2>
      {members.isPending || !team ? (
        <div className="grid gap-2" aria-label="불러오는 중">
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
          title="구성원 제거"
          description={`${removing?.name}님을 ${team.name}에서 제거할까요? ${removing?.name}님의 할일 중 이 팀에 공유된 항목의 공유가 해제됩니다.`}
          confirmLabel="제거"
          onConfirm={() => removing && remove.mutate(removing.userId)}
        />
      )}
    </div>
  )
}
