import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { Team, TeamColor, TeamList, TeamMember, TeamMemberList, TeamRole } from '@/shared/types'

export const ROLE_LABEL: Record<TeamRole, string> = { OWNER: '소유자', MANAGER: '관리자', MEMBER: '일반 팀원' }

export function useTeams() {
  return useQuery({ queryKey: queryKeys.teams(), queryFn: () => api.get<TeamList>('/api/teams') })
}

export function useTeamMembers(teamId: string) {
  return useQuery({
    queryKey: queryKeys.members(teamId),
    queryFn: () => api.get<TeamMemberList>(`/api/teams/${teamId}/members`),
    retry: false, // 404(ST-02)를 재시도하지 않는다
  })
}

export function useCreateTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.post<Team>('/api/teams', { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.teams() }),
  })
}

export function useUpdateTeamColor(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (color: TeamColor) => api.patch<Team>(`/api/teams/${teamId}/color`, { color }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.teams() }),
  })
}

function useMemberMutation<V>(teamId: string, fn: (v: V) => Promise<unknown>, alsoTodos = false) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.members(teamId) })
      if (alsoTodos) await queryClient.invalidateQueries({ queryKey: ['todos'] }) // 공유 해제 반영(R21)
    },
  })
}

export const useAddTeamMember = (teamId: string) =>
  useMemberMutation(teamId, (body: { email: string; role: TeamRole }) =>
    api.post<TeamMember>(`/api/teams/${teamId}/members`, body),
  )

export const useUpdateTeamMemberRole = (teamId: string) =>
  useMemberMutation(teamId, ({ userId, role }: { userId: string; role: TeamRole }) =>
    api.patch<TeamMember>(`/api/teams/${teamId}/members/${userId}`, { role }),
  )

export const useRemoveTeamMember = (teamId: string) =>
  useMemberMutation(teamId, (userId: string) => api.del(`/api/teams/${teamId}/members/${userId}`), true)

export function useLeaveTeam(teamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (nextOwnerId: string) => api.post(`/api/teams/${teamId}/leave`, { nextOwnerId }),
    // await 하지 않는다: 페이지가 곧 /teams 로 이동하므로 이 팀 화면이 ST-02 로 깜빡이지 않게 한다
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.members(teamId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.teams() })
      void queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })
}
