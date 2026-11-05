import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { Me } from '@/shared/types'

export interface UpdateMeBody {
  name?: string
  timezone?: string
  currentPassword?: string
  newPassword?: string
}

// 시간대가 바뀌면 목록·캘린더의 일시 표시가 달라지므로 todos 를 모두 무효화한다
export function useUpdateMe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateMeBody) => api.patch<Me>('/api/me', body),
    onSuccess: (me) => {
      queryClient.setQueryData(queryKeys.me(), me)
      return queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })
}
