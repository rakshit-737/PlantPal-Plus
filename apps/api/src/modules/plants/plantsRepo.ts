import { getPool, transaction } from '../../db/pool.ts'
import { computeWateringInterval, seasonForLocalDate } from '@plantpal/shared'
import type { Season, LightExposure, Placement, PotMaterial, SoilType, IndoorClimate } from '@plantpal/shared'

export interface PlantRow {
  id: string
  nickname: string
  species_id: string | null
  status: string
  next_water_due_at: Date | null
  effective_interval_days: number | null
  photo_url: string | null
  watering_factor_snapshot: unknown
  light_exposure: string
  placement: string
  pot_material: string | null
  soil_type: string | null
  base_interval_days: number
  min_interval_days: number
  max_interval_days: number
  last_watered_at: Date | null
  room: string | null
  acquisition_date: string | null
  created_at: Date
}

export interface CreatePlantData {
  nickname: string
  species_id?: string | null
  room?: string | null
  acquisition_date?: string | null
  light_exposure: string
  placement: string
  pot_material?: string | null
  has_drainage?: boolean | null
  soil_type?: string | null
  indoor_climate?: string | null
  base_interval_days: number
  min_interval_days: number
  max_interval_days: number
  photo_url?: string | null
}

export interface CareEventRow {
  id: string
  plant_id: string
  user_id: string
  action_type: string
  note: string | null
  logged_at_utc: Date
  local_date_str: string
  interval_at_log_days: number | null
  client_idempotency_key: string | null
}

/**
 * A row of the growth photo timeline (ENT-14 GrowthLogEntry; the schema heads
 * the table with BR-PLT-11, the plant-history rule it feeds).
 */
export interface GrowthLogEntryRow {
  id: string
  plant_id: string
  user_id: string
  photo_url: string
  photo_storage_key: string
  /**
   * numeric(6,1) in Postgres. node-postgres hands numerics back as strings on
   * purpose — parsing them into a JS float would silently lose the exact
   * decimal the user typed, and D-09 stores heights to one decimal place.
   */
  height_cm: string | null
  note: string | null
  logged_at_utc: Date
  local_date_str: string
  created_at: Date
}

export interface CreateGrowthEntryData {
  photo_url: string
  photo_storage_key: string
  height_cm?: number | null
  note?: string | null
  local_date_str: string
}

export interface SpeciesRow {
  id: string
  common_name: string
  scientific_name: string
  base_interval_days: number
  min_interval_days: number
  max_interval_days: number
  default_light: string
  default_soil: string
  care_notes: string | null
  image_url: string | null
}

const PLANT_COLUMNS = `id, nickname, species_id, status, next_water_due_at, effective_interval_days,
  photo_url, watering_factor_snapshot, light_exposure, placement, pot_material, soil_type,
  base_interval_days, min_interval_days, max_interval_days, last_watered_at, room,
  acquisition_date, created_at`

export async function listPlants(userId: string): Promise<PlantRow[]> {
  const pool = getPool()
  const { rows } = await pool.query<PlantRow>(
    `SELECT ${PLANT_COLUMNS} FROM plants WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userId],
  )
  return rows
}

export async function getPlant(id: string, userId: string): Promise<PlantRow | null> {
  const pool = getPool()
  const { rows } = await pool.query<PlantRow>(
    `SELECT ${PLANT_COLUMNS} FROM plants WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,
    [id, userId],
  )
  return rows[0] ?? null
}

export async function createPlant(userId: string, data: CreatePlantData): Promise<PlantRow> {
  const pool = getPool()
  const { rows: [plant] } = await pool.query<PlantRow>(
    `INSERT INTO plants
       (user_id, nickname, species_id, room, acquisition_date, light_exposure, placement,
        pot_material, has_drainage, soil_type, indoor_climate, base_interval_days,
        min_interval_days, max_interval_days, photo_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING ${PLANT_COLUMNS}`,
    [
      userId,
      data.nickname,
      data.species_id ?? null,
      data.room ?? null,
      data.acquisition_date ?? null,
      data.light_exposure,
      data.placement,
      data.pot_material ?? null,
      data.has_drainage ?? null,
      data.soil_type ?? null,
      data.indoor_climate ?? null,
      data.base_interval_days,
      data.min_interval_days,
      data.max_interval_days,
      data.photo_url ?? null,
    ],
  )
  return plant!
}

