-- 001: Auth schema — ENT-01 through ENT-07.
-- References: 07-domain-model.md §3.1, modules/accounts.md §5.
-- Seed idempotently per BR-SYS-29 clause 4: every table is IF NOT EXISTS.

begin;

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| User table

create table if not exists users (
  id              uuid        primary key default gen_random_uuid(),
  email           text        not null check (length(email) between 5 and 254),
  email_normalised text       not null unique check (email_normalised = lower(trim(email))),
  password_hash   text        check (password_hash is not null or oauth_count > 0),
  oauth_count     integer     not null default 0,
  status          text        not null default 'PENDING_VERIFICATION'
                              check (status = any (array[
                                'PENDING_VERIFICATION', 'ACTIVE', 'LOCKED',
                                'PENDING_DELETION'
                              ])),
  token_version   integer     not null default 0,
  email_verified_at          timestamptz,
  failed_login_count         integer   not null default 0,
  locked_until               timestamptz,
  last_login_at              timestamptz,
  password_changed_at        timestamptz,
  deletion_requested_at      timestamptz,
  purge_after                timestamptz,
  minimum_age_confirmed      boolean   not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- A deleted account's address is released only at purge, so a deletion cannot
-- be used to squat an address. The unique constraint on email_normalised is
-- therefore full-table, not partial over deleted_at.

create index if not exists idx_users_email_normalised
  on users (email_normalised);

create index if not exists idx_users_purge_after
  on users (purge_after) where purge_after is not null;

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| Profile table

create table if not exists profiles (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null unique references users(id) on delete cascade,
  display_name    text        not null check (length(display_name) between 1 and 60),
  avatar_photo_id uuid,
  date_of_birth   date        check (date_of_birth >= '1900-01-01'),
  biological_sex  text        check (biological_sex = any (array['MALE','FEMALE','PREFER_NOT_TO_SAY'])),
  height_cm       numeric(4,1) check (height_cm between 50.0 and 272.0),
  activity_level  text        not null default 'LIGHTLY_ACTIVE'
                              check (activity_level = any (array[
                                'SEDENTARY', 'LIGHTLY_ACTIVE', 'MODERATELY_ACTIVE',
                                'VERY_ACTIVE', 'EXTRA_ACTIVE'
                              ])),
  current_body_mass_kg          numeric(6,2) check (current_body_mass_kg between 20.00 and 635.00),
  current_body_mass_recorded_at timestamptz,
  onboarding_completed_at       timestamptz,
  onboarding_last_step          integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||||| UserSettings table

create table if not exists user_settings (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null unique references users(id) on delete cascade,
  timezone        text        not null default 'UTC',
  hemisphere      text        not null default 'NORTHERN'
                              check (hemisphere = any (array['NORTHERN','SOUTHERN','EQUATORIAL'])),
  hemisphere_source text      not null default 'AUTO'
                              check (hemisphere_source = any (array['AUTO','USER'])),
  locale          text        not null default 'en-US',
  unit_system     text        not null default 'METRIC'
                              check (unit_system = any (array['METRIC','IMPERIAL'])),
  theme           text        not null default 'SYSTEM'
                              check (theme = any (array['LIGHT','DARK','SYSTEM'])),
  week_start_day  text        not null default 'MONDAY'
                              check (week_start_day = any (array['SUNDAY','MONDAY'])),
  plant_care_enabled      boolean not null default true,
  fitness_enabled         boolean not null default true,
  nutrition_enabled       boolean not null default true,
  quiet_hours_mode        text    not null default 'WINDOW'
                           check (quiet_hours_mode = any (array['OFF','WINDOW','SCHEDULED_ONLY'])),
  quiet_start_time        time,
  quiet_end_time          time,
  daily_notification_cap  integer not null default 12 check (daily_notification_cap between 1 and 20),
  vacation_start_date     date,
  vacation_end_date       date,
  exercise_calories_in_budget_enabled boolean not null default false,
  reduce_motion           boolean not null default false,
  larger_text             boolean not null default false,
  high_contrast           boolean not null default false,
  analytics_opt_in        boolean not null default false,
  flag_map_version        integer not null default 1,
  timezone_change_count   integer not null default 0,
  last_timezone_change_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Invariant: at least one module must be enabled (Invariant 34).
-- Enforced in application code since it spans three boolean columns.

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||||||| AuthSession table

create table if not exists auth_sessions (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references users(id) on delete cascade,
  token_family_id uuid        not null,
  parent_session_id          uuid,
  refresh_token_hash         text not null unique,
  status          text        not null default 'ACTIVE'
                              check (status = any (array['ACTIVE','ROTATED','REVOKED','EXPIRED'])),
  platform        text        not null check (platform = any (array['IOS','ANDROID','WEB'])),
  client_installation_id     uuid not null,
  device_label    text        check (length(device_label) <= 80),
  ip_address_hash            text,
  user_agent      text        check (length(user_agent) <= 200),
  issued_at       timestamptz not null default now(),
  expires_at      timestamptz not null,
  last_used_at    timestamptz,
  revoked_at      timestamptz,
  revoke_reason   text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_auth_sessions_user
  on auth_sessions (user_id, status);

create index if not exists idx_auth_sessions_family
  on auth_sessions (token_family_id);

create index if not exists idx_auth_sessions_refresh_hash
  on auth_sessions (refresh_token_hash) where status = 'ACTIVE';

-- |||||||||||||||||||||||||||||||||||||||||||||||||||| AuthToken table (post-BR-ACC-07)

create table if not exists auth_tokens (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references users(id) on delete cascade,
  session_id      uuid        not null references auth_sessions(id) on delete cascade,
  token_family_id uuid        not null,
  parent_id       uuid,
  generation      integer     not null,
  refresh_token_digest text   not null unique,       -- SHA-256, never the raw token
  consumed_at     timestamptz,
  expires_at      timestamptz not null,
  family_created_at timestamptz not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_auth_tokens_digest
  on auth_tokens (refresh_token_digest) where consumed_at is null;

-- Family cap: 180 days from family_created_at (BR-ACC-07 clause 6).
create index if not exists idx_auth_tokens_family_expired
  on auth_tokens (token_family_id, expires_at);

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||| Email verification tokens

create table if not exists email_verification_tokens (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references users(id) on delete cascade,
  token_digest    text        not null unique,        -- SHA-256 of the token
  sent_to         text        not null,               -- address sent to at issue time
  issued_at       timestamptz not null default now(),
  expires_at      timestamptz not null,               -- 24 hours from issue
  consumed_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_email_verif_tokens_user
  on email_verification_tokens (user_id, expires_at) where consumed_at is null;

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||| Password reset tokens

create table if not exists password_reset_tokens (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references users(id) on delete cascade,
  token_digest    text        not null unique,
  issued_at       timestamptz not null default now(),
  expires_at      timestamptz not null,               -- 1 hour from issue
  consumed_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||| Login attempt audit

create table if not exists login_attempts (
  id              uuid        primary key default gen_random_uuid(),
  email_normalised text       not null,
  ip_prefix       text        not null,
  outcome         text        not null check (outcome = any (array[
                    'SUCCESS', 'BAD_PASSWORD', 'NO_ACCOUNT', 'LOCKED_OUT', 'UNVERIFIED'
                  ])),
  attempted_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_login_attempts_address
  on login_attempts (email_normalised, attempted_at);

create index if not exists idx_login_attempts_ip
  on login_attempts (ip_prefix, attempted_at);

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||| Consent records

create table if not exists consent_records (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references users(id) on delete cascade,
  consent_type    text        not null,
  version         integer     not null,
  granted         boolean     not null,
  ip_prefix       text,
  recorded_at     timestamptz not null default now(),
  superseded_by  uuid,
  created_at      timestamptz not null default now()
);

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||| Device push tokens

create table if not exists device_push_tokens (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references users(id) on delete cascade,
  installation_id uuid        not null,
  platform        text        not null check (platform = any (array['IOS','ANDROID','WEB'])),
  token           text        not null,
  status          text        not null default 'ACTIVE'
                              check (status = any (array['ACTIVE','UNREGISTERED','STALE'])),
  last_confirmed_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists idx_push_tokens_install
  on device_push_tokens (installation_id) where status = 'ACTIVE';

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||| Security audit events

create table if not exists audit_events (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        references users(id) on delete set null,
  event_type      text        not null,
  payload         jsonb       not null default '{}',
  ip_prefix       text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_audit_events_user
  on audit_events (user_id, created_at);

create index if not exists idx_audit_events_type
  on audit_events (event_type, created_at);

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||| Scheduler clean-up

-- Clean up expired rows. These run inline in every server tick (node-cron,
-- not pg_cron, because the free-tier host has no process for pg_cron).

comment on table login_attempts is 'BR-ACC-09: rows deleted 30 days after attempted_at';
comment on table email_verification_tokens is 'BR-ACC-04: rows deleted 30 days after expiry';
comment on table auth_tokens is 'BR-ACC-07: rows deleted 30 days after expiry';
comment on table audit_events is 'Retained 90 days, per the privacy window';

commit;