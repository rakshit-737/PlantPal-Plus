import { useEffect, useState } from 'react'
import { Card, Spinner, EmptyState, PageHeader, Badge } from '../components/ui'
import { getAchievements, type UserAchievement } from '../lib/achievementsApi'

const MODULE_LABELS: Record<string, string> = {
  PLANT_CARE: '🌱 Plant Care',
  FITNESS: '💪 Fitness',
  NUTRITION: '🍽️ Nutrition',
  SHARED: '⭐ Shared',
}

const TIER_TONE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  BRONZE: 'default',
  SILVER: 'info',
  GOLD: 'warning',
  PLATINUM: 'success',
}

const MODULES = ['PLANT_CARE', 'FITNESS', 'NUTRITION', 'SHARED']

export function AchievementsPage() {
  const [items, setItems] = useState<UserAchievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAchievements()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-xl">
        <PageHeader title="Achievements" subtitle="Badges, streaks and milestones." />
      </div>

      {loading ? (
        <div className="flex justify-center py-xl"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<span className="text-4xl">🏆</span>}
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
                    const unlocked = ua.unlocked_at !== null
                    const a = ua.achievement
                    return (
                      <Card
                        key={ua.id}
                        className={`flex flex-col items-center gap-sm text-center ${unlocked ? '' : 'opacity-40 grayscale'}`}
                      >
                        <span className="text-3xl">{a.icon ?? '🏅'}</span>
                        <p className="text-sm font-semibold text-text-main">{a.name}</p>
                        <p className="text-xs text-text-muted">{a.description}</p>
                        <div className="flex items-center gap-xs">
                          <Badge tone={TIER_TONE[a.tier] ?? 'default'}>{a.tier}</Badge>
                          <span className="text-xs text-text-muted">{a.points}pts</span>
                        </div>
                        {!unlocked && ua.progress_pct > 0 && (
                          <p className="text-xs text-text-muted">{ua.progress_pct}% complete</p>
                        )}
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
