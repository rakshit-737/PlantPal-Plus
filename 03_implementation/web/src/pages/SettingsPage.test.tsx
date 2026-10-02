/**
 * Settings behaviour that a user can feel: the account deletion grace window
 * (the two-part ceremony, the password step-up, cancelling it) and the
 * quiet-hours window (never sent to the server in a state the server rejects,
 * never showing an error the user has not caused).
 *
 * The account API and both contexts are mocked; the real UI primitives are
 * kept so the assertions run against the dialog, alerts and inputs a user
 * actually meets.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '../components/ui'
import type { AccountState } from '../lib/accountApi'
import { ApiError } from '../lib/apiClient'
import type { UserSettings } from '../lib/settingsApi'

const update = vi.fn()
const reload = vi.fn()
let settingsValue: UserSettings | null = null

/**
 * Stands in for SettingsContext.update: the real one applies the patch to the
 * shared settings, which is what lets the page drop its local draft and follow
 * the server again after a save.
 */
async function applyPatch(patch: Partial<UserSettings>) {
  if (settingsValue) settingsValue = { ...settingsValue, ...patch }
}

const getAccount = vi.fn()
const requestAccountDeletion = vi.fn()
const cancelAccountDeletion = vi.fn()

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'gardener@example.com', status: 'ACTIVE' },
    logout: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: true,
    isLoading: false,
  }),
}))

vi.mock('../settings/SettingsContext', () => ({
  useSettings: () => ({
    settings: settingsValue,
    loading: false,
    loadError: false,
    reload,
    update,
  }),
}))

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light', toggle: vi.fn() }),
}))

vi.mock('../lib/accountApi', () => ({
  getAccount,
  requestAccountDeletion,
  cancelAccountDeletion,
}))

const { SettingsPage } = await import('./SettingsPage')

const BASE_SETTINGS: UserSettings = {
  timezone: 'Asia/Kolkata',
  hemisphere: 'NORTHERN',
  locale: 'en-IN',
  unit_system: 'METRIC',
  theme: 'LIGHT',
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
}

const ACTIVE: AccountState = {
  status: 'ACTIVE',
  deletion_requested_at: null,
  purge_after: null,
  deletion_scheduled_at: null,
}

const PURGE_AT = '2026-08-30T09:00:00.000Z'
const PENDING: AccountState = {
  status: 'PENDING_DELETION',
  deletion_requested_at: '2026-07-31T09:00:00.000Z',
  purge_after: PURGE_AT,
  deletion_scheduled_at: PURGE_AT,
}

