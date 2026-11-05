import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { Category, CategoryList } from '@/shared/types'

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories(), queryFn: () => api.get<CategoryList>('/api/categories') })
}

// 카테고리 변경은 할일 목록의 카테고리 표시에도 영향을 주므로 둘 다 무효화한다
function useCategoryMutation<V>(mutationFn: (v: V) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.categories() }),
        queryClient.invalidateQueries({ queryKey: ['todos'] }),
      ]),
  })
}

export const useCreateCategory = () => useCategoryMutation((name: string) => api.post<Category>('/api/categories', { name }))
export const useRenameCategory = () =>
  useCategoryMutation(({ id, name }: { id: string; name: string }) => api.patch<Category>(`/api/categories/${id}`, { name }))
export const useDeleteCategory = () => useCategoryMutation((id: string) => api.del(`/api/categories/${id}`))
