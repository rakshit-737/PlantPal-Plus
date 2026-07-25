/**
 * Expo Push client — plain HTTPS against the public push API; the token
 * itself is the credential, so no account secret is needed (DEP-06).
 *
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */

import { logger } from '../../logging.js'

export interface PushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
}

interface PushTicket {
  status: 'ok' | 'error'
  message?: string
  details?: { error?: string }
}

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
export const EXPO_PUSH_BATCH_LIMIT = 100

/** Pure: split messages into API-sized batches. */
export function chunkMessages<T>(messages: T[], limit = EXPO_PUSH_BATCH_LIMIT): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < messages.length; i += limit) {
    chunks.push(messages.slice(i, i + limit))
  }
  return chunks
}

export interface PushSendResult {
  /** Tokens whose ticket came back ok. */
  delivered: string[]
  /** Tokens Expo says are gone for good — revoke them (FR-NOT-15). */
  notRegistered: string[]
  /** Tokens that failed transiently; leave for the next pass. */
  failed: string[]
}

/**
 * Send messages in batches. Network failure of a whole batch is transient:
 * its tokens land in `failed` and the reminder stays SENT for the next pass.
 */
export async function sendPushMessages(messages: PushMessage[]): Promise<PushSendResult> {
  const result: PushSendResult = { delivered: [], notRegistered: [], failed: [] }

  for (const batch of chunkMessages(messages)) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(batch),
      })
      if (!res.ok) {
        result.failed.push(...batch.map((m) => m.to))
        logger.warn({ status: res.status }, 'expo push batch rejected')
        continue
      }
      const payload = (await res.json()) as { data?: PushTicket[] }
      const tickets = payload.data ?? []
      batch.forEach((message, i) => {
        const ticket = tickets[i]
        if (ticket?.status === 'ok') {
          result.delivered.push(message.to)
        } else if (ticket?.details?.error === 'DeviceNotRegistered') {
          result.notRegistered.push(message.to)
        } else {
          result.failed.push(message.to)
        }
      })
    } catch (err) {
      result.failed.push(...batch.map((m) => m.to))
      logger.warn({ err }, 'expo push batch failed')
    }
  }

  return result
}
