/**
 * Plant detail — the mobile mirror of apps/web/src/pages/PlantDetailPage.tsx.
 * Reached from PlantsScreen (local selectedPlantId state, no navigator):
 * watering schedule, the seven care actions, the care ledger, and removal.
 */

import { useCallback, useEffect, useState } from 'react'
import { Alert, BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '../api/client'
import { logCare, searchSpecies, type Plant } from '../api/endpoints'
import { OfflineNotice } from '../components/OfflineNotice'
import { Badge, Button, Card, ErrorText, PageHeader, Spinner } from '../components/ui'
import { localDateStr } from '../lib/dates'
import { monoFont } from '../lib/fonts'
import { deletePlant, getCareHistory, getPlant, type CareEvent } from '../lib/plantsApi'
import { usePalette, space } from '../theme'

const CARE_ACTIONS = [
  { type: 'WATER', label: 'Water' },
  { type: 'FERTILIZE', label: 'Fertilise' },
  { type: 'PRUNE', label: 'Prune' },
  { type: 'REPOT', label: 'Repot' },
  { type: 'MIST', label: 'Mist' },
  { type: 'ROTATE', label: 'Rotate' },
  { type: 'TREAT', label: 'Treat' },
] as const

function fmtDate(iso: string | null): string {
  if (!iso) return 'never'
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function titleCase(actionType: string): string {
  return actionType.charAt(0) + actionType.slice(1).toLowerCase()
}

export function PlantDetailScreen({
  plantId,
  onBack,
}: {
  plantId: string
  onBack: () => void
}) {
  const p = usePalette()
  const [plant, setPlant] = useState<Plant | null>(null)
  const [history, setHistory] = useState<CareEvent[]>([])
  const [speciesName, setSpeciesName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [caring, setCaring] = useState<string | null>(null)
  const [careError, setCareError] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Android hardware/gesture back returns to the plant list instead of
  // finishing the activity — this screen is plain state, not a navigator.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack()
      return true
    })
    return () => sub.remove()
  }, [onBack])

  const load = useCallback(async () => {
    try {
      const [pl, h] = await Promise.all([getPlant(plantId), getCareHistory(plantId)])
      setPlant(pl)
      setHistory(h)
      setLoadError(false)
      setNotFound(false)
      if (pl.species_id) {
        // The plant row carries only species_id; resolve the display name from
        // the catalogue. Best-effort — the page works without it.
        try {
          const catalogue = await searchSpecies('')
          setSpeciesName(
            catalogue.find((s) => s.id === pl.species_id)?.common_name ?? null,
          )
        } catch {
          setSpeciesName(null)
        }
      } else {
        setSpeciesName(null)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true)
      else setLoadError(true)
    }
  }, [plantId])

  useEffect(() => {
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load])

  const retry = useCallback(() => {
    setLoadError(false)
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load])

  async function handleCare(actionType: string) {
    setCareError('')
    setCaring(actionType)
    try {
      await logCare(plantId, { action_type: actionType, local_date_str: localDateStr() })
      const [pl, h] = await Promise.all([getPlant(plantId), getCareHistory(plantId)])
      setPlant(pl)
      setHistory(h)
    } catch {
      setCareError('Could not log that action. Try again.')
    } finally {
      setCaring(null)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deletePlant(plantId)
      onBack()
    } catch {
      setCareError('Could not remove this plant. Try again.')
      setDeleting(false)
    }
  }

  function confirmDelete() {
    if (!plant) return
    Alert.alert(
      'Remove plant',
      `Remove ${plant.nickname} and stop its reminders? Care history is kept and the plant can be restored by support.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void handleDelete() },
      ],
    )
  }

  const due = plant?.next_water_due_at
    ? Math.round((new Date(plant.next_water_due_at).getTime() - Date.now()) / 86_400_000)
    : null
  const dueText =
    due === null
      ? 'no schedule'
      : due < 0
        ? `${Math.abs(due)}d overdue`
        : due === 0
          ? 'due today'
          : `in ${due}d`

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <View style={{ alignSelf: 'flex-start' }}>
        <Button title="Back to plants" variant="ghost" onPress={onBack} />
      </View>

      {loading ? (
        <Spinner />
      ) : notFound ? (
        <Card style={{ gap: space.sm }}>
          <Text style={{ color: p.textMain, fontSize: 14 }}>
            This plant does not exist or was removed.
          </Text>
        </Card>
      ) : loadError || !plant ? (
        <OfflineNotice onRetry={retry} />
      ) : (
        <>
          <PageHeader title={plant.nickname} subtitle={speciesName ?? 'No species set'} />

          <Card style={{ gap: space.xs }}>
            <Text style={{ color: p.textMuted, fontSize: 11, fontWeight: '500', letterSpacing: 1 }}>
              WATERING
            </Text>
            <Text
              style={{
                color: due !== null && due < 0 ? p.danger : p.primary,
                fontSize: 22,
                fontWeight: '600',
                fontFamily: monoFont,
              }}
            >
              {dueText}
            </Text>
            <Text style={{ color: p.textMuted, fontSize: 12, fontFamily: monoFont }}>
              every ~{plant.effective_interval_days ?? plant.base_interval_days}d · last{' '}
              {fmtDate(plant.last_watered_at)}
            </Text>
          </Card>

          <Card style={{ gap: space.sm }}>
            <Text style={{ color: p.textMuted, fontSize: 11, fontWeight: '500', letterSpacing: 1 }}>
              CONDITIONS
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              <Badge text={plant.light_exposure.replace(/_/g, ' ')} />
              <Badge text={plant.placement} />
              {plant.room ? <Badge text={plant.room} /> : null}
            </View>
            <Text style={{ color: p.textMuted, fontSize: 12, fontFamily: monoFont }}>
              base {plant.base_interval_days}d · added {fmtDate(plant.created_at)}
            </Text>
          </Card>

          <Card style={{ gap: space.sm }}>
            <Text style={{ color: p.textMain, fontSize: 16, fontWeight: '600' }}>Log care</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {CARE_ACTIONS.map((a) => (
                <View key={a.type} style={{ flexBasis: '31%', flexGrow: 1 }}>
                  <Button
                    title={a.label}
                    variant={a.type === 'WATER' ? 'primary' : 'secondary'}
                    loading={caring === a.type}
                    disabled={caring !== null && caring !== a.type}
                    onPress={() => void handleCare(a.type)}
                  />
                </View>
              ))}
            </View>
            <ErrorText message={careError} />
          </Card>

          <Card>
            <Text
              style={{
                color: p.textMain,
                fontSize: 16,
                fontWeight: '600',
                marginBottom: space.sm,
              }}
            >
              Care history
            </Text>
            {history.length === 0 ? (
              <Text style={{ color: p.textMuted, fontSize: 13 }}>
                Nothing logged yet. The first entry starts this plant&apos;s ledger.
              </Text>
            ) : (
              history.map((e, i) => (
                <View
                  key={e.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: space.sm,
                    paddingVertical: space.sm,
                    borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: p.border,
                  }}
                >
                  <Text style={{ color: p.textMain, fontSize: 13, flex: 1 }}>
                    {titleCase(e.action_type)}
                    {e.note ? <Text style={{ color: p.textMuted }}> — {e.note}</Text> : null}
                  </Text>
                  <Text style={{ color: p.textMuted, fontSize: 11, fontFamily: monoFont }}>
                    {e.local_date_str}
                  </Text>
                </View>
              ))
            )}
          </Card>

          <Button title="Remove plant" variant="danger" loading={deleting} onPress={confirmDelete} />
        </>
      )}
    </ScrollView>
  )
}
