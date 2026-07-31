/**
 * The HTTP boundary carries three promises the rest of the app relies on:
 * every failure arrives as a typed ApiError, an expired access token is
 * refreshed once and the request replayed, and the configured API base is
 * normalised so a trailing slash cannot produce unroutable //api paths.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiRequest, setAccessToken } from './apiClient'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorEnvelope(code: string, message = 'nope') {
  return {
    error: {
      code,
      message,
      message_key: `errors.${code.toLowerCase()}`,
      request_id: 'req-1',
      timestamp: '2026-07-31T00:00:00.000Z',
    },
  }
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  setAccessToken(null)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('apiRequest', () => {
  it('calls same-origin /api by default and identifies the client as WEB', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }))
    await apiRequest('/v1/plants')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/plants')
    expect(init.credentials).toBe('include')
    expect(init.headers['x-plantpal-client']).toBe('WEB')
  })

  it('strips a trailing slash from VITE_API_URL so paths never double up', async () => {
    vi.stubEnv('VITE_API_URL', 'https://plantpal-api.onrender.com/')
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}))
    await apiRequest('/v1/plants')

    expect(fetchMock.mock.calls[0]![0]).toBe('https://plantpal-api.onrender.com/api/v1/plants')
  })

  it('sends the access token when one is held in memory', async () => {
    setAccessToken('token-abc')
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}))
    await apiRequest('/v1/dashboard')

    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer token-abc')
  })

  it('decodes the error envelope into a typed ApiError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(422, errorEnvelope('VALIDATION_FAILED', 'Bad input')))

    await expect(apiRequest('/v1/plants', { method: 'POST', body: {} })).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'Bad input',
    })
  })

  it('reports an unreachable server as a transport error rather than a crash', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const err = await apiRequest('/v1/plants').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(0)
    expect((err as ApiError).code).toBe('NETWORK_ERROR')
  })

  it('treats a non-JSON body (a proxy or 404 page) as a transport error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<!doctype html><title>404</title>', { status: 404 }),
    )

    const err = await apiRequest('/v1/plants').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('NETWORK_ERROR')
  })

  it('refreshes once on an expired token and replays the original request', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, errorEnvelope('TOKEN_EXPIRED')))
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse(200, { plants: [] }))

    const result = await apiRequest<{ plants: unknown[] }>('/v1/plants')
    expect(result).toEqual({ plants: [] })

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/api/v1/plants',
      '/api/auth/refresh',
      '/api/v1/plants',
    ])
    // The replay carries the newly minted token.
    expect(fetchMock.mock.calls[2]![1].headers.Authorization).toBe('Bearer fresh-token')
  })

  it('gives up and rethrows when the refresh itself fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, errorEnvelope('TOKEN_EXPIRED')))
      .mockResolvedValueOnce(jsonResponse(401, errorEnvelope('INVALID_TOKEN')))

    await expect(apiRequest('/v1/plants')).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not refresh on a 401 that is not an expiry', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, errorEnvelope('INVALID_CREDENTIALS')))

    await expect(apiRequest('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('de-duplicates concurrent refreshes into a single call', async () => {
    // Each resource 401s exactly once, so both in-flight requests hit the
    // refresh path at the same moment — the case the de-duplication exists for.
    const expired = new Set<string>()
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/auth/refresh') {
        return Promise.resolve(jsonResponse(200, { access_token: 'shared-token' }))
      }
      if (!expired.has(url)) {
        expired.add(url)
        return Promise.resolve(jsonResponse(401, errorEnvelope('TOKEN_EXPIRED')))
      }
      return Promise.resolve(jsonResponse(200, { ok: true }))
    })

    await Promise.all([apiRequest('/v1/a'), apiRequest('/v1/b')])

    const refreshCalls = fetchMock.mock.calls.filter((c) => c[0] === '/api/auth/refresh')
    expect(refreshCalls).toHaveLength(1)
  })
})
