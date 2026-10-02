import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
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

/** What the screen shows once the server has accepted the registration. */
type Done = null | 'verify' | 'sign-in'

export function RegisterPage() {
  usePageTitle('Create account')
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmAge, setConfirmAge] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<ReturnType<typeof validate>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState<Done>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const errors = validate(email, password, confirmAge)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const res = await register(email, password, confirmAge)
      // BR-ACC-10: the API returns the same 202 whether or not the address was
      // already registered, so nothing here may confirm that it existed.
      if (res.verification_required === false) {
        // No email step on this deployment: the account is live, so sign the
        // person straight in and start them on onboarding. If the address was
        // already registered under another password, the sign-in fails with
        // the same generic message any wrong password gets — which discloses
        // nothing the login form would not.
        try {
          await login(email, password)
          navigate('/onboarding', { replace: true })
          return
        } catch {
          setDone('sign-in')
          return
        }
      }
      setDone('verify')
    } catch (err) {
      setFormError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <AuthLayout
        title={done === 'verify' ? 'Check your inbox' : 'You are all set'}
        subtitle={done === 'verify' ? 'One more step to get growing' : 'Sign in to start your first entry'}
      >
        <Card className="p-lg sm:p-xl">
          {done === 'verify' ? (
            <Alert tone="success">
              If that email can be registered, we&apos;ve sent a confirmation link to{' '}
              <strong>{email}</strong>. Open it to activate your account.
            </Alert>
          ) : (
            <Alert tone="success">
              If that email can be registered, its account is ready. Sign in with{' '}
              <strong>{email}</strong> to continue.
            </Alert>
          )}
          <Link
            to="/login"
            className="btn-primary mt-lg inline-flex h-12 w-full items-center justify-center rounded-[14px] text-[15px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Go to sign in
          </Link>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create your account" subtitle="Plant care, fitness and nutrition — one calm daily ritual.">
      <Card className="p-lg sm:p-xl">
        <form onSubmit={onSubmit} className="flex flex-col gap-lg" noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <div className="flex flex-col gap-sm">
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
          </div>
          <div className="flex flex-col gap-xs">
            <label className="flex cursor-pointer items-start gap-sm rounded-md border border-glass-border bg-surface/50 p-md text-sm text-text-main transition-colors hover:bg-surface/80">
              <input
                type="checkbox"
                className="mt-[2px] h-4 w-4 shrink-0 cursor-pointer rounded-[5px] border-border-control accent-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-primary"
                checked={confirmAge}
                onChange={(e) => setConfirmAge(e.target.checked)}
              />
              <span>I confirm I am at least {MINIMUM_AGE} years old.</span>
            </label>
            {fieldErrors.confirmAge ? (
              <p className="text-[13px] text-accent">{fieldErrors.confirmAge}</p>
            ) : null}
          </div>
          <Button type="submit" size="lg" loading={submitting} className="w-full">
            Create account
          </Button>
        </form>
      </Card>
      <p className="mt-lg text-center text-sm text-text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:text-primary-hover hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
