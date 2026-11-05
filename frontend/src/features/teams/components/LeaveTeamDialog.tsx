// DLG-04
import { useState } from 'react'
import { useLeaveTeam } from '@/features/teams/hooks'
import { ApiError } from '@/shared/api/client'
import { RequiredMark } from '@/shared/components/RequiredMark'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Field, FieldLabel } from '@/shared/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Spinner } from '@/shared/components/ui/spinner'
import type { TeamMember } from '@/shared/types'

interface Props {
  teamId: string
  candidates: TeamMember[] // 나를 뺀 구성원
  onOpenChange: (open: boolean) => void
  onLeft: () => void
}

export function LeaveTeamDialog({ teamId, candidates, onOpenChange, onLeft }: Props) {
  const [nextOwnerId, setNextOwnerId] = useState('')
  const leave = useLeaveTeam(teamId)
  const error = leave.error instanceof ApiError ? leave.error.message : leave.error ? '요청에 실패했습니다.' : null

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            leave.mutate(nextOwnerId, { onSuccess: onLeft })
          }}
        >
          <DialogHeader>
            <DialogTitle>팀 나가기</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">다음 소유자를 지정해야 팀을 나갈 수 있습니다.</p>
          <Field>
            <FieldLabel htmlFor="next-owner">
              다음 소유자 <RequiredMark />
            </FieldLabel>
            <Select value={nextOwnerId} onValueChange={setNextOwnerId} disabled={candidates.length === 0}>
              <SelectTrigger id="next-owner" className="w-full">
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {candidates.length === 0 && <p className="text-sm text-muted-foreground">다음 소유자로 지정할 구성원이 없습니다.</p>}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={!nextOwnerId || leave.isPending}>
              {leave.isPending && <Spinner />}
              지정하고 나가기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
