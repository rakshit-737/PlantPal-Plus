import { useCallback, useEffect, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'

import {
  createPlant,
  listPlants,
  searchSpecies,
  type Plant,
  type Species,
} from '../api/endpoints'
import { OfflineNotice } from '../components/OfflineNotice'
import { Badge, Button, Card, EmptyState, ErrorText, Input, PageHeader, Spinner } from '../components/ui'
import { localDateStr } from '../lib/dates'
import { describeWriteError, logCareWriteThrough } from '../offline'
import { usePalette, space } from '../theme'
import { PlantDetailScreen } from './PlantDetailScreen'

function dueLabel(plant: Plant): { text: string; overdue: boolean } {
  if (!plant.next_water_due_at) return { text: 'No schedule', overdue: false }
  const due = new Date(plant.next_water_due_at)
  const now = new Date()
  const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000)
  if (days < 0) return { text: `${-days}d overdue`, overdue: true }
  if (days === 0) return { text: 'Due today', overdue: false }
  return { text: `Due in ${days}d`, overdue: false }
}

const LIGHT_OPTIONS = ['LOW', 'MEDIUM', 'BRIGHT_INDIRECT', 'DIRECT_SUN']

export function PlantsScreen() {
  const p = usePalette()
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null)
  const [wateringId, setWateringId] = useState<string | null>(null)
  const [careError, setCareError] = useState('')
  const [careNotice, setCareNotice] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [nickname, setNickname] = useState('')
  const [speciesQuery, setSpeciesQuery] = useState('')
  const [speciesList, setSpeciesList] = useState<Species[]>([])
  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(null)
  const [light, setLight] = useState('BRIGHT_INDIRECT')
  const [placement, setPlacement] = useState<'INDOOR' | 'OUTDOOR'>('INDOOR')
  const [baseInterval, setBaseInterval] = useState('7')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setPlants(await listPlants())
      setLoadError(false)
    } catch {
      setPlants([])
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

  useEffect(() => {
    if (!speciesQuery || selectedSpecies) {
      setSpeciesList([])
      return
    }
    const t = setTimeout(() => {
      searchSpecies(speciesQuery)
        .then(setSpeciesList)
        .catch(() => setSpeciesList([]))
    }, 300)
    return () => clearTimeout(t)
  }, [speciesQuery, selectedSpecies])

  function pickSpecies(s: Species) {
    setSelectedSpecies(s)
    setSpeciesQuery(s.common_name)
    setSpeciesList([])
    // Species defaults seed the schedule; the user can still override.
    setBaseInterval(String(s.base_interval_days))
    setLight(s.default_light)
  }

  async function handleAdd() {
    setFormError('')
    if (!nickname.trim()) {
      setFormError('Nickname is required.')
      return
    }
    const base = parseInt(baseInterval, 10)
    if (!base || base < 1 || base > 365) {
      setFormError('Watering interval must be 1–365 days.')
      return
    }
    setSaving(true)
    try {
      await createPlant({
        nickname: nickname.trim(),
        species_id: selectedSpecies?.id ?? null,
        light_exposure: light,
        placement,
        base_interval_days: base,
        min_interval_days: selectedSpecies?.min_interval_days ?? Math.max(1, Math.round(base / 2)),
        max_interval_days: selectedSpecies?.max_interval_days ?? base * 2,
      })
      setAddOpen(false)
      setNickname('')
      setSpeciesQuery('')
      setSelectedSpecies(null)
      setBaseInterval('7')
      await load()
    } catch {
      setFormError('Failed to add plant. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function water(plant: Plant) {
    setWateringId(plant.id)
    setCareError('')
    setCareNotice('')
    try {
      const result = await logCareWriteThrough(
        plant.id,
        { action_type: 'WATER', local_date_str: localDateStr() },
        `Watering for ${plant.nickname}`,
      )
      // Queued: there is no server state to re-read, and reloading here would
      // only replace the list with an offline error. The schedule catches up
      // when the outbox drains.
      if (result.queued) setCareNotice(result.message)
      else await load()
    } catch (err) {
      setCareError(
        describeWriteError(err, `Could not log watering for ${plant.nickname}. Try again.`),
      )
    } finally {
      setWateringId(null)
    }
  }

  if (selectedPlantId) {
    return (
      <PlantDetailScreen
        plantId={selectedPlantId}
        onBack={() => {
          // Care logged on the detail page moves due dates; refresh the list.
          setSelectedPlantId(null)
          void load()
        }}
      />
    )
  }

  if (loading) return <Spinner />

  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: space.md, gap: space.sm }}
      data={plants}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={{ gap: space.sm }}>
          <PageHeader title="Plants" subtitle="Watering that adapts to each plant." />
          <ErrorText message={careError} />
          {careNotice ? (
            <Text style={{ color: p.textMuted, fontSize: 13 }}>{careNotice}</Text>
          ) : null}
          {addOpen ? (
            <Card style={{ gap: space.sm }}>
              <Input label="Nickname" value={nickname} onChangeText={setNickname} placeholder="e.g. Monstera by the window" autoCapitalize="sentences" />
              <Input
                label="Species (optional)"
                value={speciesQuery}
                onChangeText={(t) => {
                  setSpeciesQuery(t)
                  setSelectedSpecies(null)
                }}
                placeholder="Search the catalogue…"
                autoCapitalize="sentences"
              />
              {speciesList.map((s) => (
                <Pressable key={s.id} onPress={() => pickSpecies(s)} style={{ paddingVertical: space.xs }}>
                  <Text style={{ color: p.textMain, fontSize: 14 }}>
                    {s.common_name} <Text style={{ color: p.textMuted, fontStyle: 'italic' }}>({s.scientific_name})</Text>
                  </Text>
                </Pressable>
              ))}
              <Text style={{ color: p.textMain, fontSize: 13, fontWeight: '500' }}>Light</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                {LIGHT_OPTIONS.map((l) => (
                  <View key={l} style={{ opacity: light === l ? 1 : 0.55 }}>
                    <Button
                      title={l.replace(/_/g, ' ')}
                      variant={light === l ? 'primary' : 'secondary'}
                      onPress={() => setLight(l)}
                    />
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: space.xs }}>
                {(['INDOOR', 'OUTDOOR'] as const).map((pl) => (
                  <View key={pl} style={{ opacity: placement === pl ? 1 : 0.55 }}>
                    <Button
                      title={pl}
                      variant={placement === pl ? 'primary' : 'secondary'}
                      onPress={() => setPlacement(pl)}
                    />
                  </View>
                ))}
              </View>
              <Input label="Watering interval (days)" value={baseInterval} onChangeText={setBaseInterval} keyboardType="number-pad" />
              <ErrorText message={formError} />
              <Button title="Add plant" onPress={handleAdd} loading={saving} />
              <Button title="Cancel" variant="ghost" onPress={() => setAddOpen(false)} />
            </Card>
          ) : (
            <Button title="+ Add plant" onPress={() => setAddOpen(true)} />
          )}
        </View>
      }
      ListEmptyComponent={
        loadError ? (
          <OfflineNotice onRetry={retry} />
        ) : (
          <Card>
            <EmptyState
              icon="—"
              title="No plants yet"
              body="Add your first plant and PlantPal+ schedules its watering."
            />
          </Card>
        )
      }
      renderItem={({ item }) => {
        const due = dueLabel(item)
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.nickname}`}
            onPress={() => setSelectedPlantId(item.id)}
          >
            <Card style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: p.textMain, fontSize: 16, fontWeight: '600' }}>
                  {item.nickname}
                </Text>
                <Badge text={due.text} color={due.overdue ? p.danger : p.primary} />
              </View>
              <Text style={{ color: p.textMuted, fontSize: 12 }}>
                {item.room ? `${item.room} · ` : ''}
                {item.light_exposure.replace(/_/g, ' ').toLowerCase()}
                {item.effective_interval_days ? ` · every ${item.effective_interval_days}d` : ''}
              </Text>
              <Button
                title="Log watering"
                variant="secondary"
                loading={wateringId === item.id}
                onPress={() => void water(item)}
              />
            </Card>
          </Pressable>
        )
      }}
    />
  )
}
