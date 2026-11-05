// SC-02
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useSignup } from '@/features/auth/hooks'
import { ApiError } from '@/shared/api/client'
import { errorMessage, fieldErrors } from '@/shared/api/errorMessage'
import { RequiredMark } from '@/shared/components/RequiredMark'
import { LanguageSelect } from '@/shared/components/LanguageSelect'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/components/ui/field'
import { Input } from '@/shared/components/ui/input'
import { Spinner } from '@/shared/components/ui/spinner'

type Name = 'email' | 'password' | 'name'

// label·hint 는 i18n 키
const FIELDS: { name: Name; label: string; hint?: string; type: string; maxLength: number; autoComplete: string }[] = [
  { name: 'email', label: 'auth.email', type: 'email', maxLength: 254, autoComplete: 'email' },
  { name: 'password', label: 'auth.password', hint: 'auth.passwordHint', type: 'password', maxLength: 72, autoComplete: 'new-password' },
  { name: 'name', label: 'auth.name', hint: 'auth.nameHint', type: 'text', maxLength: 50, autoComplete: 'name' },
]

export function SignupPage() {
  const { t } = useTranslation()
  const [form, setForm] = useState<Record<Name, string>>({ email: '', password: '', name: '' })
  const navigate = useNavigate()
  const signup = useSignup()
  // 5xx·네트워크 오류는 전역 배너(ST-04)가 보여준다
  const error = signup.error instanceof ApiError && signup.error.status > 0 && signup.error.status < 500 ? signup.error : null
  const emailTaken = error?.code === 'EMAIL_TAKEN'
  const fieldError = (name: Name) => fieldErrors(error)?.[name] ?? (name === 'email' && emailTaken ? errorMessage(error) : undefined)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    signup.mutate(form, { onSuccess: () => navigate('/todos', { replace: true }) })
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <LanguageSelect />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-2xl">{t('auth.signup.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              {error && !emailTaken && (
                <Alert variant="destructive">
                  <AlertDescription>{errorMessage(error)}</AlertDescription>
                </Alert>
              )}
              {FIELDS.map(({ name, label, hint, ...inputProps }) => (
                <Field key={name} data-invalid={!!fieldError(name)}>
                  <FieldLabel htmlFor={name}>
                    {t(label)} <RequiredMark />
                    {hint && <span className="font-normal text-muted-foreground">{t(hint)}</span>}
                  </FieldLabel>
                  <Input
                    id={name}
                    value={form[name]}
                    aria-invalid={!!fieldError(name)}
                    onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                    {...inputProps}
                  />
                  <FieldError>{fieldError(name)}</FieldError>
                </Field>
              ))}
              <Button type="submit" disabled={signup.isPending}>
                {signup.isPending && <Spinner />}
                {t('auth.signup.submit')}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t('auth.signup.hasAccount')}{' '}
                <Link to="/login" className="text-foreground underline underline-offset-4">
                  {t('auth.signup.login')}
                </Link>
              </p>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
