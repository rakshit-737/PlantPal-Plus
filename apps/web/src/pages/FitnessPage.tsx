import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Combobox,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  StatCard,
  useToast,
} from '../components/ui'
import { usePageTitle } from '../hooks/usePageTitle'
import {
  getPersonalRecords,
  getSummary,
  listWorkouts,
  logWorkout,
  searchExercises,
  type Exercise,
  type LogWorkoutInput,
  type LogWorkoutSetInput,
  type PersonalRecord,
  type WeeklySummary,
  type Workout,
  type WorkoutSet,
} from '../lib/fitnessApi'

const ACTIVITY_TYPES = ['WALK', 'RUN', 'CYCLE', 'SWIM', 'STRENGTH', 'YOGA', 'HIIT', 'SPORT', 'OTHER']
const ACTIVITY_LABELS: Record<string, string> = {
  WALK: 'Walk',
  RUN: 'Run',
  CYCLE: 'Cycle',
  SWIM: 'Swim',
  STRENGTH: 'Strength',
  YOGA: 'Yoga',
  HIIT: 'HIIT',
  SPORT: 'Sport',
  OTHER: 'Other',
}

const INTENSITIES = ['LOW', 'MODERATE', 'VIGOROUS']
const INTENSITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MODERATE: 'Moderate',
  VIGOROUS: 'Vigorous',
}

const RECORD_TYPE_LABELS: Record<string, string> = {
  HEAVIEST_WEIGHT: 'Heaviest weight',
  BEST_ESTIMATED_1RM: 'Best estimated 1RM',
  BEST_REP_COUNT: 'Best rep count',
}

function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function weekStart(): string {
  // Monday of the current week in LOCAL wall-clock time; serialising through
  // toISOString would shift the window for anyone not on UTC (FR-SYS-22).
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return localDate(new Date(d.getFullYear(), d.getMonth(), diff))
}

/** 62.5 → "62.5", 60 → "60" — ledger numbers without noise decimals. */
function fmtKg(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10)
}

/** Compress equal consecutive sets: "3 × 8 @ 60 kg · 1 × 6 @ 65 kg". */
function formatSets(sets: WorkoutSet[]): string {
  const runs: { reps: number; weight: number; count: number }[] = []
  for (const s of sets) {
    const last = runs[runs.length - 1]
    if (last && last.reps === s.reps && last.weight === s.weight_kg) last.count += 1
    else runs.push({ reps: s.reps, weight: s.weight_kg, count: 1 })
  }
  return runs.map((r) => `${r.count} × ${r.reps} @ ${fmtKg(r.weight)} kg`).join(' · ')
}

function recordValue(r: PersonalRecord): string {
  const n = Number(r.value)
  return r.record_type === 'BEST_REP_COUNT' ? `${fmtKg(n)} reps` : `${fmtKg(n)} kg`
}

const dumbbellIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="square"
    className="h-8 w-8"
    aria-hidden
  >
    <path d="M6 6l12 12M4 8l2-2M20 16l-2 2M8 20l-2-2M18 4l2 2" />
  </svg>
)

const sectionHeading = 'mb-sm font-heading text-xl font-semibold text-text-main'
const setInputClass =
  'w-full min-w-0 rounded-sm border border-border bg-surface px-sm py-sm font-mono text-sm text-text-main placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'

interface SetRow {
  reps: string
  weight: string
}

const EMPTY_SET_ROW: SetRow = { reps: '', weight: '' }

