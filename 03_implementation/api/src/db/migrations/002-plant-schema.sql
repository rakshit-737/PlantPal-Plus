-- 002: Plant care schema — ENT-08 (Species), ENT-09 (Plant), ENT-10 (PlantCareEvent),
-- ENT-11 (GrowthLogEntry).
-- References: 02-database-schema.md §2, modules/plant-care.md, BR-PLT-03..BR-PLT-12.
--
-- The watering algorithm (computeWateringInterval in @plantpal/shared) is the
-- signature feature, so these tables must carry every input it consumes:
-- a species baseline/min/max interval, and the per-plant pot, soil, light and
-- environment. BR-PLT-08 clause 4 additionally requires the factor breakdown of
-- the *most recent* computation to be persisted so the UI can explain a due date
-- without recomputing it — that lives in plants.watering_factor_snapshot (JSONB).

begin;

-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| Species catalog

-- Seeded reference data (BR-PLT-01). `is_custom` rows are user-created species
-- that never appear in another user's search; `created_by` scopes them.
create table if not exists species (
  id                 uuid        primary key default gen_random_uuid(),
  scientific_name    text        not null check (length(scientific_name) between 1 and 120),
  common_name        text        not null check (length(common_name) between 1 and 120),
  -- Base interval assumes the reference conditions the factor tables are quoted
  -- against: BRIGHT_INDIRECT light, ceramic-glazed pot, standard potting soil.
  base_interval_days integer     not null check (base_interval_days between 1 and 365),
  min_interval_days  integer     not null check (min_interval_days between 1 and 365),
  max_interval_days  integer     not null check (max_interval_days between 1 and 365),
  default_light      text        not null default 'BRIGHT_INDIRECT'
                                 check (default_light = any (array['LOW','MEDIUM','BRIGHT_INDIRECT','DIRECT_SUN'])),
  default_soil       text        not null default 'STANDARD_POTTING'
                                 check (default_soil = any (array[
                                   'ORCHID_BARK','CACTUS_SUCCULENT','GARDEN_SOIL','STANDARD_POTTING',
                                   'PEAT_BASED','COCO_COIR','SEMI_HYDRO_LECA','OTHER'
                                 ])),
  care_notes         text        check (length(care_notes) <= 2000),
  image_url          text,
  is_custom          boolean     not null default false,
  created_by         uuid        references users(id) on delete cascade,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Species bounds must not be inverted, mirroring the RangeError the shared
  -- function throws, so a bad catalogue row can never reach the algorithm.
  check (min_interval_days <= max_interval_days),
  check (base_interval_days between min_interval_days and max_interval_days),
  -- A custom species is owned; a catalogue species is not.
  check ((is_custom and created_by is not null) or (not is_custom and created_by is null))
);

-- Catalogue lookups are by common name; custom species are per-user.
create index if not exists idx_species_common_name on species (lower(common_name));
create index if not exists idx_species_custom_owner on species (created_by) where is_custom;

-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| Plant table

