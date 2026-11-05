import i18n from '@/shared/i18n'
import type { ErrorResponse } from '@/shared/types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

type Query = Record<string, string | number | boolean | undefined>
interface Options {
  query?: Query
  body?: unknown
}

const REFRESH_PATH = '/api/auth/refresh'
// 갱신 대상에서 빼는 경로(무한 반복 방지)
const NO_REFRESH = new Set([REFRESH_PATH, '/api/auth/login', '/api/auth/signup', '/api/auth/logout'])

async function send<T>(method: string, path: string, { query, body }: Options): Promise<T> {
  let url = import.meta.env.VITE_API_BASE_URL + path
  if (query) {
    const params = new URLSearchParams() // 오프셋 '+'를 %2B로 인코딩한다(BD-09)
    for (const [k, v] of Object.entries(query)) if (v !== undefined) params.set(k, String(v))
    const qs = params.toString()
    if (qs) url += '?' + qs
  }

  let res: Response
  try {
    res = await fetch(url, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', i18n.t('error.NETWORK_ERROR'))
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as ErrorResponse | null
    throw new ApiError(
      res.status,
      data?.error?.code ?? 'UNKNOWN',
      data?.error?.message ?? i18n.t('error.UNKNOWN'),
      data?.error?.fields,
    )
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

let refreshing: Promise<unknown> | null = null

async function request<T>(method: string, path: string, options: Options = {}): Promise<T> {
  try {
    return await send<T>(method, path, options)
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || e.code !== 'UNAUTHENTICATED' || NO_REFRESH.has(path)) throw e
    // 동시에 여러 요청이 401이어도 갱신은 하나만 보낸다
    refreshing ??= send('POST', REFRESH_PATH, {}).finally(() => {
      refreshing = null
    })
    try {
      await refreshing
    } catch {
      throw e // 갱신 실패: 재시도 없이 원래 401을 던진다
    }
    return send<T>(method, path, options)
  }
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  del: <T>(path: string) => request<T>('DELETE', path),
}
