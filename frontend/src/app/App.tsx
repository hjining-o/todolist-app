import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { CalendarPage } from '@/pages/CalendarPage'
import { CategoriesPage } from '@/pages/CategoriesPage'
import { LoginPage } from '@/pages/LoginPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SignupPage } from '@/pages/SignupPage'
import { TeamDetailPage } from '@/pages/TeamDetailPage'
import { TeamsPage } from '@/pages/TeamsPage'
import { TodoEditPage } from '@/pages/TodoEditPage'
import { TodoListPage } from '@/pages/TodoListPage'
import { logger } from '@/shared/lib/logger'
import { AppLayout } from './AppLayout'
import { AuthGuard, GuestGuard } from './AuthGuard'

export function App() {
  const { pathname, search } = useLocation()
  useEffect(() => logger.info('route', pathname + search), [pathname, search])
  return (
    <Routes>
      <Route element={<GuestGuard />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/todos" element={<TodoListPage />} />
          <Route path="/todos/new" element={<TodoEditPage />} />
          <Route path="/todos/:todoId" element={<TodoEditPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:teamId" element={<TeamDetailPage />} />
          <Route path="/me" element={<ProfilePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/todos" replace />} />
    </Routes>
  )
}
