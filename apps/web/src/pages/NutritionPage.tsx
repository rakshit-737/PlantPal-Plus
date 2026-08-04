import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Combobox,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Progress,
  Select,
  Spinner,
  useToast,
  type ComboOption,
} from '../components/ui'
import { usePageTitle } from '../hooks/usePageTitle'
import {
  createCustomFood, CustomFoodLimitError, deleteCustomFood as _deleteCustomFood, getDailySummary, logMeal, logWater,
  searchFoods, SERVING_UNITS,
  type CreateCustomFoodInput, type DailySummary, type Food, type ServingUnit,
} from '../lib/nutritionApi'

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const
type MealType = (typeof MEAL_TYPES)[number]

const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
}

// Plural + singular display names for the API's serving-unit enum.
const UNIT_PLURAL: Record<string, string> = {
  GRAM: 'grams',
  MILLILITRE: 'millilitres',
  PIECE: 'pieces',
  CUP: 'cups',
  TABLESPOON: 'tablespoons',
  SLICE: 'slices',
  CUSTOM: 'servings',
}
const UNIT_SINGULAR: Record<string, string> = {
  GRAM: 'gram',
  MILLILITRE: 'millilitre',
  PIECE: 'piece',
  CUP: 'cup',
  TABLESPOON: 'tablespoon',
  SLICE: 'slice',
  CUSTOM: 'serving',
}

/* ------------------------------------------------- custom food form model */

/** The create form's raw text state — every field is a string until submit. */
interface CustomFoodForm {
  name: string
  brand: string
  kcal: string
  protein: string
  carbs: string
  fat: string
  unit: ServingUnit
  grams: string
  barcode: string
}

type CustomFoodErrors = Partial<Record<keyof CustomFoodForm, string>>

const EMPTY_CUSTOM_FOOD: CustomFoodForm = {
  name: '', brand: '', kcal: '', protein: '', carbs: '', fat: '',
  unit: 'GRAM', grams: '', barcode: '',
}

/** Parse an optional numeric field: blank is absent, anything else must fit. */
function optionalNumber(
  raw: string,
  min: number,
  max: number,
  rangeMessage: string,
): { value: number | undefined } | { error: string } {
  const text = raw.trim()
  if (!text) return { value: undefined }
  const n = Number(text)
  if (!Number.isFinite(n)) return { error: 'Enter a number.' }
  if (n < min || n > max) return { error: rangeMessage }
  return { value: n }
}

const MACRO_RANGE = 'Enter a value between 0 and 100.'

/**
 * Mirror of customFoodSchema in nutritionController — every bound here matches a
 * bound there, so a form that passes cannot come back as a 422 the user has to
 * decode from a toast. Returns the request body only when nothing is wrong.
 */
