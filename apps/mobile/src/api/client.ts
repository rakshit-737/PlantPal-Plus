/**
 * The single HTTP boundary between the mobile app and the PlantPal+ API —
 * the React Native counterpart of apps/web/src/lib/apiClient.ts.
 *
 * Auth model (BR-ACC-07 clause 7): mobile clients receive the 30-day refresh
 * token in the response body (there is no cookie jar), so it is persisted in
 * the platform keystore via expo-secure-store. The 15-minute access token
 * stays in module memory only. On a 401 TOKEN_EXPIRED we attempt one silent
 * refresh and replay the original request, exactly like the web client.
 */

import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const REFRESH_TOKEN_KEY = 'plantpal.refresh_token'

/**
 * API origin. Configure with EXPO_PUBLIC_API_URL (LAN IP for a physical
 * device). The Android emulator reaches the host machine at 10.0.2.2, the
 * iOS simulator at localhost.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000')

const CLIENT_PLATFORM = Platform.OS === 'ios' ? 'IOS' : 'ANDROID'

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

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details: { field: string; issue: string; message?: string }[]

  constructor(status: number, envelope: ApiErrorEnvelope['error']) {
    super(envelope.message)
    this.name = 'ApiError'
    this.status = status
    this.code = envelope.code
    this.details = envelope.details ?? []
  }

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

// The access token lives only in module memory for the app's lifetime.
let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export async function setRefreshToken(token: string | null): Promise<void> {
  if (token) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token)
  else await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  skipRefresh?: boolean
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
    'x-plantpal-client': CLIENT_PLATFORM,
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

  let res: Response
  try {
    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers,
    }
    if (options.body !== undefined) init.body = JSON.stringify(options.body)
    res = await fetch(`${API_URL}/api${path}`, init)
  } catch {
    throw ApiError.transport('Could not reach the server. Check your connection.')
  }

  const text = await res.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      throw ApiError.transport(`Unexpected non-JSON response (HTTP ${res.status}).`)
    }
  }

  if (res.ok) return payload as T

  if (isErrorEnvelope(payload)) {
    throw new ApiError(res.status, payload.error)
  }
  throw ApiError.transport(`Request failed (HTTP ${res.status}).`)
}

/**
 * Attempt one silent refresh using the stored refresh token. Rotation is
 * mandatory (BR-ACC-07): the server consumes the presented token and returns a
 * new pair, both of which are stored before the original request is replayed.
 */
let refreshInFlight: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const stored = await getRefreshToken()
        if (!stored) return false
        const body = await rawRequest<{ access_token: string; refresh_token?: string }>(
          '/auth/refresh',
          { method: 'POST', body: { refresh_token: stored }, skipRefresh: true },
        )
        setAccessToken(body.access_token)
        if (body.refresh_token) await setRefreshToken(body.refresh_token)
        return true
      } catch (err) {
        setAccessToken(null)
        // Only a definitive server rejection invalidates the stored token; a
        // network drop or 5xx must not sign the user out of a device whose
        // credential is still perfectly valid.
        if (err instanceof ApiError && err.status === 401) {
          await setRefreshToken(null)
        }
        return false
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

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

/** Bootstrap: true if a stored refresh token yielded a fresh access token. */
export async function trySilentSignIn(): Promise<boolean> {
  return tryRefresh()
}