create table if not exists plants (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references users(id) on delete cascade,
  species_id         uuid        references species(id) on delete set null,
  nickname           text        not null check (length(nickname) between 1 and 80),
  room               text        check (length(room) <= 80),
  acquisition_date   date,
  status             text        not null default 'THRIVING'
                                 check (status = any (array['THRIVING','NEEDS_ATTENTION','CRITICAL','DORMANT'])),

  -- Environment: the watering-algorithm inputs (BR-PLT-05..BR-PLT-07).
  light_exposure     text        not null default 'BRIGHT_INDIRECT'
                                 check (light_exposure = any (array['LOW','MEDIUM','BRIGHT_INDIRECT','DIRECT_SUN'])),
  placement          text        not null default 'INDOOR'
                                 check (placement = any (array['INDOOR','OUTDOOR'])),
  pot_material       text        check (pot_material = any (array[
                                   'FABRIC','TERRACOTTA','CONCRETE','CERAMIC_GLAZED','METAL','PLASTIC','OTHER'
                                 ])),
  pot_diameter_cm    numeric(5,1) check (pot_diameter_cm is null or pot_diameter_cm between 1.0 and 300.0),
  has_drainage       boolean,
  soil_type          text        check (soil_type = any (array[
                                   'ORCHID_BARK','CACTUS_SUCCULENT','GARDEN_SOIL','STANDARD_POTTING',
                                   'PEAT_BASED','COCO_COIR','SEMI_HYDRO_LECA','OTHER'
                                 ])),
  indoor_climate     text        default 'NONE'
                                 check (indoor_climate = any (array['NONE','HEATED_DRY_WINTER','AIR_CONDITIONED','HUMID_ROOM'])),

  -- Denormalised species baseline, copied at attach time. A plant keeps its
  -- schedule even if the referenced species row is later deleted (species_id
  -- goes null on delete), and a per-plant override is possible without editing
  -- the shared catalogue.
  base_interval_days integer     not null check (base_interval_days between 1 and 365),
  min_interval_days  integer     not null check (min_interval_days between 1 and 365),
  max_interval_days  integer     not null check (max_interval_days between 1 and 365),

  -- Schedule state, recomputed on every watering and on season change.
  last_watered_at    timestamptz,
  next_water_due_at  timestamptz,
  effective_interval_days integer check (effective_interval_days is null or effective_interval_days >= 1),
  -- BR-PLT-08 clause 4: the factor breakdown of the last computation, so the UI
  -- can explain the due date. Shape matches WateringFactorSnapshot.
  watering_factor_snapshot jsonb,

  photo_url          text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  check (min_interval_days <= max_interval_days)
);

-- The dashboard's "due today / overdue" query scans by user and due date, over
-- live rows only.
create index if not exists idx_plants_user on plants (user_id) where deleted_at is null;
create index if not exists idx_plants_due
  on plants (user_id, next_water_due_at) where deleted_at is null;
create index if not exists idx_plants_species on plants (species_id);

-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||| Plant care events

-- Append-only care log (BR-PLT-09): waterings, fertilisings, prunings. Because
-- these are the offline-syncable events, each carries the client idempotency key
-- so a replay from sync_events cannot double-insert.
create table if not exists plant_care_events (
  id                 uuid        primary key default gen_random_uuid(),
  plant_id           uuid        not null references plants(id) on delete cascade,
  user_id            uuid        not null references users(id) on delete cascade,
  action_type        text        not null check (action_type = any (array[
                                   'WATER','FERTILIZE','PRUNE','REPOT','MIST','ROTATE','TREAT'
                                 ])),
  note               text        check (length(note) <= 500),
  -- Both a UTC instant and the user's local calendar day (§1: streaks without
  -- timezone math on read).
  logged_at_utc      timestamptz not null default now(),
  local_date_str     text        not null check (local_date_str ~ '^\d{4}-\d{2}-\d{2}$'),
  -- The interval that was in force when this event was logged, so adherence
  -- reporting uses the real schedule rather than today's.
  interval_at_log_days integer,
  client_idempotency_key uuid    unique,
  created_at         timestamptz not null default now()
);

create index if not exists idx_care_events_plant
  on plant_care_events (plant_id, logged_at_utc desc);
create index if not exists idx_care_events_user_date
  on plant_care_events (user_id, local_date_str);

-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||| Growth log entries

-- Photo timeline (BR-PLT-11). Photos are stored in object storage; only the key
-- and metadata live here. Soft-deletable so a removed photo does not orphan the
-- timeline ordering.
create table if not exists growth_log_entries (
  id                 uuid        primary key default gen_random_uuid(),
  plant_id           uuid        not null references plants(id) on delete cascade,
  user_id            uuid        not null references users(id) on delete cascade,
  photo_url          text        not null,
  photo_storage_key  text        not null,
  height_cm          numeric(6,1) check (height_cm is null or height_cm between 0 and 5000),
  note               text        check (length(note) <= 1000),
  logged_at_utc      timestamptz not null default now(),
  local_date_str     text        not null check (local_date_str ~ '^\d{4}-\d{2}-\d{2}$'),
  created_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index if not exists idx_growth_plant
  on growth_log_entries (plant_id, logged_at_utc desc) where deleted_at is null;

comment on table plant_care_events is 'BR-PLT-09: append-only; idempotency key blocks duplicate offline replays';
comment on column plants.watering_factor_snapshot is 'BR-PLT-08 cl.4: WateringFactorSnapshot from @plantpal/shared';

commit;
