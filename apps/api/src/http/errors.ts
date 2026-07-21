/**
 * The closed error-code registry and the error classes that map onto it.
 *
 * BR-SYS-28 / FR-SYS-19: every error the API returns carries a stable
 * machine-readable `code`. Clients branch on `code` only, never on `message` —
 * the message is English-only in v1.0 and will be replaced by the locale
 * catalogue keyed on `message_key` without any server change (decision D-08).
 *
 * Codes are stable for the life of `/api/v1` and are never repurposed. Adding a
 * code is a compatible change; changing what an existing one means is not.
 */

export const ERROR_CODES = {
  // 400 / 422
  VALIDATION_FAILED: { status: 422, messageKey: 'errors.validation_failed' },
  MALFORMED_REQUEST: { status: 400, messageKey: 'errors.malformed_request' },
  // 401 / 403
  AUTHENTICATION_REQUIRED: { status: 401, messageKey: 'errors.authentication_required' },
  INVALID_CREDENTIALS: { status: 401, messageKey: 'errors.invalid_credentials' },
  TOKEN_EXPIRED: { status: 401, messageKey: 'errors.token_expired' },
  TOKEN_INVALID: { status: 401, messageKey: 'errors.token_invalid' },
  TOKEN_REUSE_DETECTED: { status: 401, messageKey: 'errors.token_reuse_detected' },
  EMAIL_NOT_VERIFIED: { status: 403, messageKey: 'errors.email_not_verified' },
  FORBIDDEN: { status: 403, messageKey: 'errors.forbidden' },
  ACCOUNT_LOCKED: { status: 403, messageKey: 'errors.account_locked' },
  ACC_UNDERAGE: { status: 403, messageKey: 'errors.acc_underage' },
  // 404 / 409 / 410
  NOT_FOUND: { status: 404, messageKey: 'errors.not_found' },
  CONFLICT: { status: 409, messageKey: 'errors.conflict' },
  CURSOR_EXPIRED: { status: 410, messageKey: 'errors.cursor_expired' },
  // 413 / 415
  PAYLOAD_TOO_LARGE: { status: 413, messageKey: 'errors.payload_too_large' },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, messageKey: 'errors.unsupported_media_type' },
  // 429
  RATE_LIMITED: { status: 429, messageKey: 'errors.rate_limited' },
  /**
   * BR-ACC-09 — repeated failed logins. Distinct from ACCOUNT_LOCKED (403),
   * which is an account state; this one is a self-expiring rate limit and the
   * client should retry after the Retry-After header.
   */
  ACC_ACCOUNT_LOCKED: { status: 429, messageKey: 'errors.rate_limited' },
  // 5xx
  INTERNAL_ERROR: { status: 500, messageKey: 'errors.internal_error' },
  UPSTREAM_ERROR: { status: 502, messageKey: 'errors.upstream_error' },
  SERVICE_UNAVAILABLE: { status: 503, messageKey: 'errors.service_unavailable' },
  UPSTREAM_TIMEOUT: { status: 504, messageKey: 'errors.upstream_timeout' },
} as const

export type ErrorCode = keyof typeof ERROR_CODES

export interface ErrorDetail {
  field: string
  issue: string
  [key: string]: unknown
}

/**
 * An error that is safe to surface to a client.
 *
 * Anything thrown that is NOT an AppError is treated as unexpected: the terminal
 * handler maps it to INTERNAL_ERROR and never leaks its message, because an
 * arbitrary throw may carry SQL text or an upstream body (FR-SYS-19 rule 2).
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly messageKey: string
  readonly details: ErrorDetail[] | undefined
  /** Context forwarded to the error monitor but never serialised to the client. */
  readonly context: Record<string, unknown> | undefined

  constructor(
    code: ErrorCode,
    message: string,
    options?: { details?: ErrorDetail[]; context?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'AppError'
    this.code = code
    this.status = ERROR_CODES[code].status
    this.messageKey = ERROR_CODES[code].messageKey
    this.details = options?.details
    this.context = options?.context
  }
}

/* Narrow constructors for the cases used often enough that spelling the code out each time invites typos. */

export const badRequest = (message: string, details?: ErrorDetail[]): AppError =>
  new AppError('VALIDATION_FAILED', message, details ? { details } : undefined)

export const unauthorized = (message = 'Authentication is required.'): AppError =>
  new AppError('AUTHENTICATION_REQUIRED', message)

/**
 * Not-found is deliberately used for resources the caller does not own.
 *
 * BR-ACC-01: returning 403 for another user's row would confirm that the row
 * exists, which is an enumeration oracle. 404 leaks nothing.
 */
export const notFound = (message = 'That resource could not be found.'): AppError =>
  new AppError('NOT_FOUND', message)
