import { useEffect, useState } from 'react'
import { Card, Spinner, EmptyState, Modal, PageHeader, Button, Input, Progress, Alert } from '../components/ui'
import {
  getDailySummary, logMeal, logWater, searchFoods,
  type DailySummary, type Food,
} from '../lib/nutritionApi'

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']

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

export function NutritionPage() {
  const [date, setDate] = useState(new Date())
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [logOpen, setLogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [waterSaving, setWaterSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [mealType, setMealType] = useState('BREAKFAST')
  const [foodQuery, setFoodQuery] = useState('')
  const [foodResults, setFoodResults] = useState<Food[]>([])
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState('100')

  const ds = dateStr(date)
  const isToday = ds === dateStr(new Date())

  useEffect(() => {
    setLoading(true)
    getDailySummary(ds)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }, [ds])

  // Empty query = browse the catalogue alphabetically; typing narrows it.
  // The list loads as soon as the modal opens so scrolling works without a query.
  useEffect(() => {
    if (!logOpen) { setFoodResults([]); return }
    const t = setTimeout(() => {
      searchFoods(foodQuery).then(setFoodResults).catch(() => setFoodResults([]))
    }, foodQuery ? 250 : 0)
    return () => clearTimeout(t)
  }, [foodQuery, logOpen])

  async function handleLogMeal() {
    setFormError('')
    if (!selectedFood) { setFormError('Select a food item.'); return }
    const qty = parseFloat(quantity)
    if (!qty || qty <= 0) { setFormError('Enter a valid quantity.'); return }
    setSaving(true)
    try {
      const grams = qty
      const factor = grams / 100
      await logMeal({
        meal_type: mealType,
        local_date_str: ds,
        items: [{
          food_id: selectedFood.id,
          food_name_at_log: selectedFood.name,
          quantity: qty,
          serving_unit: 'GRAM',
          grams,
          kcal: selectedFood.kcal_per_100g * factor,
          protein_g: selectedFood.protein_per_100g * factor,
          carbs_g: selectedFood.carbs_per_100g * factor,
          fat_g: selectedFood.fat_per_100g * factor,
        }],
      })
      const updated = await getDailySummary(ds)
      setSummary(updated)
      setLogOpen(false)
      setSelectedFood(null)
      setFoodQuery('')
      setQuantity('100')
    } catch {
      setFormError('Failed to log meal. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleWater(ml: number) {
    setWaterSaving(true)
    try {
      await logWater(ml, ds)
      const updated = await getDailySummary(ds)
      setSummary(updated)
    } catch {
      // silent
    } finally {
      setWaterSaving(false)
    }
  }

  const kcal = summary?.totals.kcal ?? 0
  const target = 2000
  const calPct = Math.min(1, kcal / target)
  const strokeOffset = circumference * (1 - calPct)

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-xl flex items-center justify-between">
        <PageHeader title="Nutrition" subtitle="Daily calories, macros and hydration." />
        <div className="flex items-center gap-sm">
          <Button variant="ghost" onClick={() => setDate(addDays(date, -1))}>‹</Button>
          <span className="text-sm text-text-muted">{isToday ? 'Today' : ds}</span>
          <Button variant="ghost" onClick={() => setDate(addDays(date, 1))} disabled={isToday}>›</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-xl"><Spinner size="lg" /></div>
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
                />
                <text x={60} y={55} textAnchor="middle" className="fill-text-main" fontSize={18} fontWeight="bold">
                  {Math.round(kcal)}
                </text>
                <text x={60} y={72} textAnchor="middle" className="fill-text-muted" fontSize={11}>
                  / {target} kcal
                </text>
              </svg>
              <div className="w-full flex flex-col gap-sm">
                <Progress value={summary?.totals.protein_g ?? 0} max={150} label="Protein (g)" tone="primary" />
                <Progress value={summary?.totals.carbs_g ?? 0} max={250} label="Carbs (g)" tone="secondary" />
                <Progress value={summary?.totals.fat_g ?? 0} max={65} label="Fat (g)" tone="tertiary" />
              </div>
            </Card>

            <Card className="flex flex-col gap-md">
              <p className="text-sm font-medium text-text-muted">Hydration</p>
              <p className="font-mono text-2xl font-semibold tracking-tight text-secondary">
                {summary?.water_ml_total ?? 0} ml
              </p>
              <Progress value={summary?.water_ml_total ?? 0} max={summary?.water_goal_ml ?? 2000} tone="secondary" />
              <div className="flex gap-sm">
                <Button variant="secondary" loading={waterSaving} onClick={() => handleWater(250)}>+250 ml</Button>
                <Button variant="secondary" loading={waterSaving} onClick={() => handleWater(500)}>+500 ml</Button>
              </div>
            </Card>
          </div>

          <div className="mb-md flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold text-text-main">Meals</h2>
            <Button onClick={() => setLogOpen(true)}>+ Log Meal</Button>
          </div>

          {!summary || summary.meals.length === 0 ? (
            <Card>
              <EmptyState
                icon={<span className="text-4xl">🍽️</span>}
                title="No meals logged"
                body="Log your first meal to start tracking nutrition."
                action={<Button onClick={() => setLogOpen(true)}>Log Meal</Button>}
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-md">
              {MEAL_TYPES.map((mt) => {
                const meals = summary.meals.filter((m) => m.meal_type === mt)
                if (meals.length === 0) return null
                const total = meals.reduce((s, m) => s + m.total_kcal, 0)
                return (
                  <Card key={mt}>
                    <div className="mb-sm flex items-center justify-between">
                      <p className="font-medium text-text-main">{mt}</p>
                      <p className="text-sm text-text-muted">{Math.round(total)} kcal</p>
                    </div>
                    {meals.flatMap((m) => m.items).map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-xs text-sm">
                        <span className="text-text-main">{item.food_name_at_log}</span>
                        <span className="font-mono text-xs text-text-muted">{item.grams}g · {Math.round(item.kcal)} kcal</span>
                      </div>
                    ))}
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log Meal">
        <div className="flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <label className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">Meal type</label>
            <select className="rounded-sm border border-border bg-surface px-md py-sm text-sm text-text-main" value={mealType} onChange={(e) => setMealType(e.target.value)}>
              {MEAL_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-xs">
            <label className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">Food</label>
            <input
              className="rounded-sm border border-border bg-surface px-md py-sm text-base text-text-main placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="Search or scroll — dal, dosa, paneer…"
              value={foodQuery}
              onChange={(e) => { setFoodQuery(e.target.value); setSelectedFood(null) }}
            />
            {foodResults.length > 0 && !selectedFood && (
              <div className="max-h-60 overflow-y-auto rounded-sm border border-border bg-surface">
                {foodResults.map((f) => (
                  <button
                    key={f.id}
                    className="flex w-full items-center justify-between gap-sm border-b border-border px-md py-sm text-left text-sm last:border-b-0 hover:bg-background"
                    onClick={() => {
                      setSelectedFood(f)
                      setFoodQuery(f.name)
                      setQuantity(String(f.default_serving_grams ?? 100))
                    }}
                  >
                    <span className="min-w-0 truncate text-text-main">
                      {f.name}
                      {f.brand ? <span className="text-text-muted"> · {f.brand}</span> : null}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-text-muted">
                      {Math.round(f.kcal_per_100g)} kcal/100g
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedFood && (
            <Input
              label="Quantity (grams)"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              hint={
                selectedFood.default_serving_grams
                  ? `1 ${selectedFood.default_serving_unit.toLowerCase()} ≈ ${selectedFood.default_serving_grams} g`
                  : undefined
              }
            />
          )}
          {formError && <Alert tone="error">{formError}</Alert>}
          <div className="flex justify-end gap-sm">
            <Button variant="secondary" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleLogMeal}>Log</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
