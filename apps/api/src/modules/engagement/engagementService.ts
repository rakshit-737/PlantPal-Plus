/**
 * Engagement service — streak advancement and achievement unlocking, invoked
 * after every successful qualifying log (BR-GAM-07, BR-GAM-10).
 *
 * Design notes:
 * - The transition arithmetic lives in @plantpal/shared (advanceStreakOnLog):
 *   one implementation, three clients (NFR-MAIN-03). This module only moves
 *   state between PostgreSQL and that pure function.
 * - The OVERALL streak advances when all three module scopes have counted
 *   today. v1.0 treats every module as enabled; the BR-GAM-05/06 per-module
 *   enablement predicate joins when user settings ship.
 * - Engagement is deliberately non-fatal: a failure here must never fail the
 *   log write it decorates. Callers use recordDailyLogSafe.
 */

import { advanceStreakOnLog, type StreakState } from '@plantpal/shared'

import { transaction } from '../../db/pool.js'
import { logger } from '../../logging.js'
import type { PoolClient } from 'pg'

export type ModuleScope = 'PLANT_CARE' | 'FITNESS' | 'NUTRITION'

interface StreakRow {
  current_length: number
  longest_length: number
  last_counted_date: string | null
  freeze_tokens: number
}

function toState(row: StreakRow | undefined): StreakState {
  return {
    currentLength: row?.current_length ?? 0,
    longestLength: row?.longest_length ?? 0,
    lastCountedDate: row?.last_counted_date ?? null,
    freezeTokens: row?.freeze_tokens ?? 0,
  }
}

/**
 * Load-or-create a streak row under FOR UPDATE, advance it through the shared
 * transition, and write it back. Returns the new state.
 */
async function advanceScope(
  client: PoolClient,
  userId: string,
  scope: ModuleScope | 'OVERALL',
  localDateStr: string,
): Promise<StreakState> {
  await client.query(
    `insert into streaks (user_id, streak_type)
     values ($1, $2)
     on conflict (user_id, streak_type) do nothing`,
    [userId, scope],
  )
  const { rows } = await client.query<StreakRow>(
    `select current_length, longest_length, last_counted_date, freeze_tokens
     from streaks
     where user_id = $1 and streak_type = $2
     for update`,
    [userId, scope],
  )
  const next = advanceStreakOnLog(toState(rows[0]), localDateStr)
  await client.query(
    `update streaks
     set current_length = $3, longest_length = $4, last_counted_date = $5,
         freeze_tokens = $6, updated_at = now()
     where user_id = $1 and streak_type = $2`,
    [userId, scope, next.currentLength, next.longestLength, next.lastCountedDate, next.freezeTokens],
  )
  return next
}

/**
 * The metric vocabulary of the seeded achievement criteria
 * (003-achievements.sql). Each entry computes the caller's current value.
 */
const METRIC_SQL: Record<string, string> = {
  plants_added: `select count(*)::int as v from plants where user_id = $1`,
  active_plants: `select count(*)::int as v from plants where user_id = $1 and deleted_at is null`,
  waterings_logged: `select count(*)::int as v from plant_care_events where user_id = $1 and action_type = 'WATER'`,
  workouts_logged: `select count(*)::int as v from workouts where user_id = $1 and deleted_at is null`,
  steps_in_day: `select coalesce(max(daily.steps), 0)::int as v from (
                   select sum(steps) as steps from workouts
                   where user_id = $1 and deleted_at is null group by local_date_str
                 ) daily`,
  total_volume_kg: `select coalesce(sum(total_volume_kg), 0)::float8 as v from workouts where user_id = $1 and deleted_at is null`,
  meals_logged: `select count(*)::int as v from meals where user_id = $1 and deleted_at is null`,
  hydration_goals_met: `select count(*)::int as v from (
                          select local_date_str from water_logs
                          where user_id = $1
                          group by local_date_str
                          having sum(amount_ml) >= coalesce(max(goal_ml_at_log), 2000)
                        ) met_days`,
  plant_care_streak: `select coalesce(max(current_length), 0)::int as v from streaks where user_id = $1 and streak_type = 'PLANT_CARE'`,
  fitness_streak: `select coalesce(max(current_length), 0)::int as v from streaks where user_id = $1 and streak_type = 'FITNESS'`,
  nutrition_streak: `select coalesce(max(current_length), 0)::int as v from streaks where user_id = $1 and streak_type = 'NUTRITION'`,
  overall_streak: `select coalesce(max(current_length), 0)::int as v from streaks where user_id = $1 and streak_type = 'OVERALL'`,
  all_modules_in_day: `select case when exists (
                         select 1
                         from streaks p, streaks f, streaks n
                         where p.user_id = $1 and p.streak_type = 'PLANT_CARE'
                           and f.user_id = $1 and f.streak_type = 'FITNESS'
                           and n.user_id = $1 and n.streak_type = 'NUTRITION'
                           and p.last_counted_date is not null
                           and p.last_counted_date = f.last_counted_date
                           and f.last_counted_date = n.last_counted_date
                       ) then 1 else 0 end as v`,
}

