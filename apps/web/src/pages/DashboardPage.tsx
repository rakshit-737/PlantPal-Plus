import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
  StatCard,
  useToast,
} from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { useSettings } from '../settings/SettingsContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { getDashboard, type DashboardData } from '../lib/dashboardApi'
import { dismissReminder, listReminders, type Reminder } from '../lib/remindersApi'
import { logCare } from '../lib/plantsApi'

type TodayItem = DashboardData['today_list'][number]

const todayStr = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "Thursday 31 July 2026" — the notebook's dateline. */
const formatToday = () =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

/** Inline stroke icons, matching the nav-item style (no emoji). */
const rowIcon = (path: string, size = 'h-5 w-5') => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="square"
    className={`${size} shrink-0`}
    aria-hidden
  >
    <path d={path} />
  </svg>
)

// Keys match dashboardRepo's today_list item types.
const listIcons: Record<string, ReactNode> = {
  PLANT_WATER: rowIcon('M12 3c3.5 5 6 8 6 11.5a6 6 0 11-12 0C6 11 8.5 8 12 3z'),
  LOG_MEAL: rowIcon('M7 3v8M4 3v5a3 3 0 006 0V3M7 11v10M17 3v18M17 3c-2 2-3 4-3 7 0 2 1 3 3 3'),
  LOG_WORKOUT: rowIcon('M6 6l12 12M4 8l2-2M20 16l-2 2M8 20l-2-2M18 4l2 2'),
}
const fallbackIcon = rowIcon('M9 6l6 6-6 6')
const bellIcon = rowIcon('M12 4a6 6 0 016 6v4l2 3H4l2-3v-4a6 6 0 016-6zM10 20a2 2 0 004 0')
const flameIcon = rowIcon(
  'M12 3c2.5 3.5 6 6 6 10a6 6 0 11-12 0c0-2.5 1.2-4.3 2.6-6 .6 1.6 1.6 2.5 2.9 2.5C11 7.5 11.2 5.2 12 3z',
  'h-4 w-4',
)

