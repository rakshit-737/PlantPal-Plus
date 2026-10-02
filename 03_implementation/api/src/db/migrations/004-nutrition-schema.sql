-- 004: Nutrition schema — ENT-16 (Food), ENT-17 (Meal), ENT-18 (MealItem),
-- ENT-19 (WaterLog).
-- References: modules/nutrition.md, BR-NUT-08 (Atwater energy).
--
-- Foods store macros per 100 g. A logged item's energy is computed by
-- energyFromMacros in @plantpal/shared from the item's scaled macros, then
-- frozen onto the meal_item row so a later catalogue correction never rewrites
-- a historical diary entry.

begin;

-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| Food catalog

create table if not exists foods (
  id                 uuid        primary key default gen_random_uuid(),
  name               text        not null check (length(name) between 1 and 120),
  brand              text        check (length(brand) <= 80),
  -- Macros per 100 g. Energy is derivable via Atwater but stored for search
  -- ranking and to preserve the source's stated figure where it rounds oddly.
  kcal_per_100g      numeric(7,2) not null check (kcal_per_100g between 0 and 9000),
  protein_per_100g   numeric(6,2) not null default 0 check (protein_per_100g between 0 and 100),
  carbs_per_100g     numeric(6,2) not null default 0 check (carbs_per_100g between 0 and 100),
  fat_per_100g       numeric(6,2) not null default 0 check (fat_per_100g between 0 and 100),
  -- Default serving so a user can log "1 slice" without knowing the gram weight.
  default_serving_unit text      not null default 'GRAM'
                                 check (default_serving_unit = any (array[
                                   'GRAM','MILLILITRE','PIECE','CUP','TABLESPOON','SLICE','CUSTOM'
                                 ])),
  default_serving_grams numeric(7,2) check (default_serving_grams is null or default_serving_grams between 0.1 and 5000),
  barcode            text        check (barcode is null or barcode ~ '^\d{8,14}$'),
  source             text        not null default 'SEED'
                                 check (source = any (array['SEED','OPEN_FOOD_FACTS','CUSTOM'])),
  is_custom          boolean     not null default false,
  created_by         uuid        references users(id) on delete cascade,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  check ((is_custom and created_by is not null) or (not is_custom and created_by is null))
);

create index if not exists idx_foods_name on foods (lower(name)) where deleted_at is null;
create index if not exists idx_foods_barcode on foods (barcode) where barcode is not null;
create index if not exists idx_foods_custom_owner on foods (created_by) where is_custom;

-- |||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| Meal table

-- A meal groups items logged together at one meal type on one local day.
-- Append-only for offline sync.
create table if not exists meals (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references users(id) on delete cascade,
  meal_type          text        not null check (meal_type = any (array[
                                   'BREAKFAST','LUNCH','DINNER','SNACK'
                                 ])),
  -- Meal totals, summed from items and frozen. Denormalised so the daily summary
  -- does not re-sum every item on every dashboard read.
  total_kcal         numeric(8,1) not null default 0 check (total_kcal >= 0),
  total_protein_g    numeric(7,1) not null default 0 check (total_protein_g >= 0),
  total_carbs_g      numeric(7,1) not null default 0 check (total_carbs_g >= 0),
  total_fat_g        numeric(7,1) not null default 0 check (total_fat_g >= 0),
  note               text        check (length(note) <= 500),
  logged_at_utc      timestamptz not null default now(),
  local_date_str     text        not null check (local_date_str ~ '^\d{4}-\d{2}-\d{2}$'),
  client_idempotency_key uuid    unique,
  created_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index if not exists idx_meals_user_date
  on meals (user_id, local_date_str) where deleted_at is null;

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| Meal items

create table if not exists meal_items (
  id                 uuid        primary key default gen_random_uuid(),
  meal_id            uuid        not null references meals(id) on delete cascade,
  -- Food may be soft-deleted from the catalogue later; keep the reference but
  -- also snapshot the name so a historical entry still reads correctly.
  food_id            uuid        references foods(id) on delete set null,
  food_name_at_log   text        not null check (length(food_name_at_log) between 1 and 120),
  quantity           numeric(8,2) not null check (quantity > 0),
  serving_unit       text        not null check (serving_unit = any (array[
                                   'GRAM','MILLILITRE','PIECE','CUP','TABLESPOON','SLICE','CUSTOM'
                                 ])),
  grams              numeric(9,2) not null check (grams > 0),
  -- Scaled + frozen macros for this portion, and Atwater-derived energy.
  kcal               numeric(8,1) not null check (kcal >= 0),
  protein_g          numeric(7,1) not null default 0 check (protein_g >= 0),
  carbs_g            numeric(7,1) not null default 0 check (carbs_g >= 0),
  fat_g              numeric(7,1) not null default 0 check (fat_g >= 0),
  created_at         timestamptz not null default now()
);

create index if not exists idx_meal_items_meal on meal_items (meal_id);
create index if not exists idx_meal_items_food on meal_items (food_id);

-- ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||| Water logs

-- Hydration tracking (FR-NUT-20). Default daily goal is 35 ml/kg via
-- defaultHydrationGoalMl; the per-day goal is stored so a mid-day body-mass
-- edit does not retroactively move an already-met target.
create table if not exists water_logs (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references users(id) on delete cascade,
  amount_ml          integer     not null check (amount_ml between 1 and 5000),
  goal_ml_at_log     integer     check (goal_ml_at_log is null or goal_ml_at_log between 1 and 20000),
  logged_at_utc      timestamptz not null default now(),
  local_date_str     text        not null check (local_date_str ~ '^\d{4}-\d{2}-\d{2}$'),
  client_idempotency_key uuid    unique,
  created_at         timestamptz not null default now()
);

create index if not exists idx_water_user_date on water_logs (user_id, local_date_str);

comment on column meal_items.kcal is 'BR-NUT-08: Atwater energy frozen at log time';
comment on table meals is 'Append-only; client_idempotency_key blocks duplicate offline replays';

commit;