/**
 * The only column names updatePlant may interpolate into SQL. Interpolating
 * request-derived keys directly is an injection in the identifier position
 * (NFR-SEC-10: zero request-derived string interpolation into SQL) — values
 * being parameterised does not help there. user_id, id and timestamps are
 * deliberately absent: they are never client-writable (mass assignment).
 */
const UPDATABLE_PLANT_COLUMNS = new Set([
  'nickname',
  'species_id',
  'room',
  'acquisition_date',
  'light_exposure',
  'placement',
  'pot_material',
  'has_drainage',
  'soil_type',
  'indoor_climate',
  'base_interval_days',
  'min_interval_days',
  'max_interval_days',
  'photo_url',
])

export async function updatePlant(
  id: string,
  userId: string,
  data: Partial<CreatePlantData>,
): Promise<PlantRow | null> {
  const fields = Object.entries(data).filter(
    ([k, v]) => v !== undefined && UPDATABLE_PLANT_COLUMNS.has(k),
  )
  if (fields.length === 0) return getPlant(id, userId)

  const setClauses = fields.map(([k], i) => `${k}=$${i + 3}`).join(', ')
  const values = fields.map(([, v]) => v)

  const pool = getPool()
  const { rows } = await pool.query<PlantRow>(
    `UPDATE plants SET ${setClauses}, updated_at=now()
     WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL
     RETURNING ${PLANT_COLUMNS}`,
    [id, userId, ...values],
  )
  return rows[0] ?? null
}

export async function softDeletePlant(id: string, userId: string): Promise<boolean> {
  const pool = getPool()
  const { rowCount } = await pool.query(
    `UPDATE plants SET deleted_at=now() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,
    [id, userId],
  )
  return (rowCount ?? 0) > 0
}

export async function logCareEvent(
  userId: string,
  plantId: string,
  actionType: string,
  note: string | undefined,
  localDateStr: string,
  clientIdempotencyKey?: string,
): Promise<void> {
  await transaction(async (client) => {
    const { rows: [plant] } = await client.query<{
      base_interval_days: number
      min_interval_days: number
      max_interval_days: number
      light_exposure: string
      placement: string
      pot_material: string | null
      pot_diameter_cm: number | null
      soil_type: string | null
      indoor_climate: string | null
      has_drainage: boolean | null
      effective_interval_days: number | null
    }>(
      `SELECT base_interval_days, min_interval_days, max_interval_days, light_exposure,
              placement, pot_material, pot_diameter_cm, soil_type, indoor_climate,
              has_drainage, effective_interval_days
       FROM plants WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,
      [plantId, userId],
    )

    if (!plant) throw Object.assign(new Error('Plant not found'), { __notFound: true })

    const inserted = await client.query(
      `INSERT INTO plant_care_events
         (plant_id, user_id, action_type, note, local_date_str, interval_at_log_days, client_idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (client_idempotency_key) DO NOTHING`,
      [plantId, userId, actionType, note ?? null, localDateStr, plant.effective_interval_days ?? null, clientIdempotencyKey ?? null],
    )

    // Idempotent replay (same client key): the event already exists, so the
    // schedule side effect already ran — re-running it would push
    // next_water_due_at forward again on every outbox retry.
    if ((inserted.rowCount ?? 0) === 0) return

    if (actionType === 'WATER') {
      const season = seasonForLocalDate(localDateStr, 'NORTHERN') as Season
      const snapshot = computeWateringInterval({
        baseIntervalDays: plant.base_interval_days,
        minIntervalDays: plant.min_interval_days,
        maxIntervalDays: plant.max_interval_days,
        season,
        lightExposure: plant.light_exposure as LightExposure,
        placement: plant.placement as Placement,
        potMaterial: plant.pot_material as PotMaterial | null,
        potDiameterCm: plant.pot_diameter_cm,
        hasDrainage: plant.has_drainage,
        soilType: plant.soil_type as SoilType | null,
        indoorClimate: plant.indoor_climate as IndoorClimate | null,
      })

      await client.query(
        `UPDATE plants
         SET last_watered_at=now(),
             next_water_due_at=now() + ($1 || ' days')::interval,
             effective_interval_days=$1,
             watering_factor_snapshot=$2,
             updated_at=now()
         WHERE id=$3`,
        [snapshot.effectiveIntervalDays, JSON.stringify(snapshot), plantId],
      )
    }
  })
}

