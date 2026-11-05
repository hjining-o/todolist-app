// Q-13이 console.log 커밋을 금지하므로 console 직접 호출은 이 파일에만 둔다. 개발 모드(DEV)에서만 출력한다
type Level = 'debug' | 'info' | 'warn' | 'error'

const log = (level: Level, scope: string, message: string, data?: unknown) => {
  if (!import.meta.env.DEV) return
  if (data === undefined) console[level](`[${scope}] ${message}`)
  else console[level](`[${scope}] ${message}`, data)
}

export const logger = {
  debug: (scope: string, message: string, data?: unknown) => log('debug', scope, message, data),
  info: (scope: string, message: string, data?: unknown) => log('info', scope, message, data),
  warn: (scope: string, message: string, data?: unknown) => log('warn', scope, message, data),
  error: (scope: string, message: string, data?: unknown) => log('error', scope, message, data),
}
