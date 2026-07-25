/**
 * Device push token registry — ENT-07 (DevicePushToken).
 *
 * References: migrations/007-push-tokens.sql, FR-NOT-14/15.
 */

import { transaction, getPool } from '../../db/pool.js'

export const MAX_ACTIVE_TOKENS_PER_USER = 5

export interface DeviceView {
  id: string
  platform: string
  device_label: string | null
  app_version: string | null
  permission_status: string
  last_seen_at: string
}

export interface RegisterTokenInput {
  expo_push_token: string
  platform: 'IOS' | 'ANDROID' | 'WEB'
  client_installation_id: string
  device_label?: string | undefined
  app_version?: string | undefined
  permission_status: 'GRANTED' | 'DENIED' | 'UNDETERMINED'
}

/**
 * Register or refresh a token (FR-NOT-14 processing rules 2–4):
 * upsert by token string; a token owned by a different user revokes the
 * previous owner's row (TOKEN_REASSIGNED) before this user takes it over;
 * a sixth active token evicts the least-recently-seen (LRU_EVICTED).
 */
export async function registerToken(
  userId: string,
  input: RegisterTokenInput,
): Promise<{ id: string; devices: DeviceView[] }> {
  return transaction(async (client) => {
    const { rows: existing } = await client.query<{ id: string; user_id: string }>(
      `select id, user_id from device_push_tokens where expo_push_token = $1 for update`,
      [input.expo_push_token],
    )
    const current = existing[0]

    let id: string
    if (current && current.user_id !== userId) {
      // Device handover (E-26): the previous owner's row dies first, then the
      // token is recreated under the new subject.
      await client.query(
        `update device_push_tokens
         set revoked_at = now(), revoke_reason = 'TOKEN_REASSIGNED'
         where id = $1`,
        [current.id],
      )
      id = await insertToken(client, userId, input)
    } else if (current) {
      const { rows } = await client.query<{ id: string }>(
        `update device_push_tokens
         set platform = $2, client_installation_id = $3, device_label = $4,
             app_version = $5, permission_status = $6,
             revoked_at = null, revoke_reason = null, last_seen_at = now()
         where id = $1
         returning id`,
        [
          current.id,
          input.platform,
          input.client_installation_id,
          input.device_label ?? null,
          input.app_version ?? null,
          input.permission_status,
        ],
      )
      id = rows[0]!.id
    } else {
      id = await insertToken(client, userId, input)
    }

    // FR-NOT-14 rule 4: cap active rows at 5, evicting by oldest last_seen_at.
    await client.query(
      `update device_push_tokens
       set revoked_at = now(), revoke_reason = 'LRU_EVICTED'
       where id in (
         select id from device_push_tokens
         where user_id = $1 and revoked_at is null
         order by last_seen_at desc
         offset $2
       )`,
      [userId, MAX_ACTIVE_TOKENS_PER_USER],
    )

    const { rows: devices } = await client.query<DeviceView>(
      `select id, platform, device_label, app_version, permission_status, last_seen_at
       from device_push_tokens
       where user_id = $1 and revoked_at is null
       order by last_seen_at desc`,
      [userId],
    )
    return { id, devices }
  })
}

async function insertToken(
  client: { query: (sql: string, params: unknown[]) => Promise<{ rows: { id: string }[] }> },
  userId: string,
  input: RegisterTokenInput,
): Promise<string> {
  const { rows } = await client.query(
    `insert into device_push_tokens
       (user_id, expo_push_token, platform, client_installation_id, device_label, app_version, permission_status)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [
      userId,
      input.expo_push_token,
      input.platform,
      input.client_installation_id,
      input.device_label ?? null,
      input.app_version ?? null,
      input.permission_status,
    ],
  )
  return rows[0]!.id
}

/** Active, permission-granted tokens for a set of users (the dispatch target set). */
export async function activeTokensForUsers(
  userIds: string[],
): Promise<Map<string, string[]>> {
  if (userIds.length === 0) return new Map()
  const pool = getPool()
  const { rows } = await pool.query<{ user_id: string; expo_push_token: string }>(
    `select user_id, expo_push_token
     from device_push_tokens
     where user_id = any ($1::uuid[])
       and revoked_at is null
       and permission_status = 'GRANTED'`,
    [userIds],
  )
  const map = new Map<string, string[]>()
  for (const row of rows) {
    const list = map.get(row.user_id)
    if (list) list.push(row.expo_push_token)
    else map.set(row.user_id, [row.expo_push_token])
  }
  return map
}

/** Revoke tokens Expo reports as DeviceNotRegistered (FR-NOT-15). */
export async function revokeTokens(tokens: string[], reason: string): Promise<void> {
  if (tokens.length === 0) return
  const pool = getPool()
  await pool.query(
    `update device_push_tokens
     set revoked_at = now(), revoke_reason = $2
     where expo_push_token = any ($1::text[]) and revoked_at is null`,
    [tokens, reason],
  )
}
