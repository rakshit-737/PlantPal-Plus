import { describe, expect, it } from 'vitest'

import { ApiError } from './apiClient'
import { authErrorMessage } from './errorMessages'

describe('authErrorMessage', () => {
  function apiError(code: string, message = 'srv', status = 400): ApiError {
    return new ApiError(status, {
      code,
      message,
      message_key: `errors.${code.toLowerCase()}`,
      request_id: 'r1',
      timestamp: '',
    })
  }

  it('keeps invalid credentials generic (BR-ACC-10 — no enumeration)', () => {
    // The message must not hint at which of email/password was wrong, nor at
    // whether the account exists.
    const msg = authErrorMessage(apiError('INVALID_CREDENTIALS'))
    expect(msg).toBe('That email or password is not right.')
    expect(msg).not.toMatch(/account|exist|user|found/i)
  })

  it('guides the user to verify their email', () => {
    expect(authErrorMessage(apiError('EMAIL_NOT_VERIFIED', 'x', 403))).toMatch(/confirm your email/i)
  })

  it('treats the rate-limit lockout code as a wait-and-retry', () => {
    expect(authErrorMessage(apiError('ACC_ACCOUNT_LOCKED', 'x', 429))).toMatch(/too many attempts/i)
  })

  it('surfaces the first field detail on a validation failure', () => {
    const err = new ApiError(422, {
      code: 'VALIDATION_FAILED',
      message: 'The request failed validation.',
      message_key: 'errors.validation_failed',
      details: [{ field: 'password', issue: 'policy_violation', message: 'Use at least 12 characters.' }],
      request_id: 'r1',
      timestamp: '',
    })
    expect(authErrorMessage(err)).toBe('Use at least 12 characters.')
  })

  it('passes through a transport error message', () => {
    expect(authErrorMessage(ApiError.transport('Could not reach the server.'))).toBe(
      'Could not reach the server.',
    )
  })

  it('falls back to a generic message for a non-ApiError', () => {
    expect(authErrorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.')
  })
})
