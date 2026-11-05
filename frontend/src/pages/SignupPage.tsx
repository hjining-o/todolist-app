// SC-02
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useSignup } from '@/features/auth/hooks'
import { ApiError } from '@/shared/api/client'
import { RequiredMark } from '@/shared/components/RequiredMark'
import { LanguageSelect } from '@/shared/components/LanguageSelect'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/components/ui/field'
import { Input } from '@/shared/components/ui/input'
import { Spinner } from '@/shared/components/ui/spinner'

type Name = 'email' | 'password' | 'name'

const FIELDS: { name: Name; label: string; hint?: string; type: string; maxLength: number; autoComplete: string }[] = [
  { name: 'email', label: '이메일', type: 'email', maxLength: 254, autoComplete: 'email' },
  { name: 'password', label: '비밀번호', hint: '(8자 이상, 72바이트 이하)', type: 'password', maxLength: 72, autoComplete: 'new-password' },
  { name: 'name', label: '이름', hint: '(1~50자)', type: 'text', maxLength: 50, autoComplete: 'name' },
]

export function SignupPage() {
  const [form, setForm] = useState<Record<Name, string>>({ email: '', password: '', name: '' })
  const navigate = useNavigate()
  const signup = useSignup()
  // 5xx·네트워크 오류는 전역 배너(ST-04)가 보여준다
  const error = signup.error instanceof ApiError && signup.error.status > 0 && signup.error.status < 500 ? signup.error : null
  const emailTaken = error?.code === 'EMAIL_TAKEN'
  const fieldError = (name: Name) => error?.fields?.[name] ?? (name === 'email' && emailTaken ? error.message : undefined)

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
          <CardTitle className="text-center text-2xl">회원가입</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              {error && !emailTaken && (
                <Alert variant="destructive">
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              )}
              {FIELDS.map(({ name, label, hint, ...inputProps }) => (
                <Field key={name} data-invalid={!!fieldError(name)}>
                  <FieldLabel htmlFor={name}>
                    {label} <RequiredMark />
                    {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
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
                가입
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                이미 계정이 있나요?{' '}
                <Link to="/login" className="text-foreground underline underline-offset-4">
                  로그인
                </Link>
              </p>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
