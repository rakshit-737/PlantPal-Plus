/**
 * Onboarding — docs/design/03-screen-wireframes.md §1, routed at /onboarding per
 * 04-navigation-flow.md. Two steps: which habits go in the ledger, and how the
 * ledger should fit the user's year and week. Skippable at any point.
 *
 * Trimmed from the wireframe's four screens deliberately. The welcome
 * illustration collects nothing, and the profile screen (height, weight,
 * activity level) plus the reminder-time screen ask for fields the settings API
 * does not expose — asking for them here would write them nowhere. Every
 * control below maps to a real column in PUT /api/v1/settings.
 *
 * Not force-launched, and the flow never redirects anyone into itself:
 * `profiles.onboarding_completed_at` and `profiles.onboarding_last_step` exist
 * in apps/api/src/db/migrations/001-auth-schema.sql, but no controller, repo or
 * route under apps/api/src/modules reads or writes either column (a search for
 * "onboard" across apps/api/src matches only that migration file, and settings
 * live in a different table, user_settings). The client therefore cannot tell a
 * new account from a returning one; auto-launching on sign-in would drop
 * long-standing users back into setup. Follow-up needed on the API: expose the
 * flag on GET /v1/auth/me (or GET /v1/settings) and stamp it from a
 * POST /v1/onboarding/complete, then have ProtectedRoute redirect on a null
 * value once.
 */
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Alert,
  Button,
  Card,
  ErrorState,
  PageHeader,
  Progress,
  Select,
  Spinner,
  useToast,
} from '../components/ui'
import { usePageTitle } from '../hooks/usePageTitle'
import { ApiError } from '../lib/apiClient'
import type { Hemisphere, UnitSystem, UserSettings, WeekStartDay } from '../lib/settingsApi'
import { useSettings } from '../settings/SettingsContext'

/** Exactly the settings this flow is allowed to write — nothing invented. */
type OnboardingDraft = Pick<
  UserSettings,
  | 'plant_care_enabled'
  | 'fitness_enabled'
  | 'nutrition_enabled'
  | 'hemisphere'
  | 'week_start_day'
  | 'unit_system'
>

type ModuleKey = 'plant_care_enabled' | 'fitness_enabled' | 'nutrition_enabled'

const iconProps = {
  'aria-hidden': true,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'square',
} as const

const MODULES: { key: ModuleKey; label: string; body: string; icon: ReactNode }[] = [
  {
    key: 'plant_care_enabled',
    label: 'Plant care',
    body: 'Watering schedules, care history and a photo timeline per plant.',
    icon: (
      <svg {...iconProps} className="h-5 w-5">
        <path d="M12 21c0-5 2-8 7-9-1 5-3 8-7 9z" />
        <path d="M12 21c0-5-2-8-7-9 1 5 3 8 7 9z" />
        <path d="M12 21V9" />
      </svg>
    ),
  },
  {
    key: 'fitness_enabled',
    label: 'Fitness',
    body: 'Workouts, steps and weekly activity summaries.',
    icon: (
      <svg {...iconProps} className="h-5 w-5">
        <path d="M4 9v6M20 9v6M7 6v12M17 6v12M7 12h10" />
      </svg>
    ),
  },
  {
    key: 'nutrition_enabled',
    label: 'Nutrition',
    body: 'Meals, calories and hydration against a daily target.',
    icon: (
      <svg {...iconProps} className="h-5 w-5">
        <path d="M4 11h16M5 11a7 7 0 0 0 14 0" />
        <path d="M10 3v4M14 4v3" />
      </svg>
    ),
  },
]

/**
 * A full-width toggle card: the whole row is the switch, so the target is large
 * on touch and the label reads as the control's name to a screen reader.
 */
function ModuleCard({
  label,
  body,
  icon,
  checked,
  onChange,
  descriptionId,
}: {
  label: string
  body: string
  icon: ReactNode
  checked: boolean
  onChange: (next: boolean) => void
  descriptionId: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={descriptionId}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start gap-md rounded-md border p-md text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        checked
          ? 'border-primary bg-primary/5 text-text-main'
          : 'border-border bg-surface text-text-muted hover:border-text-muted'
      }`}
    >
      <span className={`mt-[2px] shrink-0 ${checked ? 'text-primary' : 'text-text-muted'}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text-main">{label}</span>
        <span id={descriptionId} className="mt-xs block text-xs text-text-muted">
          {body}
        </span>
      </span>
      {/* The state marker: a filled stamp when tracked, an empty box when not. */}
      <span
        aria-hidden
        className={`mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border ${
          checked ? 'border-primary bg-primary text-on-primary' : 'border-border bg-background'
        }`}
      >
        {checked ? (
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
            className="h-3.5 w-3.5"
          >
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
        ) : null}
      </span>
    </button>
  )
}

/** The page frame, shared by the loading, failed and ready states. */
function Frame({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-xl">
        <PageHeader
          title="First entries"
          subtitle="Two steps to set up the ledger. Every answer can be changed later in Settings."
          action={action}
        />
      </div>
      {children}
    </div>
  )
}

/**
 * The flow itself. Mounted only once settings have loaded so the draft can be
 * seeded from the stored values in a plain useState — no syncing effect, and no
 * chance of a save that silently reverts a preference the user already set.
 */
