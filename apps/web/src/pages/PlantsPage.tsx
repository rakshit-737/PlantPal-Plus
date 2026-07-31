import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Alert, Badge, Button, Card, Combobox, EmptyState, ErrorState, Input, Modal,
  PageHeader, Select, Spinner, useToast,
  type ComboOption,
} from '../components/ui'
import { usePageTitle } from '../hooks/usePageTitle'
import {
  listPlants, createPlant, updatePlant, logCare, searchSpecies,
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

/**
 * Day counts arrive from Postgres as numbers or as numeric strings depending on
 * the column type, and both must land in the text input as "7", never "7.00"
 * or "null".
 */
const intervalText = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return ''
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : ''
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

const pencilIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="square"
    className="h-4 w-4 shrink-0"
    aria-hidden
  >
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    <path d="M14 6l4 4" />
  </svg>
)

/**
 * What the form submits, in the shape the API takes, so the add path can post it
 * unchanged and the edit path can diff it field by field.
 */
interface PlantFormValues {
  nickname: string
  species_id: string | null
  light_exposure: string
  placement: string
  pot_material: string | null
  soil_type: string | null
  base_interval_days: number
  min_interval_days: number
  max_interval_days: number
}

/**
 * The PUT body carries only the fields the user actually changed.
 * plantsRepo's UPDATABLE_PLANT_COLUMNS allow-list is a superset of this form
 * (room, acquisition_date, has_drainage, indoor_climate and photo_url are not
 * exposed here), and everything outside it is dropped server-side — so a narrow
 * patch keeps the request an honest description of the edit.
 *
 * Day counts are compared through Number(): the plant came off the wire, where
 * a count may be the string "7", and "7" !== 7 would report a phantom change.
 */
function changedFields(plant: Plant, values: PlantFormValues): Partial<Plant> {
  const patch: Partial<Plant> = {}
  if (values.nickname !== plant.nickname) patch.nickname = values.nickname
  if (values.species_id !== (plant.species_id ?? null)) patch.species_id = values.species_id
  if (values.light_exposure !== plant.light_exposure) patch.light_exposure = values.light_exposure
  if (values.placement !== plant.placement) patch.placement = values.placement
  if (values.pot_material !== (plant.pot_material ?? null)) patch.pot_material = values.pot_material
  if (values.soil_type !== (plant.soil_type ?? null)) patch.soil_type = values.soil_type
  if (values.base_interval_days !== Number(plant.base_interval_days)) {
    patch.base_interval_days = values.base_interval_days
  }
  if (values.min_interval_days !== Number(plant.min_interval_days)) {
    patch.min_interval_days = values.min_interval_days
  }
  if (values.max_interval_days !== Number(plant.max_interval_days)) {
    patch.max_interval_days = values.max_interval_days
  }
  return patch
}

/**
 * The one plant form. Add and edit differ only in their heading, their submit
 * label and what onSubmit does with the values, so the fields, the species
 * combobox and the interval validation live here once.
 *
 * The parent mounts this only while it is open: every open therefore starts
 * from `initial` instead of from whatever the previous visit left behind, and
 * the two modals can never collide over the field ids they derive from labels.
 *
 * onSubmit rejecting means "not saved" — the modal stays open, keeps the typed
 * values and shows `errorText`, so a retry costs one click.
 */
function PlantFormModal({
  title,
  submitLabel,
  errorText,
  initial,
  speciesList,
  speciesById,
  speciesLoading,
  speciesError,
  onClose,
  onSubmit,
}: {
  title: string
  submitLabel: string
  errorText: string
  initial?: Plant | undefined
  speciesList: Species[]
  speciesById: Map<string, Species>
  speciesLoading: boolean
  speciesError: boolean
  onClose: () => void
  onSubmit: (values: PlantFormValues) => Promise<void>
}) {
  const initialSpeciesId = initial?.species_id ?? null
  const initialSpecies = initialSpeciesId ? speciesById.get(initialSpeciesId) ?? null : null

  const [nickname, setNickname] = useState(initial?.nickname ?? '')
  const [speciesQuery, setSpeciesQuery] = useState(initialSpecies?.common_name ?? '')
  const [selectedSpecies, setSelectedSpecies] = useState<Species | null>(initialSpecies)
  // Whether the user has been near the species field at all. An untouched field
  // must submit the plant's existing species_id, not null: on an edit opened
  // before the catalogue loaded there is no option to resolve the id against,
  // and "we couldn't look it up" must never silently clear the species.
  const [speciesTouched, setSpeciesTouched] = useState(false)
  const [lightExposure, setLightExposure] = useState(initial?.light_exposure ?? 'BRIGHT_INDIRECT')
  const [placement, setPlacement] = useState(initial?.placement ?? 'INDOOR')
  const [potMaterial, setPotMaterial] = useState(initial?.pot_material ?? '')
  const [soilType, setSoilType] = useState(initial?.soil_type ?? '')
  const [baseInterval, setBaseInterval] = useState(
    initial ? intervalText(initial.base_interval_days) : '7',
  )
  const [minInterval, setMinInterval] = useState(
    initial ? intervalText(initial.min_interval_days) : '3',
  )
  const [maxInterval, setMaxInterval] = useState(
    initial ? intervalText(initial.max_interval_days) : '14',
  )
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // The catalogue can land after the modal opened (first fetch still in flight,
  // or the retry-on-open succeeding). Fill the species name in then, but only
  // while the user has left the field alone.
  useEffect(() => {
    if (!initialSpeciesId || speciesTouched || selectedSpecies) return
    const s = speciesById.get(initialSpeciesId)
    if (!s) return
    setSelectedSpecies(s)
    setSpeciesQuery(s.common_name)
  }, [initialSpeciesId, speciesById, speciesTouched, selectedSpecies])

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

  async function handleSubmit() {
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
      await onSubmit({
        nickname: name,
        species_id: speciesTouched ? selectedSpecies?.id ?? null : initialSpeciesId,
        light_exposure: lightExposure,
        placement,
        pot_material: potMaterial || null,
        soil_type: soilType || null,
        base_interval_days: base,
        min_interval_days: min,
        max_interval_days: max,
      })
    } catch {
      setFormError(errorText)
      setSaving(false)
      return
    }
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose} title={title} busy={saving}>
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
          onQueryChange={(q) => {
            setSpeciesTouched(true)
            setSpeciesQuery(q)
          }}
          options={speciesOptions}
          loading={speciesLoading}
          placeholder="Search or scroll — Tulsi, Monstera, Curry Leaf…"
          hint={speciesHint}
          emptyText="No catalogue match — keep the name to add it as a custom species"
          onSelect={(option) => {
            setSpeciesTouched(true)
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
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => void handleSubmit()}>{submitLabel}</Button>
        </div>
      </div>
    </Modal>
  )
}