export async function listCareEvents(
  plantId: string,
  userId: string,
  limit = 50,
): Promise<CareEventRow[]> {
  const pool = getPool()
  const { rows } = await pool.query<CareEventRow>(
    `SELECT id, plant_id, user_id, action_type, note, logged_at_utc, local_date_str,
            interval_at_log_days, client_idempotency_key
     FROM plant_care_events WHERE plant_id=$1 AND user_id=$2 ORDER BY logged_at_utc DESC LIMIT $3`,
    [plantId, userId, limit],
  )
  return rows
}

/**
 * Explicit projection for growth entries. `deleted_at` is deliberately absent:
 * it is an internal tombstone marker, and a SELECT * here would start leaking
 * it — and anything added to the table later — into API responses.
 */
const GROWTH_COLUMNS = `id, plant_id, user_id, photo_url, photo_storage_key, height_cm, note,
  logged_at_utc, local_date_str, created_at`

/**
 * Per-plant ceiling on growth log entries.
 *
 * NFR-SCAL-03 fixes this at 40 ("Growth entries per plant | 40 | Server-side
 * count check at create | LIMIT_EXCEEDED"), and its conditions put
 * LIMIT_EXCEEDED at HTTP 409.
 *
 * The count is the only bound on this table: no rate limiter covers /api/v1
 * (rateLimit is mounted on /api/auth alone), so without it one authenticated
 * caller can append rows — a URL, a storage key and a note each — until the
 * ~0.5 GB free-tier database (CON-07) is full for the entire pilot cohort,
 * which is the consequence NFR-SCAL-03 exists to prevent.
 */
export const MAX_GROWTH_ENTRIES_PER_PLANT = 40

/**
 * Discriminated outcome rather than a bare null, mirroring createCustomFood:
 * hitting the ceiling is an expected product state with its own HTTP mapping,
 * and the controller owns the error envelope (FR-SYS-19).
 *
 * NOT_FOUND stays distinct from LIMIT_EXCEEDED because the two have different
 * recovery routes — one is "that plant is not yours", the other is "delete an
 * older photo" — and NFR-SCAL-03 forbids a silent refusal: the body must carry
 * the count and the ceiling (NFR-USAB-03).
 */
export type CreateGrowthEntryResult =
  | { status: 'CREATED'; entry: GrowthLogEntryRow }
  | { status: 'NOT_FOUND' }
  | { status: 'LIMIT_EXCEEDED'; current: number; ceiling: number }

/**
 * FR-PLT-20 — create a growth log entry.
 *
 * Ownership is the INSERT's own row source rather than a preceding read: the
 * predicate must run on the write itself (BR-PLT-36 cl.1), and folding it into
 * one statement closes the check-then-write window in which a concurrent plant
 * delete would let a child row land under a plant the caller no longer owns.
 *
 * The NFR-SCAL-03 ceiling rides in that same predicate for the same reason: a
 * count-then-insert pair would let two concurrent creates both read 39 and both
 * write. Sharing one statement and one snapshot narrows that to the genuinely
 * simultaneous case, which under READ COMMITTED still cannot be closed without
 * SERIALIZABLE or a counter table — not worth it for a storage-abuse guard that
 * may overshoot by the number of in-flight requests.
 *
 * The count excludes soft-deleted rows, so it matches listGrowthEntries'
 * predicate — and therefore idx_growth_plant, the partial index on exactly
 * that — and the ceiling counts what the timeline actually shows. Note this is
 * the opposite of createCustomFood, which counts tombstones because
 * NFR-SCAL-03's conditions clause says retained records still occupy storage;
 * here the 30-day purge, not this guard, is what reclaims a deleted entry.
 *
 * NOT_FOUND is returned when the plant is missing OR belongs to someone else —
 * the caller cannot tell the two apart, which is exactly BR-PLT-36 cl.3 (a
 * distinguishable response is an ownership oracle).
 *
 * The parameters carry explicit casts because they sit in a SELECT target list
 * rather than a VALUES row: there they have no target column to infer a type
 * from, and an uncast one risks "could not determine data type of parameter".
 */
