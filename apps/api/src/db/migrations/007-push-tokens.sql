-- 007: Device push tokens — ENT-07 (DevicePushToken).
-- References: modules/notifications.md FR-NOT-14/15, BR-NOT-15.
--
-- The registry is a set, not a column: phone + tablet + a not-yet-pruned
-- reinstall is normal. At most 5 active rows per user (LRU_EVICTED beyond
-- that); a token registered by a different user revokes the previous owner's
-- row first (TOKEN_REASSIGNED) so a handed-over device can never receive the
-- previous owner's reminders.

begin;

create table if not exists device_push_tokens (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        not null references users(id) on delete cascade,
  -- Unique across the whole table, not merely per user (FR-NOT-14).
  expo_push_token        text        not null unique
                                     check (
                                       length(expo_push_token) between 20 and 200
                                       and (expo_push_token like 'ExponentPushToken[%'
                                            or expo_push_token like 'ExpoPushToken[%')
                                     ),
  platform               text        not null check (platform = any (array['IOS','ANDROID','WEB'])),
  -- Stable per application installation; links the row to the auth session.
  client_installation_id uuid        not null,
  device_label           text        check (length(device_label) <= 64),
  app_version            text        check (length(app_version) <= 20),
  -- DENIED rows are stored but never targeted by a send (FR-NOT-14 rule 5).
  permission_status      text        not null default 'UNDETERMINED'
                                     check (permission_status = any (array['GRANTED','DENIED','UNDETERMINED'])),
  revoked_at             timestamptz,
  revoke_reason          text        check (revoke_reason = any (array[
                                       'LRU_EVICTED','TOKEN_REASSIGNED','DEVICE_NOT_REGISTERED','USER_LOGOUT'
                                     ])),
  created_at             timestamptz not null default now(),
  last_seen_at           timestamptz not null default now()
);

-- The dispatcher's target set: a user's active, permitted tokens.
create index if not exists idx_push_tokens_user_active
  on device_push_tokens (user_id, last_seen_at desc)
  where revoked_at is null and permission_status = 'GRANTED';

comment on table device_push_tokens is
  'FR-NOT-14: max 5 active per user (LRU_EVICTED); token unique table-wide; reassignment revokes the previous owner';

commit;
