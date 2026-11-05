// docs/8-swagger.yaml components.schemas 응답 타입

export type DateTimeOffset = string // ISO 8601 + 오프셋, 예: '2026-11-04T09:00+09:00'

export interface UserRef {
  id: string
  name: string
}
export interface TeamRef {
  id: string
  name: string
}
export interface CategoryRef {
  id: string
  name: string
}

export interface Me {
  id: string
  email: string
  name: string
  timezone: string
}

export interface Category {
  id: string
  name: string
  isDefault: boolean
}
export interface CategoryList {
  items: Category[]
}

export type TodoStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'

export interface Todo {
  id: string
  title: string
  description: string | null
  startAt: DateTimeOffset
  endAt: DateTimeOffset
  completed: boolean
  completedAt: DateTimeOffset | null
  status: TodoStatus
  owner: UserRef
  category?: CategoryRef // 소유자일 때만 있다
  sharedTeams: TeamRef[]
  canEdit: boolean
  isOwner: boolean
}
export interface TodoPage {
  items: Todo[]
  total: number
}
export interface TodoCalendar {
  items: Todo[]
  truncated: boolean
}

export type TodoHistoryAction = 'CREATED' | 'UPDATED' | 'COMPLETED' | 'UNCOMPLETED'

interface Change<T> {
  old: T | null
  new: T
}
export interface TodoHistoryChanges {
  title?: Change<string>
  description?: { old: string | null; new: string | null }
  startAt?: Change<DateTimeOffset>
  endAt?: Change<DateTimeOffset>
  completed?: Change<boolean>
  category?: Change<CategoryRef>
  sharedTeamIds?: Change<string[]>
}
export interface TodoHistory {
  id: string
  action: TodoHistoryAction
  actor: UserRef
  changedAt: DateTimeOffset
  changes: TodoHistoryChanges
}
export interface TodoHistoryList {
  items: TodoHistory[]
}

export type TeamRole = 'OWNER' | 'MANAGER' | 'MEMBER'
export interface Team {
  id: string
  name: string
  role: TeamRole
}
export interface TeamList {
  items: Team[]
}
export interface TeamMember {
  userId: string
  name: string
  email: string
  role: TeamRole
}
export interface TeamMemberList {
  items: TeamMember[]
}

export interface ErrorResponse {
  error: {
    code: string
    message: string
    fields?: Record<string, string>
  }
}
