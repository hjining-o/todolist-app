import type { Team, TeamColor } from '@/shared/types'
import { MULTI_TEAM_COLOR, resolveTeamColor, TEAM_PALETTE, todoBarColor } from './teamColors'

const team = (i: number, color: TeamColor | null = null): Team => ({ id: `t${i}`, name: `팀${i}`, role: 'MEMBER', color })

describe('resolveTeamColor', () => {
  it('설정된 색은 그대로, null 은 목록 순서로 자동 배정한다', () => {
    const m = resolveTeamColor([team(0), team(1, 'PINK'), team(2)])
    expect(m.get('t0')!.key).toBe('RED')
    expect(m.get('t1')!.key).toBe('PINK')
    expect(m.get('t2')!.key).toBe('YELLOW')
  })

  it('팀이 팔레트보다 많으면 처음부터 순환한다(9번째 = 첫 색)', () => {
    const m = resolveTeamColor(Array.from({ length: 10 }, (_, i) => team(i)))
    expect(m.get('t8')!.key).toBe(TEAM_PALETTE[0].key)
    expect(m.get('t9')!.key).toBe(TEAM_PALETTE[1].key)
  })
})

describe('todoBarColor', () => {
  const colors = resolveTeamColor([team(0, 'BLUE'), team(1, 'YELLOW')])
  const ref = (i: number) => ({ id: `t${i}`, name: `팀${i}` })

  it('공유 팀 0개면 기본색', () => {
    expect(todoBarColor({ sharedTeams: [] }, colors)).toEqual({ hex: null, fg: null, multi: false })
  })
  it('1개면 그 팀의 색과 채움 글자색', () => {
    expect(todoBarColor({ sharedTeams: [ref(0)] }, colors)).toEqual({ hex: '#2563EB', fg: '#FFFFFF', multi: false })
    expect(todoBarColor({ sharedTeams: [ref(1)] }, colors).fg).toBe('#000000')
  })
  it('1개지만 내 팀 목록에 없으면 기본색', () => {
    expect(todoBarColor({ sharedTeams: [ref(9)] }, colors).hex).toBeNull()
  })
  it('2개 이상이면 여러 팀 전용 색 + 아이콘 플래그', () => {
    expect(todoBarColor({ sharedTeams: [ref(0), ref(1)] }, colors)).toEqual({ ...MULTI_TEAM_COLOR, multi: true })
  })
})
