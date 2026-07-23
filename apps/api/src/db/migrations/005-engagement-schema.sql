-- 005: Engagement schema — ENT-20 (ScheduledReminder), ENT-21 (Streak),
-- ENT-22 (Achievement), ENT-23 (UserAchievement).
-- References: modules/reminders.md, modules/gamification.md, RSK-01 (cron on a
-- sleeping free-tier instance).
--
-- Reminders are evaluated by a node-cron tick (not pg_cron: the free-tier host
-- has no process for it). due_at_utc is the earliest instant the tick may pick a
-- row up; the tick is a pure function of (now, due rows) so it is testable
-- without a scheduler. See M3.

begin;

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||||| Scheduled reminders

create table if not exists reminders (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references users(id) on delete cascade,
  reminder_type      text        not null check (reminder_type = any (array[
                                   'WATER_PLANT','FERTILIZE_PLANT','LOG_MEAL','LOG_WORKOUT','HYDRATION','CUSTOM'
                                 ])),
  -- The entity this reminder is about (e.g. a plant id). Nullable for module-wide
  -- nudges such as "log lunch" that are not tied to one row.
  target_entity_id   uuid,
  target_entity_type text        check (target_entity_type = any (array['PLANT','MEAL','WORKOUT','NONE'])),
  title              text        not null check (length(title) between 1 and 120),
  body               text        check (length(body) <= 300),
  due_at_utc         timestamptz not null,
  status             text        not null default 'PENDING'
                                 check (status = any (array['PENDING','SENT','DELIVERED','FAILED','CANCELLED','SUPPRESSED'])),
  -- Delivery bookkeeping for the dispatcher (M3).
  attempts           integer     not null default 0 check (attempts >= 0),
  sent_at            timestamptz,
  last_error         text        check (length(last_error) <= 300),
  -- Quiet-hours and the daily cap (user_settings.daily_notification_cap) are
  -- applied at dispatch; a reminder deferred by quiet hours keeps its row and is
  -- re-evaluated on the next tick rather than being dropped.
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- The dispatcher's hot query: pending reminders now due, oldest first.
create index if not exists idx_reminders_due
  on reminders (due_at_utc) where status = 'PENDING';
create index if not exists idx_reminders_user
  on reminders (user_id, status, due_at_utc);
-- At most one live reminder per target keeps re-computation from stacking
-- duplicate waterings on the same plant.
create unique index if not exists idx_reminders_unique_pending
  on reminders (user_id, reminder_type, target_entity_id)
  where status = 'PENDING' and target_entity_id is not null;

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| Streaks

-- One streak row per user per module (BR-GAM-04). local_date_str comparisons
-- drive the streak without server-timezone math (§1).
create table if not exists streaks (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references users(id) on delete cascade,
  streak_type        text        not null check (streak_type = any (array[
                                   'PLANT_CARE','FITNESS','NUTRITION','OVERALL'
                                 ])),
  current_length     integer     not null default 0 check (current_length >= 0),
  longest_length     integer     not null default 0 check (longest_length >= 0),
  -- The last local day that counted toward the streak. A gap of more than one
  -- day between this and today resets current_length to 0 (or 1 if today counts).
  last_counted_date  text        check (last_counted_date is null or last_counted_date ~ '^\d{4}-\d{2}-\d{2}$'),
  -- A limited number of "freeze" tokens spare a single missed day (BR-GAM-07).
  freeze_tokens      integer     not null default 0 check (freeze_tokens between 0 and 3),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, streak_type),
  check (longest_length >= current_length)
);

create index if not exists idx_streaks_user on streaks (user_id);

-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||| Achievements

-- Seeded catalogue of earnable badges (BR-GAM-10). Criteria are declarative so
-- the evaluator is data-driven rather than a switch per badge.
create table if not exists achievements (
  id                 uuid        primary key default gen_random_uuid(),
  code               text        not null unique check (code ~ '^[A-Z][A-Z0-9_]{2,49}$'),
  name               text        not null check (length(name) between 1 and 80),
  description        text        not null check (length(description) between 1 and 300),
  module             text        not null check (module = any (array['PLANT_CARE','FITNESS','NUTRITION','SHARED'])),
  -- Declarative unlock rule, e.g. { "metric": "plant_care_streak", "gte": 7 }.
  criteria           jsonb       not null default '{}',
  icon               text,
  tier               text        not null default 'BRONZE'
                                 check (tier = any (array['BRONZE','SILVER','GOLD','PLATINUM'])),
  points             integer     not null default 10 check (points between 0 and 1000),
  is_active          boolean     not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_achievements_module on achievements (module) where is_active;

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||||| User achievements

-- Join of user to unlocked achievement. The unique constraint makes unlocking
-- idempotent: the evaluator can re-run without minting a second copy.
create table if not exists user_achievements (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references users(id) on delete cascade,
  achievement_id     uuid        not null references achievements(id) on delete cascade,
  unlocked_at        timestamptz not null default now(),
  -- Progress toward a not-yet-unlocked achievement (0..100), so the UI can show
  -- a partial ring. A row exists once progress starts, unlocked_at set on 100%.
  progress_pct       integer     not null default 100 check (progress_pct between 0 and 100),
  seen_at            timestamptz,
  created_at         timestamptz not null default now(),
  unique (user_id, achievement_id)
);

create index if not exists idx_user_achievements_user
  on user_achievements (user_id, unlocked_at desc);

comment on table reminders is 'RSK-01: evaluated by node-cron tick; unique-pending index blocks duplicates';
comment on column streaks.freeze_tokens is 'BR-GAM-07: spares one missed day';

commit;