/** The same rendering the page uses, so the assertion reads what a user sees. */
const purgeLabel = new Date(PURGE_AT).toLocaleString(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function validationError(field: string, issue: string): ApiError {
  return new ApiError(422, {
    code: 'VALIDATION_FAILED',
    message: 'The request failed validation.',
    message_key: 'errors.validation_failed',
    details: [{ field, issue }],
    request_id: 'req_test',
    timestamp: '2026-07-31T09:00:00.000Z',
  })
}

/** What the deletion step-up returns for a wrong password — a 401, like expiry. */
function invalidCredentials(): ApiError {
  return new ApiError(401, {
    code: 'INVALID_CREDENTIALS',
    message: 'That email or password is not right.',
    message_key: 'errors.invalid_credentials',
    request_id: 'req_test',
    timestamp: '2026-07-31T09:00:00.000Z',
  })
}

function renderPage(initial = '/settings') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <ToastProvider>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('SettingsPage — account deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingsValue = { ...BASE_SETTINGS }
    update.mockImplementation(applyPatch)
    getAccount.mockResolvedValue(ACTIVE)
  })

  it('gates the confirm button behind both the typed phrase and the password', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Delete account' }))
    const dialog = screen.getByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: 'Schedule deletion' })

    // The grace window and the way back are stated before the user can commit.
    expect(within(dialog).getByText(/30-day grace period/)).toBeInTheDocument()
    expect(within(dialog).getByText(/restored in full/)).toBeInTheDocument()
    // Sessions survive the grace window now, so nothing here claims otherwise.
    expect(within(dialog).queryByText(/15 minutes/)).not.toBeInTheDocument()
    expect(within(dialog).getByText(/stay signed in/)).toBeInTheDocument()

    expect(confirm).toBeDisabled()
    const phrase = within(dialog).getByLabelText(/type DELETE to confirm/i)
    await user.type(phrase, 'delete')
    expect(confirm).toBeDisabled()

    await user.clear(phrase)
    await user.type(phrase, 'DELETE')
    // The ceremony alone no longer commits: the step-up is still missing.
    expect(confirm).toBeDisabled()

    const pw = within(dialog).getByLabelText(/account password/i)
    expect(pw).toHaveAttribute('type', 'password')
    expect(pw).toHaveAttribute('autocomplete', 'current-password')
    await user.type(pw, 'correct horse')
    expect(confirm).toBeEnabled()
    expect(requestAccountDeletion).not.toHaveBeenCalled()
  })

  it('schedules deletion and then shows the purge date with a way back', async () => {
    requestAccountDeletion.mockResolvedValue({ ...PENDING, already_pending: false })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Delete account' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/type DELETE to confirm/i), 'DELETE')
    await user.type(within(dialog).getByLabelText(/account password/i), 'correct horse')
    await user.click(within(dialog).getByRole('button', { name: 'Schedule deletion' }))

    // The password is the whole body; the typed phrase never leaves the client.
    expect(requestAccountDeletion).toHaveBeenCalledTimes(1)
    expect(requestAccountDeletion).toHaveBeenCalledWith('correct horse')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(screen.getAllByText(purgeLabel).length).toBeGreaterThan(0)
    // Offered both at the top of the page and in the danger zone.
    expect(screen.getAllByRole('button', { name: 'Keep my account' })).toHaveLength(2)
  })

  it('reports a refused password on the field without discarding the ceremony', async () => {
    requestAccountDeletion.mockRejectedValue(invalidCredentials())
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Delete account' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/type DELETE to confirm/i), 'DELETE')
    await user.type(within(dialog).getByLabelText(/account password/i), 'not my password')
    await user.click(within(dialog).getByRole('button', { name: 'Schedule deletion' }))

    expect(await screen.findByText('That password is not correct.')).toBeInTheDocument()
    // The dialog survives and the typed DELETE is not lost — only the password
    // needs retyping.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/type DELETE to confirm/i)).toHaveValue('DELETE')
    // INVALID_CREDENTIALS is a 401 as well; it must not read as an expired session.
    expect(screen.queryByText(/session has ended/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Schedule deletion' })).toBeEnabled()
  })

  it('cancels a pending deletion and adopts the status the server returns', async () => {
    getAccount.mockResolvedValue(PENDING)
    cancelAccountDeletion.mockResolvedValue({
      status: 'PENDING_VERIFICATION',
      deletion_requested_at: null,
      purge_after: null,
      deletion_scheduled_at: null,
    })
    const user = userEvent.setup()
    renderPage('/settings?recover=1')

    const keep = await screen.findAllByRole('button', { name: 'Keep my account' })
    expect(screen.getAllByText(purgeLabel).length).toBeGreaterThan(0)
    await user.click(keep[0]!)

    expect(cancelAccountDeletion).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(screen.queryAllByRole('button', { name: 'Keep my account' })).toHaveLength(0),
    )
    // Not assumed to be ACTIVE — the badge shows what came back.
    expect(screen.getByText('PENDING VERIFICATION')).toBeInTheDocument()
    expect(screen.getByText(/Deletion cancelled/)).toBeInTheDocument()
  })

  it('keeps the recovery banner and offers a retry when the account state fails to load', async () => {
    getAccount.mockRejectedValue(ApiError.transport('offline'))
    const user = userEvent.setup()
    renderPage('/settings?recover=1')

    // A failed load never degrades into "nothing to see here".
    const retry = await screen.findByRole('button', { name: 'Try again' })
    expect(screen.getByText(/Couldn't load account status/)).toBeInTheDocument()
    // The ?recover=1 hint still warns, even though the date is unknown.
    expect(screen.getByText(/scheduled for deletion/)).toBeInTheDocument()

    getAccount.mockResolvedValue(ACTIVE)
    await user.click(retry)
    expect(await screen.findByRole('button', { name: 'Delete account' })).toBeInTheDocument()
  })
})

describe('SettingsPage — quiet hours', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingsValue = { ...BASE_SETTINGS }
    update.mockImplementation(applyPatch)
    getAccount.mockResolvedValue(ACTIVE)
  })

  it('does not save a bare WINDOW switch, then saves the mode and both times together', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.selectOptions(await screen.findByLabelText('Quiet hours'), 'WINDOW')
    // A WINDOW with no boundaries is a guaranteed 422 — it must not be sent.
    expect(update).not.toHaveBeenCalled()

    expect(screen.getByLabelText('Quiet from')).toHaveValue('22:00')
    expect(screen.getByLabelText('Quiet until')).toHaveValue('07:00')

    await user.click(screen.getByRole('button', { name: 'Save quiet hours' }))
    expect(update).toHaveBeenCalledWith({
      quiet_hours_mode: 'WINDOW',
      quiet_start_time: '22:00',
      quiet_end_time: '07:00',
    })
  })

  it('blocks a save when start and end match', async () => {
    settingsValue = {
      ...BASE_SETTINGS,
      quiet_hours_mode: 'WINDOW',
      quiet_start_time: '22:00',
      quiet_end_time: '07:00',
    }
    renderPage()

    const end = await screen.findByLabelText('Quiet until')
    fireEvent.change(end, { target: { value: '22:00' } })

    expect(screen.getByRole('button', { name: 'Save quiet hours' })).toBeDisabled()
    expect(screen.getByText('Pick an end time different from the start.')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it('turns a rejected window into a message about the window, not a generic failure', async () => {
    update.mockRejectedValue(validationError('quiet_hours_mode', 'window_requires_start_and_end'))
    const user = userEvent.setup()
    renderPage()

    await user.selectOptions(await screen.findByLabelText('Quiet hours'), 'WINDOW')
    await user.click(screen.getByRole('button', { name: 'Save quiet hours' }))

    expect(
      await screen.findByText('A quiet window needs both a start and an end time.'),
    ).toBeInTheDocument()
  })

  it('saves OFF straight away without touching the boundaries', async () => {
    settingsValue = {
      ...BASE_SETTINGS,
      quiet_hours_mode: 'WINDOW',
      quiet_start_time: '22:00',
      quiet_end_time: '07:00',
    }
    const user = userEvent.setup()
    renderPage()

    await user.selectOptions(await screen.findByLabelText('Quiet hours'), 'OFF')
    await waitFor(() => expect(update).toHaveBeenCalledWith({ quiet_hours_mode: 'OFF' }))
    expect(screen.queryByLabelText('Quiet from')).not.toBeInTheDocument()
  })

  it('drops a rejected mode instead of stranding the select on a refused value', async () => {
    update.mockRejectedValue(ApiError.transport('offline'))
    const user = userEvent.setup()
    renderPage()

    const select = await screen.findByLabelText('Quiet hours')
    await user.selectOptions(select, 'SCHEDULED_ONLY')

    // SCHEDULED_ONLY renders no save button, so a surviving draft would leave
    // the user looking at a value the server refused with no way to retry.
    await waitFor(() => expect(select).toHaveValue('OFF'))
    expect(screen.queryByRole('button', { name: 'Save quiet hours' })).not.toBeInTheDocument()
  })

  it('keeps the times a rejected window save was typed with', async () => {
    update.mockRejectedValue(validationError('quiet_hours_mode', 'window_requires_start_and_end'))
    const user = userEvent.setup()
    renderPage()

    await user.selectOptions(await screen.findByLabelText('Quiet hours'), 'WINDOW')
    const start = screen.getByLabelText('Quiet from')
    fireEvent.change(start, { target: { value: '23:30' } })
    await user.click(screen.getByRole('button', { name: 'Save quiet hours' }))

    await screen.findByText('A quiet window needs both a start and an end time.')
    // Typed boundaries are worth the round trip, unlike a bare mode switch.
    expect(screen.getByLabelText('Quiet from')).toHaveValue('23:30')
    expect(screen.getByLabelText('Quiet hours')).toHaveValue('WINDOW')
  })

  it('does not greet a stored window with errors the user has not caused', async () => {
    // The column default: WINDOW with both boundaries null.
    settingsValue = {
      ...BASE_SETTINGS,
      quiet_hours_mode: 'WINDOW',
      quiet_start_time: null,
      quiet_end_time: null,
    }
    renderPage()

    const start = await screen.findByLabelText('Quiet from')
    expect(start).toHaveValue('')
    expect(screen.queryByText('Set a start time.')).not.toBeInTheDocument()
    expect(screen.queryByText('Set an end time.')).not.toBeInTheDocument()
    // Silent, but still not saveable.
    expect(screen.getByRole('button', { name: 'Save quiet hours' })).toBeDisabled()

    // Once the user has been in the field, the reason is named.
    fireEvent.blur(start)
    expect(await screen.findByText('Set a start time.')).toBeInTheDocument()
    // The field they have not reached yet stays quiet.
    expect(screen.queryByText('Set an end time.')).not.toBeInTheDocument()
  })

  it('does not claim reminders are silenced', async () => {
    renderPage()
    expect(
      await screen.findByText(/Reminders stay listed in the app either way/),
    ).toBeInTheDocument()
  })

  it('does not present the daily cap as an enforced delivery ceiling', async () => {
    renderPage()
    // Nothing in the reminder engine or the push dispatcher reads
    // daily_notification_cap, so the hint must not promise it is applied.
    expect(
      await screen.findByText(/not yet applied when reminders are sent/),
    ).toBeInTheDocument()
  })
})

describe('SettingsPage — onboarding entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingsValue = { ...BASE_SETTINGS }
    update.mockImplementation(applyPatch)
    getAccount.mockResolvedValue(ACTIVE)
  })

  it('links to the guided setup, which nothing else in the app reaches', async () => {
    renderPage()
    const link = await screen.findByRole('link', { name: 'Set up preferences' })
    expect(link).toHaveAttribute('href', '/onboarding')
  })
})
