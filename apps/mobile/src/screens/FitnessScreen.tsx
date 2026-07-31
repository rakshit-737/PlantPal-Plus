import { useCallback, useEffect, useState } from 'react'
import { FlatList, Text, View } from 'react-native'

import { ActivityTypeCode } from '@plantpal/shared'

import { listWorkouts, type Workout } from '../api/endpoints'
import { OfflineNotice } from '../components/OfflineNotice'
import { Button, Card, EmptyState, ErrorText, Input, PageHeader, Spinner } from '../components/ui'
import { localDateStr } from '../lib/dates'
import { monoFont } from '../lib/fonts'
import { describeWriteError, logWorkoutWriteThrough } from '../offline'
import { usePalette, space } from '../theme'

// NFR-MAIN-03: the activity vocabulary lives once, in @plantpal/shared.
const ACTIVITY_TYPES = Object.keys(ActivityTypeCode)

export function FitnessScreen() {
  const p = usePalette()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [activity, setActivity] = useState('WALK')
  const [duration, setDuration] = useState('30')
  const [steps, setSteps] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setWorkouts(await listWorkouts())
      setLoadError(false)
    } catch {
      setWorkouts([])
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  const retry = useCallback(() => {
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load])

  async function handleLog() {
    setError('')
    setNotice('')
    const mins = parseInt(duration, 10)
    if (!mins || mins < 1 || mins > 1440) {
      setError('Duration must be between 1 and 1440 minutes.')
      return
    }
    const stepCount = steps.trim() ? parseInt(steps, 10) : undefined
    setSaving(true)
    try {
      const result = await logWorkoutWriteThrough(
        {
          activity_type: activity,
          duration_mins: mins,
          ...(stepCount !== undefined && !Number.isNaN(stepCount) ? { steps: stepCount } : {}),
          local_date_str: localDateStr(),
        },
        `${activity} workout`,
      )
      setFormOpen(false)
      setDuration('30')
      setSteps('')
      // Queued workouts are not in the list yet — reloading offline would only
      // blank it. The entry appears once the outbox drains.
      if (result.queued) setNotice(result.message)
      else await load()
    } catch (err) {
      setError(describeWriteError(err, 'Failed to log workout. Try again.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: space.md, gap: space.sm }}
      data={workouts}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={{ gap: space.sm }}>
          <PageHeader title="Fitness" subtitle="Workouts, steps and streaks." />
          {notice ? <Text style={{ color: p.textMuted, fontSize: 13 }}>{notice}</Text> : null}
          {formOpen ? (
            <Card style={{ gap: space.sm }}>
              <Text style={{ color: p.textMain, fontSize: 14, fontWeight: '600' }}>Activity</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                {ACTIVITY_TYPES.map((t) => (
                  <View key={t} style={{ opacity: activity === t ? 1 : 0.55 }}>
                    <Button
                      title={t}
                      variant={activity === t ? 'primary' : 'secondary'}
                      onPress={() => setActivity(t)}
                    />
                  </View>
                ))}
              </View>
              <Input label="Duration (minutes)" value={duration} onChangeText={setDuration} keyboardType="number-pad" />
              <Input label="Steps (optional)" value={steps} onChangeText={setSteps} keyboardType="number-pad" />
              <ErrorText message={error} />
              <Button title="Save workout" onPress={handleLog} loading={saving} />
              <Button title="Cancel" variant="ghost" onPress={() => setFormOpen(false)} />
            </Card>
          ) : (
            <Button title="+ Log workout" onPress={() => setFormOpen(true)} />
          )}
        </View>
      }
      ListEmptyComponent={
        loadError ? (
          <OfflineNotice onRetry={retry} />
        ) : (
          <Card>
            <EmptyState icon="—" title="No workouts yet" body="Log your first workout to start a streak." />
          </Card>
        )
      }
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: p.textMain, fontSize: 15, fontWeight: '600' }}>
              {item.activity_type}
            </Text>
            <Text style={{ color: p.textMuted, fontSize: 12, fontFamily: monoFont }}>
              {item.local_date_str}
            </Text>
          </View>
          <Text style={{ color: p.textMuted, fontSize: 13, fontFamily: monoFont }}>
            {item.duration_mins ? `${item.duration_mins} min` : ''}
            {item.calories_burned ? ` · ${Math.round(item.calories_burned)} kcal` : ''}
            {item.steps ? ` · ${item.steps} steps` : ''}
            {item.total_volume_kg > 0 ? ` · ${item.total_volume_kg} kg volume` : ''}
          </Text>
        </Card>
      )}
    />
  )
}
