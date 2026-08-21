import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'

import { Alert, Button, Card, Input, Progress } from '../components/ui'
import { usePageTitle } from '../hooks/usePageTitle'
import { register } from '../lib/authApi'
import { authErrorMessage } from '../lib/errorMessages'
import { AuthLayout } from './AuthLayout'

// Mirrors the server policy (password.ts): 12–128 code points.
const PASSWORD_MIN = 12
const PASSWORD_MAX = 128
// Product policy OQ-09: minimum age 16.
const MINIMUM_AGE = 16

function validate(email: string, password: string, confirmAge: boolean) {
  const errors: { email?: string; password?: string; confirmAge?: string } = {}
  if (!email.includes('@') || email.length < 5) {
    errors.email = 'Enter a valid email address.'
  }
  const length = [...password].length
  if (length < PASSWORD_MIN) {
    errors.password = `Use at least ${PASSWORD_MIN} characters.`
  } else if (length > PASSWORD_MAX) {
    errors.password = `Use at most ${PASSWORD_MAX} characters.`
  }
  if (!confirmAge) {
    errors.confirmAge = `You must confirm you are at least ${MINIMUM_AGE}.`
  }
  return errors
}

/**
 * How far a password has come towards the policy the server enforces.
 *
 * Deliberately not an entropy estimate: the only rule that decides whether
 * this form submits is the length one, so scoring anything else would tell the
 * user their password is "strong" while the server rejects it. Length is the
 * bar, and the meter reports progress towards the bar.
 */
function passwordProgress(password: string): { value: number; tone: 'tertiary' | 'primary' } {
  const length = [...password].length
  const value = Math.min(length, PASSWORD_MIN)
  return { value, tone: value >= PASSWORD_MIN ? 'primary' : 'tertiary' }
}

export function RegisterPage() {
  usePageTitle('Create account')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmAge, setConfirmAge] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<ReturnType<typeof validate>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const errors = validate(email, password, confirmAge)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await register(email, password, confirmAge)
      // BR-ACC-10: the API returns the same 202 whether or not the address was
      // already registered, so the success screen never confirms existence.
      setDone(true)
    } catch (err) {
      setFormError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthLayout title="Check your inbox" subtitle="One more step to get growing">
        <Card>
          <Alert tone="success">
            If that email can be registered, we&apos;ve sent a confirmation link to{' '}
            <strong>{email}</strong>. Open it to activate your account.
          </Alert>
          <p className="mt-md text-center text-sm text-text-muted">
            <Link to="/login" className="font-semibold text-primary hover:text-primary-hover">
              Back to sign in
            </Link>
          </p>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create your account" subtitle="Plant care, fitness and nutrition in one place">
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-md" noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            hint={`At least ${PASSWORD_MIN} characters.`}
          />
          {password ? (
            <Progress
              value={passwordProgress(password).value}
              max={PASSWORD_MIN}
              tone={passwordProgress(password).tone}
              srLabel="Password length requirement"
            />
          ) : null}
          <div className="flex flex-col gap-xs">
            <label className="flex items-start gap-sm text-sm text-text-main">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded-sm border-border-control text-primary focus-visible:ring-primary"
                checked={confirmAge}
                onChange={(e) => setConfirmAge(e.target.checked)}
              />
              <span>I confirm I am at least {MINIMUM_AGE} years old.</span>
            </label>
            {fieldErrors.confirmAge ? (
              <p className="text-sm text-accent">{fieldErrors.confirmAge}</p>
            ) : null}
          </div>
          <Button type="submit" loading={submitting}>
            Create account
          </Button>
        </form>
      </Card>
      <p className="mt-lg text-center text-sm text-text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-primary hover:text-primary-hover">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
