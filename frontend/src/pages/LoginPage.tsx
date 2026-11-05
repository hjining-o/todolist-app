// SC-01
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useLogin } from '@/features/auth/hooks'
import { safeNext } from '@/features/auth/safeNext'
import { ApiError } from '@/shared/api/client'
import { LanguageSelect } from '@/shared/components/LanguageSelect'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/shared/components/ui/field'
import { Input } from '@/shared/components/ui/input'
import { Spinner } from '@/shared/components/ui/spinner'

export function LoginPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const login = useLogin()
  // 5xx·네트워크 오류는 전역 배너(ST-04)가 보여준다
  const error = login.error instanceof ApiError && login.error.status > 0 && login.error.status < 500 ? login.error : null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    login.mutate(
      { email, password },
      {
        onSuccess: () => navigate(safeNext(params.get('next')), { replace: true }),
        onError: () => setPassword(''),
      },
    )
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <LanguageSelect />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-2xl">TodoList</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              )}
              <Field>
                <FieldLabel htmlFor="email">{t('auth.email')}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">{t('auth.password')}</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Button type="submit" disabled={login.isPending}>
                {login.isPending && <Spinner />}
                {t('auth.login.submit')}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t('auth.login.noAccount')}{' '}
                <Link to="/signup" className="text-foreground underline underline-offset-4">
                  {t('auth.login.signup')}
                </Link>
              </p>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
