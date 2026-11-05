import { useNavigate } from 'react-router'
import { Button } from '@/shared/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader } from '@/shared/components/ui/empty'

// ST-02
export function TodoNotFound() {
  const navigate = useNavigate()
  return (
    <Empty>
      <EmptyHeader>
        <EmptyDescription>찾을 수 없습니다.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={() => navigate('/todos', { replace: true })}>
          목록으로
        </Button>
      </EmptyContent>
    </Empty>
  )
}
