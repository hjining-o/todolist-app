import { describe, expect, it } from 'vitest'
import i18n from '@/shared/i18n'
import { ApiError } from './client'
import { errorMessage, fieldErrors } from './errorMessage'

describe('errorMessage', () => {
  it('코드에 키가 있으면 번역하고, 없으면 서버 message를 쓴다', () => {
    expect(errorMessage(new ApiError(409, 'EMAIL_TAKEN', 'server'))).toBe('이미 가입된 이메일입니다.')
    expect(errorMessage(new ApiError(400, 'NO_SUCH_CODE', 'server'))).toBe('server')
  })

  it('fields는 ko면 원문, 다른 언어면 VALIDATION_FIELD로 바꾼다', async () => {
    const e = new ApiError(400, 'VALIDATION_ERROR', 'x', { name: '이름은 필수입니다.' })
    expect(fieldErrors(e)).toEqual({ name: '이름은 필수입니다.' })
    await i18n.changeLanguage('en')
    expect(fieldErrors(e)).toEqual({ name: 'Check your input.' })
    expect(fieldErrors(null)).toBeUndefined()
  })
})
