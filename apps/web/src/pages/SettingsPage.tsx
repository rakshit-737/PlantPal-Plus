import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorState,
  Input,
  PageHeader,
  Select,
  Spinner,
  useToast,
} from '../components/ui'
import { usePageTitle } from '../hooks/usePageTitle'
import { useTheme } from '../hooks/useTheme'
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

export function SettingsPage() {
  usePageTitle('Settings')
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const { settings, loading, loadError, reload, update } = useSettings()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  // No cancel-deletion endpoint exists yet (checked apps/api auth routes);
  // per FR-ACC-02 signing in during the grace window is what keeps the account.
  const showRecover = searchParams.get('recover') === '1'

  const [loggingOut, setLoggingOut] = useState(false)
  const [moduleError, setModuleError] = useState('')
  // null = follow the server value; a string = the user is editing.
  const [capDraft, setCapDraft] = useState<string | null>(null)
  const [capSaving, setCapSaving] = useState(false)

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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-xl">
        <PageHeader title="Settings" subtitle="Account and preferences." />
      </div>

      <div className="flex flex-col gap-md">
        {showRecover && (
          <Alert tone="info">
            Deletion is scheduled for this account. Signing in before the purge date keeps
            it — you are signed in now, so the account stays under the 30-day grace policy.
            No further action is needed.
          </Alert>
        )}

        <Section eyebrow="Account">
          <div className="flex items-center justify-between gap-md">
            <p className="text-text-main">{user?.email ?? '—'}</p>
            {user && (
              <Badge tone={STATUS_TONE[user.status] ?? 'default'}>
                {user.status.replace(/_/g, ' ')}
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
                  hint={
                    settings.quiet_hours_mode === 'WINDOW'
                      ? 'Window start and end times cannot be set here yet.'
                      : 'Controls when reminders can arrive.'
                  }
                  value={settings.quiet_hours_mode}
                  onChange={(e) =>
                    void save({ quiet_hours_mode: e.target.value as QuietHoursMode })
                  }
                >
                  <option value="OFF">Off</option>
                  <option value="WINDOW">Quiet window</option>
                  <option value="SCHEDULED_ONLY">Scheduled only</option>
                </Select>
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
                      hint={capInvalid ? undefined : 'Most notifications sent per day (1–20).'}
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
      </div>
    </div>
  )
}
