/**
 * Structured JSON logging — NFR-OBSV-01.
 *
 * The redaction list is not decoration. NFR-SEC-03 requires zero occurrences of
 * a plaintext password in logs, error events or analytics payloads, and the
 * cheapest way to honour that is to make it structurally impossible for these
 * keys to be serialised anywhere.
 */

import pino from 'pino'

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  redact: {
    paths: [
      'password',
      'passwordHash',
      'password_hash',
      '*.password',
      '*.passwordHash',
      '*.password_hash',
      'refreshToken',
      'refresh_token',
      '*.refreshToken',
      '*.refresh_token',
      'authorization',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[redacted]',
  },
  base: { service: 'plantpal-api' },
})
