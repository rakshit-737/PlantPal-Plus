/**
 * Dashboard behaviour, and specifically the promise this page makes about
 * failure: it fetches two things independently, and a failure in either must
 * announce itself rather than quietly rendering as nothing to do.
 *
 * These assertions are written to fail when the behaviour breaks, not merely
 * when the page stops rendering. Where a test names a relationship — this
 * number belongs to that label, this failure suppresses that section — it
 * asserts the relationship, because an existence check passes just as happily
 * when two values have been swapped.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '../components/ui'
import type { DashboardData } from '../lib/dashboardApi'
import type { Reminder } from '../lib/remindersApi'
import type { UserSettings } from '../lib/settingsApi'

const getDashboard = vi.fn()
const listReminders = vi.fn()
const dismissReminder = vi.fn()
const logCare = vi.fn()
let settingsValue: UserSettings | null = null

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'gardener@example.com' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
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

// The factories are typed against the modules they replace. Without the
// annotation a renamed or deleted export leaves this file compiling green
// against an API that no longer exists.
vi.mock('../lib/dashboardApi', (): typeof import('../lib/dashboardApi') => ({
  getDashboard: (...a) => getDashboard(...a),
}))
vi.mock('../lib/remindersApi', (): typeof import('../lib/remindersApi') => ({
  listReminders: (...a) => listReminders(...a),
  dismissReminder: (...a) => dismissReminder(...a),
}))
vi.mock('../lib/plantsApi', async () => {
  const actual = await vi.importActual<typeof import('../lib/plantsApi')>('../lib/plantsApi')
  return { ...actual, logCare: (...a: Parameters<typeof actual.logCare>) => logCare(...a) }
})

const { DashboardPage } = await import('./DashboardPage')

/** A complete DashboardData — no casts, so a shape change fails the build. */
function dashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    streak: { current: 4, longest: 11 },
    plants: { due_today: 2, overdue: 0 },
    fitness: { steps: 5200, goal: 10000 },
    nutrition: { calories_consumed: 1450, target: 2000 },
    today_list: [],
    ...overrides,
  } satisfies DashboardData
}

/** A complete Reminder. All eight fields, so the fixture is really one. */
function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    reminder_type: 'PLANT_WATER',
    target_entity_id: 'p1',
    title: 'Water the tulsi',
    body: 'Due now',
    due_at_utc: '2026-08-22T06:00:00.000Z',
    status: 'SENT',
    sent_at: '2026-08-22T06:00:00.000Z',
    ...overrides,
  } satisfies Reminder
}

function todayItem(type: string, id: string, title: string) {
  return { type, id, title }
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <DashboardPage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  settingsValue = null
  getDashboard.mockReset()
  listReminders.mockReset()
  dismissReminder.mockReset()
  logCare.mockReset()
  sessionStorage.clear()
})

