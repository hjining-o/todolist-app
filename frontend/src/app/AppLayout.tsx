// SC-00
import { MenuIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { useLogout, useMe } from '@/features/auth/hooks'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'

const MENUS = [
  { to: '/todos', label: '목록' },
  { to: '/calendar', label: '캘린더' },
  { to: '/categories', label: '카테고리' },
  { to: '/teams', label: '팀' },
  { to: '/me', label: '내 정보' },
]

function Menus({ onSelect }: { onSelect?: () => void }) {
  const { pathname } = useLocation()
  return MENUS.map(({ to, label }) => {
    const active = pathname === to || pathname.startsWith(to + '/') // /todos/new 도 '목록'
    return (
      <Button key={to} asChild variant={active ? 'secondary' : 'ghost'} className="justify-start">
        <Link to={to} aria-current={active ? 'page' : undefined} onClick={onSelect}>
          {label}
        </Link>
      </Button>
    )
  })
}

function UserActions({ onDone }: { onDone?: () => void }) {
  const { data: me } = useMe()
  const logout = useLogout()
  return (
    <>
      <span className="text-sm text-muted-foreground">{me?.name}</span>
      <ThemeToggle />
      <Button
        variant="outline"
        size="sm"
        disabled={logout.isPending}
        onClick={() => {
          onDone?.()
          logout.mutate()
        }}
      >
        로그아웃
      </Button>
    </>
  )
}

export function AppLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-40 h-14 border-b bg-background">
        <div className="mx-auto flex h-full w-full max-w-5xl items-center gap-2 px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="메뉴 열기" className="md:hidden">
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" aria-describedby={undefined}>
              <SheetHeader>
                <SheetTitle>메뉴</SheetTitle>
              </SheetHeader>
              <nav aria-label="모바일 메뉴" className="flex flex-col gap-1 px-4">
                <Menus onSelect={() => setOpen(false)} />
              </nav>
              <Separator />
              <div className="flex items-center justify-between px-4">
                <UserActions onDone={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <Link to="/todos" className="text-lg font-semibold">
            TodoList
          </Link>
          <nav aria-label="주 메뉴" className="ml-4 hidden gap-1 md:flex">
            <Menus />
          </nav>
          <div className="ml-auto hidden items-center gap-3 md:flex">
            <UserActions />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
