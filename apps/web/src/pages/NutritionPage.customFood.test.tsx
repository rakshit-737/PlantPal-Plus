/**
 * Custom foods in the log-meal modal.
 *
 * Three promises are worth defending: a search that finds nothing offers a way
 * forward instead of a dead end, out-of-range macros are caught here rather than
 * bounced back as a 422, and a created food lands straight on the meal line —
 * which is the entire reason the endpoint answers in the search shape.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '../components/ui'
import { CustomFoodLimitError, type DailySummary, type Food } from '../lib/nutritionApi'

const api = vi.hoisted(() => ({
  searchFoods: vi.fn(),
  getDailySummary: vi.fn(),
  logMeal: vi.fn(),
  logWater: vi.fn(),
  createCustomFood: vi.fn(),
}))

// Only the network calls are stubbed: CustomFoodLimitError stays the real class
// so the page's `instanceof` branch is the one that ships, not a test double.
vi.mock('../lib/nutritionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/nutritionApi')>()
  return { ...actual, ...api }
})

const { NutritionPage } = await import('./NutritionPage')

const EMPTY_DAY: DailySummary = {
  meals: [],
  water_ml_total: 0,
  water_goal_ml: 2000,
  totals: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
}

/** What POST /v1/nutrition/foods returns: the created row in the search shape. */
const RAGI_DOSA: Food = {
  id: 'food-created-1',
  name: 'Ragi dosa',
  brand: null,
  kcal_per_100g: 300,
  protein_per_100g: 8,
  carbs_per_100g: 60,
  fat_per_100g: 2,
  default_serving_unit: 'GRAM',
  default_serving_grams: null,
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

/** Open the modal and search for something the catalogue does not have. */
async function searchForMissingFood(user: UserEvent) {
  const openButtons = await screen.findAllByRole('button', { name: 'Log meal' })
  await user.click(openButtons[0]!)
  await user.type(screen.getByRole('combobox', { name: 'Food' }), 'Ragi dosa')
  return screen.findByRole('button', { name: 'Add it as a custom food' })
}

async function openCreateForm(user: UserEvent) {
  await user.click(await searchForMissingFood(user))
  return screen.findByRole('textbox', { name: 'Name' })
}

const kcalField = () => screen.getByRole('spinbutton', { name: 'Calories (kcal / 100 g)' })
const macroField = (macro: 'Protein' | 'Carbs' | 'Fat') =>
  screen.getByRole('spinbutton', { name: `${macro} (g)` })
const saveButton = () => screen.getByRole('button', { name: 'Save food' })

describe('NutritionPage — custom foods', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getDailySummary.mockResolvedValue(EMPTY_DAY)
    api.searchFoods.mockResolvedValue([])
    api.createCustomFood.mockResolvedValue(RAGI_DOSA)
  })

  it('offers to create the food when the search finds nothing', async () => {
    const user = renderPage()
    const add = await searchForMissingFood(user)

    expect(screen.getByText(/No food matches/)).toBeInTheDocument()
    expect(add).toBeInTheDocument()
  })

  it('opens the create form prefilled with the searched name, and focuses it', async () => {
    const user = renderPage()
    const name = await openCreateForm(user)

    expect(screen.getByRole('heading', { name: 'Add custom food' })).toBeInTheDocument()
    expect(name).toHaveValue('Ragi dosa')
    await waitFor(() => expect(name).toHaveFocus())
  })

  it('blocks out-of-range macros before calling the API', async () => {
    const user = renderPage()
    await openCreateForm(user)

    await user.type(kcalField(), '300')
    await user.type(macroField('Protein'), '150')
    await user.click(saveButton())

    expect(await screen.findByText('Enter a value between 0 and 100.')).toBeInTheDocument()
    expect(macroField('Protein')).toBeInvalid()
    expect(api.createCustomFood).not.toHaveBeenCalled()
    // Still on the create form — nothing was silently discarded.
    expect(screen.getByRole('heading', { name: 'Add custom food' })).toBeInTheDocument()
  })

  it('requires calories, which the server also insists on', async () => {
    const user = renderPage()
    await openCreateForm(user)

    await user.click(saveButton())

    expect(await screen.findByText('Enter the calories in 100 g.')).toBeInTheDocument()
    expect(api.createCustomFood).not.toHaveBeenCalled()
  })

  it('selects a created food straight into the meal line', async () => {
    const user = renderPage()
    await openCreateForm(user)

    await user.type(kcalField(), '300')
    await user.type(macroField('Protein'), '8')
    await user.type(macroField('Carbs'), '60')
    await user.type(macroField('Fat'), '2')
    await user.click(saveButton())

    await waitFor(() =>
      expect(api.createCustomFood).toHaveBeenCalledWith({
        name: 'Ragi dosa',
        kcal_per_100g: 300,
        protein_per_100g: 8,
        carbs_per_100g: 60,
        fat_per_100g: 2,
        default_serving_unit: 'GRAM',
      }),
    )

    // Back on the meal form with the new food already chosen — no second search.
    expect(await screen.findByRole('heading', { name: 'Log meal' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Food' })).toHaveValue('Ragi dosa')
    const quantity = screen.getByRole('spinbutton', { name: 'Quantity' })
    expect(quantity).toHaveValue(100)
    await waitFor(() => expect(quantity).toHaveFocus())
    expect(await screen.findByText('Ragi dosa saved to your foods')).toBeInTheDocument()
  })

  it('states the ceiling plainly when the account is full', async () => {
    api.createCustomFood.mockRejectedValue(new CustomFoodLimitError(200, 200))
    const user = renderPage()
    await openCreateForm(user)

    await user.type(kcalField(), '300')
    await user.click(saveButton())

    expect(
      await screen.findByText(/You've reached the limit of 200 custom foods/),
    ).toBeInTheDocument()
    // The form stays put so the values can be copied elsewhere.
    expect(screen.getByRole('heading', { name: 'Add custom food' })).toBeInTheDocument()
  })

  it('keeps the typed values when stepping back to the meal form', async () => {
    const user = renderPage()
    await openCreateForm(user)
    await user.type(kcalField(), '300')

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(await screen.findByRole('heading', { name: 'Log meal' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Food' })).toHaveFocus())

    await user.click(screen.getByRole('button', { name: 'Add it as a custom food' }))
    expect(kcalField()).toHaveValue(300)
  })
})
