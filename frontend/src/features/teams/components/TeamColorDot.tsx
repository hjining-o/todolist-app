import { cn } from '@/shared/lib/utils'
import type { PaletteEntry } from '../teamColors'

// 표시만 하는 색 점(SC-08, 캘린더 보기 Select)
export function TeamColorDot({ color, className }: { color?: PaletteEntry; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ backgroundColor: color?.hex }} />
}
