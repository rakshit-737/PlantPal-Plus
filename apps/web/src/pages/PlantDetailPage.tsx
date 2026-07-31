import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Badge, Button, Card, ErrorState, Modal, PageHeader, Spinner, useToast } from '../components/ui'
import { usePageTitle } from '../hooks/usePageTitle'
import { ApiError } from '../lib/apiClient'
import {
  deletePlant, getCareHistory, getPlant, logCare,
  type CareEvent, type Plant,
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
