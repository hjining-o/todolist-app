import { safeNext } from './safeNext'

describe('safeNext', () => {
  it('앱 내부 경로는 그대로(쿼리 포함)', () => {
    expect(safeNext('/calendar')).toBe('/calendar')
    expect(safeNext('/todos?page=2')).toBe('/todos?page=2')
  })

  it.each(['https://evil.example', '//evil.example', '/\\evil.example', 'todos', ''])('%j 는 /todos', (v) => {
    expect(safeNext(v)).toBe('/todos')
  })

  it('없으면 /todos', () => {
    expect(safeNext(null)).toBe('/todos')
    expect(safeNext(undefined)).toBe('/todos')
  })
})
