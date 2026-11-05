import { useState, type FormEvent } from 'react'
import { useMe } from '@/features/auth/hooks'
import { CategorySelect } from '@/features/categories/components/CategorySelect'
import { useCategories } from '@/features/categories/hooks'
import { useTeamMembers, useTeams } from '@/features/teams/hooks'
import { ApiError } from '@/shared/api/client'
import { CharCounter } from '@/shared/components/CharCounter'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { FieldGroup } from '@/shared/components/ui/field'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Spinner } from '@/shared/components/ui/spinner'
import { Textarea } from '@/shared/components/ui/textarea'
import type { Todo } from '@/shared/types'
import { useCreateTodo, useDeleteTodo, useUpdateTodo, type TodoCreate, type TodoWrite } from '../hooks'
import { isEndBeforeStart, toFormDateTime, toRequestDateTime } from '../todoDateTime'
import { useGoBack } from '../useGoBack'
import { StatusBadge } from './StatusBadge'
import { TodoFormRow } from './TodoFormRow'
import { TodoNotFound } from './TodoNotFound'

const NONE = 'NONE' // '없음(개인 할일)' 항목 값(Select 항목은 빈 문자열 불가)
const PERIOD_ERROR = '종료 일시는 시작 일시보다 빠를 수 없습니다.'

interface Values {
  teamId: string
  ownerId: string
  title: string
  description: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  categoryId: string // '' = 고르지 않음(서버·기본 카테고리)
  completed: boolean
  sharedTeamIds: string[]
}

