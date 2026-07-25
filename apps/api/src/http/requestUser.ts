/**
 * Typed access to the authenticated subject the `authenticate` middleware
 * stamps onto the request.
 *
 * Every protected handler needs `req.userId`; reading it through an index
 * signature yields `string | undefined` under noUncheckedIndexedAccess and
 * invites unchecked casts. This helper is the single place that narrows it,
 * and throws AUTHENTICATION_REQUIRED if a route was mounted without the
 * middleware — a wiring bug surfaced as a 401, never as `undefined` reaching
 * a SQL parameter.
 */

import type { Request } from 'express'

import { AppError } from './errors.js'

export function getUserId(req: Request): string {
  const userId = (req as { userId?: unknown }).userId
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new AppError('AUTHENTICATION_REQUIRED', 'Authentication is required.')
  }
  return userId
}
