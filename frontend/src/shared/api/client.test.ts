import { api, ApiError } from './client'

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status })
const unauth = () => json(401, { error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' } })

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const calledPaths = () => fetchMock.mock.calls.map((c) => c[0] as string)

describe('api client', () => {
  it('base URL + 경로, credentials include로 JSON을 받는다', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { id: 1 }))
    await expect(api.get('/api/me')).resolves.toEqual({ id: 1 })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/api/me',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
  })

  it('본문을 JSON으로 보낸다', async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}))
    await api.post('/api/todos', { title: 'a' })
    const init = fetchMock.mock.calls[0][1]
    expect(init.body).toBe('{"title":"a"}')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('204는 undefined', async () => {
    fetchMock.mockResolvedValueOnce(json(204))
    await expect(api.del('/api/todos/1')).resolves.toBeUndefined()
  })

  it('patch 헬퍼는 PATCH로 보낸다', async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}))
    await api.patch('/api/me', { name: 'a' })
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH')
  })

  it('에러 본문을 ApiError로 바꾼다(fields 포함)', async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, { error: { code: 'VALIDATION_ERROR', message: '입력 오류', fields: { title: '필수' } } }),
    )
    const err = await api.post('/api/todos', {}).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: '입력 오류', fields: { title: '필수' } })
  })

  it('본문이 JSON이 아닌 에러는 기본 문구', async () => {
    fetchMock.mockResolvedValueOnce(new Response('oops', { status: 502 }))
    await expect(api.get('/x')).rejects.toMatchObject({ status: 502, code: 'UNKNOWN' })
  })

  it('네트워크 실패는 status 0 ApiError', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('failed'))
    await expect(api.get('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })

  it('쿼리 파라미터는 URLSearchParams로, 오프셋 +는 %2B', async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}))
    await api.get('/api/todos', { from: '2026-11-01T00:00+09:00', skip: undefined, page: 2 })
    expect(calledPaths()[0]).toBe('http://api.test/api/todos?from=2026-11-01T00%3A00%2B09%3A00&page=2')
  })

  describe('토큰 갱신', () => {
    it('401이면 refresh 1번 후 원 요청을 재시도한다', async () => {
      fetchMock
        .mockResolvedValueOnce(unauth())
        .mockResolvedValueOnce(json(204))
        .mockResolvedValueOnce(json(200, { ok: 1 }))
      await expect(api.get('/api/todos')).resolves.toEqual({ ok: 1 })
      expect(calledPaths()).toEqual([
        'http://api.test/api/todos',
        'http://api.test/api/auth/refresh',
        'http://api.test/api/todos',
      ])
      expect(fetchMock.mock.calls[1][1].method).toBe('POST')
    })

    it('401이 동시에 3건이어도 refresh는 1번', async () => {
      const seen = new Set<string>()
      fetchMock.mockImplementation(async (url: string) => {
        if (url.endsWith('/api/auth/refresh')) {
          await new Promise((r) => setTimeout(r, 10))
          return json(204)
        }
        if (!seen.has(url)) {
          seen.add(url)
          return unauth()
        }
        return json(200, { url })
      })
      const results = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')])
      expect(results).toHaveLength(3)
      expect(calledPaths().filter((u) => u.endsWith('/api/auth/refresh'))).toHaveLength(1)
    })

    it('refresh가 실패하면 재시도 없이 401 ApiError', async () => {
      fetchMock.mockResolvedValueOnce(unauth()).mockResolvedValueOnce(unauth())
      await expect(api.get('/api/todos')).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it.each(['/api/auth/login', '/api/auth/signup', '/api/auth/logout', '/api/auth/refresh'])(
      '%s 는 갱신하지 않는다',
      async (path) => {
        fetchMock.mockResolvedValueOnce(unauth())
        await expect(api.post(path)).rejects.toMatchObject({ status: 401 })
        expect(fetchMock).toHaveBeenCalledTimes(1)
      },
    )

    it('401이 아닌 에러는 갱신하지 않는다', async () => {
      fetchMock.mockResolvedValueOnce(json(403, { error: { code: 'FORBIDDEN', message: 'x' } }))
      await expect(api.get('/a')).rejects.toMatchObject({ status: 403 })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})
