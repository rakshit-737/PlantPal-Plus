/**
 * Typed wrappers over /api/auth, mirroring the contracts in
 * docs/architecture/03-api-specification.md and the shipped authController.
 */
import { apiRequest } from './apiClient'

export interface AuthUser {
  id: string
  email: string
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'LOCKED' | 'PENDING_DELETION'
}

/** POST /api/auth/login success body (web variant — refresh token is a cookie). */
export interface LoginResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  user: AuthUser
  account_pending_deletion?: boolean
  deletion_scheduled_at?: string
}

/** POST /api/auth/register — always 202 with this body, new account or not (BR-ACC-10). */
export interface RegisterResponse {
  status: 'registered'
  message: string
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

export function register(
  email: string,
  password: string,
  confirmedAge: boolean,
): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, confirmed_age: confirmedAge },
  })
}

export function logout(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>('/auth/logout', { method: 'POST' })
}

/**
 * Bootstrap the session on app load: the access token is memory-only, so a page
 * refresh has none. If the httpOnly refresh cookie is still valid this exchanges
 * it for a fresh access token; otherwise it resolves to null (logged out).
 */
export async function refreshSession(): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    return await apiRequest<{ access_token: string; expires_in: number }>('/auth/refresh', {
      method: 'POST',
      skipRefresh: true,
    })
  } catch {
    return null
  }
}

/** GET /api/auth/me — restore identity after a silent refresh. */
export function getMe(): Promise<{ user: AuthUser }> {
  return apiRequest<{ user: AuthUser }>('/auth/me')
}