describe('DashboardPage failure branches', () => {
  it('announces a total failure once when both requests fail', async () => {
    getDashboard.mockRejectedValue(new Error('down'))
    listReminders.mockRejectedValue(new Error('down'))
    renderDashboard()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/couldn't load your dashboard/i)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    // A total failure replaces the content; it must not sit next to an empty
    // state saying there is nothing to do.
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Today' })).not.toBeInTheDocument()
  })

  it('recovers when a retry succeeds', async () => {
    const user = userEvent.setup()
    getDashboard.mockRejectedValue(new Error('down'))
    listReminders.mockRejectedValue(new Error('down'))
    renderDashboard()

    await screen.findByRole('alert')
    expect(getDashboard).toHaveBeenCalledTimes(1)

    // The retry has to clear the error, not merely re-issue the requests.
    getDashboard.mockResolvedValue(dashboard())
    listReminders.mockResolvedValue([])
    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByText('Plants due')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(listReminders).toHaveBeenCalledTimes(2)
  })

  it('suppresses the Today section when only the summary fails', async () => {
    getDashboard.mockRejectedValue(new Error('down'))
    listReminders.mockResolvedValue([reminder()])
    renderDashboard()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/couldn't load today's summary/i)
    // The half that succeeded still renders.
    expect(screen.getByText('Water the tulsi')).toBeInTheDocument()
    // The half that failed renders nothing at all — not an empty state. This
    // is the invariant the page exists to protect: a failure and "nothing due"
    // must never appear together, or the failure reads as good news.
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Today' })).not.toBeInTheDocument()
  })

  it('keeps the tiles visible when only reminders fail', async () => {
    getDashboard.mockResolvedValue(dashboard())
    listReminders.mockRejectedValue(new Error('down'))
    renderDashboard()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/couldn't load reminders/i)
    expect(screen.getByText('Plants due')).toBeInTheDocument()
    expect(screen.getByText('Steps')).toBeInTheDocument()
  })

  it('lets a reminders failure win over a stale list', async () => {
    // A failed refetch leaves the previously loaded rows in state. The error
    // check runs first precisely so the page cannot show yesterday's list as
    // though it were current.
    const user = userEvent.setup()
    getDashboard.mockRejectedValue(new Error('down'))
    listReminders.mockResolvedValue([reminder()])
    renderDashboard()

    expect(await screen.findByText('Water the tulsi')).toBeInTheDocument()

    // On the retry the summary recovers and reminders fail, so the reminders
    // branch is the only one left — which is the case that matters, because
    // the previously loaded row is still sitting in state.
    getDashboard.mockResolvedValue(dashboard())
    listReminders.mockRejectedValue(new Error('down'))
    await user.click(screen.getByRole('button', { name: /try again/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/couldn't load reminders/i),
    )
    expect(screen.queryByText('Water the tulsi')).not.toBeInTheDocument()
  })

  it('renders the empty state only when there is genuinely nothing due', async () => {
    getDashboard.mockResolvedValue(dashboard({ today_list: [] }))
    listReminders.mockResolvedValue([])
    renderDashboard()

    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('DashboardPage loading', () => {
  it('holds the layout with one skeleton tile per real tile', async () => {
    settingsValue = {
      plant_care_enabled: true,
      fitness_enabled: false,
      nutrition_enabled: false,
    } as UserSettings
    getDashboard.mockReturnValue(new Promise(() => {}))
    listReminders.mockReturnValue(new Promise(() => {}))
    renderDashboard()

    expect(screen.getByRole('status')).toHaveTextContent(/loading your dashboard/i)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // Streak always shows plus one enabled module: two tiles, so two tile
    // placeholders. A placeholder that does not match the shape it stands in
    // for is just a differently-coloured layout shift.
    //
    // Counted by the eyebrow bar, which only TileSkeleton has — the h-9 value
    // bar is shared with RowSkeleton's button placeholder and would count rows
    // as tiles.
    const skeletons = screen.getAllByTestId('skeleton')
    const tiles = skeletons.filter((s) => s.className.includes('h-[13px]'))
    expect(tiles).toHaveLength(2)
  })
})

describe('DashboardPage content', () => {
  it('binds each streak number to its own label', async () => {
    getDashboard.mockResolvedValue(dashboard({ streak: { current: 4, longest: 11 } }))
    listReminders.mockResolvedValue([])
    renderDashboard()

    // Scoped, not three independent existence checks: swapping current and
    // longest must fail this.
    const longest = await screen.findByText('longest')
    expect(within(longest.parentElement!).getByText('11')).toBeInTheDocument()

    const streakLabel = screen.getByText('day streak')
    expect(within(streakLabel.parentElement!).getByText('4')).toBeInTheDocument()
  })

  it('raises the overdue count out of quiet context when it is non-zero', async () => {
    getDashboard.mockResolvedValue(dashboard({ plants: { due_today: 2, overdue: 3 } }))
    listReminders.mockResolvedValue([])
    renderDashboard()

    const overdue = await screen.findByText('3 overdue')
    expect(overdue.className).toContain('text-accent')
  })

  it('leaves the overdue count quiet when there is nothing overdue', async () => {
    getDashboard.mockResolvedValue(dashboard({ plants: { due_today: 2, overdue: 0 } }))
    listReminders.mockResolvedValue([])
    renderDashboard()

    const overdue = await screen.findByText('0 overdue')
    expect(overdue.className).toContain('text-text-muted')
    expect(overdue.className).not.toContain('text-accent')
  })

  it('hides a module tile and its Today rows when that module is switched off', async () => {
    settingsValue = {
      plant_care_enabled: true,
      fitness_enabled: false,
      nutrition_enabled: true,
    } as UserSettings
    getDashboard.mockResolvedValue(
      dashboard({
        today_list: [
          todayItem('PLANT_WATER', 'p1', 'Water the tulsi'),
          todayItem('LOG_WORKOUT', 'w1', 'Log a workout'),
        ],
      }),
    )
    listReminders.mockResolvedValue([])
    renderDashboard()

    expect(await screen.findByText('Plants due')).toBeInTheDocument()
    expect(screen.queryByText('Steps')).not.toBeInTheDocument()
    expect(screen.getByText('Calories')).toBeInTheDocument()
    // Gating reaches the Today list too, not just the tiles.
    expect(screen.getByText('Water the tulsi')).toBeInTheDocument()
    expect(screen.queryByText('Log a workout')).not.toBeInTheDocument()
  })

  it('requests the summary for the local date, not a UTC one', async () => {
    getDashboard.mockResolvedValue(dashboard())
    listReminders.mockResolvedValue([])
    renderDashboard()

    await screen.findByText('Plants due')
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    // Someone east of UTC logging in the evening is already on tomorrow's date
    // by toISOString, which would ask for the wrong day's summary.
    expect(getDashboard).toHaveBeenCalledWith(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    )
  })
})

describe('DashboardPage actions', () => {
  it('removes a dismissed reminder optimistically', async () => {
    const user = userEvent.setup()
    getDashboard.mockResolvedValue(dashboard())
    listReminders.mockResolvedValue([reminder()])
    dismissReminder.mockResolvedValue({ status: 'DISMISSED' })
    renderDashboard()

    expect(await screen.findByText('Water the tulsi')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    await waitFor(() => expect(screen.queryByText('Water the tulsi')).not.toBeInTheDocument())
    expect(dismissReminder).toHaveBeenCalledWith('r1')
  })

  it('puts a reminder back when the dismissal fails', async () => {
    const user = userEvent.setup()
    getDashboard.mockResolvedValue(dashboard())
    listReminders.mockResolvedValue([reminder()])
    dismissReminder.mockRejectedValue(new Error('offline'))
    renderDashboard()

    expect(await screen.findByText('Water the tulsi')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    // The row returns rather than vanishing on a failed write.
    await waitFor(() => expect(screen.getByText('Water the tulsi')).toBeInTheDocument())
    expect(await screen.findByText(/it's back in the list/i)).toBeInTheDocument()
  })

  it('logs water for the clicked plant and refreshes the summary', async () => {
    const user = userEvent.setup()
    getDashboard.mockResolvedValue(
      dashboard({ today_list: [todayItem('PLANT_WATER', 'p1', 'Water the tulsi')] }),
    )
    listReminders.mockResolvedValue([])
    logCare.mockResolvedValue({})
    renderDashboard()

    await screen.findByText('Water the tulsi')
    await user.click(screen.getByRole('button', { name: /log water/i }))

    await waitFor(() => expect(logCare).toHaveBeenCalledTimes(1))
    expect(logCare).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ action_type: 'WATER' }),
    )
    // The tiles must catch up with the log.
    await waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(2))
  })

  it('keeps the stale summary when the post-water refresh fails', async () => {
    // The water was logged. Turning a failed refresh into an error panel would
    // tell the user their action did not happen, which is false.
    const user = userEvent.setup()
    getDashboard.mockResolvedValueOnce(
      dashboard({ today_list: [todayItem('PLANT_WATER', 'p1', 'Water the tulsi')] }),
    )
    listReminders.mockResolvedValue([])
    logCare.mockResolvedValue({})
    getDashboard.mockRejectedValueOnce(new Error('down'))
    renderDashboard()

    await screen.findByText('Water the tulsi')
    await user.click(screen.getByRole('button', { name: /log water/i }))

    await waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Plants due')).toBeInTheDocument()
  })

  it('waters two plants concurrently without sharing a busy state', async () => {
    const user = userEvent.setup()
    getDashboard.mockResolvedValue(
      dashboard({
        today_list: [
          todayItem('PLANT_WATER', 'p1', 'Water the tulsi'),
          todayItem('PLANT_WATER', 'p2', 'Water the fern'),
        ],
      }),
    )
    listReminders.mockResolvedValue([])
    // Never settles: the first button stays in flight while we inspect both.
    logCare.mockReturnValue(new Promise(() => {}))
    renderDashboard()

    await screen.findByText('Water the tulsi')
    const buttons = screen.getAllByRole('button', { name: /log water/i })
    await user.click(buttons[0]!)

    // A shared spinner would mark both busy — the per-item Set is what stops
    // watering one plant from locking every other row.
    await waitFor(() => expect(buttons[0]!).toHaveAttribute('aria-busy', 'true'))
    expect(buttons[1]!).toHaveAttribute('aria-busy', 'false')
  })
})
