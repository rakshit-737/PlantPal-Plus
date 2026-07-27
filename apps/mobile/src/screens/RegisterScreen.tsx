import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'

import { ApiError } from '../api/client'
import { register } from '../api/endpoints'
import { Button, Card, ErrorText, Input } from '../components/ui'
import { usePalette, space } from '../theme'

export function RegisterScreen({ onDone }: { onDone: () => void }) {
  const p = usePalette()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmedAge, setConfirmedAge] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleRegister() {
    setError('')
    setMessage('')
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }
    if (!confirmedAge) {
      setError('You must confirm you are 16 or older.')
      return
    }
    setBusy(true)
    try {
      const res = await register(email.trim(), password, confirmedAge)
      setMessage(res.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Try again.')
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
        <Card style={{ gap: space.md }}>
          <Text style={{ color: p.textMain, fontSize: 22, fontWeight: '700' }}>
            Create your account
          </Text>
          <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
          <Input label="Password" value={password} onChangeText={setPassword} placeholder="12+ characters" secureTextEntry />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmedAge }}
            onPress={() => setConfirmedAge((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: confirmedAge ? p.primary : p.border,
                backgroundColor: confirmedAge ? p.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {confirmedAge ? <Text style={{ color: '#fff', fontSize: 14 }}>✓</Text> : null}
            </View>
            <Text style={{ color: p.textMain, fontSize: 14, flex: 1 }}>
              I confirm I am 16 years of age or older.
            </Text>
          </Pressable>
          <ErrorText message={error} />
          {message ? (
            <Text style={{ color: p.success, fontSize: 13 }}>{message}</Text>
          ) : null}
          <Button title="Register" onPress={handleRegister} loading={busy} />
          <Button title="Back to sign in" variant="ghost" onPress={onDone} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
