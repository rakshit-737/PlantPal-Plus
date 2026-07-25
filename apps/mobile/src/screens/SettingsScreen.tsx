import { useState } from 'react'
import { ScrollView, Text } from 'react-native'

import { API_URL } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Badge, Button, Card, PageHeader } from '../components/ui'
import { usePalette, space } from '../theme'

export function SettingsScreen() {
  const p = usePalette()
  const { user, logout } = useAuth()
  const [busy, setBusy] = useState(false)

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
      <PageHeader title="Settings" subtitle="Account and app info." />

      <Card style={{ gap: space.sm }}>
        <Text style={{ color: p.textMuted, fontSize: 12, fontWeight: '500' }}>Account</Text>
        <Text style={{ color: p.textMain, fontSize: 15 }}>{user?.email ?? 'Signed in'}</Text>
        {user ? <Badge text={user.status.replace(/_/g, ' ')} /> : null}
      </Card>

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
