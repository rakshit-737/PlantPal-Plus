import { motion } from 'motion/react'
import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { BrandMark, Wordmark } from '../components/Brand'
import { ThemeToggle } from '../components/ThemeToggle'
import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * Shell for the unauthenticated auth screens.
 *
 * Split layout on desktop: an immersive conservatory panel on the left states
 * what the account is for, the form sits on the right. The panel is always the
 * dark emerald — it is a picture, not a surface, so it does not follow the
 * theme. Below `lg` the panel is dropped rather than stacked: on a phone it
 * would push the form under the fold, and someone who came here to sign in has
 * already decided.
 */

const MODULES = [
  { label: 'Plant care', body: 'Watering that follows the season', dot: '#4fd59a' },
  { label: 'Fitness', body: 'Steps and workouts, measured honestly', dot: '#7cc4ea' },
  { label: 'Nutrition', body: 'Meals and water that add up', dot: '#e6bd6a' },
]

function PanelRings() {
  const reduced = useReducedMotion()
  const rings = [
    { r: 46, pct: 0.86, color: '#4fd59a' },
    { r: 34, pct: 0.68, color: '#7cc4ea' },
    { r: 22, pct: 0.52, color: '#e6bd6a' },
  ]
  return (
    <svg viewBox="0 0 110 110" className="h-[92px] w-[92px] shrink-0">
      {rings.map((ring, i) => {
        const c = 2 * Math.PI * ring.r
        return (
          <g key={ring.r} transform="rotate(-90 55 55)">
            <circle cx="55" cy="55" r={ring.r} fill="none" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="8" />
            <motion.circle
              cx="55"
              cy="55"
              r={ring.r}
              fill="none"
              stroke={ring.color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              initial={{ strokeDashoffset: reduced ? c * (1 - ring.pct) : c }}
              animate={{ strokeDashoffset: c * (1 - ring.pct) }}
              transition={{ duration: reduced ? 0 : 1.3, delay: reduced ? 0 : 0.3 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            />
          </g>
        )
      })}
    </svg>
  )
}

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="relative flex min-h-full bg-background">
      <div aria-hidden className="app-aurora pointer-events-none fixed inset-0 z-0" />
      <div aria-hidden className="app-grain pointer-events-none fixed inset-0 z-0" />

      {/* ------------------------------------------------ the picture */}
      <aside className="relative z-10 hidden w-[46%] max-w-[680px] p-md lg:block">
        <div className="relative flex h-full min-h-[640px] flex-col justify-between overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#0f5f3e_0%,#0a3f2a_42%,#071f16_100%)] p-2xl text-[#eaf4ee] shadow-4">
          <div aria-hidden className="app-grain pointer-events-none absolute inset-0 !opacity-[0.07]" />
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#34e0a1]/20 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[#e6bd6a]/15 blur-3xl" />
          {/* Fine botanical linework, drawn in a single stroke weight. */}
          <svg aria-hidden viewBox="0 0 400 400" className="pointer-events-none absolute -right-16 bottom-24 h-[420px] w-[420px] text-white/[0.07]" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M200 390C200 250 230 140 330 60" />
            <path d="M226 260c40-6 74-34 92-80-44 2-80 30-92 80z" />
            <path d="M212 318c-36-14-58-48-60-92 38 16 58 48 60 92z" />
            <path d="M246 196c34-14 56-44 60-84-36 12-58 42-60 84z" />
            <path d="M206 250c-30-20-44-54-38-92 30 22 44 54 38 92z" />
          </svg>

          <Link to="/" className="relative flex w-fit items-center gap-[10px] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80">
            <BrandMark className="h-9 w-9" />
            <span className="font-display text-[22px] font-semibold tracking-[-0.02em] text-[#f3f8f4]">
              PlantPal<span className="text-[#7be3b4]">+</span>
            </span>
          </Link>

          <div className="relative">
            <p className="font-display text-[44px] font-medium leading-[1.06] tracking-[-0.03em] text-[#f3f8f4]">
              Tend to what
              <br />
              keeps you <em className="italic text-[#e6bd6a]">well.</em>
            </p>
            <ul className="mt-xl flex flex-col gap-md">
              {MODULES.map((m) => (
                <li key={m.label} className="flex items-start gap-md">
                  <span aria-hidden className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: m.dot, boxShadow: `0 0 12px ${m.dot}` }} />
                  <span>
                    <span className="block text-[15px] font-semibold text-[#f3f8f4]">{m.label}</span>
                    <span className="block text-sm text-[#b9d3c4]">{m.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div aria-hidden className="relative flex items-center gap-lg rounded-xl border border-white/10 bg-white/[0.06] p-md backdrop-blur-md">
            <PanelRings />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b9d3c4]">One streak</p>
              <p className="mt-[2px] font-display text-2xl font-medium text-[#f3f8f4]">Three habits, one rhythm</p>
              <p className="mt-[2px] text-sm text-[#b9d3c4]">Turn any module off — the rest carry on.</p>
            </div>
          </div>
        </div>
      </aside>

      {/* --------------------------------------------------- the form */}
      <div className="relative z-10 flex min-h-full w-full flex-col lg:flex-1">
        <div className="flex items-center justify-between px-lg pt-lg lg:justify-end">
          <Link to="/" className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden">
            <Wordmark size="sm" />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-lg py-2xl">
          <motion.div
            className="w-full max-w-[420px]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-xl">
              <h1 className="font-display text-[40px] font-medium leading-[1.05] tracking-[-0.03em] text-text-main">
                {title}
              </h1>
              <p className="mt-sm text-[15px] text-text-muted">{subtitle}</p>
            </div>
            {children}
          </motion.div>
        </div>

        <p className="px-lg pb-lg text-center text-xs text-text-muted">
          PlantPal+ is a wellness tracker, not medical advice.
        </p>
      </div>
    </div>
  )
}
