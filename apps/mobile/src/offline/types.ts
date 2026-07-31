/**
 * Shapes shared across the offline outbox. Kept in their own module so the
 * queue and its storage driver can reference each other's types without an
 * import cycle.
 *
 * Every name here mirrors the server contract in
 * apps/api/src/modules/sync/syncController.ts — the wire field names are
 * snake_case on purpose so an OutboxItem is (minus its local bookkeeping) the
 * event body POST /api/v1/sync/outbox expects.
 */

/**
 * The only four things that may be logged offline (006-sync-schema.sql). All
 * four are append-only, which is what makes replay conflict-free: there is no
 * merge algorithm anywhere in this design, by construction.
 */
export type OutboxEntityType = 'PLANT_CARE_EVENT' | 'WORKOUT' | 'MEAL' | 'WATER_LOG'

export interface OutboxItem {
  /**
   * Client-generated RFC 4122 v4 UUID — the idempotency key. It is minted
   * before the online attempt and reused for the queued replay, so the write
   * has one identity end to end and (user_id, client_idempotency_key) can do
   * its job: a request that reached the database but whose response was lost
   * cannot be applied twice.
   */
  client_idempotency_key: string
  entity_type: OutboxEntityType
  /**
   * The account this event belongs to. A queue outlives the session that
   * created it (the app can be killed without signing out), and the server
   * files an event against whoever's token drains it — so without this, a
   * queue left by one account could be posted under the next one that signs
   * in on the same device. Items whose owner is not the current account are
   * discarded on hydration rather than sent.
   */
  ownerId: string
  /** The event body, already shaped for the server's strict Zod schema. */
  payload: Record<string, unknown>
  /** ISO-8601 UTC instant the item was queued. Drain order is FIFO on this. */
  createdAt: string
  /** Local bookkeeping: how many times the server has adjudicated this item. */
  attempts: number
  /** Short human label, used only to name the entry if it has to be dropped. */
  label: string
}

/** One entry of the `results` array returned by POST /v1/sync/outbox. */
export interface SyncResult {
  client_idempotency_key: string
  status: 'PROCESSED' | 'FAILED'
  /** True when the key had been ingested before; the stored outcome is echoed. */
  replay: boolean
  entity_id: string | null
  error_code: string | null
}

export interface OutboxSnapshot {
  /** Items still waiting for the server, oldest first. */
  items: readonly OutboxItem[]
  pending: number
  /** True while a drain is in flight. */
  draining: boolean
  /**
   * A user-visible note about entries the server rejected for good, or null.
   * Dropping a queued log silently would be data loss the user never learns of.
   */
  notice: string | null
}
