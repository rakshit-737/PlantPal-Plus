import { apiRequest } from './apiClient'

export interface Achievement {
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

export interface UserAchievement {
  id: string
  achievement_id: string
  unlocked_at: string | null
  progress_pct: number
  seen_at: string | null
  achievement: Achievement
}

/**
 * One streak row per module plus OVERALL (BR-GAM-04). freeze_tokens are the
 * BR-GAM-07 "freeze days": each one spares a single missed day before the
 * current streak resets.
 */
export interface Streak {
  streak_type: 'PLANT_CARE' | 'FITNESS' | 'NUTRITION' | 'OVERALL'
  current_length: number
  longest_length: number
  /** Last local day (YYYY-MM-DD) that counted toward the streak. */
  last_counted_date: string | null
  freeze_tokens: number
}

export const getAchievements = () => apiRequest<UserAchievement[]>('/v1/achievements')

/** All of the caller's streak rows, unwrapped from the { streaks } envelope. */
export const getStreaks = () =>
  apiRequest<{ streaks: Streak[] }>('/v1/achievements/streaks').then((body) => body.streaks)

/**
 * Stamp seen_at on unlocked-but-unseen achievements so "new badge" indicators
 * clear. Idempotent; returns how many rows were stamped.
 */
export const markSeen = () =>
  apiRequest<{ marked_seen: number }>('/v1/achievements/seen', { method: 'POST' })
