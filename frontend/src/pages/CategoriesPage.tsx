// SC-06
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useCategories, useCreateCategory, useDeleteCategory, useRenameCategory } from '@/features/categories/hooks'
import { ApiError } from '@/shared/api/client'
import { errorMessage, fieldErrors } from '@/shared/api/errorMessage'
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
  return fieldErrors(error)?.name ?? errorMessage(error)
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
  const { t } = useTranslation()
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
          <NameField label={t('category.nameOf', { name: category.name })} value={name} onChange={setName} error={nameError(rename.error)} />
          <Button type="submit" disabled={rename.isPending}>
            {rename.isPending && <Spinner />}
            {t('common.save')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditing(false)
              rename.reset()
            }}
          >
            {t('common.cancel')}
          </Button>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between gap-2 p-3">
      <span className="flex items-center gap-2">
        {category.name}
        {category.isDefault && <Badge variant="secondary">{t('category.default')}</Badge>}
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
          {t('common.edit')}
        </Button>
        <Button variant="destructive" size="sm" disabled={category.isDefault} onClick={() => onDelete(category)}>
          {t('common.delete')}
        </Button>
      </span>
    </li>
  )
}

export function CategoriesPage() {
  const { t } = useTranslation()
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
      <PageHeader title={t('menu.categories')} />
      <form onSubmit={onSubmit} noValidate className="flex items-start gap-2">
        <NameField label={t('category.new')} value={name} onChange={setName} error={nameError(create.error)} />
        <Button type="submit" disabled={create.isPending}>
          {create.isPending && <Spinner />}
          {t('common.add')}
        </Button>
      </form>
      {isPending ? (
        <div className="flex flex-col gap-2" aria-label={t('common.loading')}>
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
        title={t('category.deleteTitle')}
        description={t('category.deleteDescription', { name: target?.name })}
        confirmLabel={t('common.delete')}
        onConfirm={() => target && remove.mutate(target.id)}
      />
    </div>
  )
}