export interface UnlockCandidate {
  id: string
  code: string
  metric: string
  gte: number
}

/** Pure: which candidates unlock given the computed metric values. */
export function evaluateUnlocks(
  candidates: UnlockCandidate[],
  metrics: ReadonlyMap<string, number>,
): UnlockCandidate[] {
  return candidates.filter((c) => {
    const value = metrics.get(c.metric)
    return value !== undefined && value >= c.gte
  })
}

/**
 * Evaluate all still-locked achievements for the user and unlock any whose
 * declarative criteria ({ metric, gte }) are now satisfied. Unlocking is
 * idempotent by the (user_id, achievement_id) unique constraint.
 */
async function evaluateAchievements(client: PoolClient, userId: string): Promise<string[]> {
  const { rows } = await client.query<{ id: string; code: string; criteria: unknown }>(
    `select a.id, a.code, a.criteria
     from achievements a
     where a.is_active
       and not exists (
         select 1 from user_achievements ua
         where ua.user_id = $1 and ua.achievement_id = a.id and ua.unlocked_at is not null
       )`,
    [userId],
  )

  const candidates: UnlockCandidate[] = []
  for (const row of rows) {
    const c = row.criteria as { metric?: unknown; gte?: unknown }
    if (typeof c?.metric === 'string' && typeof c?.gte === 'number' && METRIC_SQL[c.metric]) {
      candidates.push({ id: row.id, code: row.code, metric: c.metric, gte: c.gte })
    }
  }
  if (candidates.length === 0) return []

  const metrics = new Map<string, number>()
  for (const metric of new Set(candidates.map((c) => c.metric))) {
    const sql = METRIC_SQL[metric]
    if (!sql) continue
    const { rows: valueRows } = await client.query<{ v: number }>(sql, [userId])
    metrics.set(metric, Number(valueRows[0]?.v ?? 0))
  }

  const unlocked = evaluateUnlocks(candidates, metrics)
  for (const u of unlocked) {
    await client.query(
      `insert into user_achievements (user_id, achievement_id, unlocked_at, progress_pct)
       values ($1, $2, now(), 100)
       on conflict (user_id, achievement_id)
       do update set unlocked_at = coalesce(user_achievements.unlocked_at, now()), progress_pct = 100`,
      [userId, u.id],
    )
  }
  return unlocked.map((u) => u.code)
}

/**
 * Day-complete predicates (BR-GAM-02/03/04), evaluated eagerly after a log:
 * - PLANT_CARE: nothing is overdue ("nothing pending on or before D"), not
 *   "something was logged today" — intervals range 2–30 days
 * - FITNESS: one workout ≥ 10 minutes, or the day's step total ≥ 8000
 *   (the default goal; per-session floor, short workouts do not sum)
 * - NUTRITION: at least 2 meal entries for the day; water never satisfies it,
 *   and the criterion measures logging, never intake (D-07)
 */
