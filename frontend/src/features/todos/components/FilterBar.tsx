import { useQueries } from '@tanstack/react-query'
import { ListFilter } from 'lucide-react'
import { useState } from 'react'
import { useMe } from '@/features/auth/hooks'
import { CategorySelect } from '@/features/categories/components/CategorySelect'
import { TeamColorDot } from '@/features/teams/components/TeamColorDot'
import { useTeams } from '@/features/teams/hooks'
import { resolveTeamColor } from '@/features/teams/teamColors'
import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import { Button } from '@/shared/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import type { TeamMemberList } from '@/shared/types'
import { ALL_STATUS, useTodoFilterStore, type TodoView } from '@/stores/todoFilterStore'
import { STATUS_LABEL } from './StatusBadge'

const ALL_VIEW = 'ALL'
const viewToValue = (v: TodoView) => (v.type === 'ALL' ? ALL_VIEW : v.type === 'TEAM' ? `team:${v.teamId}` : `user:${v.userId}`)
function valueToView(value: string): TodoView {
  if (value.startsWith('team:')) return { type: 'TEAM', teamId: value.slice(5) }
  if (value.startsWith('user:')) return { type: 'USER', userId: value.slice(5) }
  return { type: 'ALL' }
}

// F4 선택지: 내 팀들 + 팀 구성원 합집합(중복 제거). 구성원은 팀마다 조회한다(W-04)
function useViewOptions() {
  const { data: me } = useMe()
  const { data: teams } = useTeams()
  const memberQueries = useQueries({
    queries: (teams?.items ?? []).map((t) => ({
      queryKey: queryKeys.members(t.id),
      queryFn: () => api.get<TeamMemberList>(`/api/teams/${t.id}/members`),
    })),
  })
  const users = new Map<string, string>()
  for (const q of memberQueries) for (const m of q.data?.items ?? []) if (m.userId !== me?.id) users.set(m.userId, m.name)
  return { me, teams: teams?.items ?? [], users: [...users] }
}

// F4 보기 Select. SC-03 필터와 SC-05 툴바가 같은 store 를 공유한다
export function ViewSelect() {
  const { view, setView } = useTodoFilterStore()
  const { me, teams, users } = useViewOptions()
  const colors = resolveTeamColor(teams)
  return (
    <div className="grid gap-1 md:w-48">
      <span className="text-sm">보기</span>
      <Select value={viewToValue(view)} onValueChange={(v) => setView(valueToView(v))}>
        <SelectTrigger aria-label="보기" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VIEW}>팀 전체</SelectItem>
          {me && <SelectItem value={`user:${me.id}`}>내 할일</SelectItem>}
          {teams.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>팀</SelectLabel>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={`team:${t.id}`}>
                    <TeamColorDot color={colors.get(t.id)} />
                    {t.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}
          {users.length > 0 && (
            <>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>사용자</SelectLabel>
                {users.map(([id, name]) => (
                  <SelectItem key={id} value={`user:${id}`}>
                    {name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

export function FilterBar() {
  const [open, setOpen] = useState(false) // 모바일 접힘 상태
  const { categoryId, status, setCategoryId, setStatus, reset } = useTodoFilterStore()

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="grid gap-2">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-fit md:hidden">
          <ListFilter /> 필터
        </Button>
      </CollapsibleTrigger>
      {/* forceMount: 데스크톱(md 이상)은 항상 펼친다 */}
      <CollapsibleContent forceMount className="grid gap-2 md:flex md:flex-wrap md:items-end">
        <ViewSelect />
        <div className="grid gap-1 md:w-48">
          <span className="text-sm">카테고리</span>
          <CategorySelect aria-label="카테고리" value={categoryId} onValueChange={setCategoryId} allLabel="전체" />
        </div>
        <div className="grid gap-1 md:w-40">
          <span className="text-sm">상태</span>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger aria-label="상태" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS}>전체</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" className="w-fit md:ml-auto" onClick={reset}>
          필터 초기화
        </Button>
      </CollapsibleContent>
    </Collapsible>
  )
}
