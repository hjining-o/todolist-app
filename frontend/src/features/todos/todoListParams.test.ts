import { ALL_CATEGORIES } from '@/features/categories/components/CategorySelect'
import { ALL_STATUS } from '@/stores/todoFilterStore'
import { toTodoListParams } from './todoListParams'

const base = { view: { type: 'ALL' } as const, categoryId: ALL_CATEGORIES, status: ALL_STATUS as typeof ALL_STATUS, offset: 0 }

describe('toTodoListParams', () => {
  it('기본값은 limit 50, offset 0 만 보낸다', () => {
    expect(toTodoListParams(base)).toEqual({
      teamId: undefined,
      userId: undefined,
      categoryId: undefined,
      status: undefined,
      limit: 50,
      offset: 0,
    })
  })
  it('보기가 팀이면 teamId 만 보낸다', () => {
    const p = toTodoListParams({ ...base, view: { type: 'TEAM', teamId: 't1' } })
    expect(p.teamId).toBe('t1')
    expect(p.userId).toBeUndefined()
  })
  it('보기가 사용자면 userId 만 보낸다', () => {
    const p = toTodoListParams({ ...base, view: { type: 'USER', userId: 'u1' } })
    expect(p.userId).toBe('u1')
    expect(p.teamId).toBeUndefined()
  })
  it('카테고리를 지정하면 categoryId 를 보낸다', () => {
    expect(toTodoListParams({ ...base, categoryId: 'c1' }).categoryId).toBe('c1')
  })
  it('상태를 지정하면 status 를 보낸다', () => {
    expect(toTodoListParams({ ...base, status: 'OVERDUE' }).status).toBe('OVERDUE')
  })
  it('offset 을 그대로 보낸다', () => {
    expect(toTodoListParams({ ...base, offset: 50 }).offset).toBe(50)
  })
})
