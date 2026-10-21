/**
 * Verification of the achievements screen (FR-GAM): streak ordering, locked and
 * unlocked states, empty and error states that fail independently.
 * Test IDs: TC-GAM-201 ..
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Streak, UserAchievement } from '../lib/achievementsApi'

const getAchievements = vi.fn()
const getStreaks = vi.fn()
const markSeen = vi.fn()
vi.mock('../lib/achievementsApi', () => ({
  getAchievements: () => getAchievements(),
  getStreaks: () => getStreaks(),
  markSeen: () => markSeen(),
}))
const { AchievementsPage } = await import('./AchievementsPage')

const ach = (over: Partial<UserAchievement['achievement']> & { unlocked?: boolean } = {}): UserAchievement => ({
  id: crypto.randomUUID(), achievement_id: crypto.randomUUID(),
  unlocked_at: over.unlocked ? '2026-07-01T10:00:00Z' : null, progress_pct: over.unlocked ? 100 : 0, seen_at: null,
  achievement: { id: 'a', code: over.code ?? 'X', name: over.name ?? 'Badge', description: over.description ?? 'desc', module: over.module ?? 'FITNESS', icon: null, tier: over.tier ?? 'BRONZE', points: 10, is_active: true },
})
const streak = (type: Streak['streak_type'], cur: number, longest: number): Streak => ({ streak_type: type, current_length: cur, longest_length: longest, last_counted_date: null, freeze_tokens: 0 })

describe('AchievementsPage', () => {
  beforeEach(() => {
    getAchievements.mockReset().mockResolvedValue([])
    getStreaks.mockReset().mockResolvedValue([])
    markSeen.mockReset().mockResolvedValue(undefined)
  })

  it('TC-GAM-201 shows the page heading', async () => {
    render(<AchievementsPage />)
    expect(await screen.findByRole('heading', { name: 'Achievements' })).toBeInTheDocument()
  })

  it('TC-GAM-202 with no streaks it explains how to start one', async () => {
    render(<AchievementsPage />)
    expect(await screen.findByText(/No streaks yet/)).toBeInTheDocument()
  })

  it('TC-GAM-203 streaks are shown Overall first, then plant care, fitness, nutrition, whatever order the server sends', async () => {
    getStreaks.mockResolvedValue([streak('NUTRITION', 1, 1), streak('FITNESS', 2, 2), streak('OVERALL', 5, 9), streak('PLANT_CARE', 3, 3)])
    render(<AchievementsPage />)
    const region = await screen.findByRole('region', { name: 'Streaks' })
    await waitFor(() => expect(within(region).getByText('Overall')).toBeInTheDocument())
    const labels = within(region).getAllByText(/^(Overall|Plant care|Fitness|Nutrition)$/).map((n) => n.textContent)
    expect(labels).toEqual(['Overall', 'Plant care', 'Fitness', 'Nutrition'])
  })

  it('TC-GAM-204 each streak shows the current and the longest length', async () => {
    getStreaks.mockResolvedValue([streak('OVERALL', 5, 9)])
    render(<AchievementsPage />)
    expect(await screen.findByText(/longest 9/)).toBeInTheDocument()
  })

  it('TC-GAM-205 a failing streak request shows its own error and the badge grid is unaffected', async () => {
    getStreaks.mockRejectedValue(new Error('x'))
    getAchievements.mockResolvedValue([ach({ name: 'First Steps', unlocked: true })])
    render(<AchievementsPage />)
    expect(await screen.findByText("Couldn't load streaks")).toBeInTheDocument()
    expect(await screen.findByText('First Steps')).toBeInTheDocument()
  })

  it('TC-GAM-206 retrying after a streak failure reloads and shows the streaks', async () => {
    getStreaks.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([streak('OVERALL', 4, 4)])
    render(<AchievementsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /try again|retry/i }))
    expect(await screen.findByText(/longest 4/)).toBeInTheDocument()
  })

  it('TC-GAM-207 a failing badge request shows its own error and the streaks are unaffected', async () => {
    getAchievements.mockRejectedValue(new Error('x'))
    getStreaks.mockResolvedValue([streak('OVERALL', 2, 2)])
    render(<AchievementsPage />)
    expect(await screen.findByText(/longest 2/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0))
  })

  it('TC-GAM-208 unlocked and locked badges are both listed with their names', async () => {
    getAchievements.mockResolvedValue([ach({ name: 'Green Thumb', unlocked: true }), ach({ name: 'Iron Will', unlocked: false })])
    render(<AchievementsPage />)
    expect(await screen.findByText('Green Thumb')).toBeInTheDocument()
    expect(screen.getByText('Iron Will')).toBeInTheDocument()
  })

  it('TC-GAM-209 loading the badges marks them seen exactly once', async () => {
    getAchievements.mockResolvedValue([ach({ unlocked: true })])
    render(<AchievementsPage />)
    await waitFor(() => expect(markSeen).toHaveBeenCalledTimes(1))
  })

  it('TC-GAM-210 a failure to mark badges seen is silent (pure bookkeeping)', async () => {
    markSeen.mockRejectedValue(new Error('x'))
    getAchievements.mockResolvedValue([ach({ name: 'Quiet Success', unlocked: true })])
    render(<AchievementsPage />)
    expect(await screen.findByText('Quiet Success')).toBeInTheDocument()
    expect(screen.queryByText(/couldn't load/i)).not.toBeInTheDocument()
  })

  it('TC-GAM-211 an unknown streak type is shown under its raw name instead of being dropped', async () => {
    getStreaks.mockResolvedValue([{ ...streak('OVERALL', 1, 1), streak_type: 'SLEEP' as Streak['streak_type'] }])
    render(<AchievementsPage />)
    expect(await screen.findByText('SLEEP')).toBeInTheDocument()
  })
})
