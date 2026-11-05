// SC-07
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useMe } from '@/features/auth/hooks'
import { useUpdateMe } from '@/features/users/hooks'
import { ApiError } from '@/shared/api/client'
import { CharCounter } from '@/shared/components/CharCounter'
import { PageHeader } from '@/shared/components/PageHeader'
import { RequiredMark } from '@/shared/components/RequiredMark'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/shared/components/ui/command'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/components/ui/field'
import { Input } from '@/shared/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Spinner } from '@/shared/components/ui/spinner'
import type { Me } from '@/shared/types'

// 5xx·네트워크 오류는 전역 배너가 처리한다
const clientError = (e: Error | null) => (e instanceof ApiError && e.status > 0 && e.status < 500 ? e : null)

function TimezoneCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const zones = Intl.supportedValuesOf('timeZone')
  if (!zones.includes(value)) zones.unshift(value) // 엔진 목록에 없는 값(UTC 등)도 현재 값으로 보인다
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id="timezone" type="button" variant="outline" role="combobox" aria-expanded={open} aria-label="시간대" className="justify-between font-normal">
          {value}
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="시간대 검색" />
          <CommandList>
            <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
            {zones.map((z) => (
              <CommandItem
                key={z}
                value={z}
                onSelect={() => {
                  onChange(z)
                  setOpen(false)
                }}
              >
                {z}
                {z === value && <CheckIcon className="ml-auto" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function ProfileCard({ me }: { me: Me }) {
  const [name, setName] = useState(me.name)
  const [timezone, setTimezone] = useState(me.timezone)
  const update = useUpdateMe()
  const error = clientError(update.error)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const body = { ...(name !== me.name && { name }), ...(timezone !== me.timezone && { timezone }) }
    if (Object.keys(body).length === 0) return // 바뀐 게 없으면 요청하지 않는다
    update.mutate(body, { onSuccess: () => toast.success('저장했습니다.') })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>내 정보</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {error && !error.fields && (
              <Alert variant="destructive">
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}
            <Field>
              <FieldLabel>이메일</FieldLabel>
              <p className="text-sm">
                {me.email} <span className="text-muted-foreground">(변경할 수 없습니다)</span>
              </p>
            </Field>
            <Field data-invalid={!!error?.fields?.name}>
              <FieldLabel htmlFor="name">
                이름 <RequiredMark />
              </FieldLabel>
              <Input id="name" value={name} maxLength={50} autoComplete="name" aria-invalid={!!error?.fields?.name} onChange={(e) => setName(e.target.value)} />
              <div className="flex justify-end">
                <CharCounter value={name} max={50} />
              </div>
              <FieldError>{error?.fields?.name}</FieldError>
            </Field>
            <Field data-invalid={!!error?.fields?.timezone}>
              <FieldLabel htmlFor="timezone">시간대</FieldLabel>
              <TimezoneCombobox value={timezone} onChange={setTimezone} />
              <FieldError>{error?.fields?.timezone}</FieldError>
            </Field>
            <Button type="submit" className="self-end" disabled={update.isPending}>
              {update.isPending && <Spinner />}
              저장
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function PasswordCard() {
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNew] = useState('')
  const update = useUpdateMe()
  const error = clientError(update.error)
  const currentError = error?.fields?.currentPassword ?? (error?.code === 'WRONG_PASSWORD' ? error.message : undefined)
  const newError = error?.fields?.newPassword

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    update.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrent('')
          setNew('')
          toast.success('비밀번호를 변경했습니다.')
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>비밀번호 변경</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {error && !currentError && !newError && (
              <Alert variant="destructive">
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}
            <Field data-invalid={!!currentError}>
              <FieldLabel htmlFor="currentPassword">현재 비밀번호</FieldLabel>
              <Input id="currentPassword" type="password" value={currentPassword} maxLength={72} autoComplete="current-password" aria-invalid={!!currentError} onChange={(e) => setCurrent(e.target.value)} />
              <FieldError>{currentError}</FieldError>
            </Field>
            <Field data-invalid={!!newError}>
              <FieldLabel htmlFor="newPassword">
                새 비밀번호 <span className="font-normal text-muted-foreground">(8자 이상, 72바이트 이하)</span>
              </FieldLabel>
              <Input id="newPassword" type="password" value={newPassword} maxLength={72} autoComplete="new-password" aria-invalid={!!newError} onChange={(e) => setNew(e.target.value)} />
              <FieldError>{newError}</FieldError>
            </Field>
            <Button type="submit" className="self-end" disabled={update.isPending}>
              {update.isPending && <Spinner />}
              비밀번호 변경
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

export function ProfilePage() {
  const { data: me } = useMe()
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title="내 정보" />
      {me ? <ProfileCard me={me} /> : <Skeleton className="h-64 w-full" />}
      <PasswordCard />
    </div>
  )
}
