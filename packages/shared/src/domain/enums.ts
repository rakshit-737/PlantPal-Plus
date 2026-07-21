/**
 * Every enumeration the three modules must agree on exactly.
 *
 * The Phase 1 domain model (07-domain-model.md section 6) is the single source
 * of truth for these member lists. They live here rather than in each app so
 * that a value can never drift between the backend, the website and the mobile
 * client.
 *
 * Declared as frozen const objects plus derived union types rather than
 * TypeScript `enum`, because `enum` emits a runtime construct that does not
 * survive `isolatedModules` cleanly and cannot be consumed as a plain value by
 * the React Native bundler.
 */

function asEnum<const T extends readonly string[]>(...members: T): Readonly<{ [K in T[number]]: K }> {
  return Object.freeze(
    Object.fromEntries(members.map((m) => [m, m])) as { [K in T[number]]: K },
  )
}

/* ------------------------------------------------------------------ shared */

export const Hemisphere = asEnum('NORTHERN', 'SOUTHERN', 'EQUATORIAL')
export type Hemisphere = keyof typeof Hemisphere

export const Season = asEnum('SPRING', 'SUMMER', 'AUTUMN', 'WINTER', 'YEAR_ROUND')
export type Season = keyof typeof Season

export const UnitSystem = asEnum('METRIC', 'IMPERIAL')
export type UnitSystem = keyof typeof UnitSystem

/* -------------------------------------------------------------- plant care */

export const LightExposure = asEnum('LOW', 'MEDIUM', 'BRIGHT_INDIRECT', 'DIRECT_SUN')
export type LightExposure = keyof typeof LightExposure

export const PotMaterial = asEnum(
  'FABRIC',
  'TERRACOTTA',
  'CONCRETE',
  'CERAMIC_GLAZED',
  'METAL',
  'PLASTIC',
  'OTHER',
)
export type PotMaterial = keyof typeof PotMaterial

export const SoilType = asEnum(
  'ORCHID_BARK',
  'CACTUS_SUCCULENT',
  'GARDEN_SOIL',
  'STANDARD_POTTING',
  'PEAT_BASED',
  'COCO_COIR',
  'SEMI_HYDRO_LECA',
  'OTHER',
)
export type SoilType = keyof typeof SoilType

export const Placement = asEnum('INDOOR', 'OUTDOOR')
export type Placement = keyof typeof Placement

export const IndoorClimate = asEnum('NONE', 'HEATED_DRY_WINTER', 'AIR_CONDITIONED', 'HUMID_ROOM')
export type IndoorClimate = keyof typeof IndoorClimate

export const PlantHealthStatus = asEnum('THRIVING', 'NEEDS_ATTENTION', 'CRITICAL', 'DORMANT')
export type PlantHealthStatus = keyof typeof PlantHealthStatus

/* ----------------------------------------------------------------- fitness */

export const ActivityTypeCode = asEnum(
  'WALK',
  'RUN',
  'CYCLE',
  'SWIM',
  'STRENGTH',
  'YOGA',
  'HIIT',
  'SPORT',
  'OTHER',
)
export type ActivityTypeCode = keyof typeof ActivityTypeCode

export const PerceivedIntensity = asEnum('LOW', 'MODERATE', 'VIGOROUS')
export type PerceivedIntensity = keyof typeof PerceivedIntensity

export const PersonalRecordType = asEnum('HEAVIEST_WEIGHT', 'BEST_ESTIMATED_1RM', 'BEST_REP_COUNT')
export type PersonalRecordType = keyof typeof PersonalRecordType

/* --------------------------------------------------------------- nutrition */

export const MealType = asEnum('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK')
export type MealType = keyof typeof MealType

export const BiologicalSex = asEnum('MALE', 'FEMALE', 'PREFER_NOT_TO_SAY')
export type BiologicalSex = keyof typeof BiologicalSex

export const ActivityLevel = asEnum(
  'SEDENTARY',
  'LIGHTLY_ACTIVE',
  'MODERATELY_ACTIVE',
  'VERY_ACTIVE',
  'EXTRA_ACTIVE',
)
export type ActivityLevel = keyof typeof ActivityLevel

export const NutritionGoal = asEnum('LOSE', 'MAINTAIN', 'GAIN')
export type NutritionGoal = keyof typeof NutritionGoal

export const ServingUnit = asEnum(
  'GRAM',
  'MILLILITRE',
  'PIECE',
  'CUP',
  'TABLESPOON',
  'SLICE',
  'CUSTOM',
)
export type ServingUnit = keyof typeof ServingUnit

/* ----------------------------------------------------- platform and sync */

export const SyncState = asEnum('SYNCED', 'PENDING', 'SYNCING', 'FAILED')
export type SyncState = keyof typeof SyncState

export const DeliveryStatus = asEnum(
  'PENDING',
  'SENT',
  'DELIVERED',
  'FAILED',
  'SUPPRESSED',
  'CANCELLED',
)
export type DeliveryStatus = keyof typeof DeliveryStatus
