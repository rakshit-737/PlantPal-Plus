import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  Alert, Badge, Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Spinner, useToast,
} from '../components/ui'
import { usePageTitle } from '../hooks/usePageTitle'
import { ApiError } from '../lib/apiClient'
import {
  addGrowthEntry, deleteGrowthEntry, deletePlant, getCareHistory, getPlant, listGrowth, logCare,
  type CareEvent, type GrowthEntry, type Plant,
} from '../lib/plantsApi'

const todayStr = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * The seven care verbs. `past` feeds the success toast ("Watered Monstera");
 * `path` is a 24-viewBox stroke icon in the navItems style (1.5 stroke,
 * square caps — no emoji in the field notebook).
 */
const CARE_ACTIONS = [
  {
    type: 'WATER', label: 'Water', past: 'Watered',
    path: 'M12 3.5c3.5 4.3 5.5 7.2 5.5 10a5.5 5.5 0 11-11 0c0-2.8 2-5.7 5.5-10z',
  },
  {
    type: 'FERTILIZE', label: 'Fertilise', past: 'Fertilised',
    path: 'M12 21v-7.5M12 13.5c0-3.5 2.7-6 6.5-6 0 3.8-2.7 6-6.5 6zM12 10.5c0-3-2.3-5-5.5-5 0 3.2 2.3 5 5.5 5z',
  },
  {
    type: 'PRUNE', label: 'Prune', past: 'Pruned',
    path: 'M8.5 6a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM8.5 18a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM7.8 7.8L20 20M7.8 16.2L20 4',
  },
  {
    type: 'MIST', label: 'Mist', past: 'Misted',
    path: 'M4 8h13M7 12h13M4 16h10',
  },
  {
    type: 'REPOT', label: 'Repot', past: 'Repotted',
    path: 'M5 8h14M6.5 8l1.3 12h8.4L17.5 8M12 8V6M12 6c0-1.8 1.5-3 3.5-2.8 0 1.9-1.5 3-3.5 2.8z',
  },
  {
    type: 'ROTATE', label: 'Rotate', past: 'Rotated',
    path: 'M22 4.5v5.5h-5.5M20.3 15a8.7 8.7 0 11-2-9L22 10',
  },
  {
    type: 'TREAT', label: 'Treat', past: 'Treated',
    path: 'M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5V4z',
  },
] as const

type CareAction = (typeof CARE_ACTIONS)[number]

const ACTION_PATHS: Record<string, string> = Object.fromEntries(
  CARE_ACTIONS.map((a) => [a.type, a.path]),
)

/** Fallback mark for history entries whose action type we don't recognise. */
const TICK_PATH = 'M5.5 12.5l4 4 9-9.5'

