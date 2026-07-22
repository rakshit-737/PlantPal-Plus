/**
 * The single HTTP boundary between the web app and the PlantPal+ API.
 *
 * Every response — success or failure — passes through here, so the FR-SYS-19
 * error envelope is decoded in exactly one place and the rest of the app deals
 * in typed results, never raw fetch responses.
 *
 * Auth model (see docs/architecture/03-api-specification.md):
 *  - The 15-minute JWT access token is held in memory only (never localStorage),
 *    so a stolen-storage XSS cannot lift a long-lived credential.
 *  - The 30-day refresh token is an httpOnly cookie the browser sends
 *    automatically to /api/auth; JS cannot read it. On a 401 we attempt one
 *    silent refresh and replay the original request.
 *  - Requests identify the client as WEB via the x-plantpal-client header, which
 *    is what makes the API set the refresh cookie instead of returning the raw
 *    token (authController: platform()).
 */

/** The FR-SYS-19 error envelope, produced by the API's single error handler. */
export interface ApiErrorEnvelope {
  error: {
    code: string
    message: string
    message_key: string
    details?: { field: string; issue: string; message?: string }[]
    request_id: string
    timestamp: string
  }
}

/** A typed, throwable representation of any non-2xx API response. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details: { field: string; issue: string; message?: string }[]
  readonly requestId: string | undefined

  constructor(status: number, envelope: ApiErrorEnvelope['error']) {
    super(envelope.message)
    this.name = 'ApiError'
    this.status = status
    this.code = envelope.code
    this.details = envelope.details ?? []
    this.requestId = envelope.request_id
  }

  /** A network/parse failure that never reached the API's error handler. */
  static transport(message: string): ApiError {
    return new ApiError(0, {
      code: 'NETWORK_ERROR',
      message,
      message_key: 'errors.network_error',
      request_id: '',
      timestamp: '',
    })
  }
}

// The access token lives only in module memory for the tab's lifetime.
let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Skip the automatic silent-refresh-and-retry (used by the refresh call itself). */
  skipRefresh?: boolean
}

async function parseEnvelope(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    // The API always sends JSON; a non-JSON body means an infrastructure error
    // (proxy, gateway) rather than an application response.
    throw ApiError.transport(`Unexpected non-JSON response (HTTP ${res.status}).`)
  }
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'object'
  )
}

async function rawRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    'x-plantpal-client': 'WEB',
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

  let res: Response
  try {
    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers,
      // Send/receive the httpOnly refresh cookie.
      credentials: 'include',
    }
    if (options.body !== undefined) init.body = JSON.stringify(options.body)
    res = await fetch(`/api${path}`, init)
  } catch {
    throw ApiError.transport('Could not reach the server. Check your connection.')
  }

  const payload = await parseEnvelope(res)

  if (res.ok) return payload as T

  if (isErrorEnvelope(payload)) {
    throw new ApiError(res.status, payload.error)
  }
  throw ApiError.transport(`Request failed (HTTP ${res.status}).`)
}

/**
 * Attempt one silent refresh. Returns true if a new access token was obtained.
 * De-duplicated so a burst of 401s triggers a single refresh, not one each.
 */
let refreshInFlight: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const body = await rawRequest<{ access_token: string }>('/auth/refresh', {
          method: 'POST',
          skipRefresh: true,
        })
        setAccessToken(body.access_token)
        return true
      } catch {
        setAccessToken(null)
        return false
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

/**
 * Make an API request, transparently refreshing the access token once on a 401
 * caused by expiry and replaying the original request.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options)
  } catch (err) {
    const isExpiry =
      err instanceof ApiError && err.status === 401 && err.code === 'TOKEN_EXPIRED'
    if (!isExpiry || options.skipRefresh || path === '/auth/refresh') throw err

    const refreshed = await tryRefresh()
    if (!refreshed) throw err
    return rawRequest<T>(path, options)
  }
}