export function DashboardPage() {
  usePageTitle('Dashboard')
  const { user } = useAuth()
  const { settings } = useSettings()
  const toast = useToast()
  const navigate = useNavigate()

  const [data, setData] = useState<DashboardData | null>(null)
  const [dashError, setDashError] = useState(false)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [remindersError, setRemindersError] = useState(false)
  const [loading, setLoading] = useState(true)
  // A Set: two plants can be watered concurrently without sharing a spinner.
  const [wateringIds, setWateringIds] = useState<Set<string>>(new Set())

  const load = useCallback(() => {
    setLoading(true)
    void Promise.allSettled([getDashboard(todayStr()), listReminders()]).then(
      ([dashboard, reminderList]) => {
        if (dashboard.status === 'fulfilled') {
          setData(dashboard.value)
          setDashError(false)
        } else {
          setData(null)
          setDashError(true)
        }
        if (reminderList.status === 'fulfilled') {
          setReminders(reminderList.value)
          setRemindersError(false)
        } else {
          setRemindersError(true)
        }
        setLoading(false)
      },
    )
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleLogWater(item: TodayItem) {
    setWateringIds((ids) => new Set(ids).add(item.id))
    try {
      await logCare(item.id, { action_type: 'WATER', local_date_str: todayStr() })
      toast.success(`Watered ${item.title}`)
      // Refresh the summary so the tile counts and Today list catch up.
      try {
        setData(await getDashboard(todayStr()))
        setDashError(false)
      } catch {
        // The water was logged; keep the stale summary rather than erroring.
      }
    } catch {
      toast.error(`Couldn't log water for ${item.title} — try again.`)
    } finally {
      setWateringIds((ids) => {
        const next = new Set(ids)
        next.delete(item.id)
        return next
      })
    }
  }

  async function handleDismiss(id: string) {
    // Optimistic removal via functional updates: a stale-snapshot restore
    // would resurrect rows dismissed concurrently.
    let removed: Reminder | undefined
    setReminders((current) => {
      removed = current.find((r) => r.id === id)
      return current.filter((r) => r.id !== id)
    })
    try {
      await dismissReminder(id)
    } catch {
      setReminders((current) =>
        removed && !current.some((r) => r.id === id) ? [...current, removed] : current,
      )
      toast.error("Couldn't dismiss — it's back in the list.")
    }
  }

  const greetingName = user?.email?.split('@')[0] ?? 'there'
  const streak = data?.streak.current ?? 0

  // Fail-open while settings load: treat every module as enabled.
  const fitnessOn = settings?.fitness_enabled ?? true
  const nutritionOn = settings?.nutrition_enabled ?? true

  const todayList = (data?.today_list ?? []).filter((item) =>
    item.type === 'LOG_MEAL'
      ? nutritionOn
      : item.type === 'LOG_WORKOUT'
        ? fitnessOn
        : true,
  )

  const tileCount = 2 + (fitnessOn ? 1 : 0) + (nutritionOn ? 1 : 0)
  const tileCols =
    tileCount === 4 ? 'lg:grid-cols-4' : tileCount === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'

  const totalFailure = dashError && remindersError

  function todayAction(item: TodayItem) {
    if (item.type === 'PLANT_WATER') {
      return (
        <Button
          variant="secondary"
          loading={wateringIds.has(item.id)}
          onClick={() => void handleLogWater(item)}
        >
          Log water
        </Button>
      )
    }
    if (item.type === 'LOG_MEAL') {
      return (
        <Button variant="secondary" onClick={() => navigate('/nutrition?log=1')}>
          Log meal
        </Button>
      )
    }
    if (item.type === 'LOG_WORKOUT') {
      return (
        <Button variant="secondary" onClick={() => navigate('/fitness?log=1')}>
          Log workout
        </Button>
      )
    }
    return null
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-xl">
        <PageHeader
          title={`Hello, ${greetingName}`}
          subtitle={formatToday()}
          action={
            streak > 0 ? (
              <div
                className="flex items-center gap-xs rounded-sm border border-border px-sm py-xs text-text-muted"
                aria-label={`Current streak: ${streak} days`}
              >
                {flameIcon}
                <span className="font-mono text-sm font-semibold text-text-main">{streak}</span>
                <span className="text-[11px] font-medium uppercase tracking-[0.08em]">
                  day streak
                </span>
              </div>
            ) : undefined
          }
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-xl">
          <Spinner size="lg" />
        </div>
      ) : totalFailure ? (
        <ErrorState
          title="Couldn't load your dashboard"
          body="Nothing came back from the server. Check your connection and try again."
          onRetry={load}
        />
      ) : (
        <>
          {dashError || !data ? (
            <ErrorState
              title="Couldn't load today's summary"
              body="The tiles and Today list didn't come back from the server. Try again."
              onRetry={load}
            />
          ) : (
            <div className={`grid grid-cols-1 gap-md sm:grid-cols-2 ${tileCols}`}>
              <StatCard
                label="Streak"
                value={String(data.streak.current)}
                sub={
                  data.streak.current > 0
                    ? `Longest: ${data.streak.longest}`
                    : 'Log something to start'
                }
                accent="text-primary"
              />
              <StatCard
                label="Plants due"
                value={String(data.plants.due_today)}
                sub={`${data.plants.overdue} overdue`}
                accent="text-primary-hover"
              />
              {fitnessOn && (
                <StatCard
                  label="Steps"
                  value={data.fitness.steps.toLocaleString()}
                  sub={`Goal: ${data.fitness.goal.toLocaleString()}`}
                  accent="text-secondary"
                />
              )}
              {nutritionOn && (
                <StatCard
                  label="Calories"
                  value={String(Math.round(data.nutrition.calories_consumed))}
                  sub={`Target: ${data.nutrition.target}`}
                  accent="text-tertiary"
                />
              )}
            </div>
          )}

          {remindersError ? (
            <section className="mt-xl">
              <h2 className="mb-md font-heading text-xl font-semibold text-text-main">
                Reminders
              </h2>
              <ErrorState
                title="Couldn't load reminders"
                body="Your reminders didn't come back from the server. Try again."
                onRetry={load}
              />
            </section>
          ) : reminders.length > 0 ? (
            <section className="mt-xl">
              <h2 className="mb-md font-heading text-xl font-semibold text-text-main">
                Reminders
              </h2>
              <div className="flex flex-col gap-sm">
                {reminders.map((r) => (
                  <Card key={r.id} className="flex items-center gap-md py-sm">
                    <span className="text-text-muted">{bellIcon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-main">{r.title}</p>
                      {r.body && <p className="text-xs text-text-muted">{r.body}</p>}
                    </div>
                    <Button variant="ghost" onClick={() => void handleDismiss(r.id)}>
                      Dismiss
                    </Button>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          {!dashError && data ? (
            <section className="mt-xl">
              <h2 className="mb-md font-heading text-xl font-semibold text-text-main">Today</h2>
              {todayList.length > 0 ? (
                <div className="flex flex-col gap-sm">
                  {todayList.map((item) => (
                    <Card
                      key={`${item.type}-${item.id}`}
                      className="flex items-center gap-md py-sm"
                    >
                      <span className="text-text-muted">
                        {listIcons[item.type] ?? fallbackIcon}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium text-text-main">
                        {item.title}
                      </span>
                      {todayAction(item)}
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <EmptyState
                    icon={rowIcon('M4 12l5 5L20 6', 'h-8 w-8')}
                    title="All caught up"
                    body="Nothing due today. Keep the streak going."
                  />
                </Card>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
