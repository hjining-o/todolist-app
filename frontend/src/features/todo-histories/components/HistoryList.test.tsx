import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createQueryClient } from '@/app/queryClient'
import { api } from '@/shared/api/client'
import type { TodoHistory } from '@/shared/types'
import { me } from '@/test/renderApp'
import { HistoryList } from './HistoryList'

vi.mock('@/shared/api/client', async (orig) => ({
  ...(await orig<typeof import('@/shared/api/client')>()),
  api: { get: vi.fn() },
}))
const get = vi.mocked(api.get)

const h = (over: Partial<TodoHistory>): TodoHistory => ({
  id: crypto.randomUUID(),
  action: 'UPDATED',
  actor: { id: '2', name: '이관리' },
  changedAt: '2026-11-05T10:12+09:00',
  changes: {},
  ...over,
})

function setup(items: TodoHistory[]) {
  get.mockImplementation(async (path: string) => {
    if (path === '/api/me') return me
    if (path === '/api/teams') return { items: [{ id: 't1', name: '마케팅팀', role: 'MEMBER' }] }
    return { items }
  })
  render(
    <QueryClientProvider client={createQueryClient()}>
      <HistoryList todoId="a" />
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.resetAllMocks())

describe('HistoryList', () => {
  it('이력이 없으면 빈 상태 문구', async () => {
    setup([])
    expect(await screen.findByText('표시할 변경 이력이 없습니다')).toBeInTheDocument()
  })

  it('동작별 배지와 일시·사용자를 보인다', async () => {
    setup([
      h({ action: 'CREATED' }),
      h({ action: 'UPDATED' }),
      h({ action: 'COMPLETED' }),
      h({ action: 'UNCOMPLETED' }),
    ])
    for (const label of ['등록', '수정', '완료', '완료 해제']) expect(await screen.findByText(label)).toBeInTheDocument()
    expect(screen.getAllByText('2026-11-05 10:12')).toHaveLength(4)
    expect(screen.getAllByText('이관리')).toHaveLength(4)
  })

  it('필드별 이전값 → 새값, null 은 (없음), 공유 팀은 이름', async () => {
    setup([
      h({
        changes: {
          title: { old: null, new: '주간 보고서' },
          description: { old: '메모', new: null },
          startAt: { old: null, new: '2026-11-04T00:00+09:00' },
          endAt: { old: '2026-11-04T18:00+09:00', new: '2026-11-05T18:00+09:00' },
          completed: { old: false, new: true },
          sharedTeamIds: { old: [], new: ['t1', 'zz'] },
        },
      }),
      h({ changes: { completed: { old: null, new: false } } }),
    ])
    expect(await screen.findByText('제목: (없음) → 주간 보고서')).toBeInTheDocument()
    expect(screen.getByText('설명: 메모 → (없음)')).toBeInTheDocument()
    expect(screen.getByText('시작: (없음) → 2026-11-04 00:00')).toBeInTheDocument()
    expect(screen.getByText('종료: 2026-11-04 18:00 → 2026-11-05 18:00')).toBeInTheDocument()
    expect(screen.getByText('완료 여부: 미완료 → 완료')).toBeInTheDocument()
    expect(screen.getByText('공유 팀: (없음) → 마케팅팀, (알 수 없는 팀)')).toBeInTheDocument()
    expect(screen.getByText('완료 여부: (없음) → 미완료')).toBeInTheDocument()
  })

  it('category 변경이 없으면 카테고리 줄이 없고(C-17), 있으면 이름으로 보인다', async () => {
    setup([h({ changes: { title: { old: 'a', new: 'b' } } })])
    await screen.findByText('제목: a → b')
    expect(screen.queryByText(/카테고리/)).not.toBeInTheDocument()
  })

  it('category 가 있으면 이름으로 표시', async () => {
    setup([h({ changes: { category: { old: { id: '1', name: '기본' }, new: { id: '2', name: 'Work' } } } })])
    expect(await screen.findByText('카테고리: 기본 → Work')).toBeInTheDocument()
  })
})
