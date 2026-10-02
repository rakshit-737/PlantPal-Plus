import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
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

/** "FRI · 02 OCT" — strong editorial dateline. */
const formatEditorialDate = (date = new Date()) => {
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date).toUpperCase()
  const dd = String(date.getDate()).padStart(2, '0')
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date).toUpperCase()
  return `${day} · ${dd} ${month}`
}

/** "Good morning" / "Good afternoon" / "Good evening", by local clock. */
const greetingFor = (date = new Date()) => {
  const h = date.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** Inline stroke icons */
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

const GLYPHS = {
  drop: 'M12 3.5c3.6 4.6 6 7.9 6 11a6 6 0 11-12 0c0-3.1 2.4-6.4 6-11z',
  pulse: 'M3 12h3.5l2.5-6 4 12 2.5-6H21',
  meal: 'M7 3v8M4 3v5a3 3 0 006 0V3M7 11v10M17 3v18M17 3c-2 2-3 4-3 7 0 2 1 3 3 3',
  sprout: 'M12 20v-8M12 13c0-4.2-2.9-7-7-7 0 4.2 2.9 7 7 7zM12 10.5c0-3.6 2.4-6.3 6.5-6.3 0 3.6-2.4 6.3-6.5 6.3zM7.5 20h9',
  flame: 'M12 3c2.5 3.5 6 6 6 10a6 6 0 11-12 0c0-2.5 1.2-4.3 2.6-6 .6 1.6 1.6 2.5 2.9 2.5C11 7.5 11.2 5.2 12 3z',
}

/** Botanical species line icon rendering */
function BotanicalSpeciesIcon({ name }: { name: string }) {
  if (name.toLowerCase().includes('tulsi')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6 text-primary">
        <path d="M12 20V10M12 10C10 7 6 7 6 11c0 3 4 4 6 4M12 10c2-3 6-3 6 1c0 3-4 4-6 4M12 14c-2 3-5 3-5 5M12 14c2 3 5 3 5 5" />
      </svg>
    )
  }
  if (name.toLowerCase().includes('hibiscus')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6 text-primary">
        <path d="M12 21v-7M12 14a4 4 0 100-8 4 4 0 000 8zM12 6V3M8 8L5 6M16 8l3-2" />
      </svg>
    )
  }
  if (name.toLowerCase().includes('aloe')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6 text-primary">
        <path d="M12 21V5M12 21C8 16 5 11 6 6M12 21c4-5 7-10 6-15" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6 text-primary">
      <path d="M12 20v-8M12 12c-3 0-6-3-6-6 4 0 6 3 6 6zM12 10c3 0 6-3 6-6-4 0-6 3-6 6z" />
    </svg>
  )
}

/**
 * Botanical Progress Dial Instrument ("TODAY / STREAK")
 */
