import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  useToast,
} from '../components/ui'
import { usePageTitle } from '../hooks/usePageTitle'
import { useTheme } from '../hooks/useTheme'
import {
  cancelAccountDeletion,
  getAccount,
  requestAccountDeletion,
  type AccountState,
} from '../lib/accountApi'
import { ApiError } from '../lib/apiClient'
import type {
  Hemisphere,
  QuietHoursMode,
  UnitSystem,
  UserSettings,
  WeekStartDay,
} from '../lib/settingsApi'
import { useSettings } from '../settings/SettingsContext'

const STATUS_TONE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  ACTIVE: 'success',
  PENDING_VERIFICATION: 'info',
  LOCKED: 'danger',
  PENDING_DELETION: 'warning',
}

const MODULES = [
  { key: 'plant_care_enabled', label: 'Plant care', body: 'Watering schedules and care history.' },
  { key: 'fitness_enabled', label: 'Fitness', body: 'Workouts, steps and weekly summaries.' },
  { key: 'nutrition_enabled', label: 'Nutrition', body: 'Meals, calories and hydration.' },
] as const

/** The phrase the confirm field must match before deletion can be scheduled. */
const CONFIRM_PHRASE = 'DELETE'

/** Seeds used only when the user switches TO a window and has no times stored. */
const DEFAULT_QUIET_START = '22:00'
const DEFAULT_QUIET_END = '07:00'

interface QuietDraft {
  mode: QuietHoursMode
  /** "HH:MM" or '' — '' is the empty input, which maps to a null column. */
  start: string
  end: string
}

/** Field-scoped copy for a rejected quiet-hours save. */
interface QuietErrors {
  start?: string
  end?: string
  /** Applies to the mode + both times together, not one input. */
  form?: string
}

/** A ledger instant: "31 Aug 2026, 14:32". Returns an em dash for missing values. */
function fmtInstant(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Says what happened and what to do; falls back to the caller's action line. */
function accountErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.code === 'NETWORK_ERROR') {
      return 'Could not reach the server. Check your connection and try again.'
    }
    if (err.status === 401) {
      return 'Your session has ended. Sign in again to continue.'
    }
  }
  return fallback
}

