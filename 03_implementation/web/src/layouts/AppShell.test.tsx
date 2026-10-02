/**
 * Shell behaviour: module gating (a disabled module must not leave a reachable
 * tab), the skip link, and focus moving to the content region on navigation.
 * These are the promises the navigation makes to keyboard users and to anyone
 * who switched a module off.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UserSettings } from '../lib/settingsApi'

const logout = vi.fn().mockResolvedValue(undefined)
let settingsValue: UserSettings | null = null

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'gardener@example.com' },
    logout,
    isAuthenticated: true,
    isLoading: false,
  }),
}))

vi.mock('../settings/SettingsContext', () => ({
  useSettings: () => ({
    settings: settingsValue,
    loading: false,
    loadError: false,
    reload: vi.fn(),
    update: vi.fn(),
  }),
}))

const { AppShell } = await import('./AppShell')

function renderShell(initial = '/', children?: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<h1>{children ?? 'Dashboard page'}</h1>} />
          <Route path="/plants" element={<h1>Plants page</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function settings(overrides: Partial<UserSettings>): UserSettings {
  return {
    plant_care_enabled: true,
    fitness_enabled: true,
    nutrition_enabled: true,
    ...overrides,
  } as UserSettings
}

describe('AppShell', () => {
  beforeEach(() => {
    settingsValue = null
    logout.mockClear()
  })

  it('shows every tab while settings are still loading (fail-open)', () => {
    renderShell()
    const nav = screen.getAllByRole('navigation', { name: 'Primary' })[0]!
    expect(nav).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Plants' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Fitness' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Nutrition' }).length).toBeGreaterThan(0)
  })

  it('hides the tabs of disabled modules in both the sidebar and the bottom bar', () => {
    settingsValue = settings({ fitness_enabled: false })
    renderShell()
    expect(screen.queryAllByRole('link', { name: 'Fitness' })).toHaveLength(0)
    // Nutrition stays: gating is per module, not all-or-nothing.
    expect(screen.getAllByRole('link', { name: 'Nutrition' }).length).toBeGreaterThan(0)
  })

  it('hides the Plants tab when plant care is disabled', () => {
    settingsValue = settings({ plant_care_enabled: false })
    renderShell()
    expect(screen.queryAllByRole('link', { name: 'Plants' })).toHaveLength(0)
    // The unmoduled tabs and the other modules are untouched.
    expect(screen.getAllByRole('link', { name: 'Dashboard' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Fitness' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Nutrition' }).length).toBeGreaterThan(0)
  })

  it('hides the Nutrition tab when nutrition is disabled', () => {
    settingsValue = settings({ nutrition_enabled: false })
    renderShell()
    expect(screen.queryAllByRole('link', { name: 'Nutrition' })).toHaveLength(0)
    expect(screen.getAllByRole('link', { name: 'Plants' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Fitness' }).length).toBeGreaterThan(0)
  })

  it('keeps a tab bar even with only one module enabled (Invariant 34 floor)', () => {
    settingsValue = settings({ fitness_enabled: false, nutrition_enabled: false })
    renderShell()
    expect(screen.getAllByRole('link', { name: 'Plants' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Settings' }).length).toBeGreaterThan(0)
  })

  it('offers a skip link that targets the content region', () => {
    renderShell()
    const skip = screen.getByRole('link', { name: /skip to content/i })
    expect(skip).toHaveAttribute('href', '#main')
    expect(document.getElementById('main')).toBeInTheDocument()
  })

  it('moves focus to the content region after navigating', async () => {
    const user = userEvent.setup()
    renderShell()
    const main = document.getElementById('main')!
    expect(main).not.toHaveFocus()

    await user.click(screen.getAllByRole('link', { name: 'Plants' })[0]!)
    expect(await screen.findByText('Plants page')).toBeInTheDocument()
    await waitFor(() => expect(main).toHaveFocus())
  })
})
