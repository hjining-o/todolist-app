import { ThemeProvider } from 'next-themes'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'
import { ErrorBanner } from './ErrorBanner'
import i18n from '@/shared/i18n'
import { LanguageSelect } from './LanguageSelect'
import { ThemeToggle } from './ThemeToggle'

describe('ConfirmDialog', () => {
  const setup = () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="삭제"
        description="삭제할까요?"
        confirmLabel="삭제"
        onConfirm={onConfirm}
      />,
    )
    return { onConfirm, onOpenChange }
  }

  it('취소하면 onConfirm을 부르지 않는다', async () => {
    const { onConfirm, onOpenChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('확인하면 onConfirm을 부른다', async () => {
    const { onConfirm } = setup()
    expect(screen.getByRole('alertdialog')).toHaveTextContent('삭제할까요?')
    await userEvent.click(screen.getByRole('button', { name: '삭제' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})

describe('ErrorBanner', () => {
  it('onRetry가 없으면 버튼이 없다', () => {
    render(<ErrorBanner message="권한이 없습니다." />)
    expect(screen.getByRole('alert')).toHaveTextContent('권한이 없습니다.')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('다시 시도를 누르면 onRetry를 부른다', async () => {
    const onRetry = vi.fn()
    render(<ErrorBanner message="오류" onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('ThemeToggle', () => {
  it('다크를 고르면 html에 dark 클래스가 붙는다', async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <ThemeToggle />
      </ThemeProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: '테마 변경' }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: '다크' }))
    expect(document.documentElement).toHaveClass('dark')
  })
})

describe('LanguageSelect', () => {
  it('언어를 고르면 i18n.language 가 바뀐다', async () => {
    render(<LanguageSelect />)
    await userEvent.click(screen.getByRole('button', { name: '언어 변경' }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'English' }))
    expect(i18n.language).toBe('en')
  })
})