const PREDICATE_SQL: Record<ModuleScope, string> = {
  PLANT_CARE: `select (not exists (
                 select 1 from plants p
                 where p.user_id = $1 and p.deleted_at is null
                   and p.next_water_due_at is not null
                   -- The due instant is converted into the user's own
                   -- timezone before taking its calendar date: a UTC cast
                   -- flips the verdict near midnight for non-UTC users.
                   and (p.next_water_due_at at time zone coalesce(
                          (select timezone from user_settings where user_id = $1), 'UTC'
                        ))::date <= $2::date
               )) as met`,
  FITNESS: `select (
              exists (
                select 1 from workouts
                where user_id = $1 and local_date_str = $2 and deleted_at is null
                  and duration_mins >= 10
              )
              or coalesce((
                select sum(steps) from workouts
                where user_id = $1 and local_date_str = $2 and deleted_at is null
              ), 0) >= 8000
            ) as met`,
  NUTRITION: `select (count(*) >= 2) as met
              from meals
              where user_id = $1 and local_date_str = $2 and deleted_at is null`,
}

/**
 * Evaluate the day-complete predicate for `scope`; when it holds, advance the
 * module streak, advance OVERALL when all three modules counted today, then
 * run the unlock evaluator. Achievements are evaluated even when the day is
 * not yet MET — count-based metrics (waterings_logged, meals_logged) move on
 * every log regardless of the day predicate.
 */
export async function recordDailyLog(
  userId: string,
  scope: ModuleScope,
  localDateStr: string,
): Promise<{ met: boolean; unlocked: string[] }> {
  return transaction(async (client) => {
    const { rows: predicateRows } = await client.query<{ met: boolean }>(
      PREDICATE_SQL[scope],
      [userId, localDateStr],
    )
    const met = predicateRows[0]?.met === true

    if (met) {
      await advanceScope(client, userId, scope, localDateStr)

      // Serialise the OVERALL decision: without FOR UPDATE two concurrent
      // logs (one per scope) can each read the other's row as uncounted,
      // both skip OVERALL, and the day is lost. The ORDER BY gives every
      // transaction the same lock order, so they queue instead of deadlock.
      const { rows } = await client.query<{ streak_type: string; last_counted_date: string | null }>(
        `select streak_type, last_counted_date from streaks
         where user_id = $1 and streak_type in ('PLANT_CARE', 'FITNESS', 'NUTRITION')
         order by streak_type
         for update`,
        [userId],
      )
      const allMetToday =
        rows.length === 3 && rows.every((r) => r.last_counted_date === localDateStr)
      if (allMetToday) {
        await advanceScope(client, userId, 'OVERALL', localDateStr)
      }
    }

    const unlocked = await evaluateAchievements(client, userId)
    return { met, unlocked }
  })
}

/**
 * Evaluate achievements without advancing any streak — for logs that feed
 * metrics but no day predicate (water: hydration_goals_met, BR-GAM-04 rules
 * water out of the nutrition predicate). Non-fatal like recordDailyLogSafe.
 */
export async function evaluateAchievementsSafe(userId: string): Promise<void> {
  try {
    const unlocked = await transaction((client) => evaluateAchievements(client, userId))
    if (unlocked.length > 0) {
      logger.info({ userId, unlocked }, 'achievements unlocked')
    }
  } catch (err) {
    logger.warn({ err, userId }, 'achievement evaluation failed (log write unaffected)')
  }
}

/** Non-fatal wrapper: engagement must never fail the log write it decorates. */
export async function recordDailyLogSafe(
  userId: string,
  scope: ModuleScope,
  localDateStr: string,
): Promise<void> {
  try {
    const { met, unlocked } = await recordDailyLog(userId, scope, localDateStr)
    if (unlocked.length > 0) {
      logger.info({ userId, scope, met, unlocked }, 'achievements unlocked')
    }
  } catch (err) {
    logger.warn({ err, userId, scope }, 'engagement update failed (log write unaffected)')
  }
}
