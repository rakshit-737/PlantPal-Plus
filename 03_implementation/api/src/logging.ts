/**
 * Structured JSON logging — NFR-OBSV-01.
 *
 * The redaction list is not decoration. NFR-SEC-03 requires zero occurrences of
 * a plaintext password in logs, error events or analytics payloads, and the
 * cheapest way to honour that is to make it structurally impossible for these
 * keys to be serialised anywhere.
 */

import pino from 'pino'

/**
 * Where the log lines go.
 *
 * On Node, `undefined` lets pino use its own fast path to stdout, which is the
 * point of pino.
 *
 * On a non-Node runtime it writes to `console.log` instead. pino's default
 * destination reaches for Node's stdout file descriptor directly, and on
 * Deno — which is what Supabase Edge Functions run — that write goes nowhere:
 * the process does not crash, it just silently discards every log line. The
 * symptom is worse than a crash. The deployment looks healthy, and the first
 * thing anyone reaches for when a request 500s is the very thing that was
 * quietly thrown away. (Found exactly that way: a login failing on the edge
 * deployment with no log line to explain it, including the boot line that
 * should have been there.)
 *
 * The check names Deno rather than testing for Node, because Deno's node
 * compatibility layer sets `process.versions.node` to a real Node version — a
 * "does this look like Node?" test passes there and picks the silent path,
 * which is the first version of this fix and why it is written down.
 */
const isDeno = typeof (globalThis as { Deno?: unknown }).Deno !== 'undefined'

const destination = !isDeno
  ? undefined
  : {
      write(line: string): void {
        // pino appends the newline; console.log adds its own.
        console.log(line.endsWith('\n') ? line.slice(0, -1) : line)
      },
    }

export const logger = pino(
  {
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
  },
  // pino's second argument is the destination; passing undefined is the same as
  // omitting it, so the Node path is untouched.
  destination as pino.DestinationStream | undefined,
)
