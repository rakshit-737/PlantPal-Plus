import { useCallback, useEffect, useState } from 'react'
import {
  Badge,
  EmptyState,
  ErrorState,
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

/** Tier metal, as a decorative fill for the medallion only — never ink. */
const TIER_METAL: Record<string, [string, string]> = {
  BRONZE: ['#d69a63', '#8a5a2b'],
  SILVER: ['#dfe6ea', '#8d9aa3'],
  GOLD: ['#f2d27c', '#b8862b'],
  PLATINUM: ['#bfe7f7', '#5aa6c7'],
}

/**
 * The badge itself: a metal-rimmed medallion with the rosette inside. Unlocked
 * medallions carry their tier's metal; locked ones are a quiet outline with a
 * padlock, so the grid shows at a glance what is earned.
 */
function Medallion({ tier, unlocked }: { tier: string; unlocked: boolean }) {
  const [hi] = TIER_METAL[tier] ?? TIER_METAL['BRONZE']!
  if (!unlocked) {
    return (
      <span aria-hidden className="relative grid h-14 w-14 place-items-center border border-dashed border-glass-border text-text-muted">
        <RosetteIcon className="h-6 w-6 opacity-40" />
        <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center border border-glass-border bg-background">
          <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
            <rect x="3.5" y="7" width="9" height="6.5" />
            <path d="M5.5 7V5.5a2.5 2.5 0 015 0V7" />
          </svg>
        </span>
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className="relative grid h-14 w-14 place-items-center border-2"
      style={{ borderColor: hi, color: hi }}
    >
      <RosetteIcon className="h-6 w-6" />
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

  const earned = items.filter((ua) => ua.unlocked_at !== null)
  const points = earned.reduce((sum, ua) => sum + ua.achievement.points, 0)
  const pct = items.length > 0 ? Math.round((earned.length / items.length) * 100) : 0
  const collectionBlocks = Math.round((pct / 100) * 10)

  return (
    <div className="mx-auto max-w-6xl space-y-xl">
      {/* EDITORIAL HEADER */}
      <header>
        <p className="font-mono text-xs font-semibold tracking-widest text-text-muted uppercase">
          MILESTONES · BADGES & STREAKS
        </p>
        <h1 className="mt-xs font-display text-4xl sm:text-5xl font-medium leading-tight tracking-tight text-text-main">
          Achievements
        </h1>
      </header>

      {/* STREAKS — loads independently of the badge grid */}
      <section aria-label="Streaks" className="space-y-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted">
            STREAKS
          </h2>
        </div>

        {streaksLoading ? (
          <div className="border border-glass-border bg-surface/20 rounded-lg flex justify-center py-md">
            <Spinner />
          </div>
        ) : streaksError ? (
          <ErrorState
            title="Couldn't load streaks"
            body="The streak ledger didn't come through. Your badges below are unaffected — try again."
            onRetry={loadStreaks}
          />
        ) : (
          <div className="border border-glass-border rounded-lg overflow-hidden">
            {streaks.length === 0 ? (
              <div className="p-md">
                <p className="font-mono text-xs text-text-muted">
                  No streaks yet. Log a care task, workout or meal to start one.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-glass-border">
                {streaks.map((s) => (
                  <div
                    key={s.streak_type}
                    className={`flex flex-col gap-xs p-md ${
                      s.streak_type === 'OVERALL' ? 'bg-primary/[0.05]' : 'bg-surface/20'
                    }`}
                  >
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {STREAK_LABELS[s.streak_type] ?? s.streak_type}
                    </p>
                    <p className="font-mono text-3xl font-medium tracking-[-0.03em] text-text-main">
                      {s.current_length}
                      <span className="text-sm font-normal text-text-muted"> days</span>
                    </p>
                    <div className="flex items-center justify-between gap-sm">
                      <p className="font-mono text-xs text-text-muted">
                        longest <span className="text-text-main">{s.longest_length}</span>
                      </p>
                      {/* BR-GAM-07: a freeze spares one missed day before the streak resets. */}
                      <span
                        title="A freeze spares one missed day"
                        className="font-mono text-[10px] text-text-muted"
                      >
                        {s.freeze_tokens} ❄
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* BADGES */}
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
        <div className="border border-glass-border bg-surface/20 rounded-lg p-lg">
          <EmptyState
            icon={<RosetteIcon className="h-10 w-10" />}
            title="No achievements yet"
            body="Complete daily habits to unlock badges."
          />
        </div>
      ) : (
        <div className="space-y-xl">
          {/* Collection summary */}
          <section className="space-y-sm">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted">
              COLLECTION
            </h2>
            <div className="border border-glass-border bg-surface/20 rounded-lg p-lg">
              <div className="flex flex-col gap-md sm:flex-row sm:items-center">
                <div className="flex-1 space-y-md">
                  <div className="flex items-baseline justify-between">
                    <p className="font-display text-3xl font-medium tracking-[-0.02em] text-text-main">
                      {earned.length}
                      <span className="font-mono text-base font-normal text-text-muted"> / {items.length} badges</span>
                    </p>
                    <p className="font-mono text-3xl font-medium tracking-[-0.03em] text-tertiary">
                      {points}
                      <span className="font-mono text-xs font-normal text-text-muted"> pts</span>
                    </p>
                  </div>
                  {/* Text bar progress */}
                  <div>
                    <p className="font-mono text-xs text-primary mb-xs">
                      {'█'.repeat(collectionBlocks)}{'░'.repeat(10 - collectionBlocks)}
                      <span className="text-text-muted ml-sm">{pct}% complete</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {MODULES.map((mod) => {
            const group = items.filter((ua) => ua.achievement.module === mod)
            if (group.length === 0) return null
            return (
              <section key={mod} className="space-y-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-muted">
                    {MODULE_LABELS[mod] ?? mod}
                  </h2>
                  <span className="font-mono text-xs text-text-muted">
                    {group.filter(ua => ua.unlocked_at !== null).length}/{group.length} unlocked
                  </span>
                </div>
                <div className="border border-glass-border rounded-lg overflow-hidden divide-y divide-glass-border">
                  {group.map((ua) => {
                    const a = ua.achievement
                    const unlocked = ua.unlocked_at !== null
                    return (
                      <div
                        key={ua.id}
                        className={`flex items-center gap-md p-md transition-colors ${
                          unlocked ? 'bg-surface/20 hover:bg-surface/40' : 'bg-surface/10 opacity-80'
                        }`}
                      >
                        {/* Locked state dims the medallion only — text keeps AA contrast. */}
                        <Medallion tier={a.tier} unlocked={unlocked} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-text-main tracking-[-0.01em]">{a.name}</p>
                          <p className="text-xs text-text-muted leading-5">{a.description}</p>
                          {ua.unlocked_at ? (
                            <p className="font-mono text-[10px] text-text-muted mt-xs">
                              Unlocked <span className="text-text-main">{fmtDate(ua.unlocked_at)}</span>
                            </p>
                          ) : ua.progress_pct > 0 ? (
                            <div className="mt-xs">
                              <p className="font-mono text-[10px] text-primary">
                                {'█'.repeat(Math.round(ua.progress_pct / 10))}{'░'.repeat(10 - Math.round(ua.progress_pct / 10))}
                                <span className="text-text-muted ml-xs">{ua.progress_pct}%</span>
                              </p>
                            </div>
                          ) : null}
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-xs">
                          <Badge tone={TIER_TONE[a.tier] ?? 'default'}>{a.tier}</Badge>
                          {!unlocked && <Badge>Locked</Badge>}
                          <span className="font-mono text-[10px] text-text-muted">{a.points} pts</span>
                        </div>
                      </div>
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