function OnboardingFlow({ initial }: { initial: UserSettings }) {
  const { update } = useSettings()
  const toast = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState<1 | 2>(1)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [draft, setDraft] = useState<OnboardingDraft>({
    plant_care_enabled: initial.plant_care_enabled,
    fitness_enabled: initial.fitness_enabled,
    nutrition_enabled: initial.nutrition_enabled,
    hemisphere: initial.hemisphere,
    week_start_day: initial.week_start_day,
    unit_system: initial.unit_system,
  })

  const trackedCount = MODULES.filter((m) => draft[m.key]).length
  // Invariant 34, enforced here as well as server-side: the API refuses a state
  // with every module off, so the flow refuses to build one.
  const noModules = trackedCount === 0

  function set<K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function skip() {
    toast.info('Setup skipped. Your defaults are unchanged — adjust them in Settings.')
    navigate('/')
  }

  async function finish() {
    if (noModules) {
      setStep(1)
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      await update(draft)
      toast.success('Setup saved')
      navigate('/')
    } catch (err) {
      const message =
        err instanceof ApiError && err.code === 'NETWORK_ERROR'
          ? 'Could not reach the server. Check your connection and press Finish again.'
          : 'The server did not accept these settings. Check the answers and press Finish again.'
      setSaveError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Frame
      action={
        <Button variant="ghost" onClick={skip} disabled={saving}>
          Skip for now
        </Button>
      }
    >
      <div className="flex flex-col gap-md">
        <div className="flex flex-col gap-xs">
          <div className="flex items-baseline justify-between gap-md">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-text-muted">
              {`Step ${step} of 2`}
            </p>
            <p className="text-xs uppercase tracking-[0.08em] text-text-muted">
              {step === 1 ? 'Which habits' : 'How it fits'}
            </p>
          </div>
          <Progress value={step} max={2} srLabel={`Step ${step} of 2`} />
        </div>

        {step === 1 ? (
          <Card>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
              Which habits to track
            </p>
            <h2 className="mt-xs font-heading text-lg font-bold text-text-main">
              Pick the pages you want
            </h2>
            <p className="mt-xs text-sm text-text-muted">
              A module you turn off is hidden from the navigation and the dashboard. Turning it
              back on later keeps whatever it already holds.
            </p>

            <div className="mt-md flex flex-col gap-sm">
              {MODULES.map((m) => (
                <ModuleCard
                  key={m.key}
                  label={m.label}
                  body={m.body}
                  icon={m.icon}
                  descriptionId={`onboarding-${m.key}-desc`}
                  checked={draft[m.key]}
                  onChange={(next) => set(m.key, next)}
                />
              ))}
            </div>

            <p className="mt-sm font-mono text-xs text-text-muted">{trackedCount} of 3 tracked</p>

            {noModules ? (
              <div className="mt-sm">
                <Alert tone="error">
                  Nothing is tracked. Turn on at least one module to continue — the app keeps a
                  minimum of one.
                </Alert>
              </div>
            ) : null}
          </Card>
        ) : (
          <Card>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
              How it should fit
            </p>
            <h2 className="mt-xs font-heading text-lg font-bold text-text-main">
              Set the ledger's frame
            </h2>
            <p className="mt-xs text-sm text-text-muted">
              These shape the watering schedule and how the numbers read.
            </p>

            <div className="mt-md flex flex-col gap-md">
              <Select
                label="Hemisphere"
                hint="Feeds seasonal watering adjustment."
                value={draft.hemisphere}
                onChange={(e) => set('hemisphere', e.target.value as Hemisphere)}
              >
                <option value="NORTHERN">Northern</option>
                <option value="SOUTHERN">Southern</option>
                <option value="EQUATORIAL">Equatorial</option>
              </Select>
              <div className="grid gap-md sm:grid-cols-2">
                <Select
                  label="Week starts on"
                  hint="Sets the first day of weekly summaries."
                  value={draft.week_start_day}
                  onChange={(e) => set('week_start_day', e.target.value as WeekStartDay)}
                >
                  <option value="MONDAY">Monday</option>
                  <option value="SUNDAY">Sunday</option>
                </Select>
                <Select
                  label="Units"
                  hint="Applies to weights, volumes and distances."
                  value={draft.unit_system}
                  onChange={(e) => set('unit_system', e.target.value as UnitSystem)}
                >
                  <option value="METRIC">Metric</option>
                  <option value="IMPERIAL">Imperial</option>
                </Select>
              </div>
            </div>

            {saveError ? (
              <div className="mt-md">
                <Alert tone="error">{saveError}</Alert>
              </div>
            ) : null}
          </Card>
        )}

        <div className="flex items-center justify-end gap-sm border-t border-border pt-md">
          {step === 2 ? (
            <Button variant="secondary" onClick={() => setStep(1)} disabled={saving}>
              Back
            </Button>
          ) : null}
          {step === 1 ? (
            <Button
              onClick={() => {
                if (noModules) return
                setStep(2)
              }}
            >
              Next
            </Button>
          ) : (
            <Button loading={saving} onClick={() => void finish()}>
              Finish
            </Button>
          )}
        </div>
      </div>
    </Frame>
  )
}

export function OnboardingPage() {
  usePageTitle('Setup')
  const { settings, loadError, reload } = useSettings()

  // A failed load gets a retry, never an empty form: seeding the draft from
  // guessed defaults would let Finish overwrite settings the user already has.
  if (loadError) {
    return (
      <Frame>
        <ErrorState
          title="Couldn't load your settings"
          body="Setup needs your current preferences before it can change them. They are safe on the server — try again."
          onRetry={reload}
        />
      </Frame>
    )
  }

  if (!settings) {
    return (
      <Frame>
        <Card>
          <div className="flex justify-center py-lg">
            <Spinner />
          </div>
        </Card>
      </Frame>
    )
  }

  return <OnboardingFlow initial={settings} />
}