function validateCustomFood(
  form: CustomFoodForm,
): { errors: CustomFoodErrors; input?: CreateCustomFoodInput } {
  const errors: CustomFoodErrors = {}

  const name = form.name.trim()
  if (!name) errors.name = 'Enter a name.'
  else if (name.length > 120) errors.name = 'Use 120 characters or fewer.'

  const brand = form.brand.trim()
  if (brand.length > 80) errors.brand = 'Use 80 characters or fewer.'

  const kcalText = form.kcal.trim()
  let kcal: number | null = null
  if (!kcalText) {
    errors.kcal = 'Enter the calories in 100 g.'
  } else {
    const parsed = Number(kcalText)
    if (!Number.isFinite(parsed)) errors.kcal = 'Enter a number.'
    else if (parsed < 0 || parsed > 9000) errors.kcal = 'Enter a value between 0 and 9,000.'
    else kcal = parsed
  }

  const protein = optionalNumber(form.protein, 0, 100, MACRO_RANGE)
  if ('error' in protein) errors.protein = protein.error
  const carbs = optionalNumber(form.carbs, 0, 100, MACRO_RANGE)
  if ('error' in carbs) errors.carbs = carbs.error
  const fat = optionalNumber(form.fat, 0, 100, MACRO_RANGE)
  if ('error' in fat) errors.fat = fat.error

  const grams = optionalNumber(
    form.grams, 0.1, 5000, 'Enter a weight between 0.1 and 5,000 g.',
  )
  if ('error' in grams) errors.grams = grams.error
  else if (grams.value === undefined && form.unit !== 'GRAM') {
    // Not a server rule, but a household unit with no gram weight cannot be
    // converted, so the food would only ever be loggable in grams.
    errors.grams = `Enter the weight of one ${UNIT_SINGULAR[form.unit] ?? 'serving'}.`
  }

  const barcode = form.barcode.trim()
  if (barcode && !/^\d{8,14}$/.test(barcode)) errors.barcode = 'Enter 8 to 14 digits.'

  if (Object.keys(errors).length > 0 || kcal === null) return { errors }
  if ('error' in protein || 'error' in carbs || 'error' in fat || 'error' in grams) {
    return { errors }
  }

  const input: CreateCustomFoodInput = {
    name,
    kcal_per_100g: kcal,
    // The macros default to 0 server-side; sending them explicitly keeps the
    // created row identical to what the form showed.
    protein_per_100g: protein.value ?? 0,
    carbs_per_100g: carbs.value ?? 0,
    fat_per_100g: fat.value ?? 0,
    default_serving_unit: form.unit,
  }
  if (brand) input.brand = brand
  if (grams.value !== undefined) input.default_serving_grams = grams.value
  if (barcode) input.barcode = barcode
  return { errors, input }
}

function dateStr(d: Date) {
  // Local wall-clock date (FR-SYS-22) — toISOString would shift the day for
  // anyone east of UTC in the evening or west of UTC in the morning.
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const circumference = 2 * Math.PI * 50
// No user-settable calorie target exists in the API yet; this is an honest,
// labelled default rather than a value we pretend the user chose.
const DEFAULT_KCAL_TARGET = 2000

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path d={direction === 'left' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} strokeLinecap="square" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path d="M8 3v10M3 8h10" strokeLinecap="square" />
    </svg>
  )
}

function _TrashIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path d="M3 4.5h10M6.5 4.5v-2h3v2M4.5 4.5l.5 9h6l.5-9" strokeLinecap="square" />
    </svg>
  )
}

