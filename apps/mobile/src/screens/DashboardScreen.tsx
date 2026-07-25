import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'

import { getDashboard, type DashboardData } from '../api/endpoints'
import { Card, EmptyState, PageHeader, Spinner } from '../components/ui'
import { usePalette, space } from '../theme'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const p = usePalette()
  return (
    <Card style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: p.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: p.textMain, fontSize: 22, fontWeight: '700' }}>{value}</Text>
      {hint ? <Text style={{ color: p.textMuted, fontSize: 11 }}>{hint}</Text> : null}
    </Card>
  )
}

export function DashboardScreen() {
  const p = usePalette()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await getDashboard())
    } catch {
      setData(null)
    }
  }, [])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  if (loading) return <Spinner />

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: space.md, gap: space.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <PageHeader title="Today" subtitle="Your daily habits at a glance." />

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat
          label="🔥 Streak"
          value={`${data?.streak.current ?? 0}`}
          hint={`longest ${data?.streak.longest ?? 0}`}
        />
        <Stat
          label="🌱 Plants due"
          value={`${data?.plants.due_today ?? 0}`}
          hint={`${data?.plants.overdue ?? 0} overdue`}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat
          label="👟 Steps"
          value={`${data?.fitness.steps ?? 0}`}
          hint={`goal ${data?.fitness.goal ?? 10000}`}
        />
        <Stat
          label="🍽️ Calories"
          value={`${Math.round(data?.nutrition.calories_consumed ?? 0)}`}
          hint={`target ${data?.nutrition.target ?? 2000}`}
        />
      </View>

      <Card>
        <Text style={{ color: p.textMain, fontSize: 16, fontWeight: '600', marginBottom: space.sm }}>
          Today's list
        </Text>
        {!data || data.today_list.length === 0 ? (
          <EmptyState icon="✅" title="All caught up" body="Nothing due right now." />
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
              <Text style={{ fontSize: 16 }}>
                {item.type === 'PLANT_WATER' ? '💧' : item.type === 'LOG_MEAL' ? '🍽️' : '📋'}
              </Text>
              <Text style={{ color: p.textMain, fontSize: 14 }}>{item.title}</Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  )
}
