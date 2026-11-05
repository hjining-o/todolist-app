import i18n from '@/shared/i18n'
import type { ApiError } from './client'

// 코드에 번역 키가 있으면 번역하고, 없으면 서버 message를 쓴다
export function errorMessage(e: ApiError): string {
  const key = 'error.' + e.code
  return i18n.exists(key) ? i18n.t(key) : e.message
}

// shortcut: 필드별 상세 사유는 ko에서만 보임, 다국어 사용자가 늘면 백엔드 bad()를 메시지 키로 변경
export function fieldErrors(e: ApiError | null | undefined): Record<string, string> | undefined {
  if (!e?.fields || i18n.language.startsWith('ko')) return e?.fields
  return Object.fromEntries(Object.keys(e.fields).map((k) => [k, i18n.t('error.VALIDATION_FIELD')]))
}
