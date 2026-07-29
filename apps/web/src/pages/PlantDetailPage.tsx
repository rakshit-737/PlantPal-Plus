import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { Alert, Badge, Button, Card, Modal, PageHeader, Spinner } from '../components/ui'
import {
  deletePlant, getCareHistory, getPlant, logCare,
  type CareEvent, type Plant,
} from '../lib/plantsApi'

const todayStr = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const CARE_ACTIONS = [
  { type: 'WATER', label: 'Water', icon: '💧' },
  { type: 'FERTILIZE', label: 'Fertilise', icon: '🌾' },
  { type: 'PRUNE', label: 'Prune', icon: '✂️' },
  { type: 'MIST', label: 'Mist', icon: '🌫️' },
  { type: 'REPOT', label: 'Repot', icon: '🪴' },
  { type: 'ROTATE', label: 'Rotate', icon: '🔄' },
  { type: 'TREAT', label: 'Treat', icon: '🩹' },
] as const

const ACTION_ICONS: Record<string, string> = Object.fromEntries(
  CARE_ACTIONS.map((a) => [a.type, a.icon]),
)

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function PlantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [plant, setPlant] = useState<Plant | null>(null)
  const [history, setHistory] = useState<CareEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [caring, setCaring] = useState<string | null>(null)
  const [careError, setCareError] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([getPlant(id), getCareHistory(id)])
      .then(([p, h]) => { if (!cancelled) { setPlant(p); setHistory(h) } })
      .catch(() => { if (!cancelled) setNotFound(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  async function handleCare(actionType: string) {
    if (!id) return
    setCareError('')
    setCaring(actionType)
    try {
      await logCare(id, { action_type: actionType, local_date_str: todayStr() })
      const [p, h] = await Promise.all([getPlant(id), getCareHistory(id)])
      setPlant(p)
      setHistory(h)
    } catch {
      setCareError('Could not log that action. Try again.')
    } finally {
      setCaring(null)
    }
  }

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    try {
      await deletePlant(id)
      navigate('/plants')
    } catch {
      setCareError('Could not remove this plant. Try again.')
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-2xl"><Spinner size="lg" /></div>
  }
  if (notFound || !plant) {
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

  const due = plant.next_water_due_at
    ? Math.round((new Date(plant.next_water_due_at).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-md">
        <Link to="/plants" className="text-sm text-text-muted hover:text-text-main">
          ← All plants
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
              onClick={() => void handleCare(a.type)}
            >
              {a.icon} {a.label}
            </Button>
          ))}
        </div>
        {careError && <div className="mt-sm"><Alert tone="error">{careError}</Alert></div>}
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
                <span aria-hidden>{ACTION_ICONS[e.action_type] ?? '📌'}</span>
                {e.action_type.charAt(0) + e.action_type.slice(1).toLowerCase()}
                {e.note ? <span className="text-text-muted"> — {e.note}</span> : null}
              </span>
              <span className="shrink-0 font-mono text-xs text-text-muted">{e.local_date_str}</span>
            </div>
          ))}
        </Card>
      )}

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Remove plant">
        <p className="mb-md text-sm text-text-muted">
          Remove {plant.nickname} and stop its reminders? Care history is kept
          and the plant can be restored by support.
        </p>
        <div className="flex justify-end gap-sm">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button loading={deleting} onClick={() => void handleDelete()}>Remove plant</Button>
        </div>
      </Modal>
    </div>
  )
}
