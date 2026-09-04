import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
  useToast,
} from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { useReducedMotion } from '../hooks/useReducedMotion'
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
/**
 * The three modules, as dashboard shortcuts.
 *
 * Declared once rather than written out three times in the markup, so the
 * enabled-module filter below reads as a filter instead of three conditionals.
 */
const MODULES = [
  {
    key: 'plants',
    to: '/plants',
    title: 'Plant care',
    body: 'Watering intervals that follow species, pot and season.',
    action: 'Open plants',
    accent: 'text-primary',
    icon: rowIcon('M12 3c3.5 5 6 8 6 11.5a6 6 0 11-12 0C6 11 8.5 8 12 3z', 'h-6 w-6'),
  },
  {
    key: 'fitness',
    to: '/fitness',
    title: 'Fitness',
    body: 'Steps and workouts, with energy from MET values.',
    action: 'Open fitness',
    accent: 'text-secondary',
    icon: rowIcon('M6 6l12 12M4 8l2-2M20 16l-2 2M8 20l-2-2M18 4l2 2', 'h-6 w-6'),
  },
  {
    key: 'nutrition',
    to: '/nutrition',
    title: 'Nutrition',
    body: 'Meals and water against a target that adds up.',
    action: 'Open nutrition',
    accent: 'text-tertiary',
    icon: rowIcon(
      'M7 3v8M4 3v5a3 3 0 006 0V3M7 11v10M17 3v18M17 3c-2 2-3 4-3 7 0 2 1 3 3 3',
      'h-6 w-6',
    ),
  },
] as const

const fallbackIcon = rowIcon('M9 6l6 6-6 6')
const bellIcon = rowIcon('M12 4a6 6 0 016 6v4l2 3H4l2-3v-4a6 6 0 016-6zM10 20a2 2 0 004 0')
const flameIcon = rowIcon(
  'M12 3c2.5 3.5 6 6 6 10a6 6 0 11-12 0c0-2.5 1.2-4.3 2.6-6 .6 1.6 1.6 2.5 2.9 2.5C11 7.5 11.2 5.2 12 3z',
  'h-4 w-4',
)

/**
 * Entrance delay for a list row.
 *
 * The motion contract caps a stagger at 40ms per item and 8 items; past that a
 * list animates as one block, because a ninth row arriving a third of a second
 * after the first reads as the page being slow rather than as choreography.
 *
 * `reduced` collapses it to nothing. The stylesheet also clears animation-delay
 * under both reduce-motion signals, which is the structural guarantee; this is
 * the belt to that pair of braces, and it also stops a restored row inheriting
 * a list-position delay.
 */
function staggerDelay(index: number, total: number, reduced: boolean): string {
  if (reduced || total > 8) return '0ms'
  return `${index * 40}ms`
}

/**
 * A stat tile's placeholder, shaped like the tile it stands in for.
 *
 * The heights are matched to StatCard's three lines, not eyeballed: the eyebrow
 * is `text-[11px]`, and an arbitrary Tailwind font size emits no line-height, so
 * its line box is `normal` — about 13px, not the 16px an `h-4` would claim. The
 * value is `text-3xl` (36px line box) and the context line `text-xs` (16px).
 */
function TileSkeleton() {
  return (
    <Card>
      <Skeleton className="h-[13px] w-16" />
      <Skeleton className="mt-xs h-9 w-24" />
      <Skeleton className="mt-xs h-4 w-20" />
    </Card>
  )
}

/** A reminder or Today row's placeholder, at the same height as the real row. */
function RowSkeleton() {
  return (
    <Card className="flex items-center gap-md py-sm">
      <Skeleton className="h-5 w-5 shrink-0" />
      <Skeleton className="h-4 w-1/3 flex-1" />
      <Skeleton className="h-9 w-24 shrink-0 rounded-md" />
    </Card>
  )
}