/** A dependency-free switch: a sharp track with a sliding square knob. */
function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-sm border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'border-primary bg-primary' : 'border-border bg-background'
      }`}
    >
      <span
        className={`absolute top-[3px] h-4 w-4 rounded-sm transition-all ${
          checked ? 'left-[24px] bg-surface' : 'left-[3px] bg-text-muted'
        }`}
      />
    </button>
  )
}

/** A settings card with the standard eyebrow heading. */
function Section({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <Card>
      <p className="mb-md text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
        {eyebrow}
      </p>
      {children}
    </Card>
  )
}

/** Label + quiet description on the left, a toggle on the right. */
function ToggleRow({
  label,
  body,
  checked,
  onChange,
}: {
  label: string
  body: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-md">
      <div>
        <p className="text-sm font-medium text-text-main">{label}</p>
        <p className="text-xs text-text-muted">{body}</p>
      </div>
      <Toggle label={label} checked={checked} onChange={onChange} />
    </div>
  )
}

/** A right-aligned mono value against a muted label — one ledger row. */
function LedgerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-md">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="font-mono text-xs text-text-main">{value}</span>
    </div>
  )
}

export function SettingsPage() {
  usePageTitle('Settings')
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const { settings, loading, loadError, reload, update } = useSettings()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  // Arriving from a sign-in during the grace window (LoginPage sends
  // ?recover=1). It only seeds the banner: once GET /account answers, the
  // server's status decides, so a stale link cannot show a false warning.
  const arrivedToRecover = searchParams.get('recover') === '1'

  const [loggingOut, setLoggingOut] = useState(false)
  const [moduleError, setModuleError] = useState('')
  // null = follow the server value; a string = the user is editing.
  const [capDraft, setCapDraft] = useState<string | null>(null)
  const [capSaving, setCapSaving] = useState(false)

  // Quiet hours are edited as a triple and saved as a triple (the server
  // validates them together), so one draft covers the mode and both times.
  const [quietDraft, setQuietDraft] = useState<QuietDraft | null>(null)
  const [quietSaving, setQuietSaving] = useState(false)
  const [quietErrors, setQuietErrors] = useState<QuietErrors>({})
  // Which boundary the user has actually touched. The column default is WINDOW
  // with both times null, so without this every account's first visit opens on
  // two red fields it never caused. The save button stays disabled either way —
  // this decides only whether the reason is spoken aloud yet.
  const [quietTouched, setQuietTouched] = useState<{ start: boolean; end: boolean }>({
    start: false,
    end: false,
  })

  const [account, setAccount] = useState<AccountState | null>(null)
  const [accountLoading, setAccountLoading] = useState(true)
  const [accountError, setAccountError] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  // The step-up: the server verifies this against the stored hash. Held only
  // for the life of the dialog and cleared on close, never on the page state.
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  // Which "Keep my account" button is in flight — the banner and the danger
  // zone both offer it, and only the pressed one should show the spinner.
  const [cancelSource, setCancelSource] = useState<'banner' | 'zone' | null>(null)

  const loadAccount = useCallback(() => {
    setAccountLoading(true)
    setAccountError(false)
    getAccount()
      .then((state) => setAccount(state))
      .catch(() => setAccountError(true))
      .finally(() => setAccountLoading(false))
  }, [])

  useEffect(() => {
    loadAccount()
  }, [loadAccount])

  /** Per-field save: optimistic via the provider, confirmed or explained here. */
  async function save(patch: Partial<UserSettings>): Promise<boolean> {
    try {
      await update(patch)
      toast.success('Settings saved')
      return true
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.code === 'NETWORK_ERROR'
          ? 'Could not reach the server. Check your connection and try again.'
          : 'Could not save that change. Try again.',
      )
      return false
    }
  }

  async function toggleModule(key: (typeof MODULES)[number]['key'], next: boolean) {
    setModuleError('')
    try {
      await update({ [key]: next })
      toast.success('Settings saved')
    } catch (err) {
      // Invariant 34: the API refuses to disable the last active module.
      const isGuard =
        err instanceof ApiError && err.details.some((d) => d.field === 'modules')
      if (isGuard) setModuleError('At least one module must stay enabled.')
      else toast.error('Could not save that change. Try again.')
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
    }
  }

  const capValue = capDraft ?? (settings ? String(settings.daily_notification_cap) : '')
  const capNumber = Number(capValue)
  const capInvalid =
    capDraft !== null && (!Number.isInteger(capNumber) || capNumber < 1 || capNumber > 20)
  const capDirty =
    capDraft !== null && settings !== null && capDraft !== String(settings.daily_notification_cap)

  async function saveCap() {
    if (!capDirty || capInvalid) return
    setCapSaving(true)
    const ok = await save({ daily_notification_cap: capNumber })
    setCapSaving(false)
    if (ok) setCapDraft(null)
  }

  /* --------------------------------------------------------- quiet hours */

  const quiet: QuietDraft = quietDraft ?? {
    mode: settings?.quiet_hours_mode ?? 'OFF',
    start: settings?.quiet_start_time ?? '',
    end: settings?.quiet_end_time ?? '',
  }
  const isWindow = quiet.mode === 'WINDOW'
  const quietIncomplete = isWindow && (quiet.start === '' || quiet.end === '')
  const quietSameTime = isWindow && quiet.start !== '' && quiet.start === quiet.end
  const quietDirty =
    settings !== null &&
    (quiet.mode !== settings.quiet_hours_mode ||
      (isWindow &&
        (quiet.start !== (settings.quiet_start_time ?? '') ||
          quiet.end !== (settings.quiet_end_time ?? ''))))

  /**
   * Saves the mode and, for a window, both boundaries in one PUT — the server
   * checks the triple as a unit, so sending WINDOW before the times exist would
   * be a guaranteed 422.
   */
  async function saveQuiet(next: QuietDraft) {
    const patch: Partial<UserSettings> =
      next.mode === 'WINDOW'
        ? {
            quiet_hours_mode: 'WINDOW',
            quiet_start_time: next.start,
            quiet_end_time: next.end,
          }
        : { quiet_hours_mode: next.mode }
    setQuietSaving(true)
    setQuietErrors({})
    try {
      await update(patch)
      toast.success('Settings saved')
      setQuietDraft(null)
    } catch (err) {
      // Only a window has anything worth preserving across a failed round trip
      // — the boundaries the user typed. OFF and SCHEDULED_ONLY carry no typed
      // input and render no save button, so a surviving draft would strand the
      // Select on a value the server refused with no way to retry. Drop it and
      // follow the server again, like every other Select on this page.
      const keepsDraft = next.mode === 'WINDOW'
      if (!keepsDraft) setQuietDraft(null)
      // Field-scoped copy is only worth setting while the fields are on screen.
      if (keepsDraft && err instanceof ApiError && err.code === 'VALIDATION_FAILED') {
        const issues = new Set(err.details.map((d) => d.issue))
        const mapped: QuietErrors = {}
        if (issues.has('window_requires_start_and_end')) {
          mapped.form = 'A quiet window needs both a start and an end time.'
        }
        if (issues.has('window_start_equals_end')) {
          mapped.end = 'Pick an end time different from the start.'
        }
        if (issues.has('must_be_hh_mm_24h_or_null')) {
          mapped.form = 'Enter each time as 24-hour HH:MM.'
        }
        if (mapped.form || mapped.end) {
          setQuietErrors(mapped)
          return
        }
      }
      toast.error(
        err instanceof ApiError && err.code === 'NETWORK_ERROR'
          ? 'Could not reach the server. Check your connection and try again.'
          : 'Could not save quiet hours. Try again.',
      )
    } finally {
      setQuietSaving(false)
    }
  }

  function changeQuietMode(mode: QuietHoursMode) {
    setQuietErrors({})
    if (mode === 'WINDOW') {
      // Reveal the boundaries and wait for an explicit save. Seeds are used
      // only when nothing is stored, so the inputs never misreport the row.
      setQuietDraft({
        mode,
        start: quiet.start || DEFAULT_QUIET_START,
        end: quiet.end || DEFAULT_QUIET_END,
      })
      return
    }
    // OFF and SCHEDULED_ONLY need no boundaries, so they save straight away
    // like every other select on this page.
    const next: QuietDraft = { ...quiet, mode }
    setQuietDraft(next)
    void saveQuiet(next)
  }

  /* ------------------------------------------------------------- account */

  const purgeAt = account?.purge_after ?? account?.deletion_scheduled_at ?? null
  // Before the account state loads, the ?recover=1 hint stands in; afterwards
  // the server's status is the only authority.
  const pendingDeletion = account ? account.status === 'PENDING_DELETION' : arrivedToRecover
  const displayStatus = account?.status ?? user?.status ?? null
  const confirmOk = confirmText.trim() === CONFIRM_PHRASE

  function clearRecoverParam() {
    if (!searchParams.has('recover')) return
    const next = new URLSearchParams(searchParams)
    next.delete('recover')
    setSearchParams(next, { replace: true })
  }

  function closeDeleteModal() {
    setDeleteOpen(false)
    setConfirmText('')
    setPassword('')
    setPasswordError('')
    setScheduleError('')
  }

  async function scheduleDeletion() {
    if (!confirmOk || password === '') return
    setScheduling(true)
    setScheduleError('')
    setPasswordError('')
    try {
      const state = await requestAccountDeletion(password)
      setAccount(state)
      setAccountError(false)
      closeDeleteModal()
      toast.info(
        state.already_pending
          ? 'Deletion was already scheduled for this account.'
          : 'Deletion scheduled. Cancel any time before the purge date.',
      )
    } catch (err) {
      // A refused password is a problem with one field, not a failed request:
      // keep the dialog open and the typed DELETE intact so only the password
      // is retyped. Branch on the code — INVALID_CREDENTIALS is a 401 too, and
      // reading the status alone would blame an expired session instead.
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_CREDENTIALS') {
          setPasswordError('That password is not correct.')
          return
        }
        // Not reachable today (every account is created with a password), but
        // an account with none stored is rejected here rather than silently.
        if (
          err.code === 'VALIDATION_FAILED' &&
          err.details.some((d) => d.field === 'password')
        ) {
          setPasswordError(
            'This account has no password set, so deletion cannot be confirmed here.',
          )
          return
        }
      }
      setScheduleError(accountErrorMessage(err, 'Could not schedule deletion. Try again.'))
    } finally {
      setScheduling(false)
    }
  }

  async function keepAccount(source: 'banner' | 'zone') {
    setCancelSource(source)
    try {
      // The restored status is whatever the server says — an account that
      // never verified its email comes back as PENDING_VERIFICATION.
      const state = await cancelAccountDeletion()
      setAccount(state)
      setAccountError(false)
      clearRecoverParam()
      toast.success('Deletion cancelled. This account stays.')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Nothing was scheduled — our view was stale, so refetch rather than
        // report a failure the user cannot act on.
        toast.info('This account is not scheduled for deletion.')
        clearRecoverParam()
        loadAccount()
      } else {
        toast.error(accountErrorMessage(err, 'Could not cancel deletion. Try again.'))
      }
    } finally {
      setCancelSource(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-xl">
        <PageHeader
          title="Settings"
          subtitle="Account and preferences."
          /*
            The only way into /onboarding. Nothing redirects there: no endpoint
            exposes profiles.onboarding_completed_at, so the app cannot tell a
            new account from a returning one and an auto-launch would drop
            long-standing users back into setup (see OnboardingPage's header).
            Until that flag is served, the guided pass is something the user
            chooses — hence a link, and a quiet one.
          */
          action={
            <Link
              to="/onboarding"
              className="rounded-sm text-sm text-text-muted underline-offset-4 hover:text-text-main hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Set up preferences
            </Link>
          }
        />
      </div>

      <div className="flex flex-col gap-md">
        {pendingDeletion && (
          <Alert tone="error">
            <div className="flex flex-col gap-sm">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.08em]">
                  Deletion scheduled
                </p>
                <p className="mt-xs">
                  {purgeAt ? (
                    <>
                      This account and everything in it is erased after{' '}
                      <span className="font-mono">{fmtInstant(purgeAt)}</span>. It stays
                      fully usable until then — cancel before that date to keep it.
                    </>
                  ) : (
                    'This account is scheduled for deletion. It stays fully usable during the 30-day grace period — cancel before the purge date to keep it.'
                  )}
                </p>
              </div>
              <div>
                <Button
                  variant="secondary"
                  loading={cancelSource === 'banner'}
                  disabled={cancelSource !== null}
                  onClick={() => void keepAccount('banner')}
                >
                  Keep my account
                </Button>
              </div>
            </div>
          </Alert>
        )}

        <Section eyebrow="Account">
          <div className="flex items-center justify-between gap-md">
            <p className="text-text-main">{user?.email ?? '—'}</p>
            {displayStatus && (
              <Badge tone={STATUS_TONE[displayStatus] ?? 'default'}>
                {displayStatus.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
          <div className="mt-md border-t border-border pt-md">
            <Button variant="secondary" loading={loggingOut} onClick={() => void handleLogout()}>
              Sign out
            </Button>
          </div>
        </Section>

        {settings ? (
          <>
            <Section eyebrow="Modules">
              <div className="flex flex-col gap-md">
                {MODULES.map((m) => (
                  <ToggleRow
                    key={m.key}
                    label={m.label}
                    body={m.body}
                    checked={settings[m.key]}
                    onChange={(next) => void toggleModule(m.key, next)}
                  />
                ))}
                {moduleError && <Alert tone="error">{moduleError}</Alert>}
              </div>
            </Section>

            <Section eyebrow="Plant care">
              <Select
                label="Hemisphere"
                hint="Feeds seasonal watering adjustment."
                value={settings.hemisphere}
                onChange={(e) => void save({ hemisphere: e.target.value as Hemisphere })}
              >
                <option value="NORTHERN">Northern</option>
                <option value="SOUTHERN">Southern</option>
                <option value="EQUATORIAL">Equatorial</option>
              </Select>
            </Section>

            <Section eyebrow="Notifications">
              <div className="flex flex-col gap-md">
                <Select
                  label="Quiet hours"
                  hint="Marks the hours you would rather not be sent a reminder."
                  value={quiet.mode}
                  disabled={quietSaving}
                  onChange={(e) => changeQuietMode(e.target.value as QuietHoursMode)}
                >
                  <option value="OFF">Off</option>
                  <option value="WINDOW">Quiet window</option>
                  <option value="SCHEDULED_ONLY">Scheduled only</option>
                </Select>

                {isWindow && (
                  <>
                    <div className="grid gap-md sm:grid-cols-2">
                      <Input
                        label="Quiet from"
                        id="quiet-start-time"
                        type="time"
                        className="font-mono"
                        value={quiet.start}
                        disabled={quietSaving}
                        onBlur={() => setQuietTouched((t) => ({ ...t, start: true }))}
                        onChange={(e) => {
                          setQuietErrors({})
                          setQuietTouched((t) => ({ ...t, start: true }))
                          setQuietDraft({ ...quiet, start: e.target.value })
                        }}
                        error={
                          quietErrors.start ??
                          (quiet.start === '' && quietTouched.start
                            ? 'Set a start time.'
                            : undefined)
                        }
                      />
                      <Input
                        label="Quiet until"
                        id="quiet-end-time"
                        type="time"
                        className="font-mono"
                        value={quiet.end}
                        disabled={quietSaving}
                        onBlur={() => setQuietTouched((t) => ({ ...t, end: true }))}
                        onChange={(e) => {
                          setQuietErrors({})
                          setQuietTouched((t) => ({ ...t, end: true }))
                          setQuietDraft({ ...quiet, end: e.target.value })
                        }}
                        error={
                          quietErrors.end ??
                          (quiet.end === ''
                            ? quietTouched.end
                              ? 'Set an end time.'
                              : undefined
                            : quietSameTime
                              ? 'Pick an end time different from the start.'
                              : undefined)
                        }
                        hint="A window may cross midnight."
                      />
                    </div>
                    {quietErrors.form && <Alert tone="error">{quietErrors.form}</Alert>}
                    <div>
                      <Button
                        variant="secondary"
                        loading={quietSaving}
                        disabled={!quietDirty || quietIncomplete || quietSameTime}
                        onClick={() => {
                          // Asking to save counts as interacting with both
                          // fields, so a missing boundary is named from here on.
                          setQuietTouched({ start: true, end: true })
                          void saveQuiet(quiet)
                        }}
                      >
                        Save quiet hours
                      </Button>
                    </div>
                  </>
                )}

                <p className="text-xs text-text-muted">
                  This records the hours you would rather not be sent a reminder. Reminders
                  stay listed in the app either way.
                </p>

                <div className="flex items-start gap-sm">
                  <div className="flex-1">
                    <Input
                      label="Daily notification cap"
                      type="number"
                      min={1}
                      max={20}
                      step={1}
                      inputMode="numeric"
                      className="font-mono"
                      value={capValue}
                      onChange={(e) => setCapDraft(e.target.value)}
                      error={capInvalid ? 'Enter a whole number from 1 to 20.' : undefined}
                      /*
                        Not a delivery ceiling yet, so it must not read like
                        one. The column is written by PUT /v1/settings and read
                        by nothing else: neither the reminder engine nor the
                        push dispatcher counts against it (a search for
                        daily_notification_cap across apps/api/src matches only
                        the migration, the settings controller and its repo).
                        Same honesty as the quiet-hours line above.
                      */
                      hint={
                        capInvalid
                          ? undefined
                          : 'The most you want in a day (1–20). Recorded as a preference — ' +
                            'not yet applied when reminders are sent.'
                      }
                    />
                  </div>
                  {/* Offset clears the input's eyebrow label so the button tops align. */}
                  <Button
                    variant="secondary"
                    loading={capSaving}
                    disabled={!capDirty || capInvalid}
                    onClick={() => void saveCap()}
                    className="mt-[20px]"
                  >
                    Save
                  </Button>
                </div>
              </div>
            </Section>

            <Section eyebrow="Appearance">
              <div className="flex flex-col gap-md">
                <div className="flex items-center justify-between gap-md">
                  <div>
                    <p className="text-sm font-medium text-text-main">
                      Theme: {theme === 'dark' ? 'Dark' : 'Light'}
                    </p>
                    <p className="text-xs text-text-muted">
                      Applies now and is remembered on this account.
                    </p>
                  </div>
                  <Button variant="secondary" onClick={toggle}>
                    Switch to {theme === 'dark' ? 'light' : 'dark'}
                  </Button>
                </div>
                <div className="grid gap-md sm:grid-cols-2">
                  <Select
                    label="Units"
                    value={settings.unit_system}
                    onChange={(e) => void save({ unit_system: e.target.value as UnitSystem })}
                  >
                    <option value="METRIC">Metric</option>
                    <option value="IMPERIAL">Imperial</option>
                  </Select>
                  <Select
                    label="Week starts on"
                    hint="Sets the first day of weekly summaries."
                    value={settings.week_start_day}
                    onChange={(e) =>
                      void save({ week_start_day: e.target.value as WeekStartDay })
                    }
                  >
                    <option value="MONDAY">Monday</option>
                    <option value="SUNDAY">Sunday</option>
                  </Select>
                </div>
              </div>
            </Section>

            <Section eyebrow="Accessibility">
              <div className="flex flex-col gap-md">
                <ToggleRow
                  label="Reduce motion"
                  body="Minimise animation and transitions."
                  checked={settings.reduce_motion}
                  onChange={(next) => void save({ reduce_motion: next })}
                />
                <ToggleRow
                  label="Larger text"
                  body="Increase the base text size."
                  checked={settings.larger_text}
                  onChange={(next) => void save({ larger_text: next })}
                />
                <ToggleRow
                  label="High contrast"
                  body="Strengthen borders and text contrast."
                  checked={settings.high_contrast}
                  onChange={(next) => void save({ high_contrast: next })}
                />
              </div>
            </Section>

            <Section eyebrow="Privacy">
              <ToggleRow
                label="Share usage analytics"
                body="Send anonymous usage data to help improve the app."
                checked={settings.analytics_opt_in}
                onChange={(next) => void save({ analytics_opt_in: next })}
              />
            </Section>
          </>
        ) : loadError ? (
          <ErrorState
            title="Couldn't load settings"
            body="Your preferences could not be fetched. They are safe on the server — try again."
            onRetry={reload}
          />
        ) : loading ? (
          <Card>
            <div className="flex justify-center py-lg">
              <Spinner />
            </div>
          </Card>
        ) : null}

        {/* Last on the page on purpose: the only destructive control here. */}
        <Section eyebrow="Danger zone">
          {accountError ? (
            <ErrorState
              title="Couldn't load account status"
              body="Deletion options need the current account status. Nothing has changed — try again."
              onRetry={loadAccount}
            />
          ) : accountLoading ? (
            <div className="flex justify-center py-md">
              <Spinner />
            </div>
          ) : pendingDeletion ? (
            <div className="flex flex-col gap-md">
              <div>
                <p className="text-sm font-medium text-text-main">Deletion scheduled</p>
                <p className="mt-xs text-xs text-text-muted">
                  Nothing has been erased. Cancelling before the purge date restores the
                  account in full.
                </p>
              </div>
              <div className="flex flex-col gap-xs border-y border-border py-sm">
                <LedgerRow
                  label="Requested"
                  value={fmtInstant(account?.deletion_requested_at ?? null)}
                />
                <LedgerRow label="Erased after" value={fmtInstant(purgeAt)} />
              </div>
              <div>
                <Button
                  variant="secondary"
                  loading={cancelSource === 'zone'}
                  disabled={cancelSource !== null}
                  onClick={() => void keepAccount('zone')}
                >
                  Keep my account
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-md">
              <div>
                <p className="text-sm font-medium text-text-main">Delete account</p>
                <p className="mt-xs text-xs text-text-muted">
                  Schedules deletion after a 30-day grace period. Nothing is erased today,
                  and you can cancel any time before the purge date.
                </p>
              </div>
              <div>
                <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                  Delete account
                </Button>
              </div>
            </div>
          )}
        </Section>
      </div>

      <Modal
        open={deleteOpen}
        onClose={closeDeleteModal}
        title="Delete account"
        busy={scheduling}
      >
        <div className="flex flex-col gap-md">
          <p className="text-sm text-text-main">
            Confirming schedules this account for deletion after a 30-day grace period.
          </p>
          <ul className="flex flex-col gap-xs text-sm text-text-muted">
            <li>Nothing is erased today. Your plants, logs and history stay as they are.</li>
            <li>The account keeps working normally for the whole grace period.</li>
            <li>
              Cancel any time before the purge date and the account is restored in full.
            </li>
            <li>
              You stay signed in, and signing in again works throughout the window — that
              is how you cancel from another device.
            </li>
          </ul>
          <Input
            label={`Type ${CONFIRM_PHRASE} to confirm`}
            id="delete-confirm-phrase"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            hint={`Enter ${CONFIRM_PHRASE} in capitals.`}
            disabled={scheduling}
          />
          {/*
            The typed phrase guards against a mis-click; this guards against
            someone else at an unlocked screen. The server verifies it — the
            phrase is never sent.
          */}
          <Input
            label="Account password"
            id="delete-confirm-password"
            type="password"
            value={password}
            onChange={(e) => {
              setPasswordError('')
              setPassword(e.target.value)
            }}
            autoComplete="current-password"
            error={passwordError || undefined}
            hint={
              passwordError ? undefined : 'Confirms it is you and not someone at your screen.'
            }
            disabled={scheduling}
          />
          {scheduleError && <Alert tone="error">{scheduleError}</Alert>}
          <div className="flex justify-end gap-sm">
            <Button variant="ghost" onClick={closeDeleteModal} disabled={scheduling}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={scheduling}
              disabled={!confirmOk || password === ''}
              onClick={() => void scheduleDeletion()}
            >
              Schedule deletion
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
