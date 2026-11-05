import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { ErrorBanner } from '@/shared/components/ErrorBanner'
import { useBannerStore } from '@/stores/bannerStore'

export function GlobalErrorBanner() {
  const { banner, clear } = useBannerStore()
  const { pathname } = useLocation()

  // 화면을 옮기면 배너를 지운다
  useEffect(() => clear(), [pathname, clear])

  if (!banner) return null
  const { message, onRetry } = banner
  return (
    <ErrorBanner
      message={message}
      onRetry={
        onRetry &&
        (() => {
          clear()
          onRetry()
        })
      }
    />
  )
}
