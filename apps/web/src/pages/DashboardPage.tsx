import { Card } from '../components/ui'
import { useAuth } from '../auth/AuthContext'

/**
 * Unified daily dashboard — the shape follows GET /dashboard in
 * docs/architecture/03-api-specification.md. That endpoint is not implemented
 * on the backend yet, so this renders the layout with an honest empty state
 * rather than inventing data. When the endpoint lands, swap the placeholders
 * for a fetch keyed on today's date in the user's timezone.
 */

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub: string
  accent: string
}) {
  return (
    <Card>
      <p className="text-sm font-medium text-text-muted">{label}</p>
      <p className={`mt-xs font-heading text-3xl font-bold ${accent}`}>{value}</p>
      <p className="mt-xs text-sm text-text-muted">{sub}</p>
    </Card>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const greetingName = user?.email?.split('@')[0] ?? 'there'

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-xl">
        <h1 className="font-heading text-3xl font-bold text-text-main">
          Hello, {greetingName} 👋
        </h1>
        <p className="mt-xs text-text-muted">Here&apos;s your day at a glance.</p>
      </header>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Streak" value="—" sub="Log something to start" accent="text-primary" />
        <StatCard label="Plants due" value="—" sub="Watering & care" accent="text-primary-hover" />
        <StatCard label="Steps" value="—" sub="Toward your goal" accent="text-secondary" />
        <StatCard label="Calories" value="—" sub="Toward your target" accent="text-tertiary" />
      </div>

      <section className="mt-xl">
        <h2 className="mb-md font-heading text-xl font-semibold text-text-main">Today</h2>
        <Card>
          <p className="text-text-muted">
            Your unified to-do list will appear here once the dashboard API is connected —
            watering reminders, meals to log and workouts, all in one place.
          </p>
        </Card>
      </section>
    </div>
  )
}
