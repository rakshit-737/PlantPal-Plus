import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import {
  getDailySummary,
  logMeal,
  logWater,
  searchFoods,
  type DailySummary,
  type Food,
} from '../api/endpoints'
import { MealType } from '@plantpal/shared'

import { Button, Card, EmptyState, ErrorText, Input, PageHeader, Spinner } from '../components/ui'
import { usePalette, space } from '../theme'

// NFR-MAIN-03: the meal vocabulary lives once, in @plantpal/shared.
const MEAL_TYPES = Object.keys(MealType)

function localDateStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function NutritionScreen() {
  const p = usePalette()
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [mealType, setMealType] = useState('BREAKFAST')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [selected, setSelected] = useState<Food | null>(null)
  const [grams, setGrams] = useState('100')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [waterBusy, setWaterBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setSummary(await getDailySummary(localDateStr()))
    } catch {
      setSummary(null)
    }
  }, [])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    if (!query || selected) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      searchFoods(query)
        .then(setResults)
        .catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [query, selected])

  async function handleLogMeal() {
    setError('')
    if (!selected) {
      setError('Search and select a food first.')
      return
    }
    const qty = parseFloat(grams)
    if (!qty || qty <= 0) {
      setError('Enter a valid amount in grams.')
      return
    }
    const factor = qty / 100
    setSaving(true)
    try {
      await logMeal({
        meal_type: mealType,
        local_date_str: localDateStr(),
        items: [
          {
            food_id: selected.id,
            food_name_at_log: selected.name,
            quantity: qty,
            serving_unit: 'GRAM',
            grams: qty,
            kcal: selected.kcal_per_100g * factor,
            protein_g: selected.protein_per_100g * factor,
            carbs_g: selected.carbs_per_100g * factor,
            fat_g: selected.fat_per_100g * factor,
          },
        ],
      })
      setFormOpen(false)
      setSelected(null)
      setQuery('')
      setGrams('100')
      await load()
    } catch {
      setError('Failed to log meal. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleWater(ml: number) {
    setWaterBusy(true)
    try {
      await logWater(ml, localDateStr())
      await load()
    } catch {
      // Silent; totals refresh next load.
    } finally {
      setWaterBusy(false)
    }
  }

  if (loading) return <Spinner />

  const kcal = Math.round(summary?.totals.kcal ?? 0)

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <PageHeader title="Nutrition" subtitle="Calories, macros and hydration." />

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Card style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: p.textMuted, fontSize: 12 }}>🍽️ Calories</Text>
          <Text style={{ color: p.textMain, fontSize: 22, fontWeight: '700' }}>{kcal}</Text>
          <Text style={{ color: p.textMuted, fontSize: 11 }}>
            P {Math.round(summary?.totals.protein_g ?? 0)}g · C{' '}
            {Math.round(summary?.totals.carbs_g ?? 0)}g · F {Math.round(summary?.totals.fat_g ?? 0)}g
          </Text>
        </Card>
        <Card style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: p.textMuted, fontSize: 12 }}>💧 Water</Text>
          <Text style={{ color: p.textMain, fontSize: 22, fontWeight: '700' }}>
            {summary?.water_ml_total ?? 0} ml
          </Text>
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            <Button title="+250" variant="secondary" loading={waterBusy} onPress={() => void handleWater(250)} />
            <Button title="+500" variant="secondary" loading={waterBusy} onPress={() => void handleWater(500)} />
          </View>
        </Card>
      </View>

      {formOpen ? (
        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {MEAL_TYPES.map((t) => (
              <View key={t} style={{ opacity: mealType === t ? 1 : 0.55 }}>
                <Button
                  title={t}
                  variant={mealType === t ? 'primary' : 'secondary'}
                  onPress={() => setMealType(t)}
                />
              </View>
            ))}
          </View>
          <Input
            label="Food"
            value={query}
            onChangeText={(t) => {
              setQuery(t)
              setSelected(null)
            }}
            placeholder="Search foods…"
            autoCapitalize="sentences"
          />
          {results.length > 0 && !selected
            ? results.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    setSelected(f)
                    setQuery(f.name)
                    setResults([])
                  }}
                  style={{ paddingVertical: space.xs }}
                >
                  <Text style={{ color: p.textMain, fontSize: 14 }}>
                    {f.name}
                    {f.brand ? ` (${f.brand})` : ''} — {f.kcal_per_100g} kcal/100g
                  </Text>
                </Pressable>
              ))
            : null}
          {selected ? (
            <Input label="Amount (grams)" value={grams} onChangeText={setGrams} keyboardType="number-pad" />
          ) : null}
          <ErrorText message={error} />
          <Button title="Log meal" onPress={handleLogMeal} loading={saving} />
          <Button title="Cancel" variant="ghost" onPress={() => setFormOpen(false)} />
        </Card>
      ) : (
        <Button title="+ Log meal" onPress={() => setFormOpen(true)} />
      )}

      <Card>
        <Text style={{ color: p.textMain, fontSize: 16, fontWeight: '600', marginBottom: space.sm }}>
          Meals
        </Text>
        {!summary || summary.meals.length === 0 ? (
          <EmptyState icon="🍽️" title="No meals logged" body="Log your first meal to start tracking." />
        ) : (
          MEAL_TYPES.map((mt) => {
            const meals = summary.meals.filter((m) => m.meal_type === mt)
            if (meals.length === 0) return null
            return (
              <View key={mt} style={{ marginBottom: space.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: p.textMain, fontSize: 14, fontWeight: '600' }}>{mt}</Text>
                  <Text style={{ color: p.textMuted, fontSize: 12 }}>
                    {Math.round(meals.reduce((s, m) => s + m.total_kcal, 0))} kcal
                  </Text>
                </View>
                {meals.flatMap((m) => m.items).map((item) => (
                  <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                    <Text style={{ color: p.textMain, fontSize: 13 }}>{item.food_name_at_log}</Text>
                    <Text style={{ color: p.textMuted, fontSize: 12 }}>
                      {item.grams}g · {Math.round(item.kcal)} kcal
                    </Text>
                  </View>
                ))}
              </View>
            )
          })
        )}
      </Card>
    </ScrollView>
  )
}
