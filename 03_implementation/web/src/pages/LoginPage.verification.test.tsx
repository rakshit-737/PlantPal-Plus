/**
 * Verification of the sign-in screen (FR-ACC-04, FR-ACC-02 clause 5, NFR-USAB).
 * Test IDs: TC-ACC-201 ..
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../lib/apiClient'

const login = vi.fn()
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ login }) }))
const { LoginPage } = await import('./LoginPage')

const envelope = (code: string, message = 'server message') => ({ code, message, message_key: `errors.${code}`, request_id: 'r1', timestamp: new Date().toISOString(), details: [] })

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname + l.search}</p>
}
function renderAt(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}
const fill = async (email = 'a@b.com', password = 'Correct-Horse-9!') => {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/email/i), email)
  await user.type(screen.getByLabelText(/^password/i), password)
  return user
}

describe('LoginPage', () => {
  beforeEach(() => { login.mockClear(); login.mockImplementation(() => Promise.resolve({ account_pending_deletion: false })) })

  it('TC-ACC-201 shows labelled email and password fields, a submit button and a link to registration', () => {
    renderAt()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register')
  })

  it('TC-ACC-202 the password field is masked and both fields carry the right autocomplete hints', () => {
    renderAt()
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('autocomplete', 'email')
  })

  it('TC-ACC-203 submitting sends exactly the typed email and password and lands on the dashboard', async () => {
    login.mockResolvedValue({ account_pending_deletion: false })
    renderAt()
    const user = await fill('me@example.com', 'Correct-Horse-9!')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(login).toHaveBeenCalledWith('me@example.com', 'Correct-Horse-9!')
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/dashboard'))
  })

  it('TC-ACC-204 returns to the page a protected route redirected from', async () => {
    login.mockResolvedValue({ account_pending_deletion: false })
    renderAt({ from: '/plants/42' })
    const user = await fill()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/plants/42'))
  })

  it('TC-ACC-205 a user in the deletion grace window is sent to settings with the recover flag (FR-ACC-02 clause 5)', async () => {
    login.mockResolvedValue({ account_pending_deletion: true })
    renderAt({ from: '/plants' })
    const user = await fill()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/settings?recover=1'))
  })

  it.each([
    ['INVALID_CREDENTIALS', 'That email or password is not right.'],
    ['EMAIL_NOT_VERIFIED', /confirm your email address/i],
    ['RATE_LIMITED', /Too many attempts/i],
    ['ACC_ACCOUNT_LOCKED', /Too many attempts/i],
    ['ACCOUNT_LOCKED', /account is locked/i],
  ])('TC-ACC-206 %s shows a clear message and keeps the user on the form', async (code, message) => {
    login.mockImplementation(() => Promise.reject(new ApiError(401, envelope(code))))
    renderAt()
    const user = await fill()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByTestId('where')).not.toBeInTheDocument()
  })

  it('TC-ACC-207 an unexpected non-API failure shows a generic retry message, never the raw exception text', async () => {
    login.mockImplementation(() => Promise.reject(new Error('ECONNRESET at 10.0.0.5:4000')))
    renderAt()
    const user = await fill()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong. Please try again.')
    expect(alert).not.toHaveTextContent('ECONNRESET')
  })

  it('TC-ACC-208 the error is cleared when the user submits again', async () => {
    login.mockRejectedValueOnce(new ApiError(401, envelope('INVALID_CREDENTIALS'))).mockResolvedValueOnce({ account_pending_deletion: false })
    renderAt()
    const user = await fill()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('TC-ACC-209 a second click while the request is in flight does not send a second request', async () => {
    let resolve!: (v: unknown) => void
    login.mockReturnValue(new Promise((r) => (resolve = r)))
    renderAt()
    const user = await fill()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(login).toHaveBeenCalledTimes(1)
    resolve({ account_pending_deletion: false })
  })

  it('TC-ACC-210 the password is not echoed anywhere in the page text after a failed attempt', async () => {
    login.mockImplementation(() => Promise.reject(new ApiError(401, envelope('INVALID_CREDENTIALS'))))
    const { container } = renderAt()
    const user = await fill('x@y.com', 'Secret-Passphrase-77!')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('alert')
    expect(container.textContent).not.toContain('Secret-Passphrase-77!')
  })
})
