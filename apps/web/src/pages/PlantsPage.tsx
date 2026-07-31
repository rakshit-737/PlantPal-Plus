import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Alert, Badge, Button, Card, Combobox, EmptyState, ErrorState, Input, Modal,
  PageHeader, Select, Spinner, useToast,
  type ComboOption,
} from '../components/ui'
import { usePageTitle } from '../hooks/usePageTitle'
import {
  listPlants, createPlant, logCare, searchSpecies,
  type Plant, type Species,
} from '../lib/plantsApi'

const today = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

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

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'THRIVING', label: 'Thriving' },
  { value: 'NEEDS_ATTENTION', label: 'Needs attention' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'DORMANT', label: 'Dormant' },
]

/** BRIGHT_INDIRECT -> "Bright indirect" for option labels. */
const humanize = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ')

/** Whole day count 1-365, or NaN. Number('') is 0, so empty fails the range. */
const parseDays = (value: string) => {
  const n = Number(value.trim())
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : NaN
}

const sproutIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="square"
    className="h-8 w-8"
    aria-hidden
  >
    <path d="M12 22v-7M12 15c0-4 3.5-7 8-7 0 4.5-3.5 7-8 7zM12 15c0-4-3.5-7-8-7 0 4.5 3.5 7 8 7z" />
  </svg>
)

const dropIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="square"
    className="h-4 w-4 shrink-0"
    aria-hidden
  >
    <path d="M12 3c3.5 4.6 6 7.9 6 11a6 6 0 11-12 0c0-3.1 2.5-6.4 6-11z" />
  </svg>
)

