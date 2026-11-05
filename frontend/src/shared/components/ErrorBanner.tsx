import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'

interface ErrorBannerProps {
  message: string
  onRetry?: () => void
}

// ST-03(권한 없음)은 onRetry 없이, ST-04(서버 오류)는 onRetry와 함께 쓴다
export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  const { t } = useTranslation()
  return (
    <Alert variant="destructive" className="flex items-center justify-between gap-4">
      <AlertDescription className="text-destructive">{message}</AlertDescription>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </Alert>
  )
}
