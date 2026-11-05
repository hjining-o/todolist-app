import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/shared/api/client'
import { cn } from '@/shared/lib/utils'
import { useUpdateTeamColor } from '../hooks'
import { TEAM_PALETTE, type PaletteEntry } from '../teamColors'

// SC-09 '내 캘린더 색상'. 누르면 즉시 저장한다. 견본 색은 팔레트 예외(9-style-guide 1장)
export function TeamColorPicker({ teamId, current }: { teamId: string; current?: PaletteEntry }) {
  const { t } = useTranslation()
  const update = useUpdateTeamColor(teamId)
  const failed = update.error instanceof ApiError && update.error.status > 0 && update.error.status < 500
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium">{t('team.color.title')}</span>
      <div role="radiogroup" aria-label={t('team.color.title')} className="flex gap-2">
        {TEAM_PALETTE.map((p) => {
          const checked = p.key === current?.key
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={t(`team.color.${p.key}`)}
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
      <span className="text-xs text-muted-foreground">{t('team.color.onlyMe')}</span>
      {failed && (
        <span role="alert" className="text-xs text-destructive">
          {t('team.color.saveFailed')}
        </span>
      )}
    </div>
  )
}
