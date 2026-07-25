import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'

import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { Button, Card, ErrorText, Input } from '../components/ui'
import { usePalette, space } from '../theme'

export function LoginScreen({ onRegister }: { onRegister: () => void }) {
  const p = usePalette()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleLogin() {
    setError('')
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.lg }}>
        <View style={{ alignItems: 'center', marginBottom: space.xl }}>
          <Text style={{ fontSize: 44 }}>🌱</Text>
          <Text style={{ color: p.textMain, fontSize: 28, fontWeight: '700' }}>PlantPal+</Text>
          <Text style={{ color: p.textMuted, fontSize: 14 }}>
            One app for three daily habits.
          </Text>
        </View>
        <Card style={{ gap: space.md }}>
          <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
          <Input label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
          <ErrorText message={error} />
          <Button title="Sign in" onPress={handleLogin} loading={busy} />
          <Button title="Create an account" variant="ghost" onPress={onRegister} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
