import { afterEach, expect, it } from 'vitest'
import i18n from '@/shared/i18n'
import { categoryName } from './categoryName'

afterEach(() => i18n.changeLanguage('ko'))

it('기본 카테고리 이름만 현재 언어로 바꾼다', async () => {
  await i18n.changeLanguage('en')
  expect(categoryName('기본')).toBe('Default')
  expect(categoryName('업무')).toBe('업무')
})
