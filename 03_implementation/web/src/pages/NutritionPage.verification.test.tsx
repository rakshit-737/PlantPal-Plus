import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '../components/ui'
import type { DailySummary } from '../lib/nutritionApi'

const api = vi.hoisted(() => ({
  searchFoods: vi.fn(),
  getDailySummary: vi.fn(),
  logMeal: vi.fn(),
  logWater: vi.fn(),
  createCustomFood: vi.fn(),
}))

vi.mock('../lib/nutritionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/nutritionApi')>()
  return { ...actual, ...api }
})

const { NutritionPage } = await import('./NutritionPage')

const EMPTY: DailySummary = {
  meals: [],
  water_ml_total: 0,
  water_goal_ml: 2000,
  totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
}

function renderPage() {
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <MemoryRouter>
        <NutritionPage />
      </MemoryRouter>
    </ToastProvider>,
  )
  return user
}

beforeEach(() => {
  Object.values(api).forEach((m) => m.mockClear())
  api.getDailySummary.mockImplementation(async () => EMPTY)
  api.searchFoods.mockImplementation(async () => [])
})

describe('NutritionPage', () => {
  it('TC-WEB-601 shows the heading', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Nutrition' })).toBeInTheDocument()
  })

  it('TC-WEB-602 empty day shows No meals logged', async () => {
    renderPage()
    expect(await screen.findByText('No meals logged')).toBeInTheDocument()
  })

  it('TC-WEB-603 summary failure shows an error state', async () => {
    api.getDailySummary.mockImplementationOnce(async () => {
      throw new Error('boom')
    })
    renderPage()
    expect(await screen.findByText("Couldn't load the day")).toBeInTheDocument()
  })

  it('TC-WEB-604 Log meal opens the modal with the Food field', async () => {
    const user = renderPage()
    const buttons = await screen.findAllByRole('button', { name: 'Log meal' })
    await user.click(buttons[0]!)
    expect(await screen.findByRole('combobox', { name: 'Food' })).toBeInTheDocument()
  })

  it('TC-WEB-605 typing in Food searches the catalogue', async () => {
    const user = renderPage()
    const buttons = await screen.findAllByRole('button', { name: 'Log meal' })
    await user.click(buttons[0]!)
    await user.type(await screen.findByRole('combobox', { name: 'Food' }), 'rice')
    await vi.waitFor(() =>
      expect(api.searchFoods.mock.calls.some((c) => String(c[0]).includes('rice'))).toBe(true),
    )
  })

  it('TC-WEB-606 day navigation reloads the summary for another date', async () => {
    const user = renderPage()
    await screen.findByText('No meals logged')
    const before = api.getDailySummary.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    await vi.waitFor(() => expect(api.getDailySummary.mock.calls.length).toBeGreaterThan(before))
  })
})