export function PlantsPage() {
  usePageTitle('Plants')
  const toast = useToast()

  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  // Each card's Water button gets its own busy flag so parallel taps don't
  // share a spinner.
  const [wateringIds, setWateringIds] = useState<Set<string>>(new Set())

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // The catalogue is small: fetched once, it backs both the species search
  // match on the grid and the combobox in the add modal.
  const [speciesList, setSpeciesList] = useState<Species[]>([])
  const [speciesLoading, setSpeciesLoading] = useState(false)
  const [speciesError, setSpeciesError] = useState(false)

  const [nickname, setNickname] = useState('')
  const [speciesQuery, setSpeciesQuery] = useState('')
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

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      setPlants(await listPlants())
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const loadSpecies = useCallback(async () => {
    setSpeciesLoading(true)
    try {
      setSpeciesList(await searchSpecies(''))
      setSpeciesError(false)
    } catch {
      setSpeciesError(true)
    } finally {
      setSpeciesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSpecies()
  }, [loadSpecies])

  // If the first catalogue fetch failed, retry once each time the modal opens.
  useEffect(() => {
    if (addOpen && speciesList.length === 0 && !speciesLoading) void loadSpecies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addOpen])

  const speciesById = useMemo(() => {
    const map = new Map<string, Species>()
    for (const s of speciesList) map.set(s.id, s)
    return map
  }, [speciesList])

  const query = search.trim().toLowerCase()
  const filtered = plants.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
    if (!query) return true
    const sp = p.species_id ? speciesById.get(p.species_id) : undefined
    return `${p.nickname} ${sp?.common_name ?? ''} ${sp?.scientific_name ?? ''}`
      .toLowerCase()
      .includes(query)
  })
  const isFiltered = query.length > 0 || statusFilter !== 'ALL'

  const speciesOptions: ComboOption[] = useMemo(() => {
    const q = speciesQuery.trim().toLowerCase()
    const matches = q
      ? speciesList.filter((s) =>
          `${s.common_name} ${s.scientific_name}`.toLowerCase().includes(q),
        )
      : speciesList
    return matches.map((s) => ({ id: s.id, label: s.common_name, sub: s.scientific_name }))
  }, [speciesList, speciesQuery])

  const speciesHint = selectedSpecies
    ? `Care defaults filled from ${selectedSpecies.common_name}.`
    : speciesQuery.trim()
      ? 'Custom species — no catalogue defaults'
      : speciesError
        ? "The catalogue didn't load. Type a name to add it as a custom species."
        : undefined

  const clearWatering = (id: string) =>
    setWateringIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  async function handleWater(plant: Plant) {
    setWateringIds((prev) => new Set(prev).add(plant.id))
    try {
      await logCare(plant.id, { action_type: 'WATER', local_date_str: today() })
    } catch {
      toast.error(`Couldn't log water for ${plant.nickname}. Check your connection and try again.`)
      clearWatering(plant.id)
      return
    }
    toast.success(`Watered ${plant.nickname}`)
    try {
      setPlants(await listPlants())
    } catch {
      toast.error(`Watered ${plant.nickname}, but the list didn't refresh. Reload the page to see it.`)
    } finally {
      clearWatering(plant.id)
    }
  }

  function resetForm() {
    setNickname('')
    setSpeciesQuery('')
    setSelectedSpecies(null)
    setLightExposure('BRIGHT_INDIRECT')
    setPlacement('INDOOR')
    setPotMaterial('')
    setSoilType('')
    setBaseInterval('7')
    setMinInterval('3')
    setMaxInterval('14')
    setFormError('')
  }

  async function handleAdd() {
    setFormError('')
    const name = nickname.trim()
    if (!name) {
      setFormError('Nickname is required.')
      return
    }
    const base = parseDays(baseInterval)
    const min = parseDays(minInterval)
    const max = parseDays(maxInterval)
    if (Number.isNaN(base) || Number.isNaN(min) || Number.isNaN(max)) {
      setFormError('Base, min and max days must each be whole numbers from 1 to 365.')
      return
    }
    if (min > max) {
      setFormError('Min days must be less than or equal to max days.')
      return
    }
    setSaving(true)
    try {
      await createPlant({
        nickname: name,
        species_id: selectedSpecies?.id ?? null,
        light_exposure: lightExposure,
        placement,
        pot_material: potMaterial || null,
        soil_type: soilType || null,
        base_interval_days: base,
        min_interval_days: min,
        max_interval_days: max,
      })
    } catch {
      setFormError("The plant wasn't saved. Check your connection and try again.")
      setSaving(false)
      return
    }
    setSaving(false)
    setAddOpen(false)
    resetForm()
    toast.success(`Added ${name}`)
    try {
      setPlants(await listPlants())
    } catch {
      toast.error(`Added ${name}, but the list didn't refresh. Reload the page to see it.`)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-xl">
        <PageHeader
          title="My Plants"
          subtitle="Watering reminders and care history."
          action={<Button onClick={() => setAddOpen(true)}>Add plant</Button>}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-xl"><Spinner size="lg" /></div>
      ) : loadError ? (
        <ErrorState
          title="Couldn't load your plants"
          body="The plant list didn't come back from the server. Your data is safe — try again."
          onRetry={() => void load()}
        />
      ) : plants.length === 0 ? (
        <Card>
          <EmptyState
            icon={sproutIcon}
            title="No plants yet"
            body="Add your first plant to start tracking watering reminders."
            action={<Button onClick={() => setAddOpen(true)}>Add plant</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="mb-lg flex flex-col gap-sm sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <Input
                label="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nickname or species"
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {STATUS_FILTERS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
          </div>

          {isFiltered ? (
            <p className="mb-md font-mono text-xs text-text-muted">
              {filtered.length} of {plants.length} plants
            </p>
          ) : null}

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                title="No plants match"
                body="Nothing matches the current search and status filter."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('')
                      setStatusFilter('ALL')
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => {
                const wl = wateringLabel(p.next_water_due_at)
                const busy = wateringIds.has(p.id)
                return (
                  <Card key={p.id} className="flex flex-col gap-sm">
                    <div className="flex items-start justify-between gap-sm">
                      <div>
                        <Link
                          to={`/plants/${p.id}`}
                          className="font-semibold text-text-main hover:text-primary hover:underline"
                        >
                          {p.nickname}
                        </Link>
                        <p className="text-xs text-text-muted">{p.room ?? 'No room set'}</p>
                      </div>
                      <Badge tone={statusTone[p.status] ?? 'default'}>{p.status.replace('_', ' ')}</Badge>
                    </div>
                    <Badge tone={wl.tone}>{wl.text}</Badge>
                    <p className="font-mono text-xs text-text-muted">
                      every ~{p.effective_interval_days ?? p.base_interval_days}d
                      {' · '}
                      {p.last_watered_at
                        ? `last ${new Date(p.last_watered_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
                        : 'never watered'}
                    </p>
                    <Button
                      variant="secondary"
                      loading={busy}
                      onClick={() => void handleWater(p)}
                      className="mt-auto"
                    >
                      {busy ? null : dropIcon}
                      Water
                    </Button>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add plant" busy={saving}>
        <div className="flex flex-col gap-md">
          <Input
            label="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="e.g. Monstera"
          />
          <Combobox
            label="Species (optional)"
            query={speciesQuery}
            onQueryChange={setSpeciesQuery}
            options={speciesOptions}
            loading={speciesLoading}
            placeholder="Search or scroll — Tulsi, Monstera, Curry Leaf…"
            hint={speciesHint}
            emptyText="No catalogue match — keep the name to add it as a custom species"
            onSelect={(option) => {
              if (!option) {
                // Text edited after a pick: drop the stale id so custom text
                // submits species_id null on purpose.
                setSelectedSpecies(null)
                return
              }
              const s = speciesById.get(option.id)
              if (!s) return
              setSelectedSpecies(s)
              setSpeciesQuery(s.common_name)
              // Pull the species' care defaults into the form so the
              // watering schedule starts from catalogue truth.
              setLightExposure(s.default_light)
              setSoilType(s.default_soil)
              setBaseInterval(String(s.base_interval_days))
              setMinInterval(String(s.min_interval_days))
              setMaxInterval(String(s.max_interval_days))
            }}
          />
          <div className="grid grid-cols-2 gap-sm">
            <Select
              label="Light"
              value={lightExposure}
              onChange={(e) => setLightExposure(e.target.value)}
            >
              {LIGHT_OPTIONS.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}
            </Select>
            <Select
              label="Placement"
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
            >
              {PLACEMENT_OPTIONS.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}
            </Select>
            <Select
              label="Pot material"
              value={potMaterial}
              onChange={(e) => setPotMaterial(e.target.value)}
            >
              <option value="">Not set</option>
              {POT_OPTIONS.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}
            </Select>
            <Select
              label="Soil type"
              value={soilType}
              onChange={(e) => setSoilType(e.target.value)}
            >
              <option value="">Not set</option>
              {SOIL_OPTIONS.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-sm">
            <Input label="Base days" type="number" min={1} max={365} value={baseInterval} onChange={(e) => setBaseInterval(e.target.value)} />
            <Input label="Min days" type="number" min={1} max={365} value={minInterval} onChange={(e) => setMinInterval(e.target.value)} />
            <Input label="Max days" type="number" min={1} max={365} value={maxInterval} onChange={(e) => setMaxInterval(e.target.value)} />
          </div>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <div className="flex justify-end gap-sm">
            <Button variant="secondary" disabled={saving} onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void handleAdd()}>Add plant</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
