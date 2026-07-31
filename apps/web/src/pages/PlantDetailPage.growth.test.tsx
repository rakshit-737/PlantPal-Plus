/**
 * Growth timeline behaviour (BR-PLT-11). These assert the promises the section
 * makes to a gardener: the newest photo is the one you see first, a link that
 * can never render an image is rejected before it costs a round trip, and a
 * failed load explains itself instead of pretending the timeline is empty.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { GrowthEntry, Plant } from '../lib/plantsApi'

const getPlant = vi.fn()
const getCareHistory = vi.fn()
const listGrowth = vi.fn()
const addGrowthEntry = vi.fn()
const deleteGrowthEntry = vi.fn()
const deletePlant = vi.fn()
const logCare = vi.fn()

vi.mock('../lib/plantsApi', () => ({
  getPlant,
  getCareHistory,
  listGrowth,
  addGrowthEntry,
  deleteGrowthEntry,
  deletePlant,
  logCare,
}))

const { PlantDetailPage } = await import('./PlantDetailPage')

const PLANT: Plant = {
  id: 'p1',
  nickname: 'Fern',
  species_id: null,
  status: 'THRIVING',
  next_water_due_at: null,
  effective_interval_days: null,
  photo_url: null,
  light_exposure: 'BRIGHT_INDIRECT',
  placement: 'INDOOR',
  pot_material: null,
  soil_type: null,
  base_interval_days: 7,
  min_interval_days: 3,
  max_interval_days: 14,
  last_watered_at: null,
  room: 'Study',
  acquisition_date: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

/** height_cm is a string on purpose — Postgres numeric arrives that way. */
function entry(id: string, date: string, over: Partial<GrowthEntry> = {}): GrowthEntry {
  return {
    id,
    plant_id: 'p1',
    user_id: 'u1',
    photo_url: `https://cdn.example.com/${id}.jpg`,
    photo_storage_key: `${id}.jpg`,
    height_cm: null,
    note: null,
    logged_at_utc: `${date}T09:00:00.000Z`,
    local_date_str: date,
    created_at: `${date}T09:00:00.000Z`,
    ...over,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/plants/p1']}>
      <Routes>
        <Route path="/plants/:id" element={<PlantDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** The tile list; the care history above it is not a list, so this is unambiguous. */
const tiles = () => within(screen.getByRole('list')).getAllByRole('listitem')

describe('PlantDetailPage growth log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPlant.mockResolvedValue(PLANT)
    getCareHistory.mockResolvedValue([])
    listGrowth.mockResolvedValue([])
    addGrowthEntry.mockResolvedValue(entry('new', '2026-07-31'))
    deleteGrowthEntry.mockResolvedValue({ status: 'deleted' })
  })

  it('renders entries newest-first with dates, heights and a trend summary', async () => {
    listGrowth.mockResolvedValue([
      entry('e3', '2026-07-20', { height_cm: '34.5' }),
      entry('e2', '2026-06-10', { height_cm: '20', note: 'Third leaf opened' }),
      entry('e1', '2026-05-01', { height_cm: '12.0' }),
    ])
    renderPage()

    await screen.findByRole('heading', { name: 'Growth log' })
    const items = await waitFor(() => {
      const found = tiles()
      expect(found).toHaveLength(3)
      return found
    })
    // The API returns newest-first and the grid must not reorder it.
    expect(items[0]).toHaveTextContent('2026-07-20')
    expect(items[1]).toHaveTextContent('2026-06-10')
    expect(items[2]).toHaveTextContent('2026-05-01')

    // Numeric strings are parsed, not printed raw: '20' reads as 20.0 cm.
    expect(items[1]).toHaveTextContent('20.0 cm')
    expect(screen.getByText('12.0 → 34.5 cm over 3 entries')).toBeInTheDocument()

    // A note becomes the alt text; without one the plant and date describe it.
    expect(screen.getByAltText('Third leaf opened')).toBeInTheDocument()
    expect(screen.getByAltText('Growth photo of Fern, 2026-07-20')).toBeInTheDocument()
  })

  it('rejects a non-http photo link without sending a request', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Add photo' }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText(/photo link/i), 'javascript:alert(1)')
    await user.click(within(dialog).getByRole('button', { name: 'Save photo' }))

    expect(await screen.findByText(/must start with http/i)).toBeInTheDocument()
    expect(addGrowthEntry).not.toHaveBeenCalled()
    // The dialog stays open so the link can be corrected in place.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows an error state with a retry when the timeline fails to load', async () => {
    listGrowth.mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't load the growth log")
    // A failure must never be dressed up as "no photos yet".
    expect(screen.queryByText(/no photos yet/i)).not.toBeInTheDocument()

    listGrowth.mockResolvedValue([entry('e1', '2026-05-01')])
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await screen.findByAltText('Growth photo of Fern, 2026-05-01')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the date and height when the image link is unreachable', async () => {
    listGrowth.mockResolvedValue([entry('e1', '2026-05-01', { height_cm: '12.0' })])
    renderPage()

    const img = await screen.findByAltText('Growth photo of Fern, 2026-05-01')
    fireEvent.error(img)

    expect(screen.queryByAltText('Growth photo of Fern, 2026-05-01')).not.toBeInTheDocument()
    expect(screen.getByText(/image didn't load/i)).toBeInTheDocument()
    // The record survives the dead link.
    expect(screen.getByText('2026-05-01')).toBeInTheDocument()
    expect(screen.getByText('12.0 cm')).toBeInTheDocument()
  })

  it('puts a deleted entry back when the delete request fails', async () => {
    listGrowth.mockResolvedValue([entry('e2', '2026-06-10'), entry('e1', '2026-05-01')])
    deleteGrowthEntry.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    renderPage()

    await screen.findByAltText('Growth photo of Fern, 2026-06-10')
    await user.click(screen.getByRole('button', { name: 'Delete growth photo from 2026-05-01' }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete photo' }),
    )

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(tiles()).toHaveLength(2)
    expect(screen.getByAltText('Growth photo of Fern, 2026-05-01')).toBeInTheDocument()
  })
})