export function DashboardPage() {
  usePageTitle('Dashboard')
  const { user } = useAuth()
  const { settings, loading: settingsLoading } = useSettings()
  const toast = useToast()
  const navigate = useNavigate()

  const [data, setData] = useState<DashboardData | null>(null)
  const [dashError, setDashError] = useState(false)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [remindersError, setRemindersError] = useState(false)
  const [loading, setLoading] = useState(true)
  // A Set: two plants can be watered concurrently without sharing a spinner.
  const [wateringIds, setWateringIds] = useState<Set<string>>(new Set())

  const reducedMotion = useReducedMotion()

  // The greeting animates on the first dashboard visit of a session and not
  // afterwards. This is the screen someone opens every morning and returns to
  // between every other route; re-playing an entrance each time is obnoxious.
  //
  // The read is in the initializer and the WRITE is in an effect, deliberately.
  // Writing during render is impure, and this app mounts under StrictMode,
  // which double-invokes initializers: the second pass would see the flag the
  // first one just wrote and decide the greeting had already played, so it
  // would never play at all. An effect only runs for a render that was
  // committed, so the one play per session is spent on a render someone saw.
  // Both accesses are guarded because sessionStorage throws in some privacy
  // modes rather than returning null.
  const [animateGreeting] = useState(() => {
    try {
      return !sessionStorage.getItem('plantpal-greeted')
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem('plantpal-greeted', '1')
    } catch {
      // Nothing to do: the greeting simply plays again next visit.
    }
  }, [])

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
  const plantCareOn = settings?.plant_care_enabled ?? true
  const fitnessOn = settings?.fitness_enabled ?? true
  const nutritionOn = settings?.nutrition_enabled ?? true
  const moduleEnabled: Record<string, boolean> = {
    plants: plantCareOn,
    fitness: fitnessOn,
    nutrition: nutritionOn,
  }

  const todayList = (data?.today_list ?? []).filter((item) =>
    item.type === 'PLANT_WATER'
      ? plantCareOn
      : item.type === 'LOG_MEAL'
        ? nutritionOn
        : item.type === 'LOG_WORKOUT'
          ? fitnessOn
          : true,
  )

  // Streak is cross-module and always shows; the rest follow their toggle.
  // Invariant 34 keeps at least one module on, so the minimum is two tiles.
  const tileCount = 1 + (plantCareOn ? 1 : 0) + (fitnessOn ? 1 : 0) + (nutritionOn ? 1 : 0)
  const tileCols =
    tileCount === 4 ? 'lg:grid-cols-4' : tileCount === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'

  const totalFailure = dashError && remindersError

  /*
   * The placeholder waits for settings as well as for the two data requests.
   * Settings arrive on their own independent fetch, and until they do the page
   * fails open to all four tiles — so a skeleton drawn before they land commits
   * to a four-column grid that collapses to two the moment a user with modules
   * switched off gets their real answer. That is the exact layout shift the
   * placeholder exists to prevent, so it holds until the shape is known.
   */
  const showSkeleton = loading || settingsLoading

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
      <div className={`mb-xl ${animateGreeting ? 'animate-grow-in' : ''}`}>
        <PageHeader
          title={`Hello, ${greetingName}`}
          subtitle={formatToday()}
          action={
            streak > 0 ? (
              /*
               * The streak as a ledger pair rather than a single chip.
               *
               * The design called for a GitHub-style contribution heat-grid
               * here. It is not buildable honestly: nothing stores per-day
               * activity — the streaks row is updated in place, so yesterday
               * is overwritten — and the current length cannot be laid back
               * onto a calendar, because freeze tokens let a run of 12 span
               * more than 12 days and the payload carries no last-counted
               * date. Ninety cells of invented history would be worse than
               * none on a page whose whole contract is that absent data never
               * renders as content. So the slot spends itself on the two
               * numbers that are real.
               */
              <div className="flex items-stretch gap-lg rounded-md border border-glass-border bg-glass px-md py-sm shadow-glass backdrop-blur-glass">
                <div className="flex items-center gap-sm">
                  <span className="text-primary">{flameIcon}</span>
                  <div>
                    <p className="font-mono text-xl font-semibold leading-none text-text-main">
                      {streak}
                    </p>
                    <p className="mt-[3px] text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
                      day streak
                    </p>
                  </div>
                </div>
                {data && data.streak.longest > 0 ? (
                  <div className="border-l border-glass-border pl-lg">
                    <p className="font-mono text-xl font-semibold leading-none text-text-muted">
                      {data.streak.longest}
                    </p>
                    <p className="mt-[3px] text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
                      longest
                    </p>
                  </div>
                ) : null}
              </div>
            ) : undefined
          }
        />
      </div>

      {showSkeleton ? (
        /*
         * Skeletons rather than a centred spinner, laid out as the real page:
         * the same tile grid at the same column count, then two rows. A
         * spinner tells you to wait and then shifts everything when it goes;
         * this holds the layout still, which is what the CLS budget is about.
         *
         * The live region is a sibling of the placeholders rather than their
         * parent. `role="status"` is an atomic region, so a mutating subtree
         * inside it gets the whole thing re-announced — and the tile count is
         * mutable, since it follows settings.
         */
        <>
          <span role="status" className="sr-only">
            Loading your dashboard
          </span>
          <div aria-hidden>
            <div className={`grid grid-cols-1 gap-md sm:grid-cols-2 ${tileCols}`}>
              {Array.from({ length: tileCount }, (_, i) => (
                <TileSkeleton key={i} />
              ))}
            </div>
            <div className="mt-xl flex flex-col gap-sm">
              <Skeleton className="mb-md h-7 w-32" />
              <RowSkeleton />
              <RowSkeleton />
            </div>
          </div>
        </>
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
              {plantCareOn && (
                <StatCard
                  label="Plants due"
                  value={String(data.plants.due_today)}
                  sub={`${data.plants.overdue} overdue`}
                  accent="text-primary-hover"
                  // An overdue plant is the one thing on this grid that is
                  // actually wrong, so it stops reading as quiet context.
                  subTone={data.plants.overdue > 0 ? 'text-accent' : 'text-text-muted'}
                />
              )}
              {fitnessOn && (
                <StatCard
                  label="Steps"
                  value={data.fitness.steps.toLocaleString()}
                  sub={`Goal: ${data.fitness.goal.toLocaleString()}`}
                  accent="text-secondary"
                  {...(data.fitness.goal > 0
                    ? { meter: (data.fitness.steps / data.fitness.goal) * 100 }
                    : {})}
                />
              )}
              {nutritionOn && (
                <StatCard
                  label="Calories"
                  value={String(Math.round(data.nutrition.calories_consumed))}
                  sub={`Target: ${data.nutrition.target}`}
                  accent="text-tertiary"
                  {...(data.nutrition.target > 0
                    ? { meter: (data.nutrition.calories_consumed / data.nutrition.target) * 100 }
                    : {})}
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
                {reminders.map((r, i) => (
                  <Card
                    key={r.id}
                    className="animate-grow-in flex items-center gap-md py-sm"
                    style={{ animationDelay: staggerDelay(i, reminders.length, reducedMotion) }}
                  >
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
                  {todayList.map((item, i) => (
                    <Card
                      key={`${item.type}-${item.id}`}
                      className="animate-grow-in flex items-center gap-md py-sm"
                      style={{ animationDelay: staggerDelay(i, todayList.length, reducedMotion) }}
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

          {/*
            The modules, as somewhere to go next.
            A new account's dashboard is four zeroes and an empty Today list,
            and below that the page simply stopped — half a screen of nothing
            under the only content. These are the three places the numbers come
            from, so the answer to "now what" is on the page rather than only in
            the sidebar.
          */}
          {!dashError && data ? (
            <section className="mt-xl" aria-labelledby="modules-heading">
              <h2
                id="modules-heading"
                className="mb-md font-heading text-xl font-semibold text-text-main"
              >
                Your modules
              </h2>
              <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
                {MODULES.filter((m) => moduleEnabled[m.key]).map((m) => (
                  <Card
                    key={m.key}
                    className="flex flex-col transition-shadow duration-standard ease-state hover:shadow-glass-raised"
                  >
                    <span className={m.accent}>{m.icon}</span>
                    <p className="mt-sm text-base font-semibold text-text-main">{m.title}</p>
                    <p className="mt-xs flex-1 text-sm text-text-muted">{m.body}</p>
                    <div className="mt-md">
                      <Button variant="secondary" onClick={() => navigate(m.to)}>
                        {m.action}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
