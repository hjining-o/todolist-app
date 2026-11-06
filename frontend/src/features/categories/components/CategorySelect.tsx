import { categoryName } from '@/features/categories/categoryName'
import { useTranslation } from 'react-i18next'
import { useCategories } from '@/features/categories/hooks'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

export const ALL_CATEGORIES = 'ALL'

interface CategorySelectProps {
  value: string
  onValueChange: (value: string) => void
  allLabel?: string // 있으면 맨 위에 '전체' 항목(값 ALL_CATEGORIES)을 둔다
  id?: string
  'aria-label'?: string
}

export function CategorySelect({ value, onValueChange, allLabel, id, 'aria-label': ariaLabel }: CategorySelectProps) {
  const { t } = useTranslation()
  const { data } = useCategories()
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} aria-label={ariaLabel} className="w-full">
        <SelectValue placeholder={t('category.select')} />
      </SelectTrigger>
      <SelectContent>
        {allLabel && <SelectItem value={ALL_CATEGORIES}>{allLabel}</SelectItem>}
        {data?.items.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {categoryName(c.name)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
