import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { ApiError, api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import { logger } from '@/shared/lib/logger'
import type { Me } from '@/shared/types'

// 401은 AuthGuard가 화면 이동으로 처리한다(전역 401 처리 제외)
export function useMe() {
  return useQuery({ queryKey: queryKeys.me(), queryFn: () => api.get<Me>('/api/me'), meta: { ownsAuth: true } })
}

const errorCode = (e: unknown) => (e instanceof ApiError ? e.code : 'NON_API_ERROR')

function useAuthMutation(path: string, action: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, string>) => api.post<Me>(path, body),
    onSuccess: (me) => {
      logger.info('auth', `${action} 성공`, { userId: me.id })
      queryClient.setQueryData(queryKeys.me(), me)
    },
    onError: (e) => logger.warn('auth', `${action} 실패`, { code: errorCode(e) }),
  })
}

export const useLogin = () => useAuthMutation('/api/auth/login', '로그인')
export const useSignup = () => useAuthMutation('/api/auth/signup', '가입')

export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
    onSuccess: () => {
      logger.info('auth', '로그아웃 성공')
      queryClient.clear() // 다음 사용자에게 이전 캐시가 보이지 않게 한다(EX-06)
      navigate('/login', { replace: true })
    },
    onError: (e) => logger.warn('auth', '로그아웃 실패', { code: errorCode(e) }),
  })
}
