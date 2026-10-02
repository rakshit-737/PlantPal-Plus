import { apiRequest } from './apiClient'

export interface DashboardData {
  streak: { current: number; longest: number }
  plants: { due_today: number; overdue: number }
  fitness: { steps: number; goal: number }
  nutrition: { calories_consumed: number; target: number }
  today_list: { type: string; id: string; title: string }[]
}

export const getDashboard = (date?: string) =>
  apiRequest<DashboardData>(`/v1/dashboard${date ? `?date=${date}` : ''}`)
