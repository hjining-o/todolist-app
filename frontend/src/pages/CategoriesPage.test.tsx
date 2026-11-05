import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { createQueryClient } from '@/app/queryClient'
import { CategorySelect } from '@/features/categories/components/CategorySelect'
import { ApiError, api } from '@/shared/api/client'
import { me, renderApp } from '@/test/renderApp'

vi.mock('@/shared/api/client', async (orig) => ({
  ...(await orig<typeof import('@/shared/api/client')>()),
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}))

const get = vi.mocked(api.get)
const post = vi.mocked(api.post)
const patch = vi.mocked(api.patch)
const del = vi.mocked(api.del)

const base = [
  { id: '1', name: '기본', isDefault: true },
  { id: '2', name: 'Work', isDefault: false },
]
let items = base

beforeEach(() => {
  vi.resetAllMocks()
  items = base
  get.mockImplementation(async (path: string) => (path === '/api/me' ? me : { items }))
})

const categoryCalls = () => get.mock.calls.filter(([p]) => p === '/api/categories').length

describe('CategoriesPage', () => {
  it('카테고리를 추가하면 목록이 다시 조회되고 입력란이 비워진다', async () => {
    post.mockImplementation(async () => {
      items = [...base, { id: '3', name: '스터디', isDefault: false }]
      return items[2]
    })
    renderApp('/categories')
    await screen.findByText('Work')
    await userEvent.type(screen.getByLabelText('새 카테고리'), '스터디')
    expect(screen.getByText('3/50')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(await screen.findByText('스터디')).toBeInTheDocument()
    expect(post).toHaveBeenCalledWith('/api/categories', { name: '스터디' })
    expect(screen.getByLabelText('새 카테고리')).toHaveValue('')
  })

  it('이름을 변경하면 목록이 다시 조회된다', async () => {
    patch.mockImplementation(async () => {
      items = [base[0], { id: '2', name: 'Job', isDefault: false }]
    })
    renderApp('/categories')
    await screen.findByText('Work')
    await userEvent.click(screen.getAllByRole('button', { name: '수정' })[1])
    const input = screen.getByLabelText('Work 이름')
    await userEvent.clear(input)
    await userEvent.type(input, 'Job')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('Job')).toBeInTheDocument()
    expect(patch).toHaveBeenCalledWith('/api/categories/2', { name: 'Job' })
  })

  it('수정 중 취소하면 요청 없이 원래 행으로 돌아간다', async () => {
    renderApp('/categories')
    await screen.findByText('Work')
    await userEvent.click(screen.getAllByRole('button', { name: '수정' })[1])
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(patch).not.toHaveBeenCalled()
  })

  it('삭제 확인 후 DELETE 가 나가고 목록이 다시 조회된다', async () => {
    del.mockImplementation(async () => {
      items = [base[0]]
    })
    renderApp('/categories')
    await screen.findByText('Work')
    await userEvent.click(screen.getAllByRole('button', { name: '삭제' })[1])
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent("이 카테고리의 할일은 '기본'으로 옮겨집니다.")
    const before = categoryCalls()
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    await vi.waitFor(() => expect(screen.queryByText('Work')).not.toBeInTheDocument())
    expect(del).toHaveBeenCalledWith('/api/categories/2')
    expect(categoryCalls()).toBeGreaterThan(before)
  })

  it('삭제 확인에서 취소하면 DELETE 요청이 없다(C-04)', async () => {
    renderApp('/categories')
    await screen.findByText('Work')
    await userEvent.click(screen.getAllByRole('button', { name: '삭제' })[1])
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: '취소' }))
    expect(del).not.toHaveBeenCalled()
    expect(screen.getByText('Work')).toBeInTheDocument()
  })

  it('기본 카테고리의 수정·삭제 버튼은 비활성이다', async () => {
    renderApp('/categories')
    await screen.findByText('Work')
    expect(screen.getByText('기본', { selector: '[data-slot="badge"]' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '수정' })[0]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: '삭제' })[0]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: '수정' })[1]).toBeEnabled()
  })

  it('추가 시 409 CATEGORY_NAME_TAKEN 은 입력란 아래에 보인다', async () => {
    post.mockRejectedValue(new ApiError(409, 'CATEGORY_NAME_TAKEN', '같은 이름의 카테고리가 있습니다.'))
    renderApp('/categories')
    await screen.findByText('Work')
    await userEvent.type(screen.getByLabelText('새 카테고리'), 'work')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('같은 이름의 카테고리가 있습니다.')
    expect(screen.getByLabelText('새 카테고리').closest('[data-slot="field"]')).toContainElement(alert)
  })

  it('수정 시 409 CATEGORY_NAME_TAKEN 은 수정 입력란 아래에 보인다', async () => {
    patch.mockRejectedValue(new ApiError(409, 'CATEGORY_NAME_TAKEN', '같은 이름의 카테고리가 있습니다.'))
    renderApp('/categories')
    await screen.findByText('Work')
    await userEvent.click(screen.getAllByRole('button', { name: '수정' })[1])
    await userEvent.click(screen.getByRole('button', { name: '저장' }))
    const alert = await screen.findByRole('alert')
    expect(screen.getByLabelText('Work 이름').closest('[data-slot="field"]')).toContainElement(alert)
  })

  it('VALIDATION_ERROR 의 fields.name 이 입력란 아래에 보인다', async () => {
    post.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', { name: '이름을 입력해 주세요.' }))
    renderApp('/categories')
    await screen.findByText('Work')
    await userEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(await screen.findByText('이름을 입력해 주세요.')).toBeInTheDocument()
  })
})

describe('CategorySelect', () => {
  function Harness() {
    const [value, setValue] = useState('ALL')
    return (
      <>
        <CategorySelect aria-label="카테고리 필터" value={value} onValueChange={setValue} allLabel="전체" />
        <output>{value}</output>
      </>
    )
  }

  it('항목을 렌더하고 선택하면 값이 바뀐다', async () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <Harness />
      </QueryClientProvider>,
    )
    const trigger = screen.getByRole('combobox', { name: '카테고리 필터' })
    expect(trigger).toHaveTextContent('전체')
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('option', { name: 'Work' }))
    expect(screen.getByRole('status')).toHaveTextContent('2')
  })
})
