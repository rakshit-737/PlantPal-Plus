import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Alert, Button, Card, Input } from '../components/ui'
import { usePageTitle } from '../hooks/usePageTitle'
import { authErrorMessage } from '../lib/errorMessages'
import { AuthLayout } from './AuthLayout'

export function LoginPage() {
  usePageTitle('Sign in')
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // ProtectedRoute stashes the path it blocked in state.from; return there.
  const from = (location.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await login(email, password)
      // FR-ACC-02 clause 5: a user in the deletion grace window can still sign in
      // — that is the only way to cancel deletion. Surface it rather than hide it.
      if (res.account_pending_deletion) {
        navigate('/settings?recover=1', { replace: true })
      } else {
        navigate(from ?? '/dashboard', { replace: true })
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your PlantPal+ account">
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-md" noValidate>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="Forgot your password? Password reset is coming; contact support meanwhile."
          />
          <Button type="submit" loading={submitting}>
            Sign in
          </Button>
        </form>
      </Card>
      <p className="mt-lg text-center text-sm text-text-muted">
        New to PlantPal+?{' '}
        <Link to="/register" className="font-semibold text-primary hover:text-primary-hover">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
