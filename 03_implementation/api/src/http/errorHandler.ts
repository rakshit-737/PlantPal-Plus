/**
 * The single terminal error middleware — FR-SYS-19.
 *
 * Every error response in the product is produced here, so the envelope shape is
 * defined in exactly one place. Two clients, i18n readiness and a solo developer
 * all depend on that.
 */

import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'

import { AppError, ERROR_CODES, type ErrorCode, type ErrorDetail } from './errors.ts'
import { getRequestId } from './requestId.ts'
import { logger } from '../logging.ts'

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

/**
 * PostgreSQL errors that mean "the request carried a value the schema refuses",
 * keyed by SQLSTATE, with the detail `issue` each one maps to.
 *
 * The table definitions are the last line of validation: CHECK constraints,
 * NOT NULL, foreign keys, and the uuid type itself. When a handler has not
 * pre-validated a field, a bad value reaches the database and comes back as
 * one of these. Treating that as a 500 told the client "our fault, retry"
 * about a request that will fail identically forever, and paged the logs with
 * a stack trace for what is a typo in a payload or a malformed id in a URL.
 */
const PG_CLIENT_INPUT: Record<string, { code: ErrorCode; issue: string }> = {
  '22P02': { code: 'VALIDATION_FAILED', issue: 'invalid_format' }, // e.g. "undefined" as a uuid
  '22001': { code: 'VALIDATION_FAILED', issue: 'too_long' },
  '22003': { code: 'VALIDATION_FAILED', issue: 'out_of_range' },
  '22007': { code: 'VALIDATION_FAILED', issue: 'invalid_format' },
  '22008': { code: 'VALIDATION_FAILED', issue: 'out_of_range' },
  '23502': { code: 'VALIDATION_FAILED', issue: 'required' },
  '23503': { code: 'VALIDATION_FAILED', issue: 'unknown_reference' },
  '23514': { code: 'VALIDATION_FAILED', issue: 'invalid' },
  '23505': { code: 'CONFLICT', issue: 'duplicate' },
}

interface PgErrorShape {
  code: string
  severity?: string
  table?: string
  column?: string
  constraint?: string
}

function isPgError(err: unknown): err is Error & PgErrorShape {
  if (!(err instanceof Error)) return false
  const e = err as Error & Partial<PgErrorShape>
  return typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code) && typeof e.severity === 'string'
}

/**
 * The field a constraint guards. Constraint names here follow PostgreSQL's
 * default `<table>_<column>_check` / `_fkey` / `_key` pattern, so stripping the
 * table and the suffix recovers the column — which is the only part of the
 * error safe and useful to hand a client.
 */
function fieldFromPgError(err: PgErrorShape): string {
  if (err.column) return err.column
  if (err.constraint) {
    let name = err.constraint
    if (err.table && name.startsWith(`${err.table}_`)) name = name.slice(err.table.length + 1)
    name = name.replace(/_(check|fkey|key|not_null)$/, '')
    if (/^[a-z_]+$/.test(name)) return name
  }
  return '(request)'
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
  } else if (isPgError(err) && PG_CLIENT_INPUT[err.code]) {
    const mapped = PG_CLIENT_INPUT[err.code]!
    const field = fieldFromPgError(err)
    appError = new AppError(
      mapped.code,
      mapped.code === 'CONFLICT'
        ? 'That already exists.'
        : field === '(request)'
          ? 'The request contains a value in the wrong format.'
          : `The value for ${field} is not allowed.`,
      {
        details: [{ field, issue: mapped.issue }],
        // Kept for the log line only — the client never sees context.
        context: { sqlstate: err.code, constraint: err.constraint ?? null },
      },
    )
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