export function FitnessPage() {
  usePageTitle('Fitness')
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [workoutsLoading, setWorkoutsLoading] = useState(true)
  const [workoutsError, setWorkoutsError] = useState(false)

  const [summary, setSummary] = useState<WeeklySummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState(false)

  const [records, setRecords] = useState<PersonalRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState(false)

  const [logOpen, setLogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [activityType, setActivityType] = useState('WALK')
  const [durationMins, setDurationMins] = useState('')
  const [intensity, setIntensity] = useState('MODERATE')
  const [steps, setSteps] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState('')

  const [exerciseQuery, setExerciseQuery] = useState('')
  const [exerciseOptions, setExerciseOptions] = useState<Exercise[]>([])
  const [exerciseLoading, setExerciseLoading] = useState(false)
  const [exerciseSearchError, setExerciseSearchError] = useState('')
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null)
  const [setRows, setSetRows] = useState<SetRow[]>([EMPTY_SET_ROW])

  const loadWorkouts = useCallback(async () => {
    setWorkoutsLoading(true)
    try {
      setWorkouts(await listWorkouts())
      setWorkoutsError(false)
    } catch {
      setWorkoutsError(true)
    } finally {
      setWorkoutsLoading(false)
    }
  }, [])

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      setSummary(await getSummary(weekStart()))
      setSummaryError(false)
    } catch {
      setSummaryError(true)
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true)
    try {
      setRecords(await getPersonalRecords())
      setRecordsError(false)
    } catch {
      setRecordsError(true)
    } finally {
      setRecordsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadWorkouts()
    void loadSummary()
    void loadRecords()
  }, [loadWorkouts, loadSummary, loadRecords])

  // /fitness?log=1 (dashboard quick action) opens the modal, then the param is
  // stripped so refresh/back does not reopen it.
  useEffect(() => {
    if (searchParams.get('log') !== '1') return
    setLogOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete('log')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // Debounced catalogue search while the modal is open. An empty query browses
  // the full catalogue (the API caps at 100 rows).
  useEffect(() => {
    if (!logOpen) return
    let alive = true
    setExerciseLoading(true)
    const timer = window.setTimeout(() => {
      searchExercises(exerciseQuery.trim())
        .then((rows) => {
          if (!alive) return
          setExerciseOptions(rows)
          setExerciseSearchError('')
        })
        .catch(() => {
          if (!alive) return
          setExerciseOptions([])
          setExerciseSearchError('Exercise search failed. Keep typing to retry.')
        })
        .finally(() => {
          if (alive) setExerciseLoading(false)
        })
    }, 250)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [logOpen, exerciseQuery])

  const comboOptions = useMemo(
    () =>
      exerciseOptions.map((e) => ({
        id: e.id,
        label: e.name,
        sub: `MET ${Number(e.met_value).toFixed(1)}${e.muscle_group ? ` · ${e.muscle_group}` : ''}`,
      })),
    [exerciseOptions],
  )

  function resetForm() {
    setDurationMins('')
    setSteps('')
    setNote('')
    setExerciseQuery('')
    setSelectedExercise(null)
    setSetRows([EMPTY_SET_ROW])
    setFormError('')
  }

  async function handleLog() {
    setFormError('')
    const dur = durationMins.trim() ? Number.parseInt(durationMins, 10) : undefined
    if (dur !== undefined && (!Number.isInteger(dur) || dur < 1 || dur > 1440)) {
      setFormError('Duration must be 1–1440 minutes.')
      return
    }
    const stepCount = steps.trim() ? Number.parseInt(steps, 10) : undefined
    if (stepCount !== undefined && (!Number.isInteger(stepCount) || stepCount < 0)) {
      setFormError('Steps must be 0 or more.')
      return
    }

    // The server derives volume and e1RM from reps + weight (BR-FIT-14/15);
    // only the raw pairs are sent.
    let setsPayload: LogWorkoutSetInput[] | undefined
    if (selectedExercise?.is_strength) {
      const filled = setRows.filter((r) => r.reps.trim() !== '' || r.weight.trim() !== '')
      const parsed: LogWorkoutSetInput[] = []
      for (const row of filled) {
        const reps = Number.parseInt(row.reps, 10)
        const weight = Number.parseFloat(row.weight)
        if (!Number.isInteger(reps) || reps < 1 || !Number.isFinite(weight) || weight < 0) {
          setFormError('Each set needs reps (1 or more) and a weight in kg.')
          return
        }
        parsed.push({ set_index: parsed.length + 1, reps, weight_kg: weight })
      }
      if (parsed.length > 0) setsPayload = parsed
    }

    setSaving(true)
    try {
      const payload: LogWorkoutInput = {
        activity_type: activityType,
        local_date_str: localDate(new Date()),
        duration_mins: dur ?? null,
        perceived_intensity: intensity,
        // The Steps field only renders for WALK/RUN; if picking an exercise
        // switched the type away, retained step state must not ride along.
        steps: activityType === 'WALK' || activityType === 'RUN' ? (stepCount ?? null) : null,
        note: note.trim() || null,
      }
      if (selectedExercise) {
        payload.exercise_id = selectedExercise.id
        const met = Number(selectedExercise.met_value)
        if (Number.isFinite(met)) payload.met_value_at_log = met
      }
      if (setsPayload) payload.sets = setsPayload
      await logWorkout(payload)
      toast.success(
        selectedExercise
          ? `Logged ${selectedExercise.name}`
          : `Logged ${ACTIVITY_LABELS[activityType] ?? activityType} workout`,
      )
      setLogOpen(false)
      resetForm()
      void loadWorkouts()
      void loadSummary()
      void loadRecords()
    } catch {
      toast.error('Could not save the workout. Nothing was recorded — try again.')
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
          action={<Button onClick={() => setLogOpen(true)}>Log workout</Button>}
        />
      </div>

      {/* Weekly summary — loads independently of the workout list. */}
      <div className="mb-xl">
        {summaryLoading ? (
          <Card className="flex justify-center py-lg">
            <Spinner />
          </Card>
        ) : summaryError ? (
          <ErrorState
            title="Couldn't load the weekly summary"
            body="The summary request failed. The workout log below may still be available."
            onRetry={loadSummary}
          />
        ) : summary ? (
          <div className="flex flex-col gap-md">
            <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
              <StatCard
                label="Workouts"
                value={String(summary.total_workouts)}
                sub="sessions this week"
                accent="text-primary"
              />
              <StatCard
                label="Minutes"
                value={String(summary.total_duration_mins)}
                sub="active minutes"
                accent="text-secondary"
              />
              <StatCard
                label="Calories"
                value={String(Math.round(summary.total_calories))}
                sub="kcal estimated"
                accent="text-tertiary"
              />
            </div>
            <Card>
              <div className="mb-md flex items-baseline justify-between gap-sm">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
                  Steps this week
                </p>
                <p className="font-mono text-sm text-text-main">
                  {summary.total_steps.toLocaleString()}
                </p>
              </div>
              <div className="flex items-end gap-xs" style={{ height: 80 }}>
                {summary.by_day.map((d) => (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-xs">
                    <span className="sr-only">{`${d.date}: ${d.steps.toLocaleString()} steps`}</span>
                    <div
                      aria-hidden
                      className="w-full rounded-sm bg-secondary/60"
                      style={{ height: `${Math.round((d.steps / maxSteps) * 64)}px`, minHeight: 2 }}
                      title={`${d.steps.toLocaleString()} steps`}
                    />
                    <span aria-hidden className="font-mono text-[10px] text-text-muted">
                      {d.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : null}
      </div>

      <div className="grid items-start gap-md lg:grid-cols-3">
        {/* Workout log */}
        <section className="lg:col-span-2">
          <h2 className={sectionHeading}>Workout log</h2>
          {workoutsLoading ? (
            <div className="flex justify-center py-xl">
              <Spinner size="lg" />
            </div>
          ) : workoutsError ? (
            <ErrorState
              title="Couldn't load workouts"
              body="The workout list request failed. Your entries are safe — try again."
              onRetry={loadWorkouts}
            />
          ) : workouts.length === 0 ? (
            <Card>
              <EmptyState
                icon={dumbbellIcon}
                title="No workouts yet"
                body="Log your first workout to start tracking progress."
                action={<Button onClick={() => setLogOpen(true)}>Log workout</Button>}
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-sm">
              {workouts.map((w) => {
                const details = [
                  w.duration_mins ? `${w.duration_mins} min` : null,
                  w.calories_burned ? `${Math.round(w.calories_burned)} kcal` : null,
                  w.steps ? `${w.steps.toLocaleString()} steps` : null,
                  w.perceived_intensity
                    ? (INTENSITY_LABELS[w.perceived_intensity] ?? w.perceived_intensity).toLowerCase()
                    : null,
                ].filter(Boolean)
                return (
                  <Card key={w.id} className="flex items-start justify-between gap-md">
                    <div className="min-w-0">
                      <p className="font-medium text-text-main">
                        {ACTIVITY_LABELS[w.activity_type] ?? w.activity_type}
                      </p>
                      {details.length > 0 ? (
                        <p className="mt-xs font-mono text-xs text-text-muted">
                          {details.join(' · ')}
                        </p>
                      ) : null}
                      {w.sets.length > 0 ? (
                        <p className="mt-xs font-mono text-xs text-text-main">
                          {formatSets(w.sets)}
                        </p>
                      ) : null}
                      {w.total_volume_kg > 0 ? (
                        <p className="mt-xs font-mono text-xs text-text-muted">
                          {fmtKg(w.total_volume_kg)} kg total volume
                        </p>
                      ) : null}
                      {w.note ? <p className="mt-xs text-xs text-text-muted">{w.note}</p> : null}
                    </div>
                    <span className="shrink-0 font-mono text-xs text-text-muted">
                      {w.local_date_str}
                    </span>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {/* Personal records */}
        <section>
          <h2 className={sectionHeading}>Personal records</h2>
          {recordsLoading ? (
            <Card className="flex justify-center py-lg">
              <Spinner />
            </Card>
          ) : recordsError ? (
            <ErrorState
              title="Couldn't load personal records"
              body="The records request failed. Try again."
              onRetry={loadRecords}
            />
          ) : (
            <Card>
              {records.length === 0 ? (
                <p className="text-sm text-text-muted">
                  No records yet — they appear when you log strength sets.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {records.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-baseline justify-between gap-sm border-b border-border py-sm first:pt-0 last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-main">
                          {r.exercise_name}
                        </p>
                        <p className="text-xs text-text-muted">
                          {RECORD_TYPE_LABELS[r.record_type] ?? r.record_type}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm font-semibold text-text-main">
                          {recordValue(r)}
                        </p>
                        <p className="font-mono text-[10px] text-text-muted">
                          {String(r.achieved_at).slice(0, 10)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </section>
      </div>

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log workout" busy={saving}>
        <div className="flex flex-col gap-md">
          <Combobox
            label="Exercise"
            query={exerciseQuery}
            onQueryChange={setExerciseQuery}
            options={comboOptions}
            loading={exerciseLoading}
            error={exerciseSearchError || undefined}
            hint="Optional. Strength exercises unlock set tracking."
            placeholder="Search the catalogue"
            emptyText="No exercises match"
            onSelect={(option) => {
              if (!option) {
                setSelectedExercise(null)
                return
              }
              const exercise = exerciseOptions.find((e) => e.id === option.id) ?? null
              setSelectedExercise(exercise)
              if (exercise) {
                setExerciseQuery(exercise.name)
                if (ACTIVITY_TYPES.includes(exercise.activity_type)) {
                  setActivityType(exercise.activity_type)
                }
              }
            }}
          />

          <Select
            label="Activity type"
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_LABELS[t] ?? t}
              </option>
            ))}
          </Select>

          {selectedExercise?.is_strength ? (
            <div className="flex flex-col gap-sm">
              <div className="grid grid-cols-[1.5rem_1fr_1fr_2rem] items-center gap-sm">
                <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
                  Set
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
                  Reps
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
                  Weight kg
                </span>
                <span aria-hidden />
              </div>
              {setRows.map((row, i) => (
                <div key={i} className="grid grid-cols-[1.5rem_1fr_1fr_2rem] items-center gap-sm">
                  <span className="font-mono text-xs text-text-muted">{i + 1}</span>
                  <input
                    aria-label={`Set ${i + 1} reps`}
                    inputMode="numeric"
                    placeholder="8"
                    value={row.reps}
                    onChange={(e) =>
                      setSetRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, reps: e.target.value } : r)),
                      )
                    }
                    className={setInputClass}
                  />
                  <input
                    aria-label={`Set ${i + 1} weight in kg`}
                    inputMode="decimal"
                    placeholder="60"
                    value={row.weight}
                    onChange={(e) =>
                      setSetRows((rows) =>
                        rows.map((r, idx) => (idx === i ? { ...r, weight: e.target.value } : r)),
                      )
                    }
                    className={setInputClass}
                  />
                  <button
                    type="button"
                    aria-label={`Remove set ${i + 1}`}
                    disabled={setRows.length === 1}
                    onClick={() => setSetRows((rows) => rows.filter((_, idx) => idx !== i))}
                    className="flex h-8 w-8 items-center justify-center rounded-sm text-text-muted hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg
                      aria-hidden
                      viewBox="0 0 16 16"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="square" />
                    </svg>
                  </button>
                </div>
              ))}
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setSetRows((rows) => {
                      const last = rows[rows.length - 1]
                      return [...rows, { reps: last?.reps ?? '', weight: last?.weight ?? '' }]
                    })
                  }
                >
                  Add set
                </Button>
              </div>
              <p className="text-sm text-text-muted">
                Volume and estimated 1RM are computed on save.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-sm">
            <Input
              label="Duration (mins)"
              type="number"
              min={1}
              max={1440}
              className="font-mono"
              value={durationMins}
              onChange={(e) => setDurationMins(e.target.value)}
              placeholder="optional"
            />
            {activityType === 'WALK' || activityType === 'RUN' ? (
              <Input
                label="Steps"
                type="number"
                min={0}
                className="font-mono"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                placeholder="optional"
              />
            ) : null}
          </div>

          <Select
            label="Intensity"
            value={intensity}
            onChange={(e) => setIntensity(e.target.value)}
          >
            {INTENSITIES.map((i) => (
              <option key={i} value={i}>
                {INTENSITY_LABELS[i] ?? i}
              </option>
            ))}
          </Select>

          <Input
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="optional"
          />

          {formError ? <Alert tone="error">{formError}</Alert> : null}

          <div className="flex justify-end gap-sm">
            <Button variant="secondary" disabled={saving} onClick={() => setLogOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleLog}>
              Log
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
