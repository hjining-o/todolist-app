import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/shared/api/client'
import i18n from '@/shared/i18n'
import { useBannerStore } from '@/stores/bannerStore'

// 401(갱신 실패 포함)·403·413·5xx·네트워크 오류만 전역 처리한다. 400·404·409는 화면이 처리한다
// me 쿼리(meta.ownsAuth)의 401은 AuthGuard가 화면 이동을 맡는다
function handleError(error: unknown, onRetry?: () => void, ownsAuth = false) {
  if (!(error instanceof ApiError)) return
  const { status, message } = error
  if (status === 401) {
    const { pathname, search } = window.location
    if (!ownsAuth && pathname !== '/login' && pathname !== '/signup')
      window.location.assign(`/login?next=${encodeURIComponent(pathname + search)}`)
  } else if (status === 403) {
    useBannerStore.getState().show(i18n.t('common.forbidden'))
  } else if (status === 413 || status === 0 || status >= 500) {
    useBannerStore.getState().show(message, onRetry)
  }
}

export function createQueryClient() {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => handleError(error, () => void client.invalidateQueries({ queryKey: query.queryKey }), !!query.meta?.ownsAuth),
    }),
    mutationCache: new MutationCache({ onError: (error) => handleError(error) }),
    defaultOptions: {
      // 5xx·네트워크 오류만 1회 재시도한다(401은 client가 이미 갱신 재시도함)
      queries: {
        retry: (count, error) => error instanceof ApiError && (error.status === 0 || error.status >= 500) && count < 1,
      },
    },
  })
  return client
}
