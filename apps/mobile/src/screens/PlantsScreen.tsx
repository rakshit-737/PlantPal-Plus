import { useCallback, useEffect, useState } from 'react'
import { FlatList, Text, View } from 'react-native'

import { listPlants, logCare, type Plant } from '../api/endpoints'
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui'
import { usePalette, space } from '../theme'

function localDateStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function dueLabel(plant: Plant): { text: string; overdue: boolean } {
  if (!plant.next_water_due_at) return { text: 'No schedule', overdue: false }
  const due = new Date(plant.next_water_due_at)
  const now = new Date()
  const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000)
  if (days < 0) return { text: `${-days}d overdue`, overdue: true }
  if (days === 0) return { text: 'Due today', overdue: false }
  return { text: `Due in ${days}d`, overdue: false }
}

export function PlantsScreen() {
  const p = usePalette()
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [wateringId, setWateringId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setPlants(await listPlants())
    } catch {
      setPlants([])
    }
  }, [])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  async function water(plant: Plant) {
    setWateringId(plant.id)
    try {
      await logCare(plant.id, { action_type: 'WATER', local_date_str: localDateStr() })
      await load()
    } catch {
      // Errors surface on the next refresh; watering is offline-queueable by design.
    } finally {
      setWateringId(null)
    }
  }

  if (loading) return <Spinner />

  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: space.md, gap: space.sm }}
      data={plants}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <PageHeader title="Plants" subtitle="Watering that adapts to each plant." />
      }
      ListEmptyComponent={
        <Card>
          <EmptyState
            icon="🪴"
            title="No plants yet"
            body="Add your first plant on the web app — the mobile add flow ships next."
          />
        </Card>
      }
      renderItem={({ item }) => {
        const due = dueLabel(item)
        return (
          <Card style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: p.textMain, fontSize: 16, fontWeight: '600' }}>
                🌿 {item.nickname}
              </Text>
              <Badge text={due.text} color={due.overdue ? p.danger : p.primary} />
            </View>
            <Text style={{ color: p.textMuted, fontSize: 12 }}>
              {item.room ? `${item.room} · ` : ''}
              {item.light_exposure.replace(/_/g, ' ').toLowerCase()}
              {item.effective_interval_days ? ` · every ${item.effective_interval_days}d` : ''}
            </Text>
            <Button
              title="💧 Log watering"
              variant="secondary"
              loading={wateringId === item.id}
              onPress={() => void water(item)}
            />
          </Card>
        )
      }}
    />
  )
}
