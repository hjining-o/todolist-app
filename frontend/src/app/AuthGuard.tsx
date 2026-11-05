import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import { useMe } from '@/features/auth/hooks'
import { safeNext } from '@/features/auth/safeNext'
import { ApiError } from '@/shared/api/client'
import { logger } from '@/shared/lib/logger'

// 내 정보가 확정되기 전에는 보호 화면을 그리지 않는다(EX-06)
export function AuthGuard() {
  const { data, error } = useMe()
  const { pathname, search } = useLocation()
  if (error instanceof ApiError && error.status === 401) {
    logger.info('auth', '비로그인 리다이렉트', { from: pathname })
    return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />
  }
  return data ? <Outlet /> : null
}

// 로그인 상태로 SC-01·SC-02에 오면 ?next= 또는 SC-03으로 보낸다
export function GuestGuard() {
  const { data, isPending } = useMe()
  const [params] = useSearchParams()
  if (data) return <Navigate to={safeNext(params.get('next'))} replace />
  // 401은 비로그인의 정상 상태다. 확정되기 전에는 폼을 그리지 않는다
  return isPending ? null : <Outlet />
}
