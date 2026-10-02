/**
 * The public landing page, served at / to signed-out visitors.
 *
 * It answers "what is this?" before it asks anyone to sign in, and it makes its
 * case with the product's own substance. Every number here is real — each one
 * is checked against the repository in landing-facts.test.ts, because a
 * marketing page that inflates its own figures is worse than one with none.
 * The drawings of the product (the hero card, the bento vignettes) use the
 * worked examples from the requirements, not invented user data, and are
 * aria-hidden: they repeat what the copy beside them already says.
 *
 * Section reveals are CSS scroll-driven animations (`.reveal`), progressive
 * enhancement only: a browser without support, or a visitor who asked for
 * less motion, simply gets the content — nothing waits on script to appear.
 *
 * The whole route is lazily loaded: it is visited once, and its weight must not
 * land on the dashboard someone opens every morning.
 */
import { motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { BrandMark, Wordmark } from '@/components/Brand'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { usePageTitle } from '../hooks/usePageTitle'
import vineCorner from '@/assets/vine-corner.png'

/* --------------------------------------------------------------- the facts */

/**
 * Every number this page claims, in one place so it can be verified.
 * landing-facts.test.ts checks each against its source in the repository.
 */
export const FACTS = {
  species: 94,
  foods: 180,
  exercises: 20,
  requirements: 228,
  userStories: 119,
  nonFunctional: 111,
} as const

const EASE = [0.22, 1, 0.36, 1] as const

/* ------------------------------------------------------------ rotating noun */

const NOUNS = ['plants', 'workouts', 'meals'] as const

/**
 * Cycles the three module nouns in the headline.
 *
 * Under reduced motion it does not cycle at all — it prints the full list,
 * which says the same thing in one glance. A rotator that merely cross-fades
 * more slowly still demands you wait to read the sentence.
 */
function RotatingNoun() {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduced) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % NOUNS.length), 2400)
    return () => window.clearInterval(id)
  }, [reduced])

  if (reduced) return <em className="text-brand pr-[0.06em] not-italic">plants, workouts and meals.</em>

  return (
    <span className="relative inline-block align-bottom">
      {/*
        The widest noun holds the line open so the headline never reflows
        mid-rotation, and the full stop rotates *with* the noun rather than
        trailing the box at the width of "workouts".
      */}
      <span aria-hidden className="invisible italic">
        workouts.
      </span>
      <motion.span
        key={index}
        aria-hidden
        className="text-brand absolute left-0 top-0 whitespace-nowrap pr-[0.08em] italic"
        initial={{ opacity: 0, y: '0.18em', filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        {NOUNS[index]}.
      </motion.span>
      {/* Screen readers get the sentence whole rather than a word that keeps
          changing underneath them. */}
      <span className="sr-only">plants, workouts and meals.</span>
    </span>
  )
}

/* ---------------------------------------------------------------- glyphs */

const icon = (d: string, cls = 'h-5 w-5') => (
  <svg aria-hidden viewBox="0 0 24 24" className={`${cls} shrink-0`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const GLYPH = {
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12.5l4.2 4.2L19 7',
  drop: 'M12 3.5c3.6 4.6 6 7.9 6 11a6 6 0 11-12 0c0-3.1 2.4-6.4 6-11z',
  pulse: 'M3 12h3.5l2.5-6 4 12 2.5-6H21',
  leaf: 'M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7',
  flame: 'M12 3c2.5 3.5 6 6 6 10a6 6 0 11-12 0c0-2.5 1.2-4.3 2.6-6 .6 1.6 1.6 2.5 2.9 2.5C11 7.5 11.2 5.2 12 3z',
  cloud: 'M7 18.5h10a4 4 0 00.6-7.95A5.5 5.5 0 006.6 9.1 4.75 4.75 0 007 18.5zM12 11v5m0 0l-2-2m2 2l2-2',
  eye: 'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.75a2.75 2.75 0 100-5.5 2.75 2.75 0 000 5.5z',
  bell: 'M12 4a6 6 0 016 6v3.5l1.5 2.5h-15L6 13.5V10a6 6 0 016-6zM10 19a2 2 0 004 0',
  plus: 'M12 5v14M5 12h14',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
}

/* --------------------------------------------------------- the hero visual */

/** One concentric ring, as SVG — decorative, inside an aria-hidden drawing. */
function DrawnRing({ r, pct, color, delay }: { r: number; pct: number; color: string; delay: number }) {
  const reduced = useReducedMotion()
  const c = 2 * Math.PI * r
  return (
    <>
      <circle cx="90" cy="90" r={r} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="12" />
      <motion.circle
        cx="90"
        cy="90"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: reduced ? c * (1 - pct) : c }}
        animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ duration: reduced ? 0 : 1.4, delay: reduced ? 0 : delay, ease: EASE }}
        transform="rotate(-90 90 90)"
      />
    </>
  )
}

