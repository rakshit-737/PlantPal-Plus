/**
 * Device push token registry — ENT-07 (DevicePushToken).
 *
 * References: migrations/001-auth-schema.sql (core), 007-push-tokens.sql
 * (FR-NOT-14/15 additions).
 *
 * Status mapping: ACTIVE = live dispatch target; UNREGISTERED = Expo reported
 * DeviceNotRegistered; STALE = revoked by policy with revoke_reason recorded.
 */

import { transaction, getPool } from '../../db/pool.ts'

export const MAX_ACTIVE_TOKENS_PER_USER = 5

export interface DeviceView {
  id: string
  platform: string
  device_label: string | null
  app_version: string | null
  permission_status: string
  last_confirmed_at: string | null
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
 * - upsert by token string (unique table-wide)
 * - a token owned by a different user revokes the previous owner's row first
 *   (TOKEN_REASSIGNED) so a handed-over device cannot receive old reminders
 * - an Expo token rotation retires this installation's previous ACTIVE rows
 *   (TOKEN_ROTATED) instead of leaving dead targets behind
 * - a sixth active token evicts the least-recently-confirmed (LRU_EVICTED)
 */
export async function registerToken(
  userId: string,
  input: RegisterTokenInput,
): Promise<{ id: string; devices: DeviceView[] }> {
  try {
    return await registerTokenOnce(userId, input)
  } catch (err) {
    // Two devices registering the same brand-new token concurrently: the
    // loser's INSERT hits the ACTIVE-only unique index. One retry lands on
    // the update path and succeeds.
    if (typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505') {
      return registerTokenOnce(userId, input)
    }
    throw err
  }
}

async function registerTokenOnce(
  userId: string,
  input: RegisterTokenInput,
): Promise<{ id: string; devices: DeviceView[] }> {
  return transaction(async (client) => {
    // Revoked audit rows may share the token string; the live row (or, absent
    // one, the newest) is the row this registration acts on.
    const { rows: existing } = await client.query<{ id: string; user_id: string }>(
      `select id, user_id from device_push_tokens
       where token = $1
       order by (status = 'ACTIVE') desc, created_at desc
       limit 1
       for update`,
      [input.expo_push_token],
    )
    const current = existing[0]

    let id: string
    if (current && current.user_id === userId) {
      const { rows } = await client.query<{ id: string }>(
        `update device_push_tokens
         set platform = $2, installation_id = $3, device_label = $4, app_version = $5,
             permission_status = $6, status = 'ACTIVE', revoked_at = null,
             revoke_reason = null, last_confirmed_at = now(), updated_at = now()
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
      if (current) {
        // Device handover (E-26): the previous owner's row is revoked first;
        // the ACTIVE-only unique index then frees the token for the new owner
        // while the revoked row remains as the audit trail.
        await client.query(
          `update device_push_tokens
           set status = 'STALE', revoked_at = now(), revoke_reason = 'TOKEN_REASSIGNED',
               updated_at = now()
           where id = $1`,
          [current.id],
        )
      }

      // Token rotation: retire this installation's previous live rows.
      await client.query(
        `update device_push_tokens
         set status = 'STALE', revoked_at = now(), revoke_reason = 'TOKEN_ROTATED',
             updated_at = now()
         where user_id = $1 and installation_id = $2 and status = 'ACTIVE' and token <> $3`,
        [userId, input.client_installation_id, input.expo_push_token],
      )

      const { rows } = await client.query<{ id: string }>(
        `insert into device_push_tokens
           (user_id, installation_id, platform, token, status, device_label, app_version,
            permission_status, last_confirmed_at)
         values ($1, $2, $3, $4, 'ACTIVE', $5, $6, $7, now())
         returning id`,
        [
          userId,
          input.client_installation_id,
          input.platform,
          input.expo_push_token,
          input.device_label ?? null,
          input.app_version ?? null,
          input.permission_status,
        ],
      )
      id = rows[0]!.id
    }

    // FR-NOT-14 rule 4: cap ACTIVE rows at 5, evicting the least recently seen.
    await client.query(
      `update device_push_tokens
       set status = 'STALE', revoked_at = now(), revoke_reason = 'LRU_EVICTED',
           updated_at = now()
       where id in (
         select id from device_push_tokens
         where user_id = $1 and status = 'ACTIVE'
         order by last_confirmed_at desc nulls last
         offset $2
       )`,
      [userId, MAX_ACTIVE_TOKENS_PER_USER],
    )

    const { rows: devices } = await client.query<DeviceView>(
      `select id, platform, device_label, app_version, permission_status, last_confirmed_at
       from device_push_tokens
       where user_id = $1 and status = 'ACTIVE'
       order by last_confirmed_at desc nulls last`,
      [userId],
    )
    return { id, devices }
  })
}

/** Active, permission-granted tokens for a set of users (the dispatch target set). */
export async function activeTokensForUsers(userIds: string[]): Promise<Map<string, string[]>> {
  if (userIds.length === 0) return new Map()
  const pool = getPool()
  const { rows } = await pool.query<{ user_id: string; token: string }>(
    `select user_id, token
     from device_push_tokens
     where user_id = any ($1::uuid[])
       and status = 'ACTIVE'
       and permission_status = 'GRANTED'`,
    [userIds],
  )
  const map = new Map<string, string[]>()
  for (const row of rows) {
    const list = map.get(row.user_id)
    if (list) list.push(row.token)
    else map.set(row.user_id, [row.token])
  }
  return map
}

/** Revoke tokens Expo reports as gone (FR-NOT-15). */
export async function revokeTokens(tokens: string[], reason: string): Promise<void> {
  if (tokens.length === 0) return
  const pool = getPool()
  await pool.query(
    `update device_push_tokens
     set status = case when $2 = 'DEVICE_NOT_REGISTERED' then 'UNREGISTERED' else 'STALE' end,
         revoked_at = now(), revoke_reason = $2, updated_at = now()
     where token = any ($1::text[]) and status = 'ACTIVE'`,
    [tokens, reason],
  )
}
