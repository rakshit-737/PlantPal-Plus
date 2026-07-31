import { useCallback, useEffect, useState } from 'react'
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
} from '../components/ui'
import { usePageTitle } from '../hooks/usePageTitle'
import {
  getAchievements,
  getStreaks,
  markSeen,
  type Streak,
  type UserAchievement,
} from '../lib/achievementsApi'

const MODULE_LABELS: Record<string, string> = {
  PLANT_CARE: 'Plant care',
  FITNESS: 'Fitness',
  NUTRITION: 'Nutrition',
  SHARED: 'Shared',
}

const STREAK_LABELS: Record<string, string> = {
  OVERALL: 'Overall',
  PLANT_CARE: 'Plant care',
  FITNESS: 'Fitness',
  NUTRITION: 'Nutrition',
}

const TIER_TONE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  BRONZE: 'default',
  SILVER: 'info',
  GOLD: 'warning',
  PLATINUM: 'success',
}

const MODULES = ['PLANT_CARE', 'FITNESS', 'NUTRITION', 'SHARED']

// The repo returns streaks alphabetically; the card reads better Overall-first.
const STREAK_ORDER = ['OVERALL', 'PLANT_CARE', 'FITNESS', 'NUTRITION']
const streakRank = (type: string) => {
  const i = STREAK_ORDER.indexOf(type)
  return i === -1 ? STREAK_ORDER.length : i
}

/** Rosette badge mark — inline stroke SVG per the field-notebook icon style. */
function RosetteIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="9" r="5" />
      <path d="M9.5 13.5L8 21l4-2.5 4 2.5-1.5-7.5" />
    </svg>
  )
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function AchievementsPage() {
  usePageTitle('Achievements')

  const [items, setItems] = useState<UserAchievement[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [itemsError, setItemsError] = useState(false)

  const [streaks, setStreaks] = useState<Streak[]>([])
  const [streaksLoading, setStreaksLoading] = useState(true)
  const [streaksError, setStreaksError] = useState(false)

  const loadAchievements = useCallback(() => {
    setItemsLoading(true)
    setItemsError(false)
    getAchievements()
      .then((data) => {
        setItems(data)
        // Clear "new badge" indicators. Pure bookkeeping — failures stay silent.
        markSeen().catch(() => {})
      })
      .catch(() => setItemsError(true))
      .finally(() => setItemsLoading(false))
  }, [])

  const loadStreaks = useCallback(() => {
    setStreaksLoading(true)
    setStreaksError(false)
    getStreaks()
      .then((rows) => setStreaks([...rows].sort((a, b) => streakRank(a.streak_type) - streakRank(b.streak_type))))
      .catch(() => setStreaksError(true))
      .finally(() => setStreaksLoading(false))
  }, [])

  useEffect(() => {
    loadAchievements()
    loadStreaks()
  }, [loadAchievements, loadStreaks])

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-xl">
        <PageHeader title="Achievements" subtitle="Badges, streaks and milestones." />
      </div>

      {/* Streaks load independently of the badge grid: one failing never blanks the other. */}
      <section className="mb-xl" aria-label="Streaks">
        {streaksLoading ? (
          <Card>
            <div className="flex justify-center py-md">
              <Spinner />
            </div>
          </Card>
        ) : streaksError ? (
          <ErrorState
            title="Couldn't load streaks"
            body="The streak ledger didn't come through. Your badges below are unaffected — try again."
            onRetry={loadStreaks}
          />
        ) : (
          <Card>
            {streaks.length === 0 ? (
              <p className="text-sm text-text-muted">
                No streaks yet. Log a care task, workout or meal to start one.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-lg sm:grid-cols-4">
                {streaks.map((s) => (
                  <div key={s.streak_type} className="flex flex-col items-start gap-xs">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                      {STREAK_LABELS[s.streak_type] ?? s.streak_type}
                    </p>
                    <p className="font-mono text-2xl font-semibold tracking-tight text-text-main">
                      {s.current_length}
                      <span className="text-sm font-normal text-text-muted">
                        {' '}
                        / longest {s.longest_length}
                      </span>
                    </p>
                    {/* BR-GAM-07: a freeze spares one missed day before the streak resets. */}
                    <span
                      title="A freeze spares one missed day"
                      className="inline-flex items-center gap-xs rounded-sm border border-border px-sm py-[2px] text-[11px] text-text-muted"
                    >
                      <span className="font-mono">{s.freeze_tokens}</span>
                      {s.freeze_tokens === 1 ? 'freeze day left' : 'freeze days left'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </section>

      {itemsLoading ? (
        <div className="flex justify-center py-xl">
          <Spinner size="lg" />
        </div>
      ) : itemsError ? (
        <ErrorState
          title="Couldn't load achievements"
          body="The badge list didn't come through. Your progress is safe — try again."
          onRetry={loadAchievements}
        />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<RosetteIcon className="h-10 w-10" />}
            title="No achievements yet"
            body="Complete daily habits to unlock badges."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-xl">
          {MODULES.map((mod) => {
            const group = items.filter((ua) => ua.achievement.module === mod)
            if (group.length === 0) return null
            return (
              <section key={mod}>
                <h2 className="mb-md font-heading text-lg font-semibold text-text-main">
                  {MODULE_LABELS[mod] ?? mod}
                </h2>
                <div className="grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-4">
                  {group.map((ua) => {
                    const a = ua.achievement
                    const unlocked = ua.unlocked_at !== null
                    return (
                      <Card
                        key={ua.id}
                        className="flex flex-col items-center gap-sm text-center"
                      >
                        {/* Locked state dims the icon only — text keeps AA contrast. */}
                        <span className={unlocked ? 'text-primary' : 'text-text-muted opacity-60 grayscale'}>
                          <RosetteIcon />
                        </span>
                        <p className="text-sm font-semibold text-text-main">{a.name}</p>
                        <p className="text-xs text-text-muted">{a.description}</p>
                        <div className="flex flex-wrap items-center justify-center gap-xs">
                          <Badge tone={TIER_TONE[a.tier] ?? 'default'}>{a.tier}</Badge>
                          {!unlocked && <Badge>Locked</Badge>}
                          <span className="font-mono text-xs text-text-muted">{a.points} pts</span>
                        </div>
                        {ua.unlocked_at ? (
                          <p className="text-xs text-text-muted">
                            Unlocked <span className="font-mono">{fmtDate(ua.unlocked_at)}</span>
                          </p>
                        ) : ua.progress_pct > 0 ? (
                          <p className="text-xs text-text-muted">
                            <span className="font-mono">{ua.progress_pct}%</span> complete
                          </p>
                        ) : null}
                      </Card>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
