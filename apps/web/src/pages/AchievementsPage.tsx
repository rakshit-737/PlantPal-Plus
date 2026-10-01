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

/** Tier metal, as a decorative gradient for the medallion only — never ink. */
const TIER_METAL: Record<string, [string, string]> = {
  BRONZE: ['#d69a63', '#8a5a2b'],
  SILVER: ['#dfe6ea', '#8d9aa3'],
  GOLD: ['#f2d27c', '#b8862b'],
  PLATINUM: ['#bfe7f7', '#5aa6c7'],
}

/**
 * The badge itself: a metal-rimmed medallion with the rosette inside. Unlocked
 * medallions carry their tier's metal and a soft glow; locked ones are a quiet
 * outline with a padlock, so the grid shows at a glance what is earned.
 */
function Medallion({ tier, unlocked }: { tier: string; unlocked: boolean }) {
  const [hi, lo] = TIER_METAL[tier] ?? TIER_METAL['BRONZE']!
  if (!unlocked) {
    return (
      <span aria-hidden className="relative grid h-16 w-16 place-items-center rounded-full border border-dashed border-border-control/70 bg-text-muted/[0.05] text-text-muted">
        <RosetteIcon className="h-7 w-7 opacity-60" />
        <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border border-glass-border bg-surface-raised shadow-1">
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
            <path d="M5.5 7V5.5a2.5 2.5 0 015 0V7" />
          </svg>
        </span>
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className="relative grid h-16 w-16 place-items-center rounded-full p-[3px]"
      style={{
        background: `conic-gradient(from 210deg, ${hi}, ${lo}, ${hi}, ${lo}, ${hi})`,
        boxShadow: `0 10px 28px -10px ${lo}`,
      }}
    >
      <span className="grid h-full w-full place-items-center rounded-full bg-surface-raised text-primary">
        <RosetteIcon className="h-7 w-7" />
      </span>
    </span>
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
    <div className="mx-auto max-w-6xl">
      <div className="mb-xl">
        <PageHeader eyebrow="Milestones" title="Achievements" subtitle="Badges, streaks and milestones." />
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
              <div className="grid grid-cols-2 gap-md sm:grid-cols-4">
                {streaks.map((s) => (
                  <div
                    key={s.streak_type}
                    className={`flex flex-col items-start gap-xs rounded-md p-md ${
                      s.streak_type === 'OVERALL' ? 'bg-primary/[0.07]' : 'bg-text-muted/[0.04]'
                    }`}
                  >
                    <p className="eyebrow">{STREAK_LABELS[s.streak_type] ?? s.streak_type}</p>
                    <p className="font-mono text-3xl font-medium tracking-[-0.03em] text-text-main">
                      {s.current_length}
                      <span className="text-sm font-normal tracking-normal text-text-muted">
                        {' '}
                        / longest {s.longest_length}
                      </span>
                    </p>
                    {/* BR-GAM-07: a freeze spares one missed day before the streak resets. */}
                    <span
                      title="A freeze spares one missed day"
                      className="inline-flex items-center gap-xs rounded-full border border-glass-border bg-surface/60 px-sm py-[2px] text-[11px] text-text-muted"
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
          {(() => {
            const earned = items.filter((ua) => ua.unlocked_at !== null)
            const points = earned.reduce((sum, ua) => sum + ua.achievement.points, 0)
            const pct = Math.round((earned.length / items.length) * 100)
            return (
              <Card className="edge-gradient flex flex-col gap-md sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="eyebrow">Your collection</p>
                  <p className="mt-xs font-display text-3xl font-medium tracking-[-0.02em] text-text-main">
                    {earned.length} of {items.length} badges
                  </p>
                  <div aria-hidden className="mt-md h-2 max-w-md overflow-hidden rounded-full bg-text-muted/[0.12]">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-tertiary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="sm:text-right">
                  <p className="font-mono text-3xl font-medium tracking-[-0.03em] text-tertiary">{points}</p>
                  <p className="text-xs text-text-muted">points earned</p>
                </div>
              </Card>
            )
          })()}
          {MODULES.map((mod) => {
            const group = items.filter((ua) => ua.achievement.module === mod)
            if (group.length === 0) return null
            return (
              <section key={mod}>
                <h2 className="mb-md font-heading text-xl font-semibold tracking-[-0.015em] text-text-main">
                  {MODULE_LABELS[mod] ?? mod}
                </h2>
                <div className="grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-4">
                  {group.map((ua) => {
                    const a = ua.achievement
                    const unlocked = ua.unlocked_at !== null
                    return (
                      <Card
                        key={ua.id}
                        className={`group relative flex flex-col items-center gap-sm overflow-hidden text-center transition-[transform,box-shadow] duration-standard ease-state hover:-translate-y-0.5 hover:shadow-glass-raised ${
                          unlocked ? '' : 'opacity-[0.92]'
                        }`}
                      >
                        {unlocked ? (
                          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-primary/[0.08] to-transparent" />
                        ) : null}
                        {/* Locked state dims the medallion only — text keeps AA contrast. */}
                        <Medallion tier={a.tier} unlocked={unlocked} />
                        <p className="mt-xs text-sm font-semibold text-text-main">{a.name}</p>
                        <p className="text-xs leading-5 text-text-muted">{a.description}</p>
                        <div className="mt-auto flex flex-wrap items-center justify-center gap-xs pt-xs">
                          <Badge tone={TIER_TONE[a.tier] ?? 'default'}>{a.tier}</Badge>
                          {!unlocked && <Badge>Locked</Badge>}
                          <span className="font-mono text-xs text-text-muted">{a.points} pts</span>
                        </div>
                        {ua.unlocked_at ? (
                          <p className="text-xs text-text-muted">
                            Unlocked <span className="font-mono">{fmtDate(ua.unlocked_at)}</span>
                          </p>
                        ) : ua.progress_pct > 0 ? (
                          <div className="w-full">
                            <div aria-hidden className="h-1 overflow-hidden rounded-full bg-text-muted/[0.12]">
                              <div className="h-full rounded-full bg-primary/70" style={{ width: `${ua.progress_pct}%` }} />
                            </div>
                            <p className="mt-xs text-xs text-text-muted">
                              <span className="font-mono">{ua.progress_pct}%</span> complete
                            </p>
                          </div>
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
