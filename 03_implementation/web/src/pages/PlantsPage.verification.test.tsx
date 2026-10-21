import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '../components/ui'
import type { Plant } from '../lib/plantsApi'

const listPlantsMock = vi.fn()
const createPlantMock = vi.fn()
const updatePlantMock = vi.fn()
const logCareMock = vi.fn()
const searchSpeciesMock = vi.fn()

vi.mock('../lib/plantsApi', () => ({
  listPlants: (...a: unknown[]) => listPlantsMock(...a),
  createPlant: (...a: unknown[]) => createPlantMock(...a),
  updatePlant: (...a: unknown[]) => updatePlantMock(...a),
  logCare: (...a: unknown[]) => logCareMock(...a),
  searchSpecies: (...a: unknown[]) => searchSpeciesMock(...a),
}))

const { PlantsPage } = await import('./PlantsPage')

function plant(o: Partial<Plant> = {}): Plant {
  return {
    id: 'p1',
    nickname: 'Monstera',
    species_id: null,
    status: 'THRIVING',
    next_water_due_at: null,
    effective_interval_days: null,
    photo_url: null,
    light_exposure: 'BRIGHT_INDIRECT',
    placement: 'INDOOR',
    pot_material: 'TERRACOTTA',
    soil_type: 'STANDARD_POTTING',
    base_interval_days: 7,
    min_interval_days: 3,
    max_interval_days: 14,
    last_watered_at: null,
    room: 'Kitchen',
    acquisition_date: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...o,
  }
}

function renderPage() {
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <MemoryRouter>
        <PlantsPage />
      </MemoryRouter>
    </ToastProvider>,
  )
  return user
}

beforeEach(() => {
  ;[listPlantsMock, createPlantMock, updatePlantMock, logCareMock, searchSpeciesMock].forEach((m) => m.mockClear())
  listPlantsMock.mockImplementation(async () => [])
  searchSpeciesMock.mockImplementation(async () => [])
  logCareMock.mockImplementation(async () => ({}))
})

describe('PlantsPage list', () => {
  it('TC-WEB-501 empty account shows the empty state', async () => {
    renderPage()
    expect(await screen.findByText('No plants yet')).toBeInTheDocument()
  })

  it('TC-WEB-502 load failure shows an error state', async () => {
    listPlantsMock.mockImplementationOnce(async () => {
      throw new Error('boom')
    })
    renderPage()
    expect(await screen.findByText("Couldn't load your plants")).toBeInTheDocument()
  })

  it('TC-WEB-503 plants render by nickname', async () => {
    listPlantsMock.mockImplementation(async () => [plant(), plant({ id: 'p2', nickname: 'Fern' })])
    renderPage()
    expect(await screen.findByText('Monstera')).toBeInTheDocument()
    expect(screen.getByText('Fern')).toBeInTheDocument()
  })

  it('TC-WEB-504 search filters the grid and reports the count', async () => {
    listPlantsMock.mockImplementation(async () => [plant(), plant({ id: 'p2', nickname: 'Fern' })])
    const user = renderPage()
    await screen.findByText('Monstera')
    await user.type(screen.getByLabelText('Search'), 'fern')
    expect(screen.queryByText('Monstera')).not.toBeInTheDocument()
    expect(screen.getByText('Fern')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 plants')).toBeInTheDocument()
  })

  it('TC-WEB-505 search with no hit shows No plants match', async () => {
    listPlantsMock.mockImplementation(async () => [plant()])
    const user = renderPage()
    await screen.findByText('Monstera')
    await user.type(screen.getByLabelText('Search'), 'zzzz')
    expect(await screen.findByText('No plants match')).toBeInTheDocument()
  })

  it('TC-WEB-506 a never-watered plant says water once to start its schedule', async () => {
    listPlantsMock.mockImplementation(async () => [plant()])
    renderPage()
    expect(await screen.findByText('water once to start its schedule')).toBeInTheDocument()
  })
})

describe('PlantsPage watering', () => {
  it('TC-WEB-507 Water logs a WATER care event for that plant', async () => {
    listPlantsMock.mockImplementation(async () => [plant()])
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: /Water/ }))
    await waitFor(() => expect(logCareMock).toHaveBeenCalledTimes(1))
    expect(logCareMock.mock.calls[0]![0]).toBe('p1')
    expect(logCareMock.mock.calls[0]![1]).toMatchObject({ action_type: 'WATER' })
  })

  it('TC-WEB-508 a failed Water call shows an error and does not refresh', async () => {
    listPlantsMock.mockImplementation(async () => [plant()])
    logCareMock.mockImplementationOnce(async () => {
      throw new Error('offline')
    })
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: /Water/ }))
    expect(await screen.findByText(/Couldn't log water for Monstera/)).toBeInTheDocument()
    expect(listPlantsMock).toHaveBeenCalledTimes(1)
  })
})

describe('PlantsPage add', () => {
  it('TC-WEB-509 Add plant opens the add dialog', async () => {
    const user = renderPage()
    const buttons = await screen.findAllByRole('button', { name: 'Add plant' })
    await user.click(buttons[0]!)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Nickname')).toBeInTheDocument()
  })
})
