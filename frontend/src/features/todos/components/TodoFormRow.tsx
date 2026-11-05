import type { ReactNode } from 'react'
import { RequiredMark } from '@/shared/components/RequiredMark'
import { Field, FieldContent, FieldError, FieldLabel } from '@/shared/components/ui/field'

interface TodoFormRowProps {
  label: string
  htmlFor?: string
  required?: boolean
  error?: string
  children: ReactNode
}

// 데스크톱은 라벨 왼쪽·입력 오른쪽, 모바일은 위아래(스타일 가이드 2.4)
export function TodoFormRow({ label, htmlFor, required, error, children }: TodoFormRowProps) {
  return (
    <Field data-invalid={!!error} className="md:flex-row md:items-start">
      <FieldLabel htmlFor={htmlFor} className="md:w-24! md:shrink-0 md:pt-2">
        {label}
        {required && <RequiredMark />}
      </FieldLabel>
      <FieldContent>
        {children}
        {error && <FieldError>{error}</FieldError>}
      </FieldContent>
    </Field>
  )
}
