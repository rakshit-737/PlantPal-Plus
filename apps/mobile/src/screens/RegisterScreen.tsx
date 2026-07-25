import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native'

import { ApiError } from '../api/client'
import { register } from '../api/endpoints'
import { Button, Card, ErrorText, Input } from '../components/ui'
import { usePalette, space } from '../theme'

export function RegisterScreen({ onDone }: { onDone: () => void }) {
  const p = usePalette()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [dob, setDob] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleRegister() {
    setError('')
    setMessage('')
    if (!email.trim() || !password || !dob.trim()) {
      setError('Email, password and date of birth are required.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob.trim())) {
      setError('Date of birth must be YYYY-MM-DD.')
      return
    }
    setBusy(true)
    try {
      const res = await register(email.trim(), password, dob.trim())
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
          <Input label="Date of birth" value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" />
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
