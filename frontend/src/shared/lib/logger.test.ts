import { afterEach, expect, it, vi } from 'vitest'
import { logger } from './logger'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it('개발 모드에서만 console 로 출력한다', () => {
  const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  vi.stubEnv('DEV', false)
  logger.debug('api', 'GET /x')
  logger.warn('api', 'fail', { status: 500 })
  expect(debug).not.toHaveBeenCalled()
  expect(warn).not.toHaveBeenCalled()

  vi.stubEnv('DEV', true)
  logger.debug('api', 'GET /x')
  logger.warn('api', 'fail', { status: 500 })
  expect(debug).toHaveBeenCalledWith('[api] GET /x')
  expect(warn).toHaveBeenCalledWith('[api] fail', { status: 500 })
})
