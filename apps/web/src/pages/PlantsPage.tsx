import { useEffect, useState } from 'react'
import {
  Button, Card, Badge, Spinner, EmptyState, Modal, PageHeader, Input,
} from '../components/ui'
import {
  listPlants, createPlant, logCare, searchSpecies,
  type Plant, type Species,
} from '../lib/plantsApi'

const today = () => new Date().toISOString().slice(0, 10)

function wateringLabel(due: string | null): { text: string; tone: 'danger' | 'warning' | 'success' | 'default' } {
  if (!due) return { text: 'No schedule', tone: 'default' }
  const diff = Math.round((new Date(due).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { text: `Overdue ${Math.abs(diff)}d`, tone: 'danger' }
  if (diff === 0) return { text: 'Due today', tone: 'warning' }
  return { text: `Due in ${diff}d`, tone: 'success' }
}

const statusTone: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  THRIVING: 'success',
  NEEDS_ATTENTION: 'warning',
  CRITICAL: 'danger',
  DORMANT: 'default',
}

const LIGHT_OPTIONS = ['LOW', 'MEDIUM', 'BRIGHT_INDIRECT', 'DIRECT_SUN']
const PLACEMENT_OPTIONS = ['INDOOR', 'OUTDOOR']
const POT_OPTIONS = ['FABRIC', 'TERRACOTTA', 'CONCRETE', 'CERAMIC_GLAZED', 'METAL', 'PLASTIC', 'OTHER']
const SOIL_OPTIONS = ['ORCHID_BARK', 'CACTUS_SUCCULENT', 'GARDEN_SOIL', 'STANDARD_POTTING', 'PEAT_BASED', 'COCO_COIR', 'SEMI_HYDRO_LECA', 'OTHER']

export function PlantsPage() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [watering, setWatering] = useState<string | null>(null)

  const [nickname, setNickname] = useState('')
  const [speciesQuery, setSpeciesQuery] = useState('')
  const [speciesList, setSpeciesList] = useState<Species[]>([])
  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(null)
  const [lightExposure, setLightExposure] = useState('BRIGHT_INDIRECT')
  const [placement, setPlacement] = useState('INDOOR')
  const [potMaterial, setPotMaterial] = useState('')
  const [soilType, setSoilType] = useState('')
  const [baseInterval, setBaseInterval] = useState('7')
  const [minInterval, setMinInterval] = useState('3')
  const [maxInterval, setMaxInterval] = useState('14')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    listPlants()
      .then(setPlants)
      .catch(() => setPlants([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!speciesQuery) { setSpeciesList([]); return }
    const t = setTimeout(() => {
      searchSpecies(speciesQuery).then(setSpeciesList).catch(() => setSpeciesList([]))
    }, 300)
    return () => clearTimeout(t)
  }, [speciesQuery])

  async function handleWater(plantId: string) {
    setWatering(plantId)
    try {
      await logCare(plantId, { action_type: 'WATER', local_date_str: today() })
      const updated = await listPlants()
      setPlants(updated)
    } catch {
      // silent
    } finally {
      setWatering(null)
    }
  }

  async function handleAdd() {
    setFormError('')
    if (!nickname.trim()) { setFormError('Nickname is required.'); return }
    const base = parseInt(baseInterval, 10)
    const min = parseInt(minInterval, 10)
    const max = parseInt(maxInterval, 10)
    if (!base || base < 1 || base > 365) { setFormError('Base interval must be 1–365.'); return }
    if (min > max) { setFormError('Min interval must be ≤ max.'); return }
    setSaving(true)
    try {
      await createPlant({
        nickname: nickname.trim(),
        species_id: selectedSpecies?.id ?? null,
        light_exposure: lightExposure,
        placement,
        pot_material: potMaterial || null,
        soil_type: soilType || null,
        base_interval_days: base,
        min_interval_days: min,
        max_interval_days: max,
      })
      const updated = await listPlants()
      setPlants(updated)
      setAddOpen(false)
      setNickname('')
      setSpeciesQuery('')
      setSelectedSpecies(null)
    } catch {
      setFormError('Failed to add plant. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-xl">
        <PageHeader
          title="My Plants"
          subtitle="Watering reminders and care history."
          action={<Button onClick={() => setAddOpen(true)}>+ Add Plant</Button>}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-xl"><Spinner size="lg" /></div>
      ) : plants.length === 0 ? (
        <Card>
          <EmptyState
            icon={<span className="text-4xl">🌱</span>}
            title="No plants yet"
            body="Add your first plant to start tracking watering reminders."
            action={<Button onClick={() => setAddOpen(true)}>Add Plant</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
          {plants.map((p) => {
            const wl = wateringLabel(p.next_water_due_at)
            return (
              <Card key={p.id} className="flex flex-col gap-sm">
                <div className="flex items-start justify-between gap-sm">
                  <div>
                    <p className="font-semibold text-text-main">{p.nickname}</p>
                    <p className="text-xs text-text-muted">{p.room ?? 'No room set'}</p>
                  </div>
                  <Badge tone={statusTone[p.status] ?? 'default'}>{p.status.replace('_', ' ')}</Badge>
                </div>
                <Badge tone={wl.tone}>{wl.text}</Badge>
                <Button
                  variant="secondary"
                  loading={watering === p.id}
                  onClick={() => handleWater(p.id)}
                  className="mt-auto"
                >
                  💧 Water
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Plant">
        <div className="flex flex-col gap-md">
          <Input
            label="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. Monstera"
          />
          <div className="flex flex-col gap-xs">
            <label className="text-sm font-medium text-text-main">Species (optional)</label>
            <input
              className="rounded-md border border-border bg-surface px-md py-sm text-base text-text-main placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="Search species…"
              value={speciesQuery}
              onChange={(e) => { setSpeciesQuery(e.target.value); setSelectedSpecies(null) }}
            />
            {speciesList.length > 0 && !selectedSpecies && (
              <div className="rounded-md border border-border bg-surface shadow-sm">
                {speciesList.map((s) => (
                  <button
                    key={s.id}
                    className="w-full px-md py-sm text-left text-sm text-text-main hover:bg-background"
                    onClick={() => { setSelectedSpecies(s); setSpeciesQuery(s.common_name); setSpeciesList([]) }}
                  >
                    {s.common_name} <span className="text-text-muted">({s.scientific_name})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <div className="flex flex-col gap-xs">
              <label className="text-sm font-medium text-text-main">Light</label>
              <select className="rounded-md border border-border bg-surface px-md py-sm text-sm text-text-main" value={lightExposure} onChange={(e) => setLightExposure(e.target.value)}>
                {LIGHT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-xs">
              <label className="text-sm font-medium text-text-main">Placement</label>
              <select className="rounded-md border border-border bg-surface px-md py-sm text-sm text-text-main" value={placement} onChange={(e) => setPlacement(e.target.value)}>
                {PLACEMENT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-xs">
              <label className="text-sm font-medium text-text-main">Pot material</label>
              <select className="rounded-md border border-border bg-surface px-md py-sm text-sm text-text-main" value={potMaterial} onChange={(e) => setPotMaterial(e.target.value)}>
                <option value="">— optional —</option>
                {POT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-xs">
              <label className="text-sm font-medium text-text-main">Soil type</label>
              <select className="rounded-md border border-border bg-surface px-md py-sm text-sm text-text-main" value={soilType} onChange={(e) => setSoilType(e.target.value)}>
                <option value="">— optional —</option>
                {SOIL_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-sm">
            <Input label="Base days" type="number" min={1} max={365} value={baseInterval} onChange={(e) => setBaseInterval(e.target.value)} />
            <Input label="Min days" type="number" min={1} max={365} value={minInterval} onChange={(e) => setMinInterval(e.target.value)} />
            <Input label="Max days" type="number" min={1} max={365} value={maxInterval} onChange={(e) => setMaxInterval(e.target.value)} />
          </div>
          {formError && <p className="text-sm text-accent">{formError}</p>}
          <div className="flex justify-end gap-sm">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleAdd}>Add Plant</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
