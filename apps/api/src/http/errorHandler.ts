/**
 * The single terminal error middleware — FR-SYS-19.
 *
 * Every error response in the product is produced here, so the envelope shape is
 * defined in exactly one place. Two clients, i18n readiness and a solo developer
 * all depend on that.
 */

import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'

import { AppError, ERROR_CODES, type ErrorCode, type ErrorDetail } from './errors.js'
import { getRequestId } from './requestId.js'
import { logger } from '../logging.js'

export interface ErrorEnvelope {
  error: {
    code: string
    message: string
    message_key: string
    details?: ErrorDetail[]
    request_id: string
    timestamp: string
  }
}

/** Validation failures carry at most 50 entries, each naming the offending field. */
const MAX_DETAILS = 50

function detailsFromZod(error: ZodError): ErrorDetail[] {
  return error.errors.slice(0, MAX_DETAILS).map((issue) => ({
    field: issue.path.join('.') || '(root)',
    issue: issue.code,
    message: issue.message,
  }))
}

/** 404 handler for unmatched routes, so a miss produces the envelope rather than Express's HTML page. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError('NOT_FOUND', `No route matches ${req.method} ${req.path}`))
}

/** Duck-typed application error thrown by layers that avoid importing AppError. */
function isMarkedAppError(err: unknown): err is Error & { code: ErrorCode } {
  if (!(err instanceof Error)) return false
  const marked = err as unknown as { __appError?: unknown; code?: unknown }
  return (
    marked.__appError === true && typeof marked.code === 'string' && marked.code in ERROR_CODES
  )
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = getRequestId(req)
  const timestamp = new Date().toISOString()

  let appError: AppError
  if (err instanceof AppError) {
    appError = err
  } else if (err instanceof ZodError) {
    appError = new AppError('VALIDATION_FAILED', 'The request failed validation.', {
      details: detailsFromZod(err),
    })
  } else if (err instanceof SyntaxError && 'body' in err) {
    // express.json() surfaces malformed JSON as a SyntaxError carrying `body`.
    appError = new AppError('MALFORMED_REQUEST', 'The request body is not valid JSON.')
  } else if (isMarkedAppError(err)) {
    // Repository layers throw duck-typed application errors (`__appError`)
    // rather than importing the HTTP error class; honour them so a domain
    // outcome like TOKEN_REUSE_DETECTED reaches the client as its own code
    // instead of collapsing into a 500.
    appError = new AppError(err.code, err.message)
  } else {
    // Unknown throw: never surface its message, it may carry SQL or an upstream body.
    appError = new AppError('INTERNAL_ERROR', 'An unexpected error occurred.', { cause: err })
  }

  // Full context goes to the monitor with the request id; the client sees none of it.
  const logPayload = {
    requestId,
    code: appError.code,
    status: appError.status,
    method: req.method,
    path: req.path,
    context: appError.context,
    err: appError.status >= 500 ? err : undefined,
  }
  if (appError.status >= 500) logger.error(logPayload, appError.message)
  else logger.warn(logPayload, appError.message)

  const envelope: ErrorEnvelope = {
    error: {
      code: appError.code,
      message: appError.message,
      message_key: appError.messageKey,
      ...(appError.details ? { details: appError.details } : {}),
      request_id: requestId,
      timestamp,
    },
  }

  res.status(appError.status).json(envelope)
}
