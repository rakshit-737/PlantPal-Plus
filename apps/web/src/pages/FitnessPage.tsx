import { useEffect, useState } from 'react'
import { Card, Spinner, EmptyState, Modal, PageHeader, Button, Input, Progress } from '../components/ui'
import { listWorkouts, logWorkout, getSummary, type Workout, type WeeklySummary } from '../lib/fitnessApi'

const ACTIVITY_ICONS: Record<string, string> = {
  WALK: '🚶', RUN: '🏃', CYCLE: '🚴', SWIM: '🏊',
  STRENGTH: '💪', YOGA: '🧘', HIIT: '⚡', SPORT: '⚽', OTHER: '🏋️',
}

const ACTIVITY_TYPES = ['WALK', 'RUN', 'CYCLE', 'SWIM', 'STRENGTH', 'YOGA', 'HIIT', 'SPORT', 'OTHER']
const INTENSITIES = ['LOW', 'MODERATE', 'VIGOROUS']

function weekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff)).toISOString().slice(0, 10)
}

export function FitnessPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [summary, setSummary] = useState<WeeklySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [logOpen, setLogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [activityType, setActivityType] = useState('WALK')
  const [durationMins, setDurationMins] = useState('')
  const [intensity, setIntensity] = useState('MODERATE')
  const [steps, setSteps] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    Promise.all([listWorkouts(), getSummary(weekStart())])
      .then(([w, s]) => { setWorkouts(w); setSummary(s) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleLog() {
    setFormError('')
    if (!activityType) { setFormError('Activity type is required.'); return }
    const dur = durationMins ? parseInt(durationMins, 10) : undefined
    if (dur !== undefined && (dur < 1 || dur > 1440)) { setFormError('Duration must be 1–1440 minutes.'); return }
    setSaving(true)
    try {
      await logWorkout({
        activity_type: activityType,
        duration_mins: dur ?? null,
        perceived_intensity: intensity,
        steps: steps ? parseInt(steps, 10) : null,
        note: note || null,
        local_date_str: new Date().toISOString().slice(0, 10),
      })
      const [w, s] = await Promise.all([listWorkouts(), getSummary(weekStart())])
      setWorkouts(w); setSummary(s)
      setLogOpen(false)
      setDurationMins(''); setSteps(''); setNote('')
    } catch {
      setFormError('Failed to log workout. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const maxSteps = summary ? Math.max(...summary.by_day.map((d) => d.steps), 1) : 1

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-xl">
        <PageHeader
          title="Fitness"
          subtitle="Workouts, steps and weekly progress."
          action={<Button onClick={() => setLogOpen(true)}>+ Log Workout</Button>}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-xl"><Spinner size="lg" /></div>
      ) : (
        <>
          {summary && (
            <div className="mb-xl flex flex-col gap-md">
              <div className="grid grid-cols-3 gap-md">
                <Card>
                  <p className="text-sm text-text-muted">Workouts</p>
                  <p className="mt-xs font-heading text-2xl font-bold text-primary">{summary.total_workouts}</p>
                </Card>
                <Card>
                  <p className="text-sm text-text-muted">Minutes</p>
                  <p className="mt-xs font-heading text-2xl font-bold text-secondary">{summary.total_duration_mins}</p>
                </Card>
                <Card>
                  <p className="text-sm text-text-muted">Calories</p>
                  <p className="mt-xs font-heading text-2xl font-bold text-tertiary">{Math.round(summary.total_calories)}</p>
                </Card>
              </div>
              <Card>
                <p className="mb-md text-sm font-medium text-text-muted">Steps this week</p>
                <div className="flex items-end gap-xs" style={{ height: 80 }}>
                  {summary.by_day.map((d) => (
                    <div key={d.date} className="flex flex-1 flex-col items-center gap-xs">
                      <div
                        className="w-full rounded-sm bg-secondary/60"
                        style={{ height: `${Math.round((d.steps / maxSteps) * 64)}px`, minHeight: 2 }}
                        title={`${d.steps} steps`}
                      />
                      <span className="text-xs text-text-muted">{d.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {workouts.length === 0 ? (
            <Card>
              <EmptyState
                icon={<span className="text-4xl">🏃</span>}
                title="No workouts yet"
                body="Log your first workout to start tracking progress."
                action={<Button onClick={() => setLogOpen(true)}>Log Workout</Button>}
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-sm">
              {workouts.map((w) => (
                <Card key={w.id} className="flex items-center gap-md">
                  <span className="text-2xl">{ACTIVITY_ICONS[w.activity_type] ?? '🏋️'}</span>
                  <div className="flex-1">
                    <p className="font-medium text-text-main">{w.activity_type}</p>
                    <p className="text-xs text-text-muted">
                      {w.duration_mins ? `${w.duration_mins} min` : ''}
                      {w.calories_burned ? ` · ${Math.round(w.calories_burned)} kcal` : ''}
                      {w.steps ? ` · ${w.steps.toLocaleString()} steps` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-text-muted">{w.local_date_str}</span>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log Workout">
        <div className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <label className="text-sm font-medium text-text-main">Activity type</label>
            <select className="rounded-md border border-border bg-surface px-md py-sm text-sm text-text-main" value={activityType} onChange={(e) => setActivityType(e.target.value)}>
              {ACTIVITY_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <Input label="Duration (mins)" type="number" min={1} max={1440} value={durationMins} onChange={(e) => setDurationMins(e.target.value)} placeholder="optional" />
            {(activityType === 'WALK' || activityType === 'RUN') && (
              <Input label="Steps" type="number" min={0} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="optional" />
            )}
          </div>
          <div className="flex flex-col gap-xs">
            <label className="text-sm font-medium text-text-main">Intensity</label>
            <select className="rounded-md border border-border bg-surface px-md py-sm text-sm text-text-main" value={intensity} onChange={(e) => setIntensity(e.target.value)}>
              {INTENSITIES.map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>
          <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
          {formError && <p className="text-sm text-accent">{formError}</p>}
          <div className="flex justify-end gap-sm">
            <Button variant="secondary" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleLog}>Log</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