function BotanicalProgressDial({
  streak,
  plantPct = 75,
  movePct = 74,
  nutritionPct = 43,
  reducedMotion = false,
}: {
  streak: number
  plantPct?: number
  movePct?: number
  nutritionPct?: number
  reducedMotion?: boolean
}) {
  const size = 210
  const center = size / 2
  const radius = 80
  const circumference = 2 * Math.PI * radius

  const plantOffset = circumference - (plantPct / 100) * (circumference * 0.35)
  const moveOffset = circumference - (movePct / 100) * (circumference * 0.35)
  const nutritionOffset = circumference - (nutritionPct / 100) * (circumference * 0.35)

  return (
    <div className="relative flex flex-col items-center justify-center p-sm shrink-0">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible select-none">
        {/* Outer Instrument Ticks */}
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * 360) / 24
          const rad = (angle * Math.PI) / 180
          const r1 = radius + 12
          const r2 = radius + (i % 6 === 0 ? 18 : 15)
          const x1 = center + r1 * Math.cos(rad)
          const y1 = center + r1 * Math.sin(rad)
          const x2 = center + r2 * Math.cos(rad)
          const y2 = center + r2 * Math.sin(rad)
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth={i % 6 === 0 ? 1.4 : 0.9}
              className={i % 6 === 0 ? 'text-text-muted/70' : 'text-text-muted/30'}
            />
          )
        })}

        {/* Base Track Circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          className="text-glass-border"
          strokeDasharray="3 3"
        />

        {/* Plants Arc - Botanical Green */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={reducedMotion ? plantOffset : circumference}
          transform={`rotate(-90 ${center} ${center})`}
          className="transition-all duration-700 ease-out"
          style={{ strokeDashoffset: plantOffset }}
        />

        {/* Movement Arc - Sky Blue */}
        <circle
          cx={center}
          cy={center}
          r={radius - 9}
          fill="none"
          stroke="var(--color-secondary)"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={reducedMotion ? moveOffset : circumference}
          transform={`rotate(30 ${center} ${center})`}
          className="transition-all duration-700 ease-out"
          style={{ strokeDashoffset: moveOffset }}
        />

        {/* Nutrition Arc - Warm Ochre */}
        <circle
          cx={center}
          cy={center}
          r={radius - 18}
          fill="none"
          stroke="var(--color-tertiary)"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={reducedMotion ? nutritionOffset : circumference}
          transform={`rotate(150 ${center} ${center})`}
          className="transition-all duration-700 ease-out"
          style={{ strokeDashoffset: nutritionOffset }}
        />
      </svg>

      {/* Center Instrument Readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="font-display text-4xl sm:text-5xl font-medium tracking-tight text-text-main">
          {streak}
        </span>
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-text-muted mt-1">
          DAY STREAK
        </span>
      </div>
    </div>
  )
}

function TileSkeleton() {
  return (
    <Card>
      <Skeleton className="h-[13px] w-16" />
      <Skeleton className="mt-sm h-[34px] w-24" />
      <Skeleton className="mt-sm h-4 w-20" />
    </Card>
  )
}

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

function RowSkeleton() {
  return (
    <div className="flex items-center gap-md px-md py-[14px]">
      <Skeleton className="h-10 w-10 shrink-0 !rounded-full" />
      <Skeleton className="h-4 w-1/3 flex-1" />
      <Skeleton className="h-9 w-24 shrink-0 rounded-md" />
    </div>
  )
}

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
  const [wateringIds, setWateringIds] = useState<Set<string>>(new Set())
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set())

  const [showStepsSparkline, setShowStepsSparkline] = useState(false)
  const [showCaloriesSparkline, setShowCaloriesSparkline] = useState(false)

  const reducedMotion = useReducedMotion()

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
      setCompletedTaskIds((prev) => new Set(prev).add(item.id))
      try {
        setData(await getDashboard(todayStr()))
        setDashError(false)
      } catch {
        // Keep stale summary
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

  function toggleTaskCompletion(item: TodayItem) {
    if (item.type === 'PLANT_WATER') {
      void handleLogWater(item)
    } else {
      setCompletedTaskIds((prev) => {
        const next = new Set(prev)
        if (next.has(item.id)) next.delete(item.id)
        else next.add(item.id)
        return next
      })
    }
  }

  const rawGreetingName = user?.email?.split('@')[0] ?? 'there'
  const greetingName = rawGreetingName.charAt(0).toUpperCase() + rawGreetingName.slice(1)
  const streak = data?.streak.current ?? 0

  const plantCareOn = settings?.plant_care_enabled ?? true
  const fitnessOn = settings?.fitness_enabled ?? true
  const nutritionOn = settings?.nutrition_enabled ?? true

  const todayList = (data?.today_list ?? []).filter((item) =>
    item.type === 'PLANT_WATER'
      ? plantCareOn
      : item.type === 'LOG_MEAL'
        ? nutritionOn
        : item.type === 'LOG_WORKOUT'
          ? fitnessOn
          : true,
  )

  const tileCount = 1 + (plantCareOn ? 1 : 0) + (fitnessOn ? 1 : 0) + (nutritionOn ? 1 : 0)
  const totalFailure = dashError && remindersError
  const showSkeleton = loading || settingsLoading

  const stepsPct = data ? percentOf(data.fitness.steps, data.fitness.goal) : null
  const kcalPct = data ? percentOf(data.nutrition.calories_consumed, data.nutrition.target) : null

  // Expanded plant details for My Garden strip
  const gardenPlants = [
    { name: 'Tulsi', species: 'Ocimum sanctum', status: 'water today', isDue: true, lastWatered: '5d ago', interval: '5 days' },
    { name: 'Hibiscus', species: 'Hibiscus rosa-sinensis', status: 'healthy', isDue: false, lastWatered: '2d ago', interval: '3 days' },
    { name: 'Aloe Vera', species: 'Aloe barbadensis', status: 'healthy', isDue: false, lastWatered: 'yesterday', interval: '10 days' },
    { name: 'Spearmint', species: 'Mentha spicata', status: 'healthy', isDue: false, lastWatered: '1d ago', interval: '2 days' },
  ]

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const weekDates = ['28', '29', '30', '01', '02', '03', '04']
  const weekHabits = [
    { name: 'Plant Care', dots: [true, true, true, true, false, null, null] },
    { name: 'Movement', dots: [true, true, false, true, true, null, null] },
    { name: 'Nutrition', dots: [true, true, true, false, true, null, null] },
  ]

  function todayAction(item: TodayItem) {
    if (item.type === 'PLANT_WATER') {
      return (
        <Button
          variant="secondary"
          size="sm"
          loading={wateringIds.has(item.id)}
          onClick={() => void handleLogWater(item)}
        >
          Log water
        </Button>
      )
    }
    if (item.type === 'LOG_MEAL') {
      return (
        <Button variant="secondary" size="sm" onClick={() => navigate('/nutrition?log=1')}>
          Log meal
        </Button>
      )
    }
    if (item.type === 'LOG_WORKOUT') {
      return (
        <Button variant="secondary" size="sm" onClick={() => navigate('/fitness?log=1')}>
          Log workout
        </Button>
      )
    }
    return null
  }

  const timeLabels = ['08:00', '09:30', '13:10', '18:00']

  return (
    <div className="mx-auto max-w-6xl space-y-xl">
      {/* ------------------------------------------------ EDITORIAL HEADER */}
      <header className="mb-lg">
        <p className="font-mono text-xs font-semibold tracking-widest text-text-muted uppercase">
          {formatEditorialDate()}
        </p>
        <h1 className="mt-xs font-display text-4xl sm:text-5xl lg:text-6xl font-medium leading-tight tracking-tight text-text-main">
          {greetingFor()}, {greetingName}.
        </h1>
      </header>

      {showSkeleton ? (
        <>
          <span role="status" className="sr-only">
            Loading your dashboard
          </span>
          <div aria-hidden className="grid gap-md lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-md">
              <HeroSkeleton />
              <RowSkeleton />
            </div>
            <div className="lg:col-span-5 grid grid-cols-1 gap-md">
              {Array.from({ length: tileCount }, (_, i) => (
                <TileSkeleton key={i} />
              ))}
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
        <div className="space-y-xl">
          {/* ------------------------------------------- NEEDS ATTENTION STRIP */}
          {remindersError ? (
            <section>
              <h2 className="sr-only">Reminders</h2>
              <ErrorState
                title="Couldn't load reminders"
                body="Your reminders didn't come back from the server. Try again."
                onRetry={load}
              />
            </section>
          ) : reminders.length > 0 ? (
            <section className="space-y-xs">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted">
                  NEEDS ATTENTION
                </h2>
                <span className="font-mono text-xs text-text-muted">{reminders.length} waiting</span>
              </div>
              <div className="border-l-4 border-l-amber-500 border border-glass-border bg-surface/30 rounded-md divide-y divide-glass-border overflow-hidden">
                {reminders.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-md px-md py-md transition-colors hover:bg-surface/50"
                  >
                    <div className="flex items-center gap-md min-w-0">
                      <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                      <span className="truncate text-sm font-medium text-text-main">{r.title}</span>
                    </div>
                    <div className="flex items-center gap-xs">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs font-mono text-primary hover:text-primary-hover"
                        onClick={() => {
                          if (r.target_entity_id) {
                            void logCare(r.target_entity_id, { action_type: 'WATER', local_date_str: todayStr() })
                          }
                          void handleDismiss(r.id)
                        }}
                      >
                        WATER
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs font-mono text-text-muted hover:text-text-main"
                        onClick={() => void handleDismiss(r.id)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* SUMMARY SECTION */}
          {dashError || !data ? (
            <ErrorState
              title="Couldn't load today's summary"
              body="The tiles and Today list didn't come back from the server. Try again."
              onRetry={load}
            />
          ) : (
            <div className="space-y-xl">
              {/* ---------------------------------- EXPANDED MY GARDEN PANEL */}
              {plantCareOn && (
                <section className="space-y-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted">
                      MY GARDEN
                    </h2>
                    <span className="font-mono text-xs font-medium text-primary">
                      {data.plants.due_today} NEED WATER
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
                    {gardenPlants.map((plant) => (
                      <div
                        key={plant.name}
                        className="group relative border border-glass-border bg-surface/30 p-md rounded-lg transition-all hover:border-primary/50 hover:bg-surface/50"
                      >
                        <div className="flex items-center justify-between mb-sm">
                          <div className="flex items-center gap-sm">
                            <BotanicalSpeciesIcon name={plant.name} />
                            <span className="font-semibold text-base sm:text-lg text-text-main">
                              {plant.name}
                            </span>
                          </div>
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              plant.isDue ? 'border-2 border-amber-500 bg-amber-500/20' : 'bg-primary'
                            }`}
                          />
                        </div>
                        <p className="font-mono text-xs sm:text-sm text-text-muted truncate mb-sm">
                          {plant.species}
                        </p>
                        <div className="pt-sm border-t border-glass-border/60 flex items-center justify-between font-mono text-xs text-text-muted">
                          <span>{plant.status}</span>
                          <span>{plant.lastWatered}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ---------------------------------- TODAY'S DAILY LEDGER */}
              <section className="space-y-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-xl sm:text-2xl font-semibold tracking-[-0.015em] text-text-main">
                    Today
                  </h2>
                  {todayList.length > 0 ? (
                    <span className="font-mono text-sm text-text-muted">
                      {completedTaskIds.size} / {todayList.length} to do
                    </span>
                  ) : null}
                </div>

                {todayList.length > 0 ? (
                  <div className="relative border border-glass-border bg-surface/20 rounded-lg p-lg">
                    {/* Vertical Day Line */}
                    <div
                      aria-hidden
                      className="absolute left-[64px] top-8 bottom-8 w-px bg-glass-border"
                    />

                    <div className="space-y-lg">
                      {todayList.map((item, i) => {
                        const isDone = completedTaskIds.has(item.id)
                        const timeStr = timeLabels[i % timeLabels.length] ?? '08:00'

                        return (
                          <div
                            key={`${item.type}-${item.id}`}
                            className="group relative flex items-center gap-lg text-base transition-all duration-150"
                          >
                            {/* Timestamp */}
                            <span className="font-mono text-sm text-text-muted w-10 shrink-0 text-right">
                              {timeStr}
                            </span>

                            {/* Node Toggle Button */}
                            <button
                              type="button"
                              onClick={() => toggleTaskCompletion(item)}
                              className="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-text-muted/60 bg-background transition-colors hover:border-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                              aria-label={`Mark ${item.title} as ${isDone ? 'incomplete' : 'complete'}`}
                            >
                              {isDone ? (
                                <span className="h-4 w-4 rounded-full bg-primary flex items-center justify-center text-background">
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="h-3 w-3 stroke-current fill-none"
                                    strokeWidth={3}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M20 6L9 17l-5-5" />
                                  </svg>
                                </span>
                              ) : null}
                            </button>

                            {/* Task Content */}
                            <div className="min-w-0 flex-1 flex items-center justify-between gap-md">
                              <span
                                className={`truncate font-medium text-base transition-colors ${
                                  isDone ? 'line-through text-text-muted' : 'text-text-main'
                                }`}
                              >
                                {item.title}
                              </span>

                              {/* Action button */}
                              <div>{todayAction(item)}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
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

              {/* ------------------ BOTANICAL DIAL + METRICS BULLETINS IN SAME ROW */}
              <section className="space-y-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted">
                    INSTRUMENT READOUT &amp; BULLETINS
                  </h2>
                </div>

                <div className="border border-glass-border bg-surface/20 rounded-lg p-lg flex flex-col md:flex-row items-center justify-between gap-xl">
                  {/* Botanical Progress Dial (Left) */}
                  <div className="flex flex-col items-center">
                    <BotanicalProgressDial
                      streak={streak}
                      plantPct={75}
                      movePct={stepsPct ?? 74}
                      nutritionPct={kcalPct ?? 43}
                      reducedMotion={reducedMotion}
                    />
                  </div>

                  {/* Metrics Bulletins in Same Row (Right) */}
                  <div className="flex-1 w-full space-y-md border-t md:border-t-0 md:border-l border-glass-border pt-md md:pt-0 md:pl-xl">
                    {/* Streak Bulletin */}
                    <div className="flex items-baseline justify-between border-b border-glass-border pb-md">
                      <div>
                        <p className="font-mono text-4xl font-medium tracking-tight text-text-main">
                          {data.streak.current}
                        </p>
                        <p className="font-mono text-xs uppercase tracking-wider text-text-muted mt-0.5">
                          day streak
                        </p>
                      </div>
                      {data.streak.longest > 0 ? (
                        <div className="text-right">
                          <p className="font-mono text-4xl font-medium tracking-tight text-text-muted">
                            {data.streak.longest}
                          </p>
                          <p className="font-mono text-xs uppercase tracking-wider text-text-muted mt-0.5">
                            longest
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {/* Plants Due Bulletin */}
                    {plantCareOn && (
                      <div className="flex items-baseline justify-between border-b border-glass-border pb-md">
                        <div>
                          <p className="font-mono text-sm font-medium text-text-main">Plants due</p>
                          <p className="mt-xs font-mono text-4xl font-medium tracking-tight text-primary">
                            {data.plants.due_today}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-mono text-xs font-medium ${
                              data.plants.overdue > 0 ? 'text-accent' : 'text-text-muted'
                            }`}
                          >
                            {data.plants.overdue} overdue
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Steps Bulletin */}
                    {fitnessOn && (
                      <div className="border-b border-glass-border pb-md">
                        <button
                          type="button"
                          onClick={() => setShowStepsSparkline(!showStepsSparkline)}
                          className="w-full text-left focus:outline-none"
                        >
                          <div className="flex items-baseline justify-between">
                            <div>
                              <p className="font-mono text-sm font-medium text-text-main">Steps</p>
                              <p className="mt-xs font-mono text-4xl font-medium tracking-tight text-secondary">
                                {data.fitness.steps.toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-xs text-text-muted">
                                Goal: {data.fitness.goal.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {/* Text Bar meter */}
                          <div className="mt-sm font-mono text-xs text-secondary flex items-center justify-between">
                            <span>
                              {'█'.repeat(Math.min(10, Math.round((data.fitness.steps / (data.fitness.goal || 1)) * 10)))}
                              {'░'.repeat(Math.max(0, 10 - Math.round((data.fitness.steps / (data.fitness.goal || 1)) * 10)))}
                            </span>
                            <span className="text-xs text-text-muted">
                              {data.fitness.goal > 0 ? `${Math.round((data.fitness.steps / data.fitness.goal) * 100)}%` : ''}
                            </span>
                          </div>
                        </button>

                        {showStepsSparkline && (
                          <div className="mt-sm pt-sm border-t border-glass-border/40 font-mono text-xs text-text-muted flex justify-between">
                            <span>7D AVG: 6,840</span>
                            <span>+572 VS AVG</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Calories Bulletin */}
                    {nutritionOn && (
                      <div className="pb-sm">
                        <button
                          type="button"
                          onClick={() => setShowCaloriesSparkline(!showCaloriesSparkline)}
                          className="w-full text-left focus:outline-none"
                        >
                          <div className="flex items-baseline justify-between">
                            <div>
                              <p className="font-mono text-sm font-medium text-text-main">Calories</p>
                              <p className="mt-xs font-mono text-4xl font-medium tracking-tight text-tertiary">
                                {Math.round(data.nutrition.calories_consumed).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-xs text-text-muted">
                                Target: {data.nutrition.target.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {/* Text Bar meter */}
                          <div className="mt-sm font-mono text-xs text-tertiary flex items-center justify-between">
                            <span>
                              {'█'.repeat(Math.min(10, Math.round((data.nutrition.calories_consumed / (data.nutrition.target || 1)) * 10)))}
                              {'░'.repeat(Math.max(0, 10 - Math.round((data.nutrition.calories_consumed / (data.nutrition.target || 1)) * 10)))}
                            </span>
                            <span className="text-xs text-text-muted">
                              {data.nutrition.target > 0 ? `${Math.round((data.nutrition.calories_consumed / data.nutrition.target) * 100)}%` : ''}
                            </span>
                          </div>
                        </button>

                        {showCaloriesSparkline && (
                          <div className="mt-sm pt-sm border-t border-glass-border/40 font-mono text-xs text-text-muted flex justify-between">
                            <span>TARGET: {data.nutrition.target} KCAL</span>
                            <span>ATWATER RECONCILED</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* ------------------ FULL-WIDTH WEEKLY HABIT MATRIX AT BOTTOM */}
              <section className="space-y-sm pt-md">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted">
                    WEEKLY HABIT MATRIX / SEP 28 — OCT 04
                  </h2>
                </div>

                <div className="border border-glass-border bg-surface/20 rounded-lg p-lg font-mono text-sm sm:text-base space-y-md w-full">
                  {/* Header row */}
                  <div className="flex items-center justify-between text-xs text-text-muted border-b border-glass-border/50 pb-sm">
                    <span className="w-28 font-medium">HABIT</span>
                    <div className="flex items-center justify-between flex-1 max-w-md">
                      {weekDays.map((d, i) => (
                        <div key={i} className="text-center w-8">
                          <span className="block text-xs font-bold text-text-main">{d}</span>
                          <span className="block text-[10px] text-text-muted">{weekDates[i]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Habit rows */}
                  {weekHabits.map((h) => (
                    <div key={h.name} className="flex items-center justify-between py-xs">
                      <span className="w-28 font-semibold text-text-main text-sm sm:text-base">{h.name}</span>
                      <div className="flex items-center justify-between flex-1 max-w-md">
                        {h.dots.map((val, idx) => (
                          <span key={idx} className="w-8 text-center text-lg">
                            {val === true ? (
                              <span className="text-primary">●</span>
                            ) : val === false ? (
                              <span className="text-text-muted">○</span>
                            ) : (
                              <span className="text-text-muted/30">·</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
