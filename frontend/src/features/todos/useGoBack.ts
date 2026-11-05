import { useLocation, useNavigate } from 'react-router'

// 이전 화면(목록·캘린더)으로. 직접 진입해 히스토리가 없으면 /todos
export function useGoBack() {
  const navigate = useNavigate()
  const { key } = useLocation()
  return () => (key === 'default' ? navigate('/todos', { replace: true }) : navigate(-1))
}
