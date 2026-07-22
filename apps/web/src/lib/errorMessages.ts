/**
 * Maps API error codes (errors.ts registry) to friendly, enumeration-safe copy.
 *
 * The API deliberately returns identical responses for "no such account" and
 * "wrong password" (BR-ACC-10); the UI must not undo that by guessing a more
 * specific message, so INVALID_CREDENTIALS stays generic.
 */
import { ApiError } from '../lib/apiClient'

export function authErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return 'Something went wrong. Please try again.'
  }
  switch (err.code) {
    case 'INVALID_CREDENTIALS':
      return 'That email or password is not right.'
    case 'EMAIL_NOT_VERIFIED':
      return 'Please confirm your email address before signing in. Check your inbox for the link.'
    case 'ACC_ACCOUNT_LOCKED':
    case 'RATE_LIMITED':
      return 'Too many attempts. Please wait a few minutes and try again.'
    case 'ACCOUNT_LOCKED':
      return 'This account is locked. Contact support if you need help.'
    case 'VALIDATION_FAILED':
      // Surface the first field issue when the server sent details.
      return err.details[0]?.message ?? 'Please check the details you entered.'
    case 'NETWORK_ERROR':
      return err.message
    default:
      return err.message || 'Something went wrong. Please try again.'
  }
}