function CareIcon({ path, className = 'h-4 w-4' }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <path d={path} />
    </svg>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

/* --------------------------------------------------- growth log (BR-PLT-11) */

/** The API's own cap on photo_url, restated so the request is never wasted. */
const MAX_PHOTO_URL = 2048
const MAX_HEIGHT_CM = 5000
const MAX_NOTE = 1000

/**
 * The value goes straight into an `<img src>`, so `javascript:` and `data:`
 * are rejected here for the same reason the API rejects them — a link the
 * browser will not fetch as an image is not a photo. Checking client-side also
 * means an obvious typo costs no round trip.
 */
function isHttpUrl(value: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return false
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:'
}

/**
 * height_cm arrives as a string (Postgres numeric keeps its exact decimal over
 * the wire). Anything that is not a finite number is treated as "no height"
 * rather than rendered as NaN.
 */
function parseHeight(value: string | null): number | null {
  if (value === null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const cameraIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="square"
    className="h-8 w-8"
    aria-hidden
  >
    <path d="M3 7.5h4.5L9 5h6l1.5 2.5H21v12H3zM12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
  </svg>
)

/** A framed picture struck through — "this link did not resolve to an image". */
const brokenImageIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="square"
    className="h-6 w-6"
    aria-hidden
  >
    <path d="M20 14.5V4H9.5M4 8v12h12M4 17l4-4 2.5 2.5M3.5 3.5l17 17" />
  </svg>
)

const TRASH_PATH =
  'M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5M10 10.5v6.5M14 10.5v6.5'

export function PlantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [plant, setPlant] = useState<Plant | null>(null)
  const [history, setHistory] = useState<CareEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // Which care verb is in flight — keyed by action type so each of the seven
  // buttons shows its own spinner and never borrows a neighbour's.
  const [caring, setCaring] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // The growth timeline loads on its own so a failed photo list never blanks
  // the plant, and its retry re-fetches only what actually failed.
  const [growth, setGrowth] = useState<GrowthEntry[]>([])
  const [growthLoading, setGrowthLoading] = useState(true)
  const [growthError, setGrowthError] = useState(false)
  // Ids whose <img> fired onError. Kept per entry so one dead link degrades
  // one tile instead of the grid.
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set())

  const [addOpen, setAddOpen] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoHeight, setPhotoHeight] = useState('')
  const [photoNote, setPhotoNote] = useState('')
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [photoFormError, setPhotoFormError] = useState('')

  // The entry itself, not just its id: the confirm dialog keeps naming its
  // date after the optimistic removal has taken the tile out of the grid.
  const [deleteEntry, setDeleteEntry] = useState<GrowthEntry | null>(null)
  const [entryDeleting, setEntryDeleting] = useState(false)

  usePageTitle(plant?.nickname ?? 'Plant')

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setLoadError(false)
    Promise.all([getPlant(id), getCareHistory(id)])
      .then(([p, h]) => { if (!cancelled) { setPlant(p); setHistory(h) } })
      .catch((err: unknown) => {
        if (cancelled) return
        // A 404 means the plant is gone — retrying won't bring it back.
        // Anything else (network, 5xx) is transient and gets a retry.
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setLoadError(true)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id, reloadKey])

  const loadGrowth = useCallback(async () => {
    if (!id) return
    setGrowthLoading(true)
    setGrowthError(false)
    try {
      setGrowth(await listGrowth(id))
    } catch {
      setGrowthError(true)
    } finally {
      setGrowthLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadGrowth()
  }, [loadGrowth])

  async function handleCare(action: CareAction) {
    if (!id || !plant) return
    setCaring(action.type)
    try {
      await logCare(id, { action_type: action.type, local_date_str: todayStr() })
    } catch {
      toast.error(`Could not log ${action.label.toLowerCase()} for ${plant.nickname}. Try again.`)
      setCaring(null)
      return
    }
    toast.success(`${action.past} ${plant.nickname}`)
    try {
      const [p, h] = await Promise.all([getPlant(id), getCareHistory(id)])
      setPlant(p)
      setHistory(h)
    } catch {
      // The entry saved; only the refreshed numbers failed to arrive.
      toast.info('Logged, but the page could not refresh. Reload to see it.')
    } finally {
      setCaring(null)
    }
  }

  async function handleDelete() {
    if (!id || !plant) return
    setDeleting(true)
    try {
      await deletePlant(id)
      toast.success(`Removed ${plant.nickname}`)
      navigate('/plants')
    } catch {
      toast.error(`Could not remove ${plant.nickname}. Try again.`)
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  function closeAddPhoto() {
    setAddOpen(false)
    setPhotoUrl('')
    setPhotoHeight('')
    setPhotoNote('')
    setUrlError('')
    setPhotoFormError('')
  }

  async function handleAddPhoto() {
    if (!id || !plant) return
    setUrlError('')
    setPhotoFormError('')

    const url = photoUrl.trim()
    if (!url) {
      setUrlError('A photo link is required.')
      return
    }
    if (url.length > MAX_PHOTO_URL) {
      setUrlError(`That link is ${url.length} characters. The limit is ${MAX_PHOTO_URL}.`)
      return
    }
    if (!isHttpUrl(url)) {
      setUrlError('The link must start with http:// or https://.')
      return
    }

    // Blank means "not measured this time", which the API reads as an absent
    // key — so only a typed value is validated and sent.
    let height: number | undefined
    const rawHeight = photoHeight.trim()
    if (rawHeight) {
      const n = Number(rawHeight)
      if (!Number.isFinite(n) || n < 0 || n > MAX_HEIGHT_CM) {
        setPhotoFormError(`Height must be a number from 0 to ${MAX_HEIGHT_CM} cm, or left blank.`)
        return
      }
      height = n
    }
    const note = photoNote.trim()
    if (note.length > MAX_NOTE) {
      setPhotoFormError(`The note is ${note.length} characters. Trim it to ${MAX_NOTE}.`)
      return
    }

    setSavingPhoto(true)
    let created: GrowthEntry
    try {
      created = await addGrowthEntry(id, {
        photo_url: url,
        height_cm: height,
        note: note || undefined,
        local_date_str: todayStr(),
      })
    } catch {
      // The modal stays open with everything typed still in it — re-entering a
      // long URL to retry would be its own small punishment.
      setPhotoFormError("The photo wasn't saved. Check the link and your connection, then try again.")
      setSavingPhoto(false)
      return
    }
    setSavingPhoto(false)
    closeAddPhoto()
    // The API returns the created row, so the newest-first order holds without
    // a second round trip.
    setGrowth((list) => [created, ...list])
    toast.success(`Added a growth photo for ${plant.nickname}`)
  }

  async function handleDeleteEntry() {
    const target = deleteEntry
    if (!id || !target) return
    const snapshot = growth
    setEntryDeleting(true)
    // Optimistic: the tile leaves at once, but the dialog stays busy until the
    // server confirms, so a failure can put the entry back before anything
    // else is clicked.
    setGrowth((list) => list.filter((e) => e.id !== target.id))
    try {
      await deleteGrowthEntry(id, target.id)
    } catch {
      setGrowth(snapshot)
      setEntryDeleting(false)
      setDeleteEntry(null)
      toast.error(`Could not delete the photo from ${target.local_date_str}. It is still in the timeline.`)
      return
    }
    setEntryDeleting(false)
    setDeleteEntry(null)
    toast.success(`Deleted the photo from ${target.local_date_str}`)
  }

  if (loading) {
    return <div className="flex justify-center py-2xl"><Spinner size="lg" /></div>
  }
  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <p className="text-text-main">This plant does not exist or was removed.</p>
          <Link to="/plants" className="mt-sm inline-block text-sm text-primary hover:underline">
            Back to plants
          </Link>
        </Card>
      </div>
    )
  }
  if (loadError || !plant) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          title="Couldn't load this plant"
          body="The server could not be reached. Your data is safe — try again."
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    )
  }

  const due = plant.next_water_due_at
    ? Math.round((new Date(plant.next_water_due_at).getTime() - Date.now()) / 86400000)
    : null

  // Entries are newest-first, so heights[0] is the latest measurement and the
  // last element is the earliest. Two readings are the fewest that describe a
  // change; below that there is nothing to summarise.
  const heights = growth
    .map((e) => parseHeight(e.height_cm))
    .filter((n): n is number => n !== null)
  const trend =
    heights.length >= 2
      ? `${heights[heights.length - 1]!.toFixed(1)} → ${heights[0]!.toFixed(1)} cm over ${heights.length} entries`
      : null

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-md">
        <Link
          to="/plants"
          className="inline-flex items-center gap-xs rounded-sm text-sm text-text-muted hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M10 3L5 8l5 5" strokeLinecap="square" />
          </svg>
          All plants
        </Link>
      </div>
      <div className="mb-xl">
        <PageHeader
          title={plant.nickname}
          subtitle={plant.room ?? 'No room set'}
          action={
            <Button variant="secondary" onClick={() => setDeleteOpen(true)}>
              Remove
            </Button>
          }
        />
      </div>

      <div className="mb-xl grid grid-cols-1 gap-md sm:grid-cols-2">
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">Watering</p>
          <p className="mt-xs font-mono text-2xl font-semibold tracking-tight text-primary">
            {due === null ? '—' : due < 0 ? `${Math.abs(due)}d overdue` : due === 0 ? 'due today' : `in ${due}d`}
          </p>
          <p className="mt-xs font-mono text-xs text-text-muted">
            every ~{plant.effective_interval_days ?? plant.base_interval_days}d
            {' · '}last {plant.last_watered_at ? fmtDate(plant.last_watered_at) : 'never'}
          </p>
        </Card>
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-muted">Conditions</p>
          <div className="mt-sm flex flex-wrap gap-sm">
            <Badge>{plant.light_exposure.replace(/_/g, ' ')}</Badge>
            <Badge>{plant.placement}</Badge>
            {plant.soil_type && <Badge>{plant.soil_type.replace(/_/g, ' ')}</Badge>}
            {plant.pot_material && <Badge>{plant.pot_material.replace(/_/g, ' ')}</Badge>}
          </div>
          <p className="mt-sm font-mono text-xs text-text-muted">
            bounds {plant.min_interval_days}–{plant.max_interval_days}d · added {fmtDate(plant.created_at)}
          </p>
        </Card>
      </div>

      <div className="mb-xl">
        <h2 className="mb-md font-heading text-xl font-semibold text-text-main">Log care</h2>
        <div className="flex flex-wrap gap-sm">
          {CARE_ACTIONS.map((a) => (
            <Button
              key={a.type}
              variant={a.type === 'WATER' ? 'primary' : 'secondary'}
              loading={caring === a.type}
              disabled={caring !== null && caring !== a.type}
              onClick={() => void handleCare(a)}
            >
              {caring === a.type ? null : <CareIcon path={a.path} />}
              {a.label}
            </Button>
          ))}
        </div>
      </div>

      <h2 className="mb-md font-heading text-xl font-semibold text-text-main">Care history</h2>
      {history.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            Nothing logged yet. The first entry starts this plant&apos;s ledger.
          </p>
        </Card>
      ) : (
        <Card className="p-0">
          {history.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-md border-b border-border px-lg py-sm last:border-b-0"
            >
              <span className="flex items-center gap-sm text-sm text-text-main">
                <span className="text-text-muted">
                  <CareIcon path={ACTION_PATHS[e.action_type] ?? TICK_PATH} className="h-3.5 w-3.5" />
                </span>
                {e.action_type.charAt(0) + e.action_type.slice(1).toLowerCase()}
                {e.note ? <span className="text-text-muted"> — {e.note}</span> : null}
              </span>
              <span className="shrink-0 font-mono text-xs text-text-muted">{e.local_date_str}</span>
            </div>
          ))}
        </Card>
      )}

      <div className="mt-xl mb-md flex items-center justify-between gap-md">
        <h2 className="font-heading text-xl font-semibold text-text-main">Growth log</h2>
        <Button variant="secondary" onClick={() => setAddOpen(true)}>
          Add photo
        </Button>
      </div>

      {growthLoading ? (
        <div className="flex justify-center py-xl"><Spinner /></div>
      ) : growthError ? (
        <ErrorState
          title="Couldn't load the growth log"
          body="The photo timeline didn't come back from the server. Nothing was lost — try again."
          onRetry={() => void loadGrowth()}
        />
      ) : growth.length === 0 ? (
        <Card>
          <EmptyState
            icon={cameraIcon}
            title="No photos yet"
            body={`Add a photo every few weeks and the timeline shows how ${plant.nickname} is filling out.`}
          />
        </Card>
      ) : (
        <>
          {trend ? (
            <p className="mb-md font-mono text-xs text-text-muted">{trend}</p>
          ) : null}
          <ul
            aria-label="Growth photos, newest first"
            className="grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-4"
          >
            {growth.map((e) => {
              const height = parseHeight(e.height_cm)
              const broken = brokenIds.has(e.id)
              return (
                <li
                  key={e.id}
                  className="flex flex-col overflow-hidden rounded-md border border-border bg-surface"
                >
                  <div className="aspect-square w-full bg-background">
                    {broken ? (
                      // A dead link keeps its ledger row: the date and the
                      // measurement are the record, the photo was the evidence.
                      <div className="flex h-full flex-col items-center justify-center gap-xs px-sm text-center text-text-muted">
                        {brokenImageIcon}
                        <span className="text-[10px] font-medium uppercase tracking-[0.08em]">
                          Image didn&apos;t load
                        </span>
                      </div>
                    ) : (
                      <img
                        src={e.photo_url}
                        alt={e.note ?? `Growth photo of ${plant.nickname}, ${e.local_date_str}`}
                        loading="lazy"
                        onError={() =>
                          setBrokenIds((prev) => {
                            if (prev.has(e.id)) return prev
                            const next = new Set(prev)
                            next.add(e.id)
                            return next
                          })
                        }
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-xs border-t border-border px-sm py-xs">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-text-main">{e.local_date_str}</p>
                      {height !== null ? (
                        <p className="font-mono text-xs text-text-muted">{height.toFixed(1)} cm</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteEntry(e)}
                      aria-label={`Delete growth photo from ${e.local_date_str}`}
                      className="shrink-0 rounded-sm p-xs text-text-muted hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <CareIcon path={TRASH_PATH} className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {e.note ? (
                    <p className="px-sm pb-sm text-xs text-text-muted">{e.note}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </>
      )}

      <Modal open={addOpen} onClose={closeAddPhoto} title="Add growth photo" busy={savingPhoto}>
        <div className="flex flex-col gap-md">
          <Input
            label="Photo link"
            name="photo-url"
            type="url"
            inputMode="url"
            value={photoUrl}
            onChange={(e) => {
              setPhotoUrl(e.target.value)
              if (urlError) setUrlError('')
            }}
            placeholder="https://…"
            error={urlError || undefined}
            hint="Paste a link to an image. PlantPal+ stores the link, not the file."
          />
          <Input
            label="Height in cm (optional)"
            name="growth-height"
            type="number"
            min={0}
            max={MAX_HEIGHT_CM}
            step="0.1"
            value={photoHeight}
            onChange={(e) => setPhotoHeight(e.target.value)}
            placeholder="e.g. 34.5"
          />
          <Input
            label="Note (optional)"
            name="growth-note"
            value={photoNote}
            maxLength={MAX_NOTE}
            onChange={(e) => setPhotoNote(e.target.value)}
            placeholder="e.g. new leaf unfurled"
          />
          {photoFormError ? <Alert tone="error">{photoFormError}</Alert> : null}
          <div className="flex justify-end gap-sm">
            <Button variant="secondary" disabled={savingPhoto} onClick={closeAddPhoto}>
              Cancel
            </Button>
            <Button loading={savingPhoto} onClick={() => void handleAddPhoto()}>
              Save photo
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteEntry !== null}
        onClose={() => setDeleteEntry(null)}
        title="Delete growth photo"
        busy={entryDeleting}
      >
        <p className="mb-md text-sm text-text-muted">
          Delete the photo from{' '}
          <span className="font-mono text-text-main">{deleteEntry?.local_date_str}</span>? It
          leaves the timeline and its height stops counting towards the trend.
        </p>
        <div className="flex justify-end gap-sm">
          <Button variant="secondary" disabled={entryDeleting} onClick={() => setDeleteEntry(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={entryDeleting} onClick={() => void handleDeleteEntry()}>
            Delete photo
          </Button>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Remove plant" busy={deleting}>
        <p className="mb-md text-sm text-text-muted">
          Remove {plant.nickname} and stop its reminders? Care history is kept
          and the plant can be restored by support.
        </p>
        <div className="flex justify-end gap-sm">
          <Button variant="secondary" disabled={deleting} onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleting} onClick={() => void handleDelete()}>
            Remove plant
          </Button>
        </div>
      </Modal>
    </div>
  )
}
