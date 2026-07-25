/**
 * Achievements repository — ENT-22 (Achievement), ENT-23 (UserAchievement),
 * ENT-21 (Streak).
 *
 * References: modules/gamification.md, migrations/005-engagement-schema.sql.
 *
 * The list endpoint returns the FULL active catalogue with the caller's unlock
 * state joined on, not just unlocked rows: the UI renders locked badges greyed
 * out (BR-GAM-10 — the catalogue is discoverable, not a surprise). A user with
 * no user_achievements rows still sees every badge at progress 0.
 */

import { getPool } from '../../db/pool.js'

export interface AchievementView {
  id: string
  code: string
  name: string
  description: string
  module: string
  icon: string | null
  tier: string
  points: number
  is_active: boolean
}

export interface UserAchievementView {
  /** user_achievements.id when a row exists, else the achievement id (stable key for the UI). */
  id: string
  achievement_id: string
  unlocked_at: string | null
  progress_pct: number
  seen_at: string | null
  achievement: AchievementView
}

interface JoinedRow {
  a_id: string
  code: string
  name: string
  description: string
  module: string
  icon: string | null
  tier: string
  points: number
  is_active: boolean
  ua_id: string | null
  unlocked_at: string | null
  progress_pct: number | null
  seen_at: string | null
}

export async function listForUser(userId: string): Promise<UserAchievementView[]> {
  const pool = getPool()
  const { rows } = await pool.query<JoinedRow>(
    `select a.id as a_id, a.code, a.name, a.description, a.module, a.icon,
            a.tier, a.points, a.is_active,
            ua.id as ua_id, ua.unlocked_at, ua.progress_pct, ua.seen_at
     from achievements a
     left join user_achievements ua
       on ua.achievement_id = a.id and ua.user_id = $1
     where a.is_active
     order by a.module, a.points, a.name`,
    [userId],
  )

  return rows.map((r) => ({
    id: r.ua_id ?? r.a_id,
    achievement_id: r.a_id,
    // A user_achievements row tracks progress before unlock; unlocked_at is
    // null until progress hits 100 (005-engagement-schema.sql).
    unlocked_at: r.unlocked_at,
    progress_pct: r.ua_id ? (r.progress_pct ?? 0) : 0,
    seen_at: r.seen_at,
    achievement: {
      id: r.a_id,
      code: r.code,
      name: r.name,
      description: r.description,
      module: r.module,
      icon: r.icon,
      tier: r.tier,
      points: r.points,
      is_active: r.is_active,
    },
  }))
}

export interface StreakView {
  streak_type: string
  current_length: number
  longest_length: number
  last_counted_date: string | null
  freeze_tokens: number
}

/** All of a user's streak rows (BR-GAM-04: one per module plus OVERALL). */
export async function listStreaks(userId: string): Promise<StreakView[]> {
  const pool = getPool()
  const { rows } = await pool.query<StreakView>(
    `select streak_type, current_length, longest_length, last_counted_date, freeze_tokens
     from streaks
     where user_id = $1
     order by streak_type`,
    [userId],
  )
  return rows
}

/**
 * Mark unlocked achievements as seen, so the "new badge" indicator clears.
 * Idempotent: only stamps rows that are unlocked and not yet seen.
 */
export async function markSeen(userId: string): Promise<number> {
  const pool = getPool()
  const result = await pool.query(
    `update user_achievements
     set seen_at = now()
     where user_id = $1 and unlocked_at is not null and seen_at is null`,
    [userId],
  )
  return result.rowCount ?? 0
}