function initialValues(todo: Todo | undefined, meId: string, timeZone: string, defaultTeamId: string): Values {
  if (!todo)
    return {
      teamId: defaultTeamId, ownerId: meId, title: '', description: '', startDate: '', startTime: '', endDate: '', endTime: '',
      categoryId: '', completed: false, sharedTeamIds: defaultTeamId === NONE ? [] : [defaultTeamId],
    }
  const s = toFormDateTime(todo.startAt, timeZone)
  const e = toFormDateTime(todo.endAt, timeZone)
  return {
    teamId: NONE, ownerId: todo.owner.id, title: todo.title, description: todo.description ?? '',
    startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
    categoryId: todo.category?.id ?? '', completed: todo.completed, sharedTeamIds: todo.sharedTeams.map((t) => t.id),
  }
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

function OwnerSelect({ teamId, value, meId, onChange }: { teamId: string; value: string; meId: string; onChange: (id: string) => void }) {
  const { data } = useTeamMembers(teamId)
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id="owner" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {data?.items.map((m) => (
          <SelectItem key={m.userId} value={m.userId}>
            {m.userId === meId ? `나 (${m.name})` : m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface TodoFormProps {
  todo?: Todo // 없으면 등록, 있으면 편집(canEdit 인 것만 넘긴다)
  defaultTeamId?: string
}

export function TodoForm({ todo, defaultTeamId }: TodoFormProps) {
  const { data: me } = useMe()
  const { data: teams } = useTeams()
  const { data: categories } = useCategories()
  const goBack = useGoBack()
  const createTodo = useCreateTodo()
  const updateTodo = useUpdateTodo()
  const removeTodo = useDeleteTodo()
  const meId = me?.id ?? ''
  const timeZone = me?.timezone ?? 'Asia/Seoul'

  const [initial] = useState(() => initialValues(todo, meId, timeZone, defaultTeamId ?? NONE))
  const [v, setV] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [gone, setGone] = useState(false) // 저장·삭제 중 404(ST-02)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((p) => ({ ...p, [k]: val }))

  const isEdit = !!todo
  const isOwner = todo ? todo.isOwner : v.ownerId === meId // 등록: 소유자가 본인일 때 카테고리 활성
  const delegated = !isEdit && v.ownerId !== meId // 대리 등록
  const myRole = teams?.items.find((t) => t.id === v.teamId)?.role
  const showOwner = !isEdit && (myRole === 'OWNER' || myRole === 'MANAGER')
  const pending = createTodo.isPending || updateTodo.isPending
  const dirty = JSON.stringify(v) !== JSON.stringify(initial)
  const reversed = isEndBeforeStart(v.startDate, v.startTime, v.endDate, v.endTime)
  const endError = errors.endAt ?? (reversed ? PERIOD_ERROR : undefined)

  const changeTeam = (teamId: string) =>
    setV((p) => ({ ...p, teamId, ownerId: meId, sharedTeamIds: teamId === NONE ? [] : [teamId] })) // 고른 팀이 공유 기본값(FR-11 #3)
  const changeDate = (which: 'start' | 'end', date: string) =>
    setV((p) => ({ ...p, [`${which}Date`]: date, ...(date ? {} : { [`${which}Time`]: '' }) })) // 날짜를 지우면 시각도 비운다
  const toggleTeam = (id: string, on: boolean) =>
    set('sharedTeamIds', on ? [...v.sharedTeamIds, id] : v.sharedTeamIds.filter((x) => x !== id))

  const onError = (e: Error) => {
    if (!(e instanceof ApiError)) return
    if (e.status === 404) setGone(true)
    else if (e.fields) setErrors(e.fields)
    else if (e.code === 'INVALID_PERIOD') setErrors({ endAt: e.message })
    else if (e.status === 400) setFormError(e.message) // INVALID_SHARE_TEAM, INVALID_OWNER 등
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    setFormError('')
    const next: Record<string, string> = {}
    if (!v.title.trim()) next.title = '제목을 입력해 주세요.'
    if (isEdit && !v.startDate) next.startAt = '시작 날짜를 입력해 주세요.'
    if (isEdit && !v.endDate) next.endAt = '종료 날짜를 입력해 주세요.'
    setErrors(next)
    if (Object.keys(next).length > 0 || reversed) return

    const startAt = toRequestDateTime(v.startDate, v.startTime, timeZone)
    const endAt = toRequestDateTime(v.endDate, v.endTime, timeZone)
    const description = v.description.trim()
    if (!todo) {
      const body: TodoCreate = {
        teamId: v.teamId === NONE ? undefined : v.teamId,
        ownerId: delegated ? v.ownerId : undefined,
        title: v.title.trim(),
        description: description || undefined,
        startAt,
        endAt,
        categoryId: isOwner ? v.categoryId || undefined : undefined,
        sharedTeamIds: delegated ? undefined : v.sharedTeamIds, // 대리 등록은 보내면 400
      }
      createTodo.mutate(body, { onSuccess: goBack, onError })
      return
    }
    const patch: TodoWrite & { completed?: boolean } = {}
    if (v.title.trim() !== todo.title) patch.title = v.title.trim()
    if (description !== (todo.description ?? '')) patch.description = description || null
    if (v.startDate !== initial.startDate || v.startTime !== initial.startTime) patch.startAt = startAt
    if (v.endDate !== initial.endDate || v.endTime !== initial.endTime) patch.endAt = endAt
    if (v.completed !== todo.completed) patch.completed = v.completed
    if (isOwner && v.categoryId !== initial.categoryId) patch.categoryId = v.categoryId
    if (isOwner && !sameSet(v.sharedTeamIds, initial.sharedTeamIds)) patch.sharedTeamIds = v.sharedTeamIds
    if (Object.keys(patch).length === 0) return goBack() // 바뀐 것이 없으면 요청 없이 돌아간다
    updateTodo.mutate({ id: todo.id, ...patch }, { onSuccess: goBack, onError })
  }

  if (gone) return <TodoNotFound />

  const defaultCategoryId = categories?.items.find((c) => c.isDefault)?.id ?? ''
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      {todo && !todo.isOwner && <p className="text-sm text-muted-foreground">소유자: {todo.owner.name} (읽기 전용)</p>}
      <FieldGroup className="gap-4">
        {!isEdit && (
          <TodoFormRow label="팀" htmlFor="team">
            <Select value={v.teamId} onValueChange={changeTeam}>
              <SelectTrigger id="team" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>없음(개인)</SelectItem>
                {teams?.items.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TodoFormRow>
        )}
        {showOwner && (
          <TodoFormRow label="소유자" htmlFor="owner" error={errors.ownerId}>
            <OwnerSelect teamId={v.teamId} value={v.ownerId} meId={meId} onChange={(id) => set('ownerId', id)} />
          </TodoFormRow>
        )}
        <TodoFormRow label="제목" htmlFor="title" required error={errors.title}>
          <Input id="title" maxLength={200} value={v.title} aria-invalid={!!errors.title} onChange={(e) => set('title', e.target.value)} />
          <div className="flex justify-end">
            <CharCounter value={v.title} max={200} />
          </div>
        </TodoFormRow>
        <TodoFormRow label="설명" htmlFor="description" error={errors.description}>
          <Textarea id="description" maxLength={2000} value={v.description} onChange={(e) => set('description', e.target.value)} />
          <div className="flex justify-end">
            <CharCounter value={v.description} max={2000} />
          </div>
        </TodoFormRow>
        {(['start', 'end'] as const).map((w) => {
          const label = w === 'start' ? '시작' : '종료'
          const error = w === 'start' ? errors.startAt : endError
          return (
            <TodoFormRow key={w} label={label} htmlFor={`${w}Date`} error={error}>
              <div className="flex flex-wrap items-center gap-2">
                <Input id={`${w}Date`} type="date" className="w-auto" aria-invalid={!!error} value={v[`${w}Date`]} onChange={(e) => changeDate(w, e.target.value)} />
                <Input
                  type="time"
                  className="w-auto"
                  aria-label={`${label} 시각`}
                  disabled={!v[`${w}Date`]}
                  value={v[`${w}Time`]}
                  onChange={(e) => set(`${w}Time`, e.target.value)}
                />
                {!isEdit && <span className="text-xs text-muted-foreground">(비우면 {w === 'start' ? '00:00' : '23:59'})</span>}
              </div>
            </TodoFormRow>
          )
        })}
        <TodoFormRow label="카테고리" htmlFor="category" error={errors.categoryId}>
          {isOwner ? (
            <CategorySelect id="category" value={v.categoryId || defaultCategoryId} onValueChange={(id) => set('categoryId', id)} />
          ) : (
            <Select disabled>
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="(비공개)" />
              </SelectTrigger>
            </Select>
          )}
        </TodoFormRow>
        {todo && (
          <TodoFormRow label="완료 여부">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox id="completed" checked={v.completed} onCheckedChange={(c) => set('completed', c === true)} />
                <Label htmlFor="completed">완료</Label>
              </div>
              <StatusBadge status={todo.status} />
            </div>
          </TodoFormRow>
        )}
        {!delegated && (
          <TodoFormRow label="공유 팀" error={errors.sharedTeamIds}>
            {isOwner ? (
              <div className="flex flex-wrap gap-4">
                {teams?.items.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <Checkbox id={`share-${t.id}`} checked={v.sharedTeamIds.includes(t.id)} onCheckedChange={(c) => toggleTeam(t.id, c === true)} />
                    <Label htmlFor={`share-${t.id}`}>{t.name}</Label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm">{todo?.sharedTeams.map((t) => t.name).join(', ')}</p>
            )}
          </TodoFormRow>
        )}
      </FieldGroup>
      <div className="flex items-center justify-between gap-2">
        {todo ? (
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => setDeleteOpen(true)}>
            삭제
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => (dirty ? setLeaveOpen(true) : goBack())}>
            취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            저장
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="저장하지 않은 변경"
        description="저장하지 않은 변경이 있습니다. 나가시겠어요?"
        confirmLabel="나가기"
        confirmVariant="default"
        onConfirm={goBack}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="할일 삭제"
        description={`'${todo?.title ?? ''}' 할일을 삭제할까요? 삭제하면 복구할 수 없습니다.`}
        confirmLabel="삭제"
        onConfirm={() => todo && removeTodo.mutate(todo.id, { onSuccess: goBack, onError })}
      />
    </form>
  )
}
