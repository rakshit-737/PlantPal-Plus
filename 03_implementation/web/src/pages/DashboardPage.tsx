import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Ring,
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

/** "Good morning" / "Good afternoon" / "Good evening", by the local clock. */
const greetingFor = (date = new Date()) => {
  const h = date.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** Inline stroke icons, matching the nav-item style (no emoji). */
const rowIcon = (path: string, size = 'h-5 w-5') => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${size} shrink-0`}
    aria-hidden
  >
    <path d={path} />
  </svg>
)

/** A glyph in a soft disc of its own ink — the list-row and tile icon chip. */
function InkChip({ ink, children, size = 'h-10 w-10' }: { ink: string; children: ReactNode; size?: string }) {
  return (
    <span aria-hidden className={`relative grid shrink-0 place-items-center rounded-full ${size} ${ink}`}>
      <span className="absolute inset-0 rounded-full bg-current opacity-[0.12]" />
      <span className="relative">{children}</span>
    </span>
  )
}

/** Which ink a Today/reminder row takes, by its type. */
const rowInk: Record<string, string> = {
  PLANT_WATER: 'text-primary',
  LOG_MEAL: 'text-tertiary',
  LOG_WORKOUT: 'text-secondary',
}

// Keys match dashboardRepo's today_list item types.
const GLYPHS = {
  drop: 'M12 3.5c3.6 4.6 6 7.9 6 11a6 6 0 11-12 0c0-3.1 2.4-6.4 6-11z',
  pulse: 'M3 12h3.5l2.5-6 4 12 2.5-6H21',
  meal: 'M7 3v8M4 3v5a3 3 0 006 0V3M7 11v10M17 3v18M17 3c-2 2-3 4-3 7 0 2 1 3 3 3',
  sprout: 'M12 20v-8M12 13c0-4.2-2.9-7-7-7 0 4.2 2.9 7 7 7zM12 10.5c0-3.6 2.4-6.3 6.5-6.3 0 3.6-2.4 6.3-6.5 6.3zM7.5 20h9',
}

const listIcons: Record<string, ReactNode> = {
  PLANT_WATER: rowIcon(GLYPHS.drop),
  LOG_MEAL: rowIcon(GLYPHS.meal),
  LOG_WORKOUT: rowIcon(GLYPHS.pulse),
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
    icon: rowIcon(GLYPHS.sprout, 'h-6 w-6'),
  },
  {
    key: 'fitness',
    to: '/fitness',
    title: 'Fitness',
    body: 'Steps and workouts, with energy from MET values.',
    action: 'Open fitness',
    accent: 'text-secondary',
    icon: rowIcon(GLYPHS.pulse, 'h-6 w-6'),
  },
  {
    key: 'nutrition',
    to: '/nutrition',
    title: 'Nutrition',
    body: 'Meals and water against a target that adds up.',
    action: 'Open nutrition',
    accent: 'text-tertiary',
    icon: rowIcon(GLYPHS.meal, 'h-6 w-6'),
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
      <Skeleton className="mt-sm h-[34px] w-24" />
      <Skeleton className="mt-sm h-4 w-20" />
    </Card>
  )
}

/** The rings card's placeholder: a ring-sized disc and three legend lines. */
function HeroSkeleton() {
  return (
    <Card className="flex items-center gap-lg">
      <Skeleton className="h-[148px] w-[148px] shrink-0 !rounded-full" />
      <div className="flex flex-1 flex-col gap-md">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </Card>
  )
}

/** A reminder or Today row's placeholder, at the same height as the real row. */
function RowSkeleton() {
  return (
    <div className="flex items-center gap-md px-md py-[14px]">
      <Skeleton className="h-10 w-10 shrink-0 !rounded-full" />
      <Skeleton className="h-4 w-1/3 flex-1" />
      <Skeleton className="h-9 w-24 shrink-0 rounded-md" />
    </div>
  )
}

/** Percentage of a goal, for display; null when there is no goal to divide by. */
function percentOf(value: number, goal: number): number | null {
  if (!(goal > 0)) return null
  return Math.round((value / goal) * 100)
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

  const stepsPct = data ? percentOf(data.fitness.steps, data.fitness.goal) : null
  const kcalPct = data ? percentOf(data.nutrition.calories_consumed, data.nutrition.target) : null
  // The rings card only draws what has a real denominator: steps against a
  // goal, calories against a target. Plant care has no "fraction of today
  // done" in the summary payload, so it gets a tile, not a ring.
  const showRings = fitnessOn || nutritionOn

  return (
    <div className="mx-auto max-w-6xl">
      <div className={`mb-xl ${animateGreeting ? 'animate-grow-in' : ''}`}>
        <PageHeader
          eyebrow={formatToday()}
          title={`${greetingFor()}, ${greetingName}`}
          subtitle="Here is today, across everything you tend."
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
              <div className="pane flex items-stretch gap-lg rounded-lg px-md py-[10px]">
                <div className="flex items-center gap-sm">
                  <InkChip ink="text-tertiary" size="h-9 w-9">
                    {flameIcon}
                  </InkChip>
                  <div>
                    <p className="font-mono text-xl font-medium leading-none text-text-main">
                      {streak}
                    </p>
                    <p className="mt-[4px] text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                      day streak
                    </p>
                  </div>
                </div>
                {data && data.streak.longest > 0 ? (
                  <div className="flex flex-col justify-center border-l border-glass-border pl-lg">
                    <p className="font-mono text-xl font-medium leading-none text-text-muted">
                      {data.streak.longest}
                    </p>
                    <p className="mt-[4px] text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">
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
         * the rings card, the same tile grid at the same count, then rows. A
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
            <div className={`grid gap-md ${showRings ? 'lg:grid-cols-12' : ''}`}>
              {showRings ? (
                <div className="lg:col-span-5">
                  <HeroSkeleton />
                </div>
              ) : null}
              <div
                className={`grid grid-cols-1 gap-md sm:grid-cols-2 ${
                  showRings ? 'lg:col-span-7' : tileCols
                } sm:[&>*:last-child:nth-child(odd)]:col-span-2`}
              >
                {Array.from({ length: tileCount }, (_, i) => (
                  <TileSkeleton key={i} />
                ))}
              </div>
            </div>
            <div className="mt-xl">
              <Skeleton className="mb-md h-7 w-32" />
              <Card className="!p-0">
                <RowSkeleton />
                <RowSkeleton />
              </Card>
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
            <div className={`grid gap-md ${showRings ? 'lg:grid-cols-12' : ''}`}>
              {showRings ? (
                <Card className="edge-gradient relative flex flex-col overflow-hidden lg:col-span-5">
                  <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(closest-side,var(--aurora-1),transparent)]" />
                  <p className="eyebrow relative">Today&apos;s rings</p>
                  <div className="relative mt-md flex flex-1 flex-col items-center justify-center gap-lg sm:flex-row">
                    <div className="relative grid shrink-0 place-items-center">
                      {fitnessOn ? (
                        <Ring
                          value={data.fitness.steps}
                          max={data.fitness.goal > 0 ? data.fitness.goal : 1}
                          label="Steps towards today's goal"
                          size={168}
                          thickness={14}
                          tone="secondary"
                        />
                      ) : null}
                      {nutritionOn ? (
                        <Ring
                          value={data.nutrition.calories_consumed}
                          max={data.nutrition.target > 0 ? data.nutrition.target : 1}
                          label="Calories towards today's target"
                          size={fitnessOn ? 124 : 168}
                          thickness={14}
                          tone="tertiary"
                          className={fitnessOn ? 'absolute' : ''}
                        />
                      ) : null}
                      <div aria-hidden className="absolute text-center">
                        <p className="font-display text-3xl font-medium leading-none text-text-main">{streak}</p>
                        <p className="mt-[3px] text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">streak</p>
                      </div>
                    </div>
                    <ul className="flex w-full flex-1 flex-col gap-md">
                      {fitnessOn ? (
                        <li className="flex items-center gap-sm">
                          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-secondary" />
                          <span className="flex-1">
                            <span className="block text-sm font-semibold text-text-main">Move</span>
                            <span className="block font-mono text-xs text-text-muted">
                              {data.fitness.steps.toLocaleString()} of {data.fitness.goal.toLocaleString()} steps
                            </span>
                          </span>
                          {stepsPct !== null ? (
                            <span className="font-mono text-sm font-medium text-secondary">{stepsPct}%</span>
                          ) : null}
                        </li>
                      ) : null}
                      {nutritionOn ? (
                        <li className="flex items-center gap-sm">
                          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-tertiary" />
                          <span className="flex-1">
                            <span className="block text-sm font-semibold text-text-main">Nourish</span>
                            <span className="block font-mono text-xs text-text-muted">
                              {Math.round(data.nutrition.calories_consumed).toLocaleString()} of{' '}
                              {data.nutrition.target.toLocaleString()} kcal
                            </span>
                          </span>
                          {kcalPct !== null ? (
                            <span className="font-mono text-sm font-medium text-tertiary">{kcalPct}%</span>
                          ) : null}
                        </li>
                      ) : null}
                      <li className="rule-fade" aria-hidden />
                      <li className="text-xs leading-5 text-text-muted">
                        The streak grows on days every habit you track has counted.
                      </li>
                    </ul>
                  </div>
                </Card>
              ) : null}

              <div
                className={`grid grid-cols-1 gap-md sm:grid-cols-2 ${
                  showRings ? 'lg:col-span-7' : tileCols
                } sm:[&>*:last-child:nth-child(odd)]:col-span-2`}
              >
                <StatCard
                  label="Streak"
                  value={String(data.streak.current)}
                  sub={
                    data.streak.current > 0
                      ? `Longest: ${data.streak.longest}`
                      : 'Log something to start'
                  }
                  accent="text-primary"
                  icon={flameIcon}
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
                    icon={rowIcon(GLYPHS.drop, 'h-4 w-4')}
                  />
                )}
                {fitnessOn && (
                  <StatCard
                    label="Steps"
                    value={data.fitness.steps.toLocaleString()}
                    sub={`Goal: ${data.fitness.goal.toLocaleString()}`}
                    accent="text-secondary"
                    icon={rowIcon(GLYPHS.pulse, 'h-4 w-4')}
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
                    icon={rowIcon(GLYPHS.meal, 'h-4 w-4')}
                    {...(data.nutrition.target > 0
                      ? { meter: (data.nutrition.calories_consumed / data.nutrition.target) * 100 }
                      : {})}
                  />
                )}
              </div>
            </div>
          )}

          {remindersError ? (
            <section className="mt-2xl">
              <h2 className="mb-md font-heading text-xl font-semibold tracking-[-0.015em] text-text-main">
                Reminders
              </h2>
              <ErrorState
                title="Couldn't load reminders"
                body="Your reminders didn't come back from the server. Try again."
                onRetry={load}
              />
            </section>
          ) : reminders.length > 0 ? (
            <section className="mt-2xl">
              <div className="mb-md flex items-baseline justify-between">
                <h2 className="font-heading text-xl font-semibold tracking-[-0.015em] text-text-main">
                  Reminders
                </h2>
                <span className="font-mono text-xs text-text-muted">{reminders.length} waiting</span>
              </div>
              <div className="pane divide-y divide-glass-border overflow-hidden rounded-lg">
                {reminders.map((r, i) => (
                  <div
                    key={r.id}
                    className="animate-grow-in flex items-center gap-md px-md py-[12px] transition-colors hover:bg-text-main/[0.02]"
                    style={{ animationDelay: staggerDelay(i, reminders.length, reducedMotion) }}
                  >
                    <InkChip ink={rowInk[r.reminder_type] ?? 'text-text-muted'}>{bellIcon}</InkChip>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-main">{r.title}</p>
                      {r.body && <p className="text-xs text-text-muted">{r.body}</p>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => void handleDismiss(r.id)}>
                      Dismiss
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {!dashError && data ? (
            <section className="mt-2xl">
              <div className="mb-md flex items-baseline justify-between">
                <h2 className="font-heading text-xl font-semibold tracking-[-0.015em] text-text-main">Today</h2>
                {todayList.length > 0 ? (
                  <span className="font-mono text-xs text-text-muted">{todayList.length} to do</span>
                ) : null}
              </div>
              {todayList.length > 0 ? (
                <div className="pane divide-y divide-glass-border overflow-hidden rounded-lg">
                  {todayList.map((item, i) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="animate-grow-in flex items-center gap-md px-md py-[12px] transition-colors hover:bg-text-main/[0.02]"
                      style={{ animationDelay: staggerDelay(i, todayList.length, reducedMotion) }}
                    >
                      <InkChip ink={rowInk[item.type] ?? 'text-text-muted'}>
                        {listIcons[item.type] ?? fallbackIcon}
                      </InkChip>
                      <span className="min-w-0 flex-1 text-sm font-medium text-text-main">
                        {item.title}
                      </span>
                      {todayAction(item)}
                    </div>
                  ))}
                </div>
              ) : (
                <Card>
                  <EmptyState
                    icon={rowIcon('M4.5 12.5l4.5 4.5L19.5 7', 'h-7 w-7')}
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
            <section className="mt-2xl" aria-labelledby="modules-heading">
              <h2
                id="modules-heading"
                className="mb-md font-heading text-xl font-semibold tracking-[-0.015em] text-text-main"
              >
                Your modules
              </h2>
              <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
                {MODULES.filter((m) => moduleEnabled[m.key]).map((m) => (
                  <Card
                    key={m.key}
                    className="group relative flex flex-col overflow-hidden transition-[box-shadow,transform] duration-standard ease-state hover:-translate-y-0.5 hover:shadow-glass-raised"
                  >
                    <div
                      aria-hidden
                      className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-current opacity-[0.08] blur-2xl ${m.accent}`}
                    />
                    <InkChip ink={m.accent} size="h-12 w-12">
                      {m.icon}
                    </InkChip>
                    <p className="mt-md text-base font-semibold tracking-[-0.01em] text-text-main">{m.title}</p>
                    <p className="mt-xs flex-1 text-sm leading-6 text-text-muted">{m.body}</p>
                    <div className="mt-lg">
                      <Button variant="secondary" size="sm" onClick={() => navigate(m.to)}>
                        {m.action}
                        <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform duration-standard group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
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
