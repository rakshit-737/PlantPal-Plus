-- 003: Fitness schema — ENT-12 (Exercise/Activity), ENT-13 (Workout),
-- ENT-14 (WorkoutSet), ENT-15 (PersonalRecord).
-- References: modules/fitness.md, BR-FIT-05 (MET energy), BR-FIT-14 (volume),
-- BR-FIT-15 (estimated 1RM).
--
-- Energy uses workoutEnergyKcal(MET, mass, minutes) and 1RM uses
-- estimatedOneRepMax — both from @plantpal/shared. The MET value is frozen onto
-- the workout row at save time (FR-FIT-05) so a later catalogue revision never
-- rewrites historical estimates: exercises.met_value is the catalogue source,
-- workouts.met_value_at_log is the frozen copy.

begin;

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||||||| Exercise catalog

create table if not exists exercises (
  id             uuid        primary key default gen_random_uuid(),
  name           text        not null check (length(name) between 1 and 100),
  activity_type  text        not null check (activity_type = any (array[
                               'WALK','RUN','CYCLE','SWIM','STRENGTH','YOGA','HIIT','SPORT','OTHER'
                             ])),
  -- Compendium MET value, 1.0..23.0 to match the shared function's guard.
  met_value      numeric(4,1) not null check (met_value between 1.0 and 23.0),
  -- Strength exercises track sets/reps/weight; cardio tracks duration only.
  is_strength    boolean     not null default false,
  muscle_group   text        check (length(muscle_group) <= 60),
  is_custom      boolean     not null default false,
  created_by     uuid        references users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check ((is_custom and created_by is not null) or (not is_custom and created_by is null))
);

create index if not exists idx_exercises_name on exercises (lower(name));
create index if not exists idx_exercises_type on exercises (activity_type);
create index if not exists idx_exercises_custom_owner on exercises (created_by) where is_custom;

-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| Workout table

-- Append-only fitness log. Carries the idempotency key for offline replay.
create table if not exists workouts (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references users(id) on delete cascade,
  exercise_id        uuid        references exercises(id) on delete set null,
  activity_type      text        not null check (activity_type = any (array[
                                   'WALK','RUN','CYCLE','SWIM','STRENGTH','YOGA','HIIT','SPORT','OTHER'
                                 ])),
  duration_mins      integer     check (duration_mins is null or duration_mins between 1 and 1440),
  perceived_intensity text       check (perceived_intensity = any (array['LOW','MODERATE','VIGOROUS'])),
  -- Frozen MET and body mass used for the energy estimate, so the row is
  -- reproducible and immune to later catalogue or profile edits.
  met_value_at_log   numeric(4,1) check (met_value_at_log is null or met_value_at_log between 1.0 and 23.0),
  body_mass_at_log_kg numeric(6,2) check (body_mass_at_log_kg is null or body_mass_at_log_kg between 20.0 and 635.0),
  calories_burned    numeric(7,1) check (calories_burned is null or calories_burned >= 0),
  -- Total volume across sets (kg), BR-FIT-14; 0.0 for non-strength so no chart gap.
  total_volume_kg    numeric(9,1) not null default 0 check (total_volume_kg >= 0),
  steps              integer     check (steps is null or steps between 0 and 200000),
  note               text        check (length(note) <= 500),
  logged_at_utc      timestamptz not null default now(),
  local_date_str     text        not null check (local_date_str ~ '^\d{4}-\d{2}-\d{2}$'),
  client_idempotency_key uuid    unique,
  created_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index if not exists idx_workouts_user_date
  on workouts (user_id, local_date_str) where deleted_at is null;
create index if not exists idx_workouts_user_logged
  on workouts (user_id, logged_at_utc desc) where deleted_at is null;

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| Workout sets

create table if not exists workout_sets (
  id                 uuid        primary key default gen_random_uuid(),
  workout_id         uuid        not null references workouts(id) on delete cascade,
  set_index          integer     not null check (set_index >= 1),
  reps               integer     not null check (reps between 0 and 1000),
  weight_kg          numeric(6,2) not null default 0 check (weight_kg between 0 and 1000),
  -- Per-set volume (reps * weight) and Epley e1RM, both from @plantpal/shared.
  volume_kg          numeric(9,1) not null default 0 check (volume_kg >= 0),
  estimated_1rm_kg   numeric(7,1) check (estimated_1rm_kg is null or estimated_1rm_kg >= 0),
  created_at         timestamptz not null default now(),
  unique (workout_id, set_index)
);

create index if not exists idx_workout_sets_workout on workout_sets (workout_id, set_index);

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||||||| Personal records

-- BR-FIT-15: a record is per user, per exercise, per record type. Only the
-- current best is stored; superseding updates the row and bumps achieved_at.
create table if not exists personal_records (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references users(id) on delete cascade,
  exercise_id        uuid        not null references exercises(id) on delete cascade,
  record_type        text        not null check (record_type = any (array[
                                   'HEAVIEST_WEIGHT','BEST_ESTIMATED_1RM','BEST_REP_COUNT'
                                 ])),
  value              numeric(9,2) not null check (value >= 0),
  source_workout_id  uuid        references workouts(id) on delete set null,
  achieved_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, exercise_id, record_type)
);

create index if not exists idx_pr_user on personal_records (user_id, exercise_id);

comment on column workouts.met_value_at_log is 'FR-FIT-05: MET frozen at save; catalogue edits never rewrite history';
comment on table workouts is 'Append-only; client_idempotency_key blocks duplicate offline replays';

commit;
