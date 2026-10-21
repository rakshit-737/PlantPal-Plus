import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '../components/ui'

const api = vi.hoisted(() => ({
  listWorkouts: vi.fn(),
  getSummary: vi.fn(),
  getPersonalRecords: vi.fn(),
  searchExercises: vi.fn(),
  logWorkout: vi.fn(),
}))

vi.mock('../lib/fitnessApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/fitnessApi')>()
  return { ...actual, ...api }
})

const { FitnessPage } = await import('./FitnessPage')

const SUMMARY = { total_workouts: 0, total_duration_mins: 0, total_calories: 0, total_steps: 0, by_day: [] }

const WORKOUT = {
  id: 'w1',
  activity_type: 'RUN',
  duration_mins: 30,
  perceived_intensity: null,
  calories_burned: 250,
  total_volume_kg: 0,
  steps: null,
  note: null,
  local_date_str: '2026-10-12',
  logged_at_utc: '2026-10-12T06:00:00.000Z',
  sets: [],
}

function renderPage() {
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <MemoryRouter>
        <FitnessPage />
      </MemoryRouter>
    </ToastProvider>,
  )
  return user
}

beforeEach(() => {
  Object.values(api).forEach((m) => m.mockClear())
  api.getSummary.mockImplementation(async () => SUMMARY)
  api.getPersonalRecords.mockImplementation(async () => [])
  api.searchExercises.mockImplementation(async () => [])
  api.listWorkouts.mockImplementation(async () => [])
})

describe('FitnessPage', () => {
  it('TC-WEB-401 shows the page heading', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Fitness' })).toBeInTheDocument()
  })

  it('TC-WEB-402 empty list shows the empty state with a call to action', async () => {
    renderPage()
    expect(await screen.findByText('No workouts yet')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Log workout' }).length).toBeGreaterThanOrEqual(2)
  })

  it('TC-WEB-403 a logged workout is listed and the empty state is gone', async () => {
    api.listWorkouts.mockImplementation(async () => [WORKOUT])
    renderPage()
    await waitFor(() => expect(api.listWorkouts).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('No workouts yet')).not.toBeInTheDocument())
    expect(await screen.findByText(/Run/)).toBeInTheDocument()
  })

  it('TC-WEB-404 workout list failure shows an error with retry, then recovers', async () => {
    const user = userEvent.setup()
    api.listWorkouts.mockImplementationOnce(async () => {
      throw new Error('boom')
    })
    render(
      <ToastProvider>
        <MemoryRouter>
          <FitnessPage />
        </MemoryRouter>
      </ToastProvider>,
    )
    expect(await screen.findByText("Couldn't load workouts")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /retry|try again/i }))
    expect(await screen.findByText('No workouts yet')).toBeInTheDocument()
  })

  it('TC-WEB-405 summary failure does not hide the workout list', async () => {
    api.getSummary.mockImplementation(async () => {
      throw new Error('boom')
    })
    api.listWorkouts.mockImplementation(async () => [WORKOUT])
    renderPage()
    expect(await screen.findByText("Couldn't load the weekly summary")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText("Couldn't load workouts")).not.toBeInTheDocument())
  })

  it('TC-WEB-406 Log workout opens the modal', async () => {
    const user = renderPage()
    const buttons = await screen.findAllByRole('button', { name: 'Log workout' })
    await user.click(buttons[0]!)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
