/**
 * Verification of the registration screen (FR-ACC-01, BR-ACC-01, BR-ACC-10, BR-ACC-13).
 * Test IDs: TC-ACC-221 ..
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../lib/apiClient'

const login = vi.fn()
const register = vi.fn()
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ login }) }))
vi.mock('../lib/authApi', () => ({ register: (...a: unknown[]) => register(...a) }))
const { RegisterPage } = await import('./RegisterPage')

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

async function submit({ email = 'new@example.com', password = 'Correct-Horse-9!', age = true } = {}) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/email/i), email)
  await user.type(screen.getByLabelText(/^password/i), password, { delay: 0 })
  if (age) await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', { name: 'Create account' }))
}

describe('RegisterPage', () => {
  beforeEach(() => {
    login.mockReset()
    register.mockReset()
    register.mockResolvedValue({ verification_required: true })
  })

  it('TC-ACC-221 shows email, password and the age confirmation, and a link to sign in', () => {
    renderPage()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByText('I confirm I am at least 16 years old.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })

  it('TC-ACC-222 the password field is masked with new-password autocomplete', () => {
    renderPage()
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('autocomplete', 'new-password')
  })

  it('TC-ACC-223 submitting an empty form shows all three errors at once and sends nothing', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Use at least 12 characters.')).toBeInTheDocument()
    expect(screen.getByText('You must confirm you are at least 16.')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it.each(['plainaddress', 'a@b', ''])('TC-ACC-224 rejects the email %j', async (email) => {
    renderPage()
    await submit({ email: email || ' ' })
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('TC-ACC-225 an 11-character password is refused and a 12-character one is accepted (boundary)', async () => {
    renderPage()
    await submit({ password: 'Abcdef-1234' })
    expect(await screen.findByText('Use at least 12 characters.')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('TC-ACC-226 a 12-character password is accepted and sent with the age confirmation', async () => {
    renderPage()
    await submit({ password: 'Abcdef-12345' })
    await waitFor(() => expect(register).toHaveBeenCalledWith('new@example.com', 'Abcdef-12345', true))
  })

  it('TC-ACC-227 a 128-character password is accepted and a 129-character one is refused (boundary)', async () => {
    renderPage()
    await submit({ password: 'Aa1!'.repeat(32) })
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1))
  })

  it('TC-ACC-228 a 129-character password shows the maximum-length error', async () => {
    renderPage()
    await submit({ password: 'Aa1!'.repeat(32) + 'x' })
    expect(await screen.findByText('Use at most 128 characters.')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('TC-ACC-229 length is counted in characters, not UTF-16 units: twelve emoji count as 12', async () => {
    renderPage()
    await submit({ password: '\u{1F331}'.repeat(12) })
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1))
  })

  it('TC-ACC-230 the age confirmation is required (BR-ACC-13)', async () => {
    renderPage()
    await submit({ age: false })
    expect(await screen.findByText('You must confirm you are at least 16.')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('TC-ACC-231 success with email verification shows a neutral message that does not reveal whether the address was already registered (BR-ACC-10)', async () => {
    renderPage()
    await submit()
    expect(await screen.findByText('Check your inbox')).toBeInTheDocument()
    expect(screen.getByText(/If that email can be registered/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login')
  })

  it('TC-ACC-232 without verification the user is signed in and sent to onboarding', async () => {
    register.mockResolvedValue({ verification_required: false })
    login.mockResolvedValue({})
    renderPage()
    await submit({ email: 'quick@example.com', password: 'Abcdef-12345' })
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/onboarding'))
    expect(login).toHaveBeenCalledWith('quick@example.com', 'Abcdef-12345')
  })

  it('TC-ACC-233 if the automatic sign-in fails the user is told to sign in manually', async () => {
    register.mockResolvedValue({ verification_required: false })
    login.mockRejectedValue(new Error('boom'))
    renderPage()
    await submit()
    expect(await screen.findByText('You are all set')).toBeInTheDocument()
  })

  it('TC-ACC-234 a server validation error is shown on the form and the form stays editable', async () => {
    register.mockRejectedValue(new ApiError(422, { code: 'VALIDATION_FAILED', message: 'bad', message_key: 'errors.VALIDATION_FAILED', request_id: 'r', timestamp: new Date().toISOString(), details: [{ field: 'password', issue: 'weak', message: 'That password is too weak.' }] }))
    renderPage()
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('That password is too weak.')
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
  })

  it('TC-ACC-235 [DEF-005] the client also enforces the password composition rules of BR-ACC-01 (clauses 3 to 5)', async () => {
    // The screen validates length only, so a single-character-class, 12-times
    // repeated password is sent to the server. The SRS requires it to be refused.
    renderPage()
    await submit({ password: 'aaaaaaaaaaaa' })
    expect(register).not.toHaveBeenCalled()
  })
})
