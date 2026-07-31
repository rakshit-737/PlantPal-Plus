/**
 * Onboarding behaviour: the at-least-one-module rule (Invariant 34) is enforced
 * before the flow can advance, moving between the two steps keeps every answer,
 * and Finish writes exactly the fields the user chose — no invented settings.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UserSettings } from '../lib/settingsApi'

const update = vi.fn()
const reload = vi.fn()
let settingsValue: UserSettings | null = null
let loading = false
let loadError = false

vi.mock('../settings/SettingsContext', () => ({
  useSettings: () => ({ settings: settingsValue, loading, loadError, reload, update }),
}))

const { OnboardingPage } = await import('./OnboardingPage')

function stored(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    timezone: 'Asia/Kolkata',
    hemisphere: 'NORTHERN',
    locale: 'en-IN',
    unit_system: 'METRIC',
    theme: 'SYSTEM',
    week_start_day: 'MONDAY',
    plant_care_enabled: true,
    fitness_enabled: true,
    nutrition_enabled: true,
    quiet_hours_mode: 'OFF',
    quiet_start_time: null,
    quiet_end_time: null,
    daily_notification_cap: 5,
    reduce_motion: false,
    larger_text: false,
    high_contrast: false,
    analytics_opt_in: false,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<h1>Dashboard page</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

const next = () => screen.getByRole('button', { name: 'Next' })
const back = () => screen.getByRole('button', { name: 'Back' })
const moduleSwitch = (name: string) => screen.getByRole('switch', { name })

describe('OnboardingPage', () => {
  beforeEach(() => {
    settingsValue = stored()
    loading = false
    loadError = false
    update.mockReset().mockResolvedValue(undefined)
    reload.mockReset()
  })

  it('starts on step 1 with the stored modules already reflected', () => {
    settingsValue = stored({ nutrition_enabled: false })
    renderPage()
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument()
    expect(moduleSwitch('Plant care')).toHaveAttribute('aria-checked', 'true')
    expect(moduleSwitch('Nutrition')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('2 of 3 tracked')).toBeInTheDocument()
  })

  it('refuses to advance while no module is tracked, and says so', async () => {
    const user = userEvent.setup()
    renderPage()

    for (const name of ['Plant care', 'Fitness', 'Nutrition']) {
      await user.click(moduleSwitch(name))
    }
    expect(screen.getByRole('alert')).toHaveTextContent(/at least one module/i)

    await user.click(next())
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument()

    // Turning one back on clears the message and unblocks the step.
    await user.click(moduleSwitch('Plant care'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(next())
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument()
  })

  it('keeps every choice when stepping forward and back', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(moduleSwitch('Fitness'))
    await user.click(next())

    await user.selectOptions(screen.getByLabelText('Hemisphere'), 'SOUTHERN')
    await user.click(back())

    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument()
    expect(moduleSwitch('Fitness')).toHaveAttribute('aria-checked', 'false')
    expect(moduleSwitch('Plant care')).toHaveAttribute('aria-checked', 'true')

    await user.click(next())
    expect(screen.getByLabelText('Hemisphere')).toHaveValue('SOUTHERN')
  })

  it('saves exactly the chosen fields on Finish, then goes to the dashboard', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(moduleSwitch('Nutrition'))
    await user.click(next())
    await user.selectOptions(screen.getByLabelText('Hemisphere'), 'SOUTHERN')
    await user.selectOptions(screen.getByLabelText('Week starts on'), 'SUNDAY')
    await user.selectOptions(screen.getByLabelText('Units'), 'IMPERIAL')
    await user.click(screen.getByRole('button', { name: 'Finish' }))

    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({
      plant_care_enabled: true,
      fitness_enabled: true,
      nutrition_enabled: false,
      hemisphere: 'SOUTHERN',
      week_start_day: 'SUNDAY',
      unit_system: 'IMPERIAL',
    })
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument()
  })

  it('explains a failed save and stays on step 2 so Finish can be retried', async () => {
    const user = userEvent.setup()
    update.mockRejectedValue(new Error('boom'))
    renderPage()

    await user.click(next())
    await user.click(screen.getByRole('button', { name: 'Finish' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/press Finish again/i)
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument()
  })

  it('skips without writing anything', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Skip for now' }))

    expect(update).not.toHaveBeenCalled()
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument()
  })

  it('offers a retry instead of a blank form when settings fail to load', async () => {
    const user = userEvent.setup()
    settingsValue = null
    loadError = true
    renderPage()

    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
