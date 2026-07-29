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
