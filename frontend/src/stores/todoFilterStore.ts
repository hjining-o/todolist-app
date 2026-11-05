import { create } from 'zustand'
import { ALL_CATEGORIES } from '@/features/categories/components/CategorySelect'
import type { TodoStatus } from '@/shared/types'

// SC-03 필터·페이지와 SC-05 보기(F4) 공용 UI 상태. 서버 데이터는 넣지 않는다(FE-05)
export type TodoView = { type: 'ALL' } | { type: 'TEAM'; teamId: string } | { type: 'USER'; userId: string }
export const ALL_STATUS = 'ALL'

interface TodoFilterState {
  view: TodoView
  categoryId: string // ALL_CATEGORIES 이면 전체
  status: TodoStatus | typeof ALL_STATUS
  offset: number
  setView: (view: TodoView) => void
  setCategoryId: (categoryId: string) => void
  setStatus: (status: TodoFilterState['status']) => void
  setOffset: (offset: number) => void
  reset: () => void
}

const initial = { view: { type: 'ALL' } as TodoView, categoryId: ALL_CATEGORIES, status: ALL_STATUS as TodoFilterState['status'], offset: 0 }

// 필터를 바꾸면 1쪽으로 돌아간다(offset 0)
export const useTodoFilterStore = create<TodoFilterState>((set) => ({
  ...initial,
  setView: (view) => set({ view, offset: 0 }),
  setCategoryId: (categoryId) => set({ categoryId, offset: 0 }),
  setStatus: (status) => set({ status, offset: 0 }),
  setOffset: (offset) => set({ offset }),
  reset: () => set(initial),
}))