export function PlantsPage() {
  usePageTitle('Plants')
  const toast = useToast()

  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  // The plant being edited doubles as the edit modal's open flag: one plant at
  // a time, and the form reads its initial values straight off it.
  const [editing, setEditing] = useState<Plant | null>(null)
  // Each card's Water button gets its own busy flag so parallel taps don't
  // share a spinner.
  const [wateringIds, setWateringIds] = useState<Set<string>>(new Set())

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // The catalogue is small: fetched once, it backs both the species search
  // match on the grid and the combobox in the add and edit modals.
  const [speciesList, setSpeciesList] = useState<Species[]>([])
  const [speciesLoading, setSpeciesLoading] = useState(false)
  const [speciesError, setSpeciesError] = useState(false)

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

  const formOpen = addOpen || editing !== null

  // If the first catalogue fetch failed, retry once each time a form opens.
  useEffect(() => {
    if (formOpen && speciesList.length === 0 && !speciesLoading) void loadSpecies()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen])

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

  const clearWatering = (id: string) =>
    setWateringIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  /** Re-reads the list after a write. Never throws: a stale grid is a toast, not a failure. */
  const refresh = useCallback(
    async (doneMessage: string) => {
      try {
        setPlants(await listPlants())
      } catch {
        toast.error(`${doneMessage}, but the list didn't refresh. Reload the page to see it.`)
      }
    },
    [toast],
  )

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
    await refresh(`Watered ${plant.nickname}`)
    clearWatering(plant.id)
  }

  async function handleAdd(values: PlantFormValues) {
    await createPlant(values)
    setAddOpen(false)
    toast.success(`Added ${values.nickname}`)
    await refresh(`Added ${values.nickname}`)
  }

  async function handleEdit(plant: Plant, values: PlantFormValues) {
    const patch = changedFields(plant, values)
    if (Object.keys(patch).length === 0) {
      setEditing(null)
      toast.info('No changes to save.')
      return
    }
    try {
      await updatePlant(plant.id, patch)
    } catch (err) {
      toast.error(`Couldn't update ${plant.nickname}. Check your connection and try again.`)
      // Rethrown so the form keeps the modal open with the values still typed.
      throw err
    }
    setEditing(null)
    toast.success(`Updated ${values.nickname}`)
    await refresh(`Updated ${values.nickname}`)
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
                    <div className="mt-auto flex gap-sm">
                      <Button
                        variant="secondary"
                        loading={busy}
                        onClick={() => void handleWater(p)}
                        className="flex-1"
                      >
                        {busy ? null : dropIcon}
                        Water
                      </Button>
                      {/* Named per plant so the grid reads as "Edit Monstera", not
                          a column of identical "Edit" buttons. */}
                      <Button
                        variant="ghost"
                        onClick={() => setEditing(p)}
                        aria-label={`Edit ${p.nickname}`}
                      >
                        {pencilIcon}
                        Edit
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {addOpen ? (
        <PlantFormModal
          title="Add plant"
          submitLabel="Add plant"
          errorText="The plant wasn't saved. Check your connection and try again."
          speciesList={speciesList}
          speciesById={speciesById}
          speciesLoading={speciesLoading}
          speciesError={speciesError}
          onClose={() => setAddOpen(false)}
          onSubmit={handleAdd}
        />
      ) : null}

      {editing ? (
        <PlantFormModal
          key={editing.id}
          title="Edit plant"
          submitLabel="Save changes"
          errorText="The changes weren't saved. Check your connection and try again."
          initial={editing}
          speciesList={speciesList}
          speciesById={speciesById}
          speciesLoading={speciesLoading}
          speciesError={speciesError}
          onClose={() => setEditing(null)}
          onSubmit={(values) => handleEdit(editing, values)}
        />
      ) : null}
    </div>
  )
}
