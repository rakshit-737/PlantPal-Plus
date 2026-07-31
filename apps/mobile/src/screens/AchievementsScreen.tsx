import { useCallback, useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { getAchievements, type UserAchievement } from '../api/endpoints'
import { OfflineNotice } from '../components/OfflineNotice'
import { Badge, Card, EmptyState, PageHeader, Spinner } from '../components/ui'
import { monoFont } from '../lib/fonts'
import { usePalette, space } from '../theme'

const MODULE_LABELS: Record<string, string> = {
  PLANT_CARE: 'Plant Care',
  FITNESS: 'Fitness',
  NUTRITION: 'Nutrition',
  SHARED: 'Shared',
}

const MODULES = ['PLANT_CARE', 'FITNESS', 'NUTRITION', 'SHARED']

export function AchievementsScreen() {
  const p = usePalette()
  const [items, setItems] = useState<UserAchievement[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await getAchievements())
      setLoadError(false)
    } catch {
      setItems([])
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

  if (loading) return <Spinner />

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <PageHeader title="Achievements" subtitle="Badges, streaks and milestones." />

      {loadError ? (
        <OfflineNotice onRetry={retry} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon="—" title="No achievements yet" body="Complete daily habits to unlock badges." />
        </Card>
      ) : (
        MODULES.map((mod) => {
          const group = items.filter((ua) => ua.achievement.module === mod)
          if (group.length === 0) return null
          return (
            <View key={mod} style={{ gap: space.sm }}>
              <Text style={{ color: p.textMain, fontSize: 16, fontWeight: '600' }}>
                {MODULE_LABELS[mod] ?? mod}
              </Text>
              {group.map((ua) => {
                const unlocked = ua.unlocked_at !== null
                const a = ua.achievement
                return (
                  <Card key={ua.id} style={{ opacity: unlocked ? 1 : 0.5, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: p.textMain, fontSize: 14, fontWeight: '600' }}>
                          {a.name}
                        </Text>
                        <Text style={{ color: p.textMuted, fontSize: 12 }}>{a.description}</Text>
                      </View>
                      <Badge text={`${a.tier} · ${a.points}pt`} />
                    </View>
                    {!unlocked && ua.progress_pct > 0 ? (
                      <Text style={{ color: p.textMuted, fontSize: 11, fontFamily: monoFont }}>
                        {ua.progress_pct}% complete
                      </Text>
                    ) : null}
                  </Card>
                )
              })}
            </View>
          )
        })
      )}
    </ScrollView>
  )
}
