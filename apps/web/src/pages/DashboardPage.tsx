import { useEffect, useState } from 'react'
import { Card, Spinner, StatCard, EmptyState, PageHeader } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { getDashboard, type DashboardData } from '../lib/dashboardApi'

const todayStr = () => new Date().toISOString().slice(0, 10)

const listIcons: Record<string, string> = {
  PLANT_WATER: '💧',
  MEAL_LOG: '🍽️',
  LOG_WORKOUT: '💪',
}

export function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboard(todayStr())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const greetingName = user?.email?.split('@')[0] ?? 'there'
  const streak = data?.streak.current ?? 0

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-xl">
        <h1 className="font-heading text-3xl font-bold text-text-main">
          Hello, {greetingName} {streak > 0 ? '🔥' : '👋'}
        </h1>
        <p className="mt-xs text-text-muted">Here&apos;s your day at a glance.</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-xl">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Streak"
              value={data ? String(data.streak.current) : '—'}
              sub={data ? `Longest: ${data.streak.longest}` : 'Log something to start'}
              accent="text-primary"
            />
            <StatCard
              label="Plants due"
              value={data ? String(data.plants.due_today) : '—'}
              sub={data ? `${data.plants.overdue} overdue` : 'Watering & care'}
              accent="text-primary-hover"
            />
            <StatCard
              label="Steps"
              value={data ? data.fitness.steps.toLocaleString() : '—'}
              sub={data ? `Goal: ${data.fitness.goal.toLocaleString()}` : 'Toward your goal'}
              accent="text-secondary"
            />
            <StatCard
              label="Calories"
              value={data ? String(Math.round(data.nutrition.calories_consumed)) : '—'}
              sub={data ? `Target: ${data.nutrition.target}` : 'Toward your target'}
              accent="text-tertiary"
            />
          </div>

          <section className="mt-xl">
            <h2 className="mb-md font-heading text-xl font-semibold text-text-main">Today</h2>
            {data && data.today_list.length > 0 ? (
              <div className="flex flex-col gap-sm">
                {data.today_list.map((item) => (
                  <Card key={item.id} className="flex items-center gap-md py-sm">
                    <span className="text-xl">{listIcons[item.type] ?? '📌'}</span>
                    <span className="text-sm font-medium text-text-main">{item.title}</span>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <EmptyState
                  icon={<span className="text-4xl">✅</span>}
                  title="All caught up!"
                  body="No tasks for today. Keep up the streak."
                />
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  )
}
