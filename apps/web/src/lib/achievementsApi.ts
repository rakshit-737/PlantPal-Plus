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

export const getAchievements = () => apiRequest<UserAchievement[]>('/v1/achievements')
