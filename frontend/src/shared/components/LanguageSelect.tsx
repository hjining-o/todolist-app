import { LanguagesIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'

const LANGUAGES = ['ko', 'en', 'zh', 'ja']
// 각 언어 고유 표기(한국어, English, 中文, 日本語)
const nativeName = (lng: string) => new Intl.DisplayNames(lng, { type: 'language' }).of(lng)

export function LanguageSelect() {
  const { t, i18n } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('language.change')}>
          <LanguagesIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={i18n.resolvedLanguage} onValueChange={(v) => void i18n.changeLanguage(v)}>
          {LANGUAGES.map((lng) => (
            <DropdownMenuRadioItem key={lng} value={lng}>
              {nativeName(lng)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