export async function createGrowthEntry(
  userId: string,
  plantId: string,
  data: CreateGrowthEntryData,
): Promise<CreateGrowthEntryResult> {
  const pool = getPool()
  const { rows } = await pool.query<GrowthLogEntryRow>(
    `INSERT INTO growth_log_entries
       (plant_id, user_id, photo_url, photo_storage_key, height_cm, note, local_date_str)
     SELECT p.id, p.user_id, $3::text, $4::text, $5::numeric, $6::text, $7::text
       FROM plants p
      WHERE p.id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL
        AND (SELECT count(*) FROM growth_log_entries g
              WHERE g.plant_id=p.id AND g.deleted_at IS NULL) < $8::int
     RETURNING ${GROWTH_COLUMNS}`,
    [
      plantId,
      userId,
      data.photo_url,
      data.photo_storage_key,
      data.height_cm ?? null,
      data.note ?? null,
      data.local_date_str,
      MAX_GROWTH_ENTRIES_PER_PLANT,
    ],
  )

  const entry = rows[0]
  if (entry) return { status: 'CREATED', entry }

  // Zero rows means one of the two predicates was false, and the caller needs
  // them apart: 404 for a plant that is not the caller's, 409 for one that is
  // full. This second round-trip is confined to the cold path, and it repeats
  // the ownership predicate so a stranger's plant can never surface a count.
  const { rows: [state] } = await pool.query<{ current: number }>(
    `SELECT (SELECT count(*)::int FROM growth_log_entries g
              WHERE g.plant_id=p.id AND g.deleted_at IS NULL) AS current
       FROM plants p
      WHERE p.id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL`,
    [plantId, userId],
  )
  if (!state) return { status: 'NOT_FOUND' }

  return {
    status: 'LIMIT_EXCEEDED',
    current: state.current,
    ceiling: MAX_GROWTH_ENTRIES_PER_PLANT,
  }
}

/**
 * FR-PLT-21 — the plant's photo timeline.
 *
 * Newest-first and capped at the same 50 as listCareEvents: both back the same
 * plant-detail history list, so one convention on the wire. FR-PLT-21 asks for
 * an ascending presentation order — that is the client's render order, not the
 * transport order, and reversing 50 rows costs nothing there.
 *
 * `user_id` sits in the predicate alongside `plant_id` even though the two
 * always agree: child rows carry their own denormalised owner precisely so the
 * ownership test is a single indexed comparison and never depends on a join
 * someone might drop (domain model §ownership / BR-PLT-36 cl.1).
 *
 * `deleted_at IS NULL` matches idx_growth_plant, which is a partial index on
 * exactly that predicate.
 */
export async function listGrowthEntries(
  plantId: string,
  userId: string,
  limit = 50,
): Promise<GrowthLogEntryRow[]> {
  const pool = getPool()
  const { rows } = await pool.query<GrowthLogEntryRow>(
    `SELECT ${GROWTH_COLUMNS}
     FROM growth_log_entries
     WHERE plant_id=$1 AND user_id=$2 AND deleted_at IS NULL
     ORDER BY logged_at_utc DESC LIMIT $3`,
    [plantId, userId, limit],
  )
  return rows
}

/**
 * BR-PLT-24 cl.5 — deletion of a growth entry is soft.
 *
 * The row survives so delta sync can emit its tombstone and so the object
 * storage cleanup job can still find the orphaned photo to remove later; a hard
 * delete would strand the binary forever.
 *
 * `deleted_at IS NULL` makes a repeat delete match nothing and report false, so
 * the caller answers 404 instead of quietly re-stamping the tombstone with a
 * later timestamp and telling the client it deleted something twice.
 */
export async function softDeleteGrowthEntry(
  entryId: string,
  plantId: string,
  userId: string,
): Promise<boolean> {
  const pool = getPool()
  const { rowCount } = await pool.query(
    `UPDATE growth_log_entries SET deleted_at=now()
     WHERE id=$1 AND plant_id=$2 AND user_id=$3 AND deleted_at IS NULL`,
    [entryId, plantId, userId],
  )
  return (rowCount ?? 0) > 0
}

export async function listSpecies(search?: string): Promise<SpeciesRow[]> {
  const pool = getPool()
  if (search) {
    const { rows } = await pool.query<SpeciesRow>(
      `SELECT id, common_name, scientific_name, base_interval_days, min_interval_days,
              max_interval_days, default_light, default_soil, care_notes, image_url
       FROM species WHERE lower(common_name) ILIKE $1 AND NOT is_custom ORDER BY common_name LIMIT 200`,
      [`%${search.toLowerCase()}%`],
    )
    return rows
  }
  const { rows } = await pool.query<SpeciesRow>(
    `SELECT id, common_name, scientific_name, base_interval_days, min_interval_days,
            max_interval_days, default_light, default_soil, care_notes, image_url
     FROM species WHERE NOT is_custom ORDER BY common_name LIMIT 200`,
  )
  return rows
}
