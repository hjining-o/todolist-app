import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { Me } from '@/shared/types'

// 401은 AuthGuard가 화면 이동으로 처리한다(전역 401 처리 제외)
export function useMe() {
  return useQuery({ queryKey: queryKeys.me(), queryFn: () => api.get<Me>('/api/me'), meta: { ownsAuth: true } })
}

function useAuthMutation(path: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, string>) => api.post<Me>(path, body),
    onSuccess: (me) => queryClient.setQueryData(queryKeys.me(), me),
  })
}

export const useLogin = () => useAuthMutation('/api/auth/login')
export const useSignup = () => useAuthMutation('/api/auth/signup')

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
    onSuccess: () => {
      queryClient.clear() // 다음 사용자에게 이전 캐시가 보이지 않게 한다(EX-06)
      navigate('/login', { replace: true })
    },
  })
}