export function NutritionPage() {
  usePageTitle('Nutrition')
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [date, setDate] = useState(new Date())
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [logOpen, setLogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [mealType, setMealType] = useState<MealType>('BREAKFAST')
  const [foodQuery, setFoodQuery] = useState('')
  const [foodResults, setFoodResults] = useState<Food[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [servingUnit, setServingUnit] = useState('GRAM')
  const [quantity, setQuantity] = useState('100')

  // The modal has three panes rather than three Modals: the shared Modal traps
  // Tab on `document`, so a second open instance would fight the first for
  // focus. That is also why deleting a food confirms in a pane here rather than
  // in the separate confirm Modal the plant pages use — there is already one
  // open.
  const [modalPane, setModalPane] = useState<'log' | 'create' | 'confirm-delete'>('log')
  const [customFood, setCustomFood] = useState<CustomFoodForm>(EMPTY_CUSTOM_FOOD)
  const [customErrors, setCustomErrors] = useState<CustomFoodErrors>({})
  const [customFormError, setCustomFormError] = useState('')
  const [creating, setCreating] = useState(false)

  // The food itself, not just its id: the confirm pane keeps naming it while
  // the search list underneath is free to refresh.
  // (Underscored names: delete-food scaffolding whose confirm pane isn't
  // rendered yet — rename back when wiring the UI.)
  const [_foodToDelete, setFoodToDelete] = useState<Food | null>(null)
  const [_deleting, _setDeleting] = useState(false)
  // Bumped to re-run the search effect after a delete, without touching the
  // query text (which would move the user's cursor and re-debounce).
  const [_searchNonce, _setSearchNonce] = useState(0)

  const logPaneRef = useRef<HTMLDivElement>(null)
  const customNameRef = useRef<HTMLInputElement>(null)
  const quantityRef = useRef<HTMLInputElement>(null)
  const _cancelDeleteRef = useRef<HTMLButtonElement>(null)
  // Where focus lands when the create pane hands control back.
  const returnFocusRef = useRef<'search' | 'quantity'>('search')
  const prevPaneRef = useRef<'log' | 'create' | 'confirm-delete'>('log')

  // Each water button carries its own busy flag so +250 spinning never locks +500.
  const [water250Busy, setWater250Busy] = useState(false)
  const [water500Busy, setWater500Busy] = useState(false)

  // Water goal: the API records goal_ml_at_log on each water entry and the
  // summary reports max(goal) for the day. An edited goal is held here and
  // rides along on the next logWater call; the displayed goal always comes
  // from the summary.
  const [goalEditing, setGoalEditing] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [goalError, setGoalError] = useState('')
  const [pendingGoal, setPendingGoal] = useState<number | null>(null)

  // The ring animates its stroke from zero once the first summary renders.
  const [ringReady, setRingReady] = useState(false)

  const ds = dateStr(date)
  const isToday = ds === dateStr(new Date())

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    getDailySummary(ds)
      .then((s) => setSummary(s))
      .catch(() => {
        // Keep the error separate from "empty day" — a failed fetch must never
        // render a zeroed ring and "No meals logged".
        setSummary(null)
        setLoadError(true)
      })
      .finally(() => setLoading(false))
  }, [ds])

  useEffect(() => {
    load()
  }, [load])

  // Arm the ring transition one frame after the ring first paints at zero.
  useEffect(() => {
    if (loading || loadError || ringReady) return
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setRingReady(true)),
    )
    return () => cancelAnimationFrame(raf)
  }, [loading, loadError, ringReady])

  // ?log=1 (optionally &meal=LUNCH) opens the modal preselected, then the
  // params are stripped so refresh/back does not re-open it.
  const openLog = useCallback((mt: MealType) => {
    setMealType(mt)
    setFoodQuery('')
    setSelectedFood(null)
    setServingUnit('GRAM')
    setQuantity('100')
    setFormError('')
    setSearchError('')
    setModalPane('log')
    setCustomFood(EMPTY_CUSTOM_FOOD)
    setCustomErrors({})
    setCustomFormError('')
    setFoodToDelete(null)
    setLogOpen(true)
  }, [])

  // Move focus with the pane, and only when the pane actually changes — on the
  // first open the Modal's own focus handling stands.
  useEffect(() => {
    if (!logOpen) {
      prevPaneRef.current = 'log'
      return
    }
    if (prevPaneRef.current === modalPane) return
    prevPaneRef.current = modalPane
    if (modalPane === 'create') {
      customNameRef.current?.focus()
      return
    }
    if (returnFocusRef.current === 'quantity' && quantityRef.current) {
      quantityRef.current.focus()
      return
    }
    // The shared Combobox takes no ref, so reach its input through the pane.
    logPaneRef.current?.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus()
  }, [logOpen, modalPane])

  useEffect(() => {
    if (searchParams.get('log') !== '1') return
    const mealParam = (searchParams.get('meal') ?? '').toUpperCase()
    openLog(
      (MEAL_TYPES as readonly string[]).includes(mealParam)
        ? (mealParam as MealType)
        : 'BREAKFAST',
    )
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams, openLog])

  // Empty query = browse the catalogue alphabetically; typing narrows it.
  // The list loads as soon as the modal opens so scrolling works without a query.
  useEffect(() => {
    if (!logOpen) {
      setFoodResults([])
      return
    }
    let cancelled = false
    setSearchLoading(true)
    const t = setTimeout(() => {
      searchFoods(foodQuery)
        .then((foods) => {
          if (cancelled) return
          setFoodResults(foods)
          setSearchError('')
        })
        .catch(() => {
          if (cancelled) return
          setFoodResults([])
          setSearchError('Food search failed. Edit the text to retry.')
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false)
        })
    }, foodQuery ? 250 : 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [foodQuery, logOpen])

  const foodOptions = useMemo<ComboOption[]>(
    () =>
      foodResults.map((f) => ({
        id: f.id,
        label: f.name,
        sub: `${Math.round(f.kcal_per_100g)} kcal/100g${f.brand ? ` · ${f.brand}` : ''}`,
      })),
    [foodResults],
  )

  /** Put a food on the meal line, in its most natural unit. */
  const selectFood = useCallback((food: Food) => {
    setSelectedFood(food)
    setFoodQuery(food.name)
    if (food.default_serving_unit !== 'GRAM' && food.default_serving_grams) {
      // The catalogue provides a household serving — start in it.
      setServingUnit(food.default_serving_unit)
      setQuantity('1')
    } else {
      setServingUnit('GRAM')
      setQuantity(String(food.default_serving_grams ?? 100))
    }
  }, [])

  function handleFoodSelect(option: ComboOption | null) {
    if (!option) {
      // The user edited the text after selecting — drop the stale food.
      setSelectedFood(null)
      return
    }
    const food = foodResults.find((f) => f.id === option.id)
    if (!food) return
    selectFood(food)
  }

  // Units we can honestly convert: grams always; the food's own default unit
  // when the catalogue gives its gram weight.
  const unitOptions = useMemo(() => {
    if (
      selectedFood &&
      selectedFood.default_serving_unit !== 'GRAM' &&
      selectedFood.default_serving_grams
    ) {
      return [selectedFood.default_serving_unit, 'GRAM']
    }
    return ['GRAM']
  }, [selectedFood])

  function handleUnitChange(next: string) {
    const perUnit = selectedFood?.default_serving_grams
    const q = parseFloat(quantity)
    if (perUnit && Number.isFinite(q) && q > 0) {
      // Keep the logged amount equivalent when switching units.
      if (servingUnit !== 'GRAM' && next === 'GRAM') {
        setQuantity(String(Math.round(q * perUnit)))
      } else if (servingUnit === 'GRAM' && next !== 'GRAM') {
        setQuantity(String(Number((q / perUnit).toFixed(2))))
      }
    }
    setServingUnit(next)
  }

  const qtyNum = parseFloat(quantity)
  const gramsForQty =
    servingUnit === 'GRAM'
      ? qtyNum
      : qtyNum * (selectedFood?.default_serving_grams ?? 0)
  const kcalPreview = selectedFood
    ? (gramsForQty / 100) * selectedFood.kcal_per_100g
    : 0

  // A search that found nothing — not a failed one, which the Combobox reports
  // as an error, and not the browse-everything state of an empty query.
  const noMatches =
    !selectedFood &&
    !searchLoading &&
    !searchError &&
    foodQuery.trim().length > 0 &&
    foodResults.length === 0
  const hasCustomFieldErrors = Object.keys(customErrors).length > 0

  async function handleLogMeal() {
    setFormError('')
    if (!selectedFood) {
      setFormError('Select a food from the list.')
      return
    }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0 || !Number.isFinite(gramsForQty) || gramsForQty <= 0) {
      setFormError('Enter a quantity above zero.')
      return
    }
    const factor = gramsForQty / 100
    setSaving(true)
    try {
      await logMeal({
        meal_type: mealType,
        local_date_str: ds,
        items: [{
          food_id: selectedFood.id,
          food_name_at_log: selectedFood.name,
          quantity: qtyNum,
          serving_unit: servingUnit,
          grams: gramsForQty,
          kcal: selectedFood.kcal_per_100g * factor,
          protein_g: selectedFood.protein_per_100g * factor,
          carbs_g: selectedFood.carbs_per_100g * factor,
          fat_g: selectedFood.fat_per_100g * factor,
        }],
      })
      setLogOpen(false)
      toast.success(`Logged ${selectedFood.name}`)
      try {
        setSummary(await getDailySummary(ds))
      } catch {
        toast.error('Meal saved, but totals did not refresh. Reload to see them.')
      }
    } catch {
      setFormError('The meal was not saved. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  function setCustomField<K extends keyof CustomFoodForm>(key: K, value: CustomFoodForm[K]) {
    setCustomFood((prev) => ({ ...prev, [key]: value }))
    // Editing a field clears its error; submit re-checks everything anyway.
    setCustomErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function openCustomFood() {
    // The draft survives stepping back to the search and returning; only the
    // name follows the search box, because that is the user's latest intent.
    setCustomFood((prev) => ({ ...prev, name: foodQuery.trim().slice(0, 120) }))
    setCustomErrors({})
    setCustomFormError('')
    returnFocusRef.current = 'search'
    setModalPane('create')
  }

  function closeCustomFood() {
    setCustomErrors({})
    setCustomFormError('')
    returnFocusRef.current = 'search'
    setModalPane('log')
  }

  async function handleCreateCustomFood() {
    setCustomFormError('')
    const { errors, input } = validateCustomFood(customFood)
    setCustomErrors(errors)
    if (!input) return

    setCreating(true)
    try {
      const food = await createCustomFood(input)
      // The endpoint answers in the search shape precisely so this needs no
      // second search — keep it in the result list too, so re-picking it works
      // before the background re-search lands.
      setFoodResults((prev) => (prev.some((f) => f.id === food.id) ? prev : [food, ...prev]))
      selectFood(food)
      setCustomFood(EMPTY_CUSTOM_FOOD)
      setCustomErrors({})
      returnFocusRef.current = 'quantity'
      setModalPane('log')
      toast.success(`${food.name} saved to your foods`)
    } catch (err) {
      if (err instanceof CustomFoodLimitError) {
        // Stated as a fact, not as advice: nothing in the API deletes a custom
        // food yet, so "remove one" would be an instruction nobody can follow.
        setCustomFormError(
          `You've reached the limit of ${err.ceiling} custom foods, and this one was not saved. ` +
            'Custom foods cannot be removed yet, so search the catalogue for the closest match.',
        )
      } else {
        setCustomFormError('The food was not saved. Check your connection and try again.')
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleWater(ml: 250 | 500) {
    const setBusy = ml === 250 ? setWater250Busy : setWater500Busy
    setBusy(true)
    try {
      await logWater(ml, ds, pendingGoal ?? undefined)
    } catch {
      toast.error(`Water not logged. Check your connection and try again.`)
      setBusy(false)
      return
    }
    // The edited goal is now recorded server-side; stop carrying it.
    if (pendingGoal != null) setPendingGoal(null)
    try {
      setSummary(await getDailySummary(ds))
    } catch {
      // The log itself succeeded; totals catch up on the next load.
    }
    setBusy(false)
  }

  function saveGoal() {
    const parsed = Math.round(Number(goalInput))
    if (!Number.isFinite(parsed) || parsed < 250 || parsed > 10000) {
      setGoalError('Enter a goal between 250 and 10,000 ml.')
      return
    }
    setGoalError('')
    setGoalEditing(false)
    setPendingGoal(parsed)
    // The server keeps the highest goal recorded on a given day, so a lower
    // goal cannot take effect until tomorrow — say so instead of pretending.
    const current = summary?.water_goal_ml ?? 2000
    toast.info(
      parsed < current
        ? `Goal set to ${parsed} ml — today keeps the higher goal already recorded; the new one applies from tomorrow.`
        : `Goal set to ${parsed} ml — it is recorded with your next water log.`,
    )
  }

  const kcal = summary?.totals.kcal ?? 0
  const calPct = Math.min(1, kcal / DEFAULT_KCAL_TARGET)
  const strokeOffset = ringReady ? circumference * (1 - calPct) : circumference
  const goalMl = summary?.water_goal_ml ?? 2000
  const waterMl = summary?.water_ml_total ?? 0

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-xl">
        <PageHeader
          title="Nutrition"
          subtitle="Daily calories, macros and hydration."
          action={
            <div className="flex items-center gap-sm">
              <Button
                variant="ghost"
                aria-label="Previous day"
                onClick={() => setDate(addDays(date, -1))}
              >
                <ChevronIcon direction="left" />
              </Button>
              <span className="font-mono text-sm text-text-muted">
                {isToday ? 'Today' : ds}
              </span>
              <Button
                variant="ghost"
                aria-label="Next day"
                onClick={() => setDate(addDays(date, 1))}
                disabled={isToday}
              >
                <ChevronIcon direction="right" />
              </Button>
            </div>
          }
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-xl"><Spinner size="lg" /></div>
      ) : loadError ? (
        <ErrorState
          title="Couldn't load the day"
          body="The nutrition summary could not be fetched. Your logs are safe — try again."
          onRetry={load}
        />
      ) : (
        <>
          <div className="mb-xl grid grid-cols-1 gap-md md:grid-cols-2">
            <Card className="flex flex-col items-center gap-md">
              <svg width={140} height={140} viewBox="0 0 120 120">
                <circle cx={60} cy={60} r={50} fill="none" stroke="var(--color-border)" strokeWidth={10} />
                <circle
                  cx={60} cy={60} r={50} fill="none"
                  stroke="var(--color-primary)" strokeWidth={10}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dashoffset 700ms ease-out' }}
                />
                <text x={60} y={55} textAnchor="middle" className="fill-text-main font-mono" fontSize={18} fontWeight="bold">
                  {Math.round(kcal)}
                </text>
                <text x={60} y={72} textAnchor="middle" className="fill-text-muted font-mono" fontSize={11}>
                  / {DEFAULT_KCAL_TARGET.toLocaleString()} kcal
                </text>
              </svg>
              <p className="text-xs text-text-muted">
                Default target — <span className="font-mono">2,000</span> kcal
              </p>
              <div className="w-full flex flex-col gap-sm">
                <Progress value={summary?.totals.protein_g ?? 0} max={150} label="Protein (g)" tone="primary" />
                <Progress value={summary?.totals.carbs_g ?? 0} max={250} label="Carbs (g)" tone="secondary" />
                <Progress value={summary?.totals.fat_g ?? 0} max={65} label="Fat (g)" tone="tertiary" />
              </div>
            </Card>

            <Card className="flex flex-col gap-md">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">
                  Hydration
                </p>
                {!goalEditing ? (
                  <button
                    onClick={() => {
                      setGoalInput(String(pendingGoal ?? goalMl))
                      setGoalError('')
                      setGoalEditing(true)
                    }}
                    className="rounded-sm text-xs text-text-muted underline decoration-border underline-offset-2 hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Edit goal
                  </button>
                ) : null}
              </div>
              <p className="font-mono text-2xl font-semibold tracking-tight text-secondary">
                {waterMl}
                <span className="text-base font-normal text-text-muted"> / {goalMl} ml</span>
              </p>
              <Progress value={waterMl} max={goalMl} srLabel="Water intake (ml)" tone="secondary" />
              {goalEditing ? (
                <form
                  className="flex items-start gap-sm"
                  onSubmit={(e) => {
                    e.preventDefault()
                    saveGoal()
                  }}
                >
                  <div className="w-32">
                    <Input
                      label="Daily goal (ml)"
                      type="number"
                      inputMode="numeric"
                      min={250}
                      max={10000}
                      step={50}
                      className="font-mono"
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      error={goalError || undefined}
                    />
                  </div>
                  <div className="flex gap-sm pt-[22px]">
                    <Button type="submit" variant="secondary">Save</Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setGoalEditing(false)
                        setGoalError('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : pendingGoal != null && pendingGoal !== goalMl ? (
                <p className="text-xs text-text-muted">
                  New goal <span className="font-mono">{pendingGoal} ml</span> is recorded with
                  your next water log.
                </p>
              ) : null}
              <div className="flex gap-sm">
                <Button
                  variant="secondary"
                  className="font-mono"
                  loading={water250Busy}
                  onClick={() => handleWater(250)}
                >
                  +250 ml
                </Button>
                <Button
                  variant="secondary"
                  className="font-mono"
                  loading={water500Busy}
                  onClick={() => handleWater(500)}
                >
                  +500 ml
                </Button>
              </div>
            </Card>
          </div>

          <div className="mb-md flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold text-text-main">Meals</h2>
            <Button onClick={() => openLog('BREAKFAST')}>Log meal</Button>
          </div>

          {!summary || summary.meals.length === 0 ? (
            <Card>
              <EmptyState
                icon={
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="h-8 w-8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path d="M4 13a8 8 0 0016 0v-1H4v1zM2 12h20M9 21h6" strokeLinecap="square" />
                  </svg>
                }
                title="No meals logged"
                body="Log your first meal to start tracking nutrition."
                action={<Button onClick={() => openLog('BREAKFAST')}>Log meal</Button>}
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-md">
              {MEAL_TYPES.map((mt) => {
                const meals = summary.meals.filter((m) => m.meal_type === mt)
                const total = meals.reduce((s, m) => s + m.total_kcal, 0)
                return (
                  <Card key={mt}>
                    <div className="mb-sm flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
                        {MEAL_LABELS[mt]}
                      </p>
                      <div className="flex items-center gap-sm">
                        <p className="font-mono text-sm text-text-muted">
                          {Math.round(total)} kcal
                        </p>
                        <button
                          onClick={() => openLog(mt)}
                          aria-label={`Log ${MEAL_LABELS[mt].toLowerCase()}`}
                          className="rounded-sm border border-border p-xs text-text-muted hover:border-text-muted hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <PlusIcon />
                        </button>
                      </div>
                    </div>
                    {meals.length === 0 ? (
                      <p className="text-sm text-text-muted">Nothing logged.</p>
                    ) : (
                      meals.flatMap((m) => m.items).map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-xs text-sm">
                          <span className="text-text-main">{item.food_name_at_log}</span>
                          <span className="font-mono text-xs text-text-muted">
                            {item.grams}g · {Math.round(item.kcal)} kcal
                          </span>
                        </div>
                      ))
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      <Modal
        open={logOpen}
        // In the create pane, Escape and the backdrop step back to the meal
        // form rather than throwing away a half-filled food.
        onClose={() => (modalPane === 'create' ? closeCustomFood() : setLogOpen(false))}
        title={modalPane === 'create' ? 'Add custom food' : 'Log meal'}
        busy={saving || creating}
      >
        {modalPane === 'log' ? (
          <div className="flex flex-col gap-md" ref={logPaneRef}>
            <Select
              label="Meal type"
              value={mealType}
              onChange={(e) => setMealType(e.target.value as MealType)}
            >
              {MEAL_TYPES.map((t) => (
                <option key={t} value={t}>{MEAL_LABELS[t]}</option>
              ))}
            </Select>

            <Combobox
              label="Food"
              query={foodQuery}
              onQueryChange={setFoodQuery}
              options={foodOptions}
              onSelect={handleFoodSelect}
              placeholder="Search the catalogue — dal, dosa, paneer…"
              loading={searchLoading}
              error={searchError || undefined}
              emptyText="No foods match — add it as a custom food below"
            />

            {noMatches ? (
              <div className="rounded-sm border border-border">
                <EmptyState
                  title={`No food matches “${foodQuery.trim()}”`}
                  body="Add it once with its per-100 g values and it stays in your searches."
                  action={
                    <Button variant="secondary" onClick={openCustomFood}>
                      Add it as a custom food
                    </Button>
                  }
                />
              </div>
            ) : null}

            {selectedFood ? (
              <div className="grid grid-cols-2 gap-md">
                <Select
                  label="Unit"
                  value={servingUnit}
                  onChange={(e) => handleUnitChange(e.target.value)}
                >
                  {unitOptions.map((u) => (
                    <option key={u} value={u}>{UNIT_PLURAL[u] ?? u.toLowerCase()}</option>
                  ))}
                </Select>
                <Input
                  ref={quantityRef}
                  label="Quantity"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  className="font-mono"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  hint={
                    servingUnit !== 'GRAM' && selectedFood.default_serving_grams
                      ? `1 ${UNIT_SINGULAR[servingUnit] ?? 'serving'} ≈ ${selectedFood.default_serving_grams} g`
                      : undefined
                  }
                />
              </div>
            ) : null}

            {selectedFood && Number.isFinite(gramsForQty) && gramsForQty > 0 ? (
              <p className="text-sm text-text-muted">
                Adds <span className="font-mono">{Math.round(gramsForQty)}</span> g ·{' '}
                <span className="font-mono">{Math.round(kcalPreview)}</span> kcal
              </p>
            ) : null}

            {formError ? <Alert tone="error">{formError}</Alert> : null}

            <div className="flex justify-end gap-sm">
              <Button variant="secondary" disabled={saving} onClick={() => setLogOpen(false)}>
                Cancel
              </Button>
              <Button loading={saving} onClick={handleLogMeal}>Log</Button>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-col gap-md"
            // The min/max attributes stay for the spinners and mobile keypads,
            // but native constraint validation is off: it would block submit
            // with an unstyled browser tooltip before our own field errors —
            // which carry the same ranges, in this app's voice — could render.
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void handleCreateCustomFood()
            }}
          >
            <p className="text-sm text-text-muted">
              Only you can see this food, and it appears in your searches from now on. Enter
              the values printed for <span className="font-mono">100 g</span>.
            </p>

            <Input
              ref={customNameRef}
              label="Name"
              name="cf-name"
              maxLength={120}
              value={customFood.name}
              onChange={(e) => setCustomField('name', e.target.value)}
              error={customErrors.name}
            />

            <Input
              label="Brand"
              name="cf-brand"
              maxLength={80}
              value={customFood.brand}
              onChange={(e) => setCustomField('brand', e.target.value)}
              error={customErrors.brand}
              hint="Optional."
            />

            <Input
              label="Calories (kcal / 100 g)"
              name="cf-kcal"
              type="number"
              inputMode="decimal"
              min={0}
              max={9000}
              step="any"
              className="font-mono"
              value={customFood.kcal}
              onChange={(e) => setCustomField('kcal', e.target.value)}
              error={customErrors.kcal}
            />

            <div className="grid grid-cols-3 gap-sm">
              <Input
                label="Protein (g)"
                name="cf-protein"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="any"
                className="font-mono"
                value={customFood.protein}
                onChange={(e) => setCustomField('protein', e.target.value)}
                error={customErrors.protein}
              />
              <Input
                label="Carbs (g)"
                name="cf-carbs"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="any"
                className="font-mono"
                value={customFood.carbs}
                onChange={(e) => setCustomField('carbs', e.target.value)}
                error={customErrors.carbs}
              />
              <Input
                label="Fat (g)"
                name="cf-fat"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="any"
                className="font-mono"
                value={customFood.fat}
                onChange={(e) => setCustomField('fat', e.target.value)}
                error={customErrors.fat}
              />
            </div>

            <div className="grid grid-cols-2 gap-md">
              <Select
                label="Serving unit"
                name="cf-unit"
                value={customFood.unit}
                onChange={(e) => setCustomField('unit', e.target.value as ServingUnit)}
              >
                {SERVING_UNITS.map((u) => (
                  <option key={u} value={u}>{UNIT_PLURAL[u] ?? u.toLowerCase()}</option>
                ))}
              </Select>
              <Input
                label="Serving weight (g)"
                name="cf-grams"
                type="number"
                inputMode="decimal"
                min={0.1}
                max={5000}
                step="any"
                className="font-mono"
                value={customFood.grams}
                onChange={(e) => setCustomField('grams', e.target.value)}
                error={customErrors.grams}
                hint={
                  customFood.unit === 'GRAM'
                    ? 'Optional — your usual portion.'
                    : `Weight of one ${UNIT_SINGULAR[customFood.unit] ?? 'serving'}.`
                }
              />
            </div>

            <Input
              label="Barcode"
              name="cf-barcode"
              inputMode="numeric"
              className="font-mono"
              value={customFood.barcode}
              onChange={(e) => setCustomField('barcode', e.target.value)}
              error={customErrors.barcode}
              hint="Optional — 8 to 14 digits."
            />

            {customFormError ? (
              <Alert tone="error">{customFormError}</Alert>
            ) : hasCustomFieldErrors ? (
              <Alert tone="error">Check the highlighted fields.</Alert>
            ) : null}

            <div className="flex justify-end gap-sm">
              <Button type="button" variant="secondary" disabled={creating} onClick={closeCustomFood}>
                Back
              </Button>
              <Button type="submit" loading={creating}>Save food</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
