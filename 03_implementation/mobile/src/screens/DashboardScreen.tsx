import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'

import { getDashboard, type DashboardData } from '../api/endpoints'
import { OfflineNotice } from '../components/OfflineNotice'
import { Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui'
import { localDateStr } from '../lib/dates'
import { monoFont } from '../lib/fonts'
import { dismissReminder, listReminders, type Reminder } from '../lib/remindersApi'
import { usePalette, space } from '../theme'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const p = usePalette()
  return (
    <Card style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: p.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: p.textMain, fontSize: 22, fontWeight: '700', fontFamily: monoFont }}>
        {value}
      </Text>
      {hint ? <Text style={{ color: p.textMuted, fontSize: 11 }}>{hint}</Text> : null}
    </Card>
  )
}

export function DashboardScreen() {
  const p = usePalette()
  const [data, setData] = useState<DashboardData | null>(null)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    // The dashboard is the page; reminders are an extra — a reminders failure
    // must not blank the whole screen.
    const [dashboard, reminderList] = await Promise.allSettled([
      getDashboard(localDateStr()),
      listReminders(),
    ])
    if (dashboard.status === 'fulfilled') {
      setData(dashboard.value)
      setLoadError(false)
    } else {
      setData(null)
      setLoadError(true)
    }
    setReminders(reminderList.status === 'fulfilled' ? reminderList.value : [])
  }, [])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const retry = useCallback(() => {
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load])

  const handleDismiss = useCallback(async (id: string) => {
    // Optimistic removal via functional updates: a stale-snapshot restore
    // would resurrect rows dismissed concurrently.
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
    }
  }, [])

  if (loading) return <Spinner />

  const dueReminders = reminders.filter(
    (r) => new Date(r.due_at_utc).getTime() <= Date.now(),
  )

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: space.md, gap: space.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <PageHeader title="Today" subtitle="Your daily habits at a glance." />

      {loadError ? (
        <OfflineNotice onRetry={retry} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Stat
              label="Streak"
              value={`${data?.streak.current ?? 0}`}
              hint={`longest ${data?.streak.longest ?? 0}`}
            />
            <Stat
              label="Plants due"
              value={`${data?.plants.due_today ?? 0}`}
              hint={`${data?.plants.overdue ?? 0} overdue`}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Stat
              label="Steps"
              value={`${data?.fitness.steps ?? 0}`}
              hint={`goal ${data?.fitness.goal ?? 10000}`}
            />
            <Stat
              label="Calories"
              value={`${Math.round(data?.nutrition.calories_consumed ?? 0)}`}
              hint={`target ${data?.nutrition.target ?? 2000}`}
            />
          </View>

          {dueReminders.length > 0 ? (
            <Card>
              <Text
                style={{
                  color: p.textMain,
                  fontSize: 16,
                  fontWeight: '600',
                  marginBottom: space.sm,
                }}
              >
                Reminders
              </Text>
              {dueReminders.map((r) => (
                <View
                  key={r.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.sm,
                    paddingVertical: space.xs,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.textMain, fontSize: 14, fontWeight: '500' }}>
                      {r.title}
                    </Text>
                    {r.body ? (
                      <Text style={{ color: p.textMuted, fontSize: 12 }}>{r.body}</Text>
                    ) : null}
                  </View>
                  <Button
                    title="Dismiss"
                    variant="ghost"
                    onPress={() => void handleDismiss(r.id)}
                  />
                </View>
              ))}
            </Card>
          ) : null}

          <Card>
            <Text
              style={{ color: p.textMain, fontSize: 16, fontWeight: '600', marginBottom: space.sm }}
            >
              Today&apos;s list
            </Text>
            {!data || data.today_list.length === 0 ? (
              <EmptyState icon="—" title="All caught up" body="Nothing due right now." />
            ) : (
              data.today_list.map((item) => (
                <View
                  key={`${item.type}-${item.id}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.sm,
                    paddingVertical: space.sm,
                  }}
                >
                  <Text style={{ color: p.textMuted, fontSize: 10, fontFamily: monoFont }}>
                    {item.type.replace(/_/g, ' ')}
                  </Text>
                  <Text style={{ color: p.textMain, fontSize: 14, flex: 1 }}>{item.title}</Text>
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </ScrollView>
  )
}
