// SC-07
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useMe } from '@/features/auth/hooks'
import { useUpdateMe } from '@/features/users/hooks'
import { ApiError } from '@/shared/api/client'
import { errorMessage, fieldErrors } from '@/shared/api/errorMessage'
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
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const zones = Intl.supportedValuesOf('timeZone')
  if (!zones.includes(value)) zones.unshift(value) // 엔진 목록에 없는 값(UTC 등)도 현재 값으로 보인다
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id="timezone" type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={t('profile.timezone')} className="justify-between font-normal">
          {value}
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder={t('profile.timezoneSearch')} />
          <CommandList>
            <CommandEmpty>{t('profile.noResult')}</CommandEmpty>
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
  const { t } = useTranslation()
  const [name, setName] = useState(me.name)
  const [timezone, setTimezone] = useState(me.timezone)
  const update = useUpdateMe()
  const error = clientError(update.error)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const body = { ...(name !== me.name && { name }), ...(timezone !== me.timezone && { timezone }) }
    if (Object.keys(body).length === 0) return // 바뀐 게 없으면 요청하지 않는다
    update.mutate(body, { onSuccess: () => toast.success(t('profile.saved')) })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('menu.profile')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {error && !error.fields && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage(error)}</AlertDescription>
              </Alert>
            )}
            <Field>
              <FieldLabel>{t('auth.email')}</FieldLabel>
              <p className="text-sm">
                {me.email} <span className="text-muted-foreground">{t('profile.emailReadonly')}</span>
              </p>
            </Field>
            <Field data-invalid={!!fieldErrors(error)?.name}>
              <FieldLabel htmlFor="name">
                {t('auth.name')} <RequiredMark />
              </FieldLabel>
              <Input id="name" value={name} maxLength={50} autoComplete="name" aria-invalid={!!fieldErrors(error)?.name} onChange={(e) => setName(e.target.value)} />
              <div className="flex justify-end">
                <CharCounter value={name} max={50} />
              </div>
              <FieldError>{fieldErrors(error)?.name}</FieldError>
            </Field>
            <Field data-invalid={!!fieldErrors(error)?.timezone}>
              <FieldLabel htmlFor="timezone">{t('profile.timezone')}</FieldLabel>
              <TimezoneCombobox value={timezone} onChange={setTimezone} />
              <FieldError>{fieldErrors(error)?.timezone}</FieldError>
            </Field>
            <Button type="submit" className="self-end" disabled={update.isPending}>
              {update.isPending && <Spinner />}
              {t('common.save')}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function PasswordCard() {
  const { t } = useTranslation()
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNew] = useState('')
  const update = useUpdateMe()
  const error = clientError(update.error)
  const currentError = fieldErrors(error)?.currentPassword ?? (error?.code === 'WRONG_PASSWORD' ? errorMessage(error) : undefined)
  const newError = fieldErrors(error)?.newPassword

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    update.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrent('')
          setNew('')
          toast.success(t('profile.passwordChanged'))
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.passwordChange')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {error && !currentError && !newError && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage(error)}</AlertDescription>
              </Alert>
            )}
            <Field data-invalid={!!currentError}>
              <FieldLabel htmlFor="currentPassword">{t('profile.currentPassword')}</FieldLabel>
              <Input id="currentPassword" type="password" value={currentPassword} maxLength={72} autoComplete="current-password" aria-invalid={!!currentError} onChange={(e) => setCurrent(e.target.value)} />
              <FieldError>{currentError}</FieldError>
            </Field>
            <Field data-invalid={!!newError}>
              <FieldLabel htmlFor="newPassword">
                {t('profile.newPassword')} <span className="font-normal text-muted-foreground">{t('auth.passwordHint')}</span>
              </FieldLabel>
              <Input id="newPassword" type="password" value={newPassword} maxLength={72} autoComplete="new-password" aria-invalid={!!newError} onChange={(e) => setNew(e.target.value)} />
              <FieldError>{newError}</FieldError>
            </Field>
            <Button type="submit" className="self-end" disabled={update.isPending}>
              {update.isPending && <Spinner />}
              {t('profile.passwordChange')}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

export function ProfilePage() {
  const { t } = useTranslation()
  const { data: me } = useMe()
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title={t('menu.profile')} />
      {me ? <ProfileCard me={me} /> : <Skeleton className="h-64 w-full" />}
      {me?.hasPassword && <PasswordCard />}
    </div>
  )
}
