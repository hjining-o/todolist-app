// SC-08
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { TeamColorDot } from '@/features/teams/components/TeamColorDot'
import { resolveTeamColor } from '@/features/teams/teamColors'
import { ROLE_KEY, useCreateTeam, useTeams } from '@/features/teams/hooks'
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
  const { t } = useTranslation()
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
            <DialogTitle>{t('team.create.title')}</DialogTitle>
          </DialogHeader>
          <Field data-invalid={!!message}>
            <FieldLabel htmlFor="team-name">
              {t('team.name')} <RequiredMark />
            </FieldLabel>
            <Input id="team-name" value={name} maxLength={50} aria-invalid={!!message} onChange={(e) => setName(e.target.value)} />
            <FieldError>{message}</FieldError>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Spinner />}
              {t('team.create.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TeamsPage() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { data, isPending } = useTeams()
  const colors = resolveTeamColor(data?.items ?? [])

  return (
    <div className="grid gap-4">
      <PageHeader title={t('team.title')} actions={<Button onClick={() => setOpen(true)}>{t('team.createButton')}</Button>} />
      {isPending ? (
        <div className="grid gap-2" aria-label={t('common.loading')}>
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : data?.items.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('team.name')}</TableHead>
              <TableHead>{t('team.myRole')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((team) => (
              <TableRow key={team.id} className="cursor-pointer" onClick={() => navigate(`/teams/${team.id}`)}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <TeamColorDot color={colors.get(team.id)} />
                    <Link to={`/teams/${team.id}`} onClick={(e) => e.stopPropagation()} className="underline-offset-4 hover:underline">
                      {team.name}
                    </Link>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{t(ROLE_KEY[team.role])}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyDescription>{t('team.empty')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {open && <CreateTeamDialog onOpenChange={setOpen} />}
    </div>
  )
}
