import { useCallback, useEffect, useState } from 'react'
import { ScrollView, Switch, Text, View } from 'react-native'

import { API_URL, ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { OfflineNotice } from '../components/OfflineNotice'
import { Badge, Button, Card, ErrorText, PageHeader, Spinner } from '../components/ui'
import { getSettings, updateSettings, type UserSettings } from '../lib/settingsApi'
import { usePalette, space } from '../theme'

// Field names match apps/api settingsController.ts, same as the web client.
const MODULES = [
  { key: 'plant_care_enabled', label: 'Plant care', body: 'Watering schedules and care history.' },
  { key: 'fitness_enabled', label: 'Fitness', body: 'Workouts, steps and weekly summaries.' },
  { key: 'nutrition_enabled', label: 'Nutrition', body: 'Meals, calories and hydration.' },
] as const

type ModuleKey = (typeof MODULES)[number]['key']

export function SettingsScreen() {
  const p = usePalette()
  const { user, logout } = useAuth()
  const [busy, setBusy] = useState(false)

  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState(false)
  const [moduleError, setModuleError] = useState('')

  const loadSettings = useCallback(async () => {
    try {
      setSettings(await getSettings())
      setSettingsError(false)
    } catch {
      setSettingsError(true)
    }
  }, [])

  useEffect(() => {
    void loadSettings().finally(() => setSettingsLoading(false))
  }, [loadSettings])

  const retrySettings = useCallback(() => {
    setSettingsLoading(true)
    void loadSettings().finally(() => setSettingsLoading(false))
  }, [loadSettings])

  /** Optimistically applies the patch, rolls back if the server rejects it. */
  const applyPatch = useCallback(async (patch: Partial<UserSettings>) => {
    let previous: UserSettings | null = null
    setSettings((current) => {
      previous = current
      return current ? { ...current, ...patch } : current
    })
    try {
      setSettings(await updateSettings(patch))
    } catch (err) {
      setSettings(previous)
      throw err
    }
  }, [])

  async function toggleModule(key: ModuleKey, next: boolean) {
    setModuleError('')
    if (!settings) return
    // Invariant 34, checked client-side before the round trip (the server
    // enforces it too): at least one module must stay enabled.
    if (!next && MODULES.filter((m) => settings[m.key]).length <= 1 && settings[key]) {
      setModuleError('At least one module must stay enabled.')
      return
    }
    try {
      await applyPatch({ [key]: next })
    } catch (err) {
      setModuleError(
        err instanceof ApiError && err.code === 'VALIDATION_FAILED'
          ? 'At least one module must stay enabled.'
          : 'Could not save. Check your connection and try again.',
      )
    }
  }

  async function setUnits(next: 'METRIC' | 'IMPERIAL') {
    try {
      await applyPatch({ unit_system: next })
    } catch {
      // Optimistic state already rolled back by applyPatch.
    }
  }

  async function handleLogout() {
    setBusy(true)
    try {
      await logout()
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <PageHeader title="Settings" subtitle="Account and preferences." />

      <Card style={{ gap: space.sm }}>
        <Text style={{ color: p.textMuted, fontSize: 12, fontWeight: '500' }}>Account</Text>
        <Text style={{ color: p.textMain, fontSize: 15 }}>{user?.email ?? 'Signed in'}</Text>
        {user ? <Badge text={user.status.replace(/_/g, ' ')} /> : null}
      </Card>

      {settingsLoading ? (
        <Spinner />
      ) : settingsError && !settings ? (
        <OfflineNotice onRetry={retrySettings} />
      ) : settings ? (
        <>
          <Card style={{ gap: space.md }}>
            <Text style={{ color: p.textMuted, fontSize: 12, fontWeight: '500' }}>Modules</Text>
            {MODULES.map((m) => (
              <View
                key={m.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: space.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.textMain, fontSize: 14, fontWeight: '500' }}>
                    {m.label}
                  </Text>
                  <Text style={{ color: p.textMuted, fontSize: 12 }}>{m.body}</Text>
                </View>
                <Switch
                  accessibilityLabel={m.label}
                  value={settings[m.key]}
                  onValueChange={(next) => void toggleModule(m.key, next)}
                  trackColor={{ false: p.border, true: p.primary }}
                  thumbColor={p.surface}
                  ios_backgroundColor={p.border}
                />
              </View>
            ))}
            <ErrorText message={moduleError} />
          </Card>

          <Card style={{ gap: space.sm }}>
            <Text style={{ color: p.textMuted, fontSize: 12, fontWeight: '500' }}>Units</Text>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {(['METRIC', 'IMPERIAL'] as const).map((u) => (
                <View key={u} style={{ flex: 1 }}>
                  <Button
                    title={u === 'METRIC' ? 'Metric' : 'Imperial'}
                    variant={settings.unit_system === u ? 'primary' : 'secondary'}
                    onPress={() => void setUnits(u)}
                  />
                </View>
              ))}
            </View>
          </Card>
        </>
      ) : null}

      <Card style={{ gap: space.sm }}>
        <Text style={{ color: p.textMuted, fontSize: 12, fontWeight: '500' }}>API server</Text>
        <Text style={{ color: p.textMain, fontSize: 13 }}>{API_URL}</Text>
        <Text style={{ color: p.textMuted, fontSize: 11 }}>
          Set EXPO_PUBLIC_API_URL in apps/mobile/.env to point at another server.
        </Text>
      </Card>

      <Card style={{ gap: space.sm }}>
        <Text style={{ color: p.textMuted, fontSize: 12, fontWeight: '500' }}>Session</Text>
        <Button title="Sign out" variant="secondary" loading={busy} onPress={handleLogout} />
      </Card>
    </ScrollView>
  )
}
