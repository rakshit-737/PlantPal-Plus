/**
 * The edit-plant flow. These assert the promises the flow makes to the user:
 * the form opens already holding the plant's values, saving sends only what the
 * user actually changed (never a phantom field the API would then write), and a
 * failed save keeps the typed values on screen instead of swallowing them.
 *
 * The add path shares the same form component, so one add case rides along to
 * catch a regression in the extraction.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '../components/ui'
import type { Plant, Species } from '../lib/plantsApi'

const listPlantsMock = vi.fn()
const createPlantMock = vi.fn()
const updatePlantMock = vi.fn()
const logCareMock = vi.fn()
const searchSpeciesMock = vi.fn()

vi.mock('../lib/plantsApi', () => ({
  listPlants: (...args: unknown[]) => listPlantsMock(...args),
  createPlant: (...args: unknown[]) => createPlantMock(...args),
  updatePlant: (...args: unknown[]) => updatePlantMock(...args),
  logCare: (...args: unknown[]) => logCareMock(...args),
  searchSpecies: (...args: unknown[]) => searchSpeciesMock(...args),
}))

const { PlantsPage } = await import('./PlantsPage')

const species: Species = {
  id: 's1',
  scientific_name: 'Monstera deliciosa',
  common_name: 'Monstera',
  base_interval_days: 7,
  min_interval_days: 3,
  max_interval_days: 14,
  default_light: 'BRIGHT_INDIRECT',
  default_soil: 'STANDARD_POTTING',
}

function plant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: 'p1',
    nickname: 'Monstera',
    species_id: 's1',
    status: 'THRIVING',
    next_water_due_at: null,
    effective_interval_days: null,
    photo_url: null,
    light_exposure: 'BRIGHT_INDIRECT',
    placement: 'INDOOR',
    pot_material: 'TERRACOTTA',
    soil_type: 'STANDARD_POTTING',
    // A Postgres count can reach the client as a string; the form must still
    // show "7" and must not read the unchanged field as an edit.
    base_interval_days: '7' as unknown as number,
    min_interval_days: 3,
    max_interval_days: 14,
    last_watered_at: null,
    room: 'Kitchen',
    acquisition_date: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const fern = plant({ id: 'p2', nickname: 'Fern', species_id: null, status: 'DORMANT' })

async function renderPage() {
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <MemoryRouter>
        <PlantsPage />
      </MemoryRouter>
    </ToastProvider>,
  )
  await screen.findByRole('button', { name: 'Edit Monstera' })
  return user
}

async function openEdit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Edit Monstera' }))
  return await screen.findByRole('dialog')
}

describe('PlantsPage edit flow', () => {
  beforeEach(() => {
    listPlantsMock.mockReset().mockResolvedValue([plant(), fern])
    createPlantMock.mockReset().mockResolvedValue(plant())
    updatePlantMock.mockReset().mockResolvedValue(plant())
    logCareMock.mockReset().mockResolvedValue(undefined)
    searchSpeciesMock.mockReset().mockResolvedValue([species])
  })

  it('opens an edit dialog prefilled from the plant', async () => {
    const user = await renderPage()
    const dialog = await openEdit(user)

    expect(dialog).toHaveAccessibleName('Edit plant')
    expect(screen.getByLabelText('Nickname')).toHaveValue('Monstera')
    // Numeric-as-string from the API lands as a plain "7", not "7.00".
    expect(screen.getByLabelText('Base days')).toHaveValue(7)
    expect(screen.getByLabelText('Min days')).toHaveValue(3)
    expect(screen.getByLabelText('Max days')).toHaveValue(14)
    expect(screen.getByLabelText('Light')).toHaveValue('BRIGHT_INDIRECT')
    expect(screen.getByLabelText('Placement')).toHaveValue('INDOOR')
    expect(screen.getByLabelText('Pot material')).toHaveValue('TERRACOTTA')
    expect(screen.getByLabelText('Soil type')).toHaveValue('STANDARD_POTTING')
    // The species id is resolved against the catalogue for display.
    expect(screen.getByLabelText('Species (optional)')).toHaveValue('Monstera')
  })

  it('sends only the changed fields and refreshes the list', async () => {
    const user = await renderPage()
    await openEdit(user)

    const nickname = screen.getByLabelText('Nickname')
    await user.clear(nickname)
    await user.type(nickname, 'Big Monstera')
    const base = screen.getByLabelText('Base days')
    await user.clear(base)
    await user.type(base, '10')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(updatePlantMock).toHaveBeenCalledTimes(1))
    // Exactly the two edits: no species_id, light, placement, pot, soil or the
    // untouched min/max riding along.
    expect(updatePlantMock).toHaveBeenCalledWith('p1', {
      nickname: 'Big Monstera',
      base_interval_days: 10,
    })
    expect(await screen.findByText('Updated Big Monstera')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // Once on mount, once after the save.
    expect(listPlantsMock).toHaveBeenCalledTimes(2)
  })

  it('skips the request when nothing was edited', async () => {
    const user = await renderPage()
    await openEdit(user)

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('No changes to save.')).toBeInTheDocument()
    expect(updatePlantMock).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps the dialog open with the typed values when the save fails', async () => {
    updatePlantMock.mockRejectedValue(new Error('offline'))
    const user = await renderPage()
    await openEdit(user)

    const nickname = screen.getByLabelText('Nickname')
    await user.clear(nickname)
    await user.type(nickname, 'Big Monstera')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText("The changes weren't saved. Check your connection and try again."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Couldn't update Monstera. Check your connection and try again."),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Nickname')).toHaveValue('Big Monstera')
    // The retry is one click away, so the list must not have been re-read.
    expect(listPlantsMock).toHaveBeenCalledTimes(1)
  })

  it('validates the intervals before reaching the API', async () => {
    const user = await renderPage()
    await openEdit(user)

    await user.clear(screen.getByLabelText('Base days'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText('Base, min and max days must each be whole numbers from 1 to 365.'),
    ).toBeInTheDocument()
    expect(updatePlantMock).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('still adds a plant through the shared form', async () => {
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: 'Add plant' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAccessibleName('Add plant')
    // A fresh form, not the last plant's values.
    expect(screen.getByLabelText('Nickname')).toHaveValue('')

    await user.type(screen.getByLabelText('Nickname'), 'Tulsi')
    await user.click(within(dialog).getByRole('button', { name: 'Add plant' }))

    await waitFor(() => expect(createPlantMock).toHaveBeenCalledTimes(1))
    expect(createPlantMock).toHaveBeenCalledWith({
      nickname: 'Tulsi',
      species_id: null,
      light_exposure: 'BRIGHT_INDIRECT',
      placement: 'INDOOR',
      pot_material: null,
      soil_type: null,
      base_interval_days: 7,
      min_interval_days: 3,
      max_interval_days: 14,
    })
    expect(await screen.findByText('Added Tulsi')).toBeInTheDocument()
  })
})
