// SC-08
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { TeamColorDot } from '@/features/teams/components/TeamColorDot'
import { resolveTeamColor } from '@/features/teams/teamColors'
import { ROLE_LABEL, useCreateTeam, useTeams } from '@/features/teams/hooks'
import { ApiError } from '@/shared/api/client'
import { PageHeader } from '@/shared/components/PageHeader'
import { RequiredMark } from '@/shared/components/RequiredMark'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader } from '@/shared/components/ui/empty'
import { Field, FieldError, FieldLabel } from '@/shared/components/ui/field'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Spinner } from '@/shared/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'

// DLG-03
function CreateTeamDialog({ onOpenChange }: { onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const create = useCreateTeam()
  const error = create.error instanceof ApiError && create.error.status > 0 && create.error.status < 500 ? create.error : null
  const message = error?.fields?.name ?? error?.message

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    create.mutate(name, {
      onSuccess: (team) => {
        onOpenChange(false)
        navigate(`/teams/${team.id}`)
      },
    })
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>팀 생성</DialogTitle>
          </DialogHeader>
          <Field data-invalid={!!message}>
            <FieldLabel htmlFor="team-name">
              팀 이름 <RequiredMark />
            </FieldLabel>
            <Input id="team-name" value={name} maxLength={50} aria-invalid={!!message} onChange={(e) => setName(e.target.value)} />
            <FieldError>{message}</FieldError>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Spinner />}
              생성
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TeamsPage() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { data, isPending } = useTeams()
  const colors = resolveTeamColor(data?.items ?? [])

  return (
    <div className="grid gap-4">
      <PageHeader title="팀" actions={<Button onClick={() => setOpen(true)}>팀 만들기</Button>} />
      {isPending ? (
        <div className="grid gap-2" aria-label="불러오는 중">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : data?.items.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>팀 이름</TableHead>
              <TableHead>내 역할</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`/teams/${t.id}`)}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <TeamColorDot color={colors.get(t.id)} />
                    <Link to={`/teams/${t.id}`} onClick={(e) => e.stopPropagation()} className="underline-offset-4 hover:underline">
                      {t.name}
                    </Link>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{ROLE_LABEL[t.role]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyDescription>속한 팀이 없습니다. 팀을 만들어 보세요.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {open && <CreateTeamDialog onOpenChange={setOpen} />}
    </div>
  )
}
