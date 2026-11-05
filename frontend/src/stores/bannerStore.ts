import { create } from 'zustand'

// 전역 에러 배너(ST-03·ST-04) UI 상태
interface BannerState {
  banner: { message: string; onRetry?: () => void } | null
  show: (message: string, onRetry?: () => void) => void
  clear: () => void
}

export const useBannerStore = create<BannerState>((set) => ({
  banner: null,
  show: (message, onRetry) => set({ banner: { message, onRetry } }),
  clear: () => set({ banner: null }),
}))
