import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button } from '@/shared/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader } from '@/shared/components/ui/empty'

// ST-02
export function TodoNotFound() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <Empty>
      <EmptyHeader>
        <EmptyDescription>{t('common.notFound')}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={() => navigate('/todos', { replace: true })}>
          {t('common.backToList')}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
