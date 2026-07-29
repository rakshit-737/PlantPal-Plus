import { useState } from 'react'
import { Card, PageHeader, Button, Badge, Alert } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { useTheme } from '../hooks/useTheme'
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
        className={`absolute top-[3px] h-4 w-4 rounded-sm bg-surface transition-all ${
          checked ? 'left-[24px]' : 'left-[3px]'
        }`}
      />
    </button>
  )
}

export function SettingsPage() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const { settings, update } = useSettings()
  const [loggingOut, setLoggingOut] = useState(false)
  const [moduleError, setModuleError] = useState('')

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
    }
  }

  async function toggleModule(key: (typeof MODULES)[number]['key'], next: boolean) {
    setModuleError('')
    try {
      await update({ [key]: next })
    } catch {
      setModuleError('At least one module must stay enabled.')
    }
  }

  async function setUnits(next: 'METRIC' | 'IMPERIAL') {
    try {
      await update({ unit_system: next })
    } catch {
      // Optimistic state already rolled back by the provider.
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-xl">
        <PageHeader title="Settings" subtitle="Account and preferences." />
      </div>

      <div className="flex flex-col gap-md">
        <Card>
          <p className="mb-sm text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">Account</p>
          <div className="flex items-center justify-between">
            <p className="text-text-main">{user?.email ?? '—'}</p>
            {user && (
              <Badge tone={STATUS_TONE[user.status] ?? 'default'}>
                {user.status.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
        </Card>

        <Card>
          <p className="mb-sm text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">Modules</p>
          <div className="flex flex-col gap-md">
            {MODULES.map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-md">
                <div>
                  <p className="text-sm font-medium text-text-main">{m.label}</p>
                  <p className="text-xs text-text-muted">{m.body}</p>
                </div>
                <Toggle
                  label={m.label}
                  checked={settings?.[m.key] ?? true}
                  disabled={!settings}
                  onChange={(next) => void toggleModule(m.key, next)}
                />
              </div>
            ))}
            {moduleError && <Alert tone="error">{moduleError}</Alert>}
          </div>
        </Card>

        <Card>
          <p className="mb-sm text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">Units</p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-main">Measurements</p>
            <div className="flex gap-sm">
              {(['METRIC', 'IMPERIAL'] as const).map((u) => (
                <Button
                  key={u}
                  variant={settings?.unit_system === u ? 'primary' : 'secondary'}
                  disabled={!settings}
                  onClick={() => void setUnits(u)}
                >
                  {u === 'METRIC' ? 'Metric' : 'Imperial'}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <p className="mb-sm text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">Appearance</p>
          <div className="flex items-center justify-between">
            <p className="text-text-main">Theme: {theme === 'dark' ? 'Dark' : 'Light'}</p>
            <Button variant="secondary" onClick={toggle}>
              Switch to {theme === 'dark' ? 'light' : 'dark'}
            </Button>
          </div>
        </Card>

        <Card>
          <p className="mb-md text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">Session</p>
          <Button variant="secondary" loading={loggingOut} onClick={handleLogout}>
            Sign out
          </Button>
        </Card>
      </div>
    </div>
  )
}
