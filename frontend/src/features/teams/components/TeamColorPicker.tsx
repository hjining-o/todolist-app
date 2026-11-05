import { Check } from 'lucide-react'
import { ApiError } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { useUpdateTeamColor } from '../hooks'
import { TEAM_PALETTE, type PaletteEntry } from '../teamColors'

// SC-09 '내 캘린더 색상'. 누르면 즉시 저장한다. 견본 색은 팔레트 예외(9-style-guide 1장)
export function TeamColorPicker({ teamId, current }: { teamId: string; current?: PaletteEntry }) {
  const update = useUpdateTeamColor(teamId)
  const failed = update.error instanceof ApiError && update.error.status > 0 && update.error.status < 500
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium">내 캘린더 색상</span>
      <div role="radiogroup" aria-label="내 캘린더 색상" className="flex gap-2">
        {TEAM_PALETTE.map((p) => {
          const checked = p.key === current?.key
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={p.name}
              disabled={update.isPending}
              onClick={() => update.mutate(p.key)}
              style={{ backgroundColor: p.hex, color: p.fg }}
              className={cn(
                'flex size-6 items-center justify-center rounded-full outline-none transition-colors',
                'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                'disabled:pointer-events-none disabled:opacity-50',
              )}
            >
              {checked && <Check className="size-3.5" aria-hidden />}
            </button>
          )
        })}
      </div>
      <span className="text-xs text-muted-foreground">나에게만 적용됩니다</span>
      {failed && (
        <span role="alert" className="text-xs text-destructive">
          색을 저장하지 못했습니다.
        </span>
      )}
    </div>
  )
}
