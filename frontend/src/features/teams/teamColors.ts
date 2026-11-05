// 팀 캘린더 색(6.3 CL-03·CL-04). 스타일 가이드 1장 '고정 색 금지'의 명시적 예외
import type { Team, TeamColor, Todo } from '@/shared/types'

export interface PaletteEntry {
  key: TeamColor
  name: string
  hex: string
  fg: string // 채움 배경 위 글자색
}

export const TEAM_PALETTE: readonly PaletteEntry[] = [
  { key: 'RED', name: '빨강', hex: '#DC2626', fg: '#FFFFFF' },
  { key: 'ORANGE', name: '주황', hex: '#C2410C', fg: '#FFFFFF' },
  { key: 'YELLOW', name: '노랑', hex: '#FACC15', fg: '#000000' },
  { key: 'GREEN', name: '초록', hex: '#15803D', fg: '#FFFFFF' },
  { key: 'TEAL', name: '청록', hex: '#0F766E', fg: '#FFFFFF' },
  { key: 'BLUE', name: '파랑', hex: '#2563EB', fg: '#FFFFFF' },
  { key: 'VIOLET', name: '보라', hex: '#7C3AED', fg: '#FFFFFF' },
  { key: 'PINK', name: '분홍', hex: '#BE185D', fg: '#FFFFFF' },
]

// 여러 팀에 공유된 할일 전용(팔레트에서 고를 수 없다)
export const MULTI_TEAM_COLOR = { hex: '#64748B', fg: '#FFFFFF' }

/** 팀 id → 표시 색. 색 미설정(null) 팀은 목록 순서로 팔레트를 순환 배정한다 */
export function resolveTeamColor(teams: readonly Team[]): Map<string, PaletteEntry> {
  return new Map(
    teams.map((t, i) => [t.id, TEAM_PALETTE.find((p) => p.key === t.color) ?? TEAM_PALETTE[i % TEAM_PALETTE.length]]),
  )
}

export interface BarColor {
  hex: string | null // null = 기본색(--primary)
  fg: string | null
  multi: boolean // 여러 팀 아이콘 표시
}

/** 보는 사람 기준 공유 팀 수로 막대 색을 정한다(CL-04) */
export function todoBarColor(todo: Pick<Todo, 'sharedTeams'>, teamColors: Map<string, PaletteEntry>): BarColor {
  const teams = todo.sharedTeams
  if (teams.length >= 2) return { ...MULTI_TEAM_COLOR, multi: true }
  const c = teams.length === 1 ? teamColors.get(teams[0].id) : undefined
  return c ? { hex: c.hex, fg: c.fg, multi: false } : { hex: null, fg: null, multi: false }
}