/**
 * A still of the product beside the headline: today's three rings and the rows
 * behind them. The figures are the requirements' own worked examples — a 5-day
 * watering interval, a 10,000-step goal, a 2,000 kcal target.
 */
function HeroVisual() {
  const rows = [
    { ink: 'text-primary', label: 'Water the tulsi', detail: 'every 5 days', glyph: GLYPH.drop },
    { ink: 'text-secondary', label: 'Evening walk', detail: '7,412 / 10,000 steps', glyph: GLYPH.pulse },
    { ink: 'text-tertiary', label: 'Lunch — curd rice', detail: '1,180 / 2,000 kcal', glyph: GLYPH.leaf },
  ]
  return (
    <motion.div
      aria-hidden
      className="relative mx-auto w-full max-w-[440px]"
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
    >
      {/* Halo behind the card. */}

      <div className="edge-gradient pane relative rounded-2xl p-lg shadow-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Today</p>
            <p className="mt-[2px] font-display text-xl font-medium tracking-[-0.02em] text-text-main">Good morning</p>
          </div>
          <span className="flex items-center gap-[6px] rounded-full border border-glass-border bg-surface/70 px-[10px] py-[5px] text-xs font-medium text-text-main shadow-1">
            <span className="text-tertiary">{icon(GLYPH.flame, 'h-3.5 w-3.5')}</span>
            <span className="font-mono">12</span> day streak
          </span>
        </div>

        <div className="mt-lg flex items-center gap-lg">
          <svg viewBox="0 0 180 180" className="h-[150px] w-[150px] shrink-0 text-text-main">
            <DrawnRing r={78} pct={0.92} color="var(--color-primary)" delay={0.35} />
            <DrawnRing r={60} pct={0.74} color="var(--color-secondary)" delay={0.5} />
            <DrawnRing r={42} pct={0.59} color="var(--color-tertiary)" delay={0.65} />
          </svg>
          <dl className="flex flex-1 flex-col gap-[10px] text-sm">
            {[
              { k: 'Care', v: '92%', ink: 'bg-primary' },
              { k: 'Move', v: '74%', ink: 'bg-secondary' },
              { k: 'Nourish', v: '59%', ink: 'bg-tertiary' },
            ].map((m) => (
              <div key={m.k} className="flex items-center justify-between gap-sm">
                <dt className="flex items-center gap-sm text-text-muted">
                  <span className={`h-2 w-2 rounded-full ${m.ink}`} />
                  {m.k}
                </dt>
                <dd className="font-mono font-medium text-text-main">{m.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rule-fade my-lg" />

        <ul className="flex flex-col gap-sm">
          {rows.map((row, i) => (
            <motion.li
              key={row.label}
              className="flex items-center gap-md rounded-md border border-glass-border bg-surface/60 px-md py-[10px]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 + i * 0.08, ease: EASE }}
            >
              <span className={`relative grid h-8 w-8 place-items-center rounded-full ${row.ink}`}>
                <span className="absolute inset-0 rounded-full bg-current opacity-[0.12]" />
                <span className="relative">{icon(row.glyph, 'h-4 w-4')}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-text-main">{row.label}</span>
                <span className="block font-mono text-[11px] text-text-muted">{row.detail}</span>
              </span>
              <span className="grid h-6 w-6 place-items-center rounded-full border border-border-control/60 text-text-muted">
                {icon(GLYPH.check, 'h-3.5 w-3.5')}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Two floating notes, offset from the card. */}
      <motion.div
        className="pane absolute -left-8 -top-6 hidden items-center gap-sm rounded-lg px-md py-sm shadow-3 sm:flex"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.0, ease: EASE }}
      >
        <span className="text-primary">{icon(GLYPH.bell, 'h-4 w-4')}</span>
        <span className="text-xs font-medium text-text-main">Monstera is thirsty</span>
      </motion.div>
      <motion.div
        className="pane absolute -bottom-5 -right-4 hidden items-center gap-sm rounded-lg px-md py-sm shadow-3 sm:flex"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.15, ease: EASE }}
      >
        <span className="font-mono text-xs text-text-muted">7 × 0.80 × 1.10 × 0.80</span>
        <span className="font-mono text-xs font-semibold text-primary">→ 5 days</span>
      </motion.div>
    </motion.div>
  )
}

/* -------------------------------------------------------------- primitives */

/** The page's two link-buttons, sized for the marketing surfaces. */
function CtaLink({ to, children, variant = 'primary' }: { to: string; children: ReactNode; variant?: 'primary' | 'secondary' }) {
  const base =
    'group inline-flex h-12 items-center justify-center gap-sm rounded-[14px] px-6 text-[15px] font-medium transition-[transform,box-shadow,background-color,border-color,filter] duration-standard ease-state focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.985]'
  const look =
    variant === 'primary'
      ? 'btn-primary hover:-translate-y-px'
      : 'border border-border-control bg-glass text-text-main shadow-1 backdrop-blur-glass hover:-translate-y-px hover:border-text-muted hover:bg-surface-raised'
  return (
    <Link to={to} className={`${base} ${look}`}>
      {children}
      {variant === 'primary' ? (
        <span className="transition-transform duration-standard ease-state group-hover:translate-x-0.5">{icon(GLYPH.arrow, 'h-4 w-4')}</span>
      ) : null}
    </Link>
  )
}

function SectionHeading({ eyebrow, title, body, id, center = false }: { eyebrow: string; title: ReactNode; body?: string; id: string; center?: boolean }) {
  return (
    <div className={`reveal ${center ? 'mx-auto text-center' : ''} max-w-2xl`}>
      <p className={`eyebrow ${center ? 'justify-center' : ''} flex items-center gap-sm`}>
        <span aria-hidden className="h-px w-6 bg-primary" />
        {eyebrow}
      </p>
      <h2 id={id} className="mt-md font-display text-display-sm font-medium text-text-main">
        {title}
      </h2>
      {body ? <p className="mt-md text-[17px] leading-relaxed text-text-muted">{body}</p> : null}
    </div>
  )
}

/** A metric: mono numeral over its noun. */
function Figure({ value, label, tone = 'text-text-main' }: { value: string; label: string; tone?: string }) {
  return (
    <div>
      <p className={`font-mono text-4xl font-medium tracking-[-0.03em] md:text-5xl ${tone}`}>{value}</p>
      <p className="mt-sm text-sm text-text-muted">{label}</p>
    </div>
  )
}

/** A bento tile. */
function Tile({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`reveal group relative border-b border-r border-glass-border p-lg transition-colors duration-standard ease-state hover:bg-text-main/[0.025] md:p-xl ${className}`}>
      {children}
    </div>
  )
}

function TileHead({ ink, glyph, title, body }: { ink: string; glyph: string; title: string; body: string }) {
  return (
    <>
      <span className={`grid h-6 w-6 place-items-center ${ink}`}>{icon(glyph)}</span>
      <h3 className="mt-lg font-heading text-lg font-semibold tracking-[-0.015em] text-text-main">{title}</h3>
      <p className="mt-sm max-w-md text-[15px] leading-relaxed text-text-muted">{body}</p>
    </>
  )
}

/* ------------------------------------------------------------------- page */

export function LandingPage() {
  usePageTitle('Plant care, fitness and nutrition in one daily ritual')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="relative min-h-full overflow-x-clip">
      <div aria-hidden className="app-aurora pointer-events-none fixed inset-0 z-0" />
      <div aria-hidden className="app-grain pointer-events-none fixed inset-0 z-0" />

      <div className="relative z-10">
        {/* -------------------------------------------------------- header */}
        <header
          className={`sticky top-0 z-40 transition-[background-color,border-color,box-shadow] duration-standard ease-state ${
            scrolled ? 'border-b border-glass-border bg-glass-strong shadow-1 backdrop-blur-glass' : 'border-b border-transparent'
          }`}
        >
          <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-sm px-md sm:gap-md sm:px-lg">
            <Link to="/" className="shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="PlantPal+ home">
              <Wordmark />
            </Link>
            <nav className="hidden items-center gap-xl text-sm font-medium text-text-muted md:flex" aria-label="Sections">
              <a href="#features" className="transition-colors hover:text-text-main">Features</a>
              <a href="#how" className="transition-colors hover:text-text-main">How it works</a>
              <a href="#craft" className="transition-colors hover:text-text-main">Craft</a>
            </nav>
            <nav className="flex items-center gap-sm" aria-label="Account">
              <ThemeToggle />
              <Link
                to="/login"
                className="hidden h-10 items-center rounded-full px-md text-sm font-medium text-text-muted transition-colors duration-standard ease-state hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="btn-primary inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-[transform,filter,box-shadow] duration-standard ease-state hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-5"
              >
                {/* The phone header has room for one short verb, not two words. */}
                <span className="sm:hidden">Sign up</span>
                <span className="hidden sm:inline">Create account</span>
              </Link>
            </nav>
          </div>
        </header>

        <main>
          {/* ---------------------------------------------------------- hero */}
          <section className="mx-auto grid max-w-6xl items-center gap-2xl px-lg pb-2xl pt-xl md:pt-2xl lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-xl lg:pb-[96px]">
            <div>
              <motion.p
                className="inline-flex items-center gap-sm rounded-full border border-glass-border bg-glass py-[6px] pl-[6px] pr-md text-[13px] font-medium text-text-muted shadow-1 backdrop-blur-glass"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <span className="rounded-full bg-primary/[0.12] px-[10px] py-[2px] text-xs font-semibold text-primary">New</span>
                Plant care, fitness and nutrition<span className="hidden sm:inline">&nbsp;— one streak</span>
              </motion.p>

              <motion.h1
                className="mt-lg font-display text-display font-medium text-text-main"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
              >
                One quiet ritual
                <br />
                for your <RotatingNoun />
              </motion.h1>

              <motion.p
                className="mt-lg max-w-xl text-lg leading-relaxed text-text-muted"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.12, ease: EASE }}
              >
                PlantPal+ keeps the three daily habits that keep you well in one calm place — watering
                that follows the season, workouts and meals that add up, and a single streak that
                holds all three together.
              </motion.p>

              <motion.div
                className="mt-xl flex flex-wrap items-center gap-md"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
              >
                <CtaLink to="/register">Start your ritual — free</CtaLink>
                <CtaLink to="/login" variant="secondary">
                  Sign in
                </CtaLink>
              </motion.div>

              <motion.ul
                className="mt-xl flex flex-wrap gap-x-lg gap-y-sm text-sm text-text-muted"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
              >
                {[`${FACTS.species} plant species`, `${FACTS.foods} foods with macros`, 'Offline logging on mobile'].map((t) => (
                  <li key={t} className="flex items-center gap-[6px]">
                    <span className="text-primary">{icon(GLYPH.check, 'h-4 w-4')}</span>
                    {t}
                  </li>
                ))}
              </motion.ul>
            </div>

            <div className="lg:pl-lg">
              <HeroVisual />
            </div>
          </section>

          {/* ------------------------------------------------------ proof bar */}
          <section aria-label="Built to a specification" className="border-y border-glass-border bg-background-alt/50">
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-lg px-lg py-xl md:grid-cols-4">
              <Figure value={String(FACTS.requirements)} label="functional requirements" tone="text-primary" />
              <Figure value={String(FACTS.userStories)} label="user stories, with criteria" />
              <Figure value={String(FACTS.nonFunctional)} label="non-functional requirements" />
              <Figure value={String(FACTS.exercises)} label="exercises with MET values" tone="text-secondary" />
            </div>
          </section>

          {/* -------------------------------------------------------- bento */}
          <section id="features" aria-labelledby="features-heading" className="mx-auto max-w-6xl scroll-mt-24 px-lg py-[88px]">
            <SectionHeading
              id="features-heading"
              eyebrow="Three habits, one system"
              title={
                <>
                  Everything you tend, <em className="text-brand italic">in one rhythm.</em>
                </>
              }
              body="One system with three contextual lockups, not three apps wearing the same logo. Turn any module off and the rest carry on."
            />

            <div className="mt-2xl grid border-l border-t border-glass-border md:grid-cols-6">
              <Tile className="md:col-span-4">
                <TileHead
                  ink="text-primary"
                  glyph={GLYPH.drop}
                  title="Watering that follows the season"
                  body="Intervals computed from species, pot size, light and season — not a fixed weekly reminder that ignores winter."
                />
                <div aria-hidden className="mt-xl flex items-end gap-[6px]">
                  {Array.from({ length: 14 }, (_, i) => {
                    const due = i % 5 === 0
                    return (
                      <div key={i} className="flex flex-1 flex-col items-center gap-sm">
                        <div className={`w-full rounded-full ${due ? 'h-10 bg-primary/80' : 'h-4 bg-text-muted/[0.14]'}`} />
                        <span className={`font-mono text-[10px] ${due ? 'text-primary' : 'text-text-muted'}`}>{i + 1}</span>
                      </div>
                    )
                  })}
                </div>
              </Tile>

              <Tile className="md:col-span-2">
                <TileHead
                  ink="text-tertiary"
                  glyph={GLYPH.flame}
                  title="One streak for all three"
                  body="Care for your plants, move and eat well in the same day and the streak grows. Switch a module off and it only asks for the rest."
                />
                <p aria-hidden className="mt-xl font-display text-6xl font-medium tracking-[-0.04em] text-tertiary">
                  12<span className="ml-sm align-top font-sans text-sm font-medium tracking-normal text-text-muted">days</span>
                </p>
              </Tile>

              <Tile className="md:col-span-2">
                <TileHead
                  ink="text-secondary"
                  glyph={GLYPH.pulse}
                  title="Move, measured honestly"
                  body={`Steps and ${FACTS.exercises} seeded exercises with MET-based energy, against goals you set.`}
                />
                <div aria-hidden className="mt-xl flex h-16 items-end gap-[6px]">
                  {[38, 62, 45, 80, 56, 92, 70].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-md bg-secondary/70" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </Tile>

              <Tile className="md:col-span-2">
                <TileHead
                  ink="text-tertiary"
                  glyph={GLYPH.leaf}
                  title="Meals that add up"
                  body="Calories reconciled against the Atwater factors, so what you log and what it sums to cannot disagree."
                />
                <p aria-hidden className="mt-xl font-mono text-3xl font-medium tracking-[0.12em] text-tertiary">4·4·9</p>
              </Tile>

              <Tile className="md:col-span-2">
                <TileHead
                  ink="text-primary"
                  glyph={GLYPH.cloud}
                  title="Logs even when you're offline"
                  body="Waterings, workouts and meals queue on your phone and sync later — replay-safe, never double-counted."
                />
              </Tile>

              <Tile className="md:col-span-3">
                <TileHead
                  ink="text-secondary"
                  glyph={GLYPH.bell}
                  title="Reminders that know the plant"
                  body="One reminder engine for all three habits, with quiet hours that are actually respected."
                />
              </Tile>

              <Tile className="md:col-span-3">
                <TileHead
                  ink="text-primary"
                  glyph={GLYPH.eye}
                  title="Accessible by design"
                  body="High contrast, reduced motion and larger text are settings, not afterthoughts — every colour here is measured for contrast."
                />
              </Tile>
            </div>
          </section>

          {/* ---------------------------------------------------- catalogue */}
          <section aria-labelledby="catalogue-heading" className="border-y border-glass-border bg-background-alt/50">
            <div className="mx-auto grid max-w-6xl items-center gap-2xl px-lg py-[88px] lg:grid-cols-2">
              <SectionHeading
                id="catalogue-heading"
                eyebrow="Ready on day one"
                title="Seeded for the plants and food actually in your kitchen."
                body="Most trackers ship a catalogue that assumes a temperate garden and a Western pantry. This one starts with tulsi, curry leaf and mogra, and with the food an Indian household logs every day."
              />
              <div className="reveal">
                <div className="grid grid-cols-3 gap-lg">
                  <Figure value={String(FACTS.species)} label="plant species" tone="text-primary" />
                  <Figure value={String(FACTS.foods)} label="foods, with macros" tone="text-tertiary" />
                  <Figure value="0" label="rows to type first" />
                </div>
                <ul aria-label="A few of the seeded entries" className="mt-xl flex flex-wrap gap-sm">
                  {['Tulsi', 'Curry leaf', 'Neem', 'Mogra', 'Hibiscus', 'Roti', 'Curd rice', 'Khichdi', 'Thepla', 'Biryani'].map((name, i) => (
                    <li
                      key={name}
                      className={`rounded-full border px-md py-[6px] text-sm font-medium ${
                        i < 5 ? 'border-primary/25 bg-primary/[0.07] text-primary' : 'border-tertiary/25 bg-tertiary/[0.08] text-tertiary'
                      }`}
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------- how it works */}
          <section id="how" aria-labelledby="how-heading" className="mx-auto max-w-6xl scroll-mt-24 px-lg py-[88px]">
            <SectionHeading id="how-heading" eyebrow="How it works" title="Three minutes a day. That's the whole ritual." center />
            <ol className="mt-2xl grid gap-lg md:grid-cols-3">
              {[
                { n: '01', title: 'Add what you tend', body: 'Pick plants from the catalogue, set a step goal and a calorie target. Nothing to configure before the first log.', glyph: GLYPH.plus },
                { n: '02', title: 'Get a gentle nudge', body: 'Reminders arrive when a plant is actually due — adjusted for the season — and stay quiet when you asked them to.', glyph: GLYPH.bell },
                { n: '03', title: 'Watch it compound', body: 'Each log feeds one streak and a set of achievements, so the three habits pull each other along.', glyph: GLYPH.spark },
              ].map((s) => (
                <li key={s.n} className="reveal pane relative rounded-xl p-lg md:p-xl">
                  <span aria-hidden className="font-display text-5xl font-medium italic text-primary/25">{s.n}</span>
                  <div className="mt-md flex items-center gap-sm text-primary">{icon(s.glyph)}</div>
                  <h3 className="mt-md font-heading text-lg font-semibold tracking-[-0.015em] text-text-main">{s.title}</h3>
                  <p className="mt-sm text-[15px] leading-relaxed text-text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* ------------------------------------------------------- craft */}
          <section id="craft" aria-labelledby="craft-heading" className="border-y border-glass-border bg-background-alt/50">
            <div className="mx-auto grid max-w-6xl items-center gap-2xl px-lg py-[88px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <SectionHeading
                id="craft-heading"
                eyebrow="Craft"
                title="The tests assert the specification, not the implementation."
                body="The requirements publish worked examples, and those exact vectors are the test cases. A behaviour change fails against the requirement rather than against a number the code picked for itself."
              />
              <div className="reveal edge-gradient pane overflow-x-auto rounded-xl p-lg shadow-3 md:p-xl">
                <div aria-hidden className="mb-md flex gap-[6px]">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-tertiary/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
                </div>
                <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-loose text-text-main sm:whitespace-pre sm:text-[13px] md:text-sm">
                  <code>
                    <span className="text-text-muted">{'// watering interval\n'}</span>
                    {'7 × 0.80 × 1.10 × 0.80 × 1.00 = 4.928 → '}
                    <span className="text-primary">5 days</span>
                    {'\n\n'}
                    <span className="text-text-muted">{'// daily energy (TDEE)\n'}</span>
                    {'BMR 1345 × 1.375 → '}
                    <span className="text-secondary">1849 kcal</span>
                    {'\n\n'}
                    <span className="text-text-muted">{'// one rep max\n'}</span>
                    {'100 kg × (1 + 5/30) → '}
                    <span className="text-tertiary">116.7 kg</span>
                  </code>
                </pre>
              </div>
            </div>
          </section>

          {/* --------------------------------------------------------- cta */}
          <section className="mx-auto max-w-6xl px-lg py-[88px]">
            <div className="reveal relative overflow-hidden rounded-3xl bg-gradient-to-b from-primary/[0.07] via-surface/30 to-transparent px-lg py-2xl text-center md:px-2xl md:py-[72px]">
              {/* Corner Vines */}
              <img
                src={vineCorner}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute top-0 left-0 w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 object-contain opacity-90 z-10 select-none"
              />
              <img
                src={vineCorner}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute top-0 right-0 w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 object-contain opacity-90 z-10 select-none scale-x-[-1]"
              />
              <img
                src={vineCorner}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 left-0 w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 object-contain opacity-90 z-10 select-none scale-y-[-1]"
              />
              <img
                src={vineCorner}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 right-0 w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 object-contain opacity-90 z-10 select-none scale-x-[-1] scale-y-[-1]"
              />

              <div aria-hidden className="app-grain pointer-events-none absolute inset-0" />
              <div className="relative z-20">
                <BrandMark className="mx-auto h-14 w-14" />
                <h2 className="mx-auto mt-lg max-w-2xl font-display text-display-sm font-medium text-text-main">
                  Begin today&apos;s entry.
                </h2>
                <p className="mx-auto mt-md max-w-lg text-[17px] text-text-muted">
                  Free, and there is nothing to configure before the first log.
                </p>
                <div className="mt-xl flex justify-center">
                  <CtaLink to="/register">Create your account</CtaLink>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-glass-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-lg px-lg py-xl md:flex-row md:items-center md:justify-between">
            <div>
              <Wordmark size="sm" />
              <p className="mt-sm max-w-sm text-sm text-text-muted">
                A daily habit ledger for plant care, fitness and nutrition. A wellness tracker, not
                medical advice.
              </p>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-lg gap-y-sm text-sm font-medium text-text-muted">
              <Link to="/login" className="transition-colors hover:text-text-main">Sign in</Link>
              <Link to="/register" className="transition-colors hover:text-text-main">Create account</Link>
              <a href="https://github.com/rakshit-737/PlantPal-Plus" className="transition-colors hover:text-text-main" rel="noreferrer" target="_blank">
                Source on GitHub
              </a>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  )
}
