-- 007: Bring ENT-07 device_push_tokens (created in 001) up to FR-NOT-14/15.
-- References: modules/notifications.md FR-NOT-14/15, BR-NOT-15.
--
-- 001 shipped the registry core (installation_id, token, ACTIVE/UNREGISTERED/
-- STALE status). This migration adds what dispatch and the settings screen
-- need: permission tracking, device metadata, revocation bookkeeping, and the
-- table-wide token uniqueness the spec requires.
--
-- Status mapping: ACTIVE = live target; UNREGISTERED = Expo said
-- DeviceNotRegistered; STALE = revoked by policy (LRU_EVICTED,
-- TOKEN_REASSIGNED, TOKEN_ROTATED, USER_LOGOUT) with the reason recorded.

begin;

alter table device_push_tokens
  add column if not exists device_label      text check (length(device_label) <= 64),
  add column if not exists app_version       text check (length(app_version) <= 20),
  add column if not exists permission_status text not null default 'UNDETERMINED'
                             check (permission_status = any (array['GRANTED','DENIED','UNDETERMINED'])),
  add column if not exists revoked_at        timestamptz,
  add column if not exists revoke_reason     text
                             check (revoke_reason = any (array[
                               'LRU_EVICTED','TOKEN_REASSIGNED','TOKEN_ROTATED','DEVICE_NOT_REGISTERED','USER_LOGOUT'
                             ]));

-- FR-NOT-14: one live owner per token string, table-wide (not merely per
-- user). Partial on ACTIVE so a reassigned or rotated token keeps its revoked
-- rows as an audit trail while the new owner's row takes the live slot.
create unique index if not exists idx_push_tokens_token
  on device_push_tokens (token) where status = 'ACTIVE';

-- The dispatcher's target set: a user's live, permitted tokens.
create index if not exists idx_push_tokens_dispatch
  on device_push_tokens (user_id, last_confirmed_at desc)
  where status = 'ACTIVE' and permission_status = 'GRANTED';

comment on table device_push_tokens is
  'ENT-07 / FR-NOT-14: max 5 ACTIVE per user (LRU_EVICTED); token unique table-wide; reassignment revokes the previous owner';

commit;
