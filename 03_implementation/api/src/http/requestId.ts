/**
 * Request identity — FR-SYS-18.
 *
 * Every request carries an id, echoed in the response header and embedded in
 * every log line and error envelope. It is what lets a user-reported error
 * ("request 5f1a9a2c…") be traced to its server-side cause without asking the
 * user for a screenshot of a stack trace.
 *
 * An inbound `X-Request-Id` is honoured so a client-side retry can be correlated
 * with its original attempt, but it is length-capped and sanitised: it is
 * attacker-controlled and ends up in logs, so an unbounded value is a log
 * injection vector.
 */

import { randomUUID } from 'node:crypto'
import type { Request, RequestHandler } from 'express'

export const REQUEST_ID_HEADER = 'x-request-id'
const MAX_INBOUND_LENGTH = 64
const SAFE_ID = /^[A-Za-z0-9._-]+$/

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string
    }
  }
}

export const requestId: RequestHandler = (req, res, next) => {
  const inbound = req.header(REQUEST_ID_HEADER)
  const usable =
    inbound && inbound.length <= MAX_INBOUND_LENGTH && SAFE_ID.test(inbound) ? inbound : undefined

  const id = usable ?? randomUUID()
  req.requestId = id
  res.setHeader(REQUEST_ID_HEADER, id)
  next()
}

export function getRequestId(req: Request): string {
  return req.requestId ?? 'unknown'
}
