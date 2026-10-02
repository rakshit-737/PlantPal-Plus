/**
 * Idempotency-key generation.
 *
 * The server accepts a strict RFC 4122 v4 UUID and nothing else — see the
 * `client_idempotency_key` regex in syncController.ts, which pins the version
 * nibble to 4 and the variant nibble to 8/9/a/b. This is byte-for-byte the same
 * generator the app already ships in src/notifications.ts (installation ids);
 * it is duplicated rather than imported because that module pulls
 * expo-notifications and expo-device into its import graph at load time, and
 * the outbox must stay loadable without them.
 */

/** A fresh RFC 4122 v4 UUID, lowercase. */
export function newIdempotencyKey(): string {
  // crypto.getRandomValues is available in Hermes/React Native.
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** The exact shape the server will accept. Used to sweep unusable items. */
export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
