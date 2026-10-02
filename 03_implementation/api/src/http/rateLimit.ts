/**
 * Minimal fixed-window per-IP rate limiter (FR-SYS-21, BR-ACC-09 clause 5).
 *
 * In-memory by design: the free tier runs exactly one process (CON-01), so a
 * shared store would be dead weight. The window map is pruned on every sweep
 * so an address scan cannot grow memory without bound. This is a blunt outer
 * guard — the per-account lockout in authController remains the precise one.
 */

import type { NextFunction, Request, Response } from 'express'

import { AppError } from './errors.ts'

interface Window {
  count: number
  resetAt: number
}

export function rateLimit(options: { windowMs: number; max: number }) {
  const windows = new Map<string, Window>()

  return function rateLimitMiddleware(req: Request, _res: Response, next: NextFunction) {
    const now = Date.now()

    // Prune expired windows so the map tracks only active clients.
    if (windows.size > 10_000) {
      for (const [key, w] of windows) {
        if (w.resetAt <= now) windows.delete(key)
      }
    }

    const key = req.ip ?? 'unknown'
    const current = windows.get(key)
    if (!current || current.resetAt <= now) {
      windows.set(key, { count: 1, resetAt: now + options.windowMs })
      next()
      return
    }

    current.count += 1
    if (current.count > options.max) {
      _res.setHeader('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)))
      next(new AppError('RATE_LIMITED', 'Too many requests. Slow down.'))
      return
    }
    next()
  }
}
