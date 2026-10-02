-- 006: Offline sync outbox — ENT-24 (SyncEvent).
-- References: 03-api-specification.md §3.2, "Notable engineering decisions" in
-- README (offline sync with no merge algorithm).
--
-- Only append-only log events may be queued offline: a watering, a workout, a
-- meal, a water log. Each carries a client-generated UUID idempotency key; the
-- server upserts by it, so a replay is safe and conflict-free by construction —
-- no CRDT, no last-write-wins. Everything else requires connectivity.
--
-- This table is the durable record of ingest. The unique constraint on
-- (user_id, client_idempotency_key) is the idempotency guarantee: a second POST
-- of the same key is a no-op that returns the original result, and the same key
-- also guards the destination row (plant_care_events / workouts / meals /
-- water_logs all carry client_idempotency_key unique).

begin;

create table if not exists sync_events (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        not null references users(id) on delete cascade,
  -- Client-generated, the whole point of the design.
  client_idempotency_key uuid        not null,
  entity_type            text        not null check (entity_type = any (array[
                                       'PLANT_CARE_EVENT','WORKOUT','MEAL','WATER_LOG'
                                     ])),
  -- The raw event payload, validated against the entity's Zod schema before the
  -- destination row is written. Kept for audit and for reprocessing a FAILED row.
  payload                jsonb       not null,
  status                 text        not null default 'PENDING'
                                     check (status = any (array['PENDING','PROCESSED','FAILED'])),
  -- The id of the row this event produced in its destination table, once
  -- PROCESSED. Lets a client reconcile its local copy with the server id.
  result_entity_id       uuid,
  error_code             text        check (length(error_code) <= 60),
  error_detail           text        check (length(error_detail) <= 500),
  received_at            timestamptz not null default now(),
  processed_at           timestamptz,
  created_at             timestamptz not null default now(),
  -- The idempotency guarantee. A replayed key collides here and the ingest
  -- returns the stored result rather than writing a duplicate.
  unique (user_id, client_idempotency_key)
);

-- The client clears its local queue by the keys the server confirms PROCESSED.
create index if not exists idx_sync_events_user_status
  on sync_events (user_id, status, received_at);

-- A retry sweep for FAILED rows (transient errors) scans by status.
create index if not exists idx_sync_events_failed
  on sync_events (status, received_at) where status = 'FAILED';

comment on table sync_events is
  'Append-only offline outbox. (user_id, client_idempotency_key) unique = replay-safe by construction';

commit;
