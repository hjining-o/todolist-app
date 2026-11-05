// SC-06
import { useState, type FormEvent } from 'react'
import { useCategories, useCreateCategory, useDeleteCategory, useRenameCategory } from '@/features/categories/hooks'
import { ApiError } from '@/shared/api/client'
import { CharCounter } from '@/shared/components/CharCounter'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { PageHeader } from '@/shared/components/PageHeader'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Field, FieldError } from '@/shared/components/ui/field'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Spinner } from '@/shared/components/ui/spinner'
import type { Category } from '@/shared/types'

const MAX = 50

// 이름 입력란 아래에 보일 메시지(5xx·네트워크 오류는 전역 배너가 처리)
function nameError(error: Error | null) {
  if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500) return undefined
  return error.fields?.name ?? error.message
}

interface NameFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
}

function NameField({ label, value, onChange, error }: NameFieldProps) {
  return (
    <Field data-invalid={!!error} className="flex-1">
      <Input aria-label={label} value={value} maxLength={MAX} aria-invalid={!!error} onChange={(e) => onChange(e.target.value)} />
      <div className="flex justify-end">
        <CharCounter value={value} max={MAX} />
      </div>
      <FieldError>{error}</FieldError>
    </Field>
  )
}

function CategoryRow({ category, onDelete }: { category: Category; onDelete: (c: Category) => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const rename = useRenameCategory()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    rename.mutate({ id: category.id, name }, { onSuccess: () => setEditing(false) })
  }

  if (editing) {
    return (
      <li>
        <form onSubmit={onSubmit} noValidate className="flex items-start gap-2 p-3">
          <NameField label={`${category.name} 이름`} value={name} onChange={setName} error={nameError(rename.error)} />
          <Button type="submit" disabled={rename.isPending}>
            {rename.isPending && <Spinner />}
            저장
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditing(false)
              rename.reset()
            }}
          >
            취소
          </Button>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between gap-2 p-3">
      <span className="flex items-center gap-2">
        {category.name}
        {category.isDefault && <Badge variant="secondary">기본</Badge>}
      </span>
      <span className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={category.isDefault}
          onClick={() => {
            setName(category.name)
            setEditing(true)
          }}
        >
          수정
        </Button>
        <Button variant="destructive" size="sm" disabled={category.isDefault} onClick={() => onDelete(category)}>
          삭제
        </Button>
      </span>
    </li>
  )
}

export function CategoriesPage() {
  const { data, isPending } = useCategories()
  const create = useCreateCategory()
  const remove = useDeleteCategory()
  const [name, setName] = useState('')
  const [target, setTarget] = useState<Category | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    create.mutate(name, { onSuccess: () => setName('') })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="카테고리" />
      <form onSubmit={onSubmit} noValidate className="flex items-start gap-2">
        <NameField label="새 카테고리" value={name} onChange={setName} error={nameError(create.error)} />
        <Button type="submit" disabled={create.isPending}>
          {create.isPending && <Spinner />}
          추가
        </Button>
      </form>
      {isPending ? (
        <div className="flex flex-col gap-2" aria-label="불러오는 중">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {/* 기본 카테고리가 맨 위(R2) */}
          {data?.items
            .toSorted((a, b) => Number(b.isDefault) - Number(a.isDefault))
            .map((c) => <CategoryRow key={c.id} category={c} onDelete={setTarget} />)}
        </ul>
      )}
      <ConfirmDialog
        open={!!target}
        onOpenChange={(open) => !open && setTarget(null)}
        title="카테고리 삭제"
        description={`'${target?.name}' 카테고리를 삭제할까요? 이 카테고리의 할일은 '기본'으로 옮겨집니다.`}
        confirmLabel="삭제"
        onConfirm={() => target && remove.mutate(target.id)}
      />
    </div>
  )
}
