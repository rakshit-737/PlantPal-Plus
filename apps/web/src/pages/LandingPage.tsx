/**
 * The public landing page, served at / to signed-out visitors.
 *
 * The demo used to open on a login form, which asks a stranger to authenticate
 * before telling them what the thing is. This page answers that first.
 *
 * Its argument is the app's own substance rather than the usual three feature
 * cards: a habit tracker lives or dies on legible numbers, so the numbers do
 * the persuading and they are all real — every figure here is checked against
 * the repository in landing-facts.test.ts, because a marketing page that
 * inflates its own test count is worse than one with no numbers on it.
 *
 * The whole route is lazily loaded: it is visited once, and its weight must not
 * land on the dashboard someone opens every morning.
 */
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useReducedMotion } from '@/hooks/useReducedMotion'
import { usePageTitle } from '../hooks/usePageTitle'

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

/* ------------------------------------------------------------- the wordmark */

function SproutMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={`${className} text-primary`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
    >
      <path d="M12 21v-8" />
      <path d="M12 13c0-3.5-2.5-6-6-6 0 3.5 2.5 6 6 6Z" />
      <path d="M12 10c0-3 2-5.5 5.5-5.5 0 3-2 5.5-5.5 5.5" />
    </svg>
  )
}

/**
 * The wordmark's entrance — the one authored moment on the page, and the only
 * place in the product where the identity animates. It plays once, on load,
 * and never inside the app.
 */
function Wordmark() {
  return (
    <motion.div
      className="flex items-center gap-sm"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <SproutMark />
      <span className="font-heading text-2xl font-extrabold tracking-tight text-text-main">
        PlantPal+
      </span>
    </motion.div>
  )
}

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
    const id = window.setInterval(() => setIndex((i) => (i + 1) % NOUNS.length), 2200)
    return () => window.clearInterval(id)
  }, [reduced])

  if (reduced) return <span className="text-primary">plants, workouts and meals.</span>

  return (
    <span className="relative inline-block align-bottom text-primary">
      {/*
        The widest noun holds the line width open so the headline never reflows
        mid-rotation — and the full stop rotates *with* the noun rather than
        following the box. Left outside, it sat at the width of "workouts" while
        "plants" was showing, which reads as a typo: `plants        .`
      */}
      <span aria-hidden className="invisible">
        workouts.
      </span>
      <motion.span
        key={index}
        className="absolute left-0 top-0 whitespace-nowrap"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {NOUNS[index]}
        <span className="text-text-main">.</span>
      </motion.span>
      {/* Screen readers get the sentence whole rather than a word that keeps
          changing underneath them. */}
      <span className="sr-only">plants, workouts and meals.</span>
    </span>
  )
}

/* -------------------------------------------------------------- primitives */

/** A section that grows in the first time it is scrolled to, once. */
function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.98 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/* --------------------------------------------------------- the hero panel */

/**
 * A still of the product, beside the headline.
 *
 * The hero used to be one column of text on a 1440px page, which left the
 * right half empty and made the whole thing read as unfinished. This fills it
 * with the only thing a habit tracker can honestly show off: a day's worth of
 * rows, in the app's own type and colour.
 *
 * It is a drawing, not a screenshot, and not live data — the figures are the
 * ones the product's own worked examples use (the 5-day watering interval, a
 * 10,000-step goal, a 2,000 kcal target), so nothing here claims more than the
 * app does. Marked aria-hidden: it repeats what the copy beside it already
 * says, and a screen reader should not have to sit through a decorative
 * dashboard.
 */
function HeroPanel() {
  const rows = [
    { ink: 'text-primary', label: 'Monstera', detail: 'due today', value: '5d', meter: 100 },
    { ink: 'text-secondary', label: 'Steps', detail: 'of 10,000', value: '7,412', meter: 74 },
    { ink: 'text-tertiary', label: 'Calories', detail: 'of 2,000', value: '1,180', meter: 59 },
  ]

  return (
    <motion.div
      aria-hidden
      className="relative"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* A second card behind the first, offset — depth without a drop shadow
          heavy enough to muddy the light ground. */}
      <div
        className="absolute inset-0 -rotate-2 rounded-xl border border-glass-border bg-glass"
        style={{ transform: 'rotate(-2deg) translate(10px, 10px)' }}
      />
      <div className="relative rounded-xl border border-glass-border bg-surface-raised p-lg shadow-3 backdrop-blur-glass">
        <div className="flex items-baseline justify-between">
          <p className="font-heading text-sm font-bold uppercase tracking-widest text-text-muted">
            Today
          </p>
          <p className="font-mono text-sm text-text-muted">day 12</p>
        </div>

        <ul className="mt-lg flex flex-col gap-lg">
          {rows.map((row) => (
            // The row carries the module's colour so the meter below can take it
            // from `currentColor` — the value and its bar are one unit, and
            // stating the colour twice is how they drift apart.
            <li key={row.label} className={row.ink}>
              <div className="flex items-baseline justify-between gap-md">
                <span className="text-sm font-semibold text-text-main">{row.label}</span>
                <span className="font-mono text-lg font-semibold">{row.value}</span>
              </div>
              <div className="mt-xs flex items-center gap-md">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background-alt">
                  <div
                    className="h-full rounded-full bg-current opacity-80"
                    style={{ width: `${row.meter}%` }}
                  />
                </div>
                <span className="w-20 text-right text-xs text-text-muted">{row.detail}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-lg flex items-center justify-between border-t border-glass-border pt-lg">
          <span className="text-xs text-text-muted">One streak, three habits</span>
          <span className="font-mono text-sm font-semibold text-primary">12 days</span>
        </div>
      </div>
    </motion.div>
  )
}

/** A metric: mono numeral over its noun. The page's structural unit. */
function Figure({
  value,
  label,
  tone = 'text-text-main',
}: {
  value: string
  label: string
  tone?: string
}) {
  return (
    <div>
      <p className={`font-mono text-4xl font-semibold tracking-tight md:text-5xl ${tone}`}>
        {value}
      </p>
      <p className="mt-xs text-sm text-text-muted">{label}</p>
    </div>
  )
}

/* ------------------------------------------------------------------- page */

export function LandingPage() {
  usePageTitle('Plant care, fitness and nutrition in one ledger')

  return (
    <div className="relative min-h-full overflow-x-hidden">
      <div aria-hidden className="app-aurora pointer-events-none fixed inset-0 z-0" />

      <div className="relative z-10">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-lg py-lg">
          <Wordmark />
          <nav className="flex items-center gap-md" aria-label="Account">
            <Link
              to="/login"
              className="text-sm font-semibold text-text-muted transition-colors duration-standard ease-state hover:text-text-main"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-md bg-primary px-md py-sm text-sm font-semibold text-on-primary shadow-glow-primary transition-colors duration-standard ease-state hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Create account
            </Link>
          </nav>
        </header>

        <main>
          {/* ------------------------------------------------------- hero */}
          <section className="mx-auto grid max-w-6xl items-center gap-2xl px-lg pb-2xl pt-xl md:pt-2xl lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-2xl">
            <div>
            <motion.h1
              className="max-w-4xl font-heading text-display font-bold text-text-main"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              One ledger for your <RotatingNoun />
            </motion.h1>

            <p className="mt-lg max-w-xl text-lg leading-relaxed text-text-muted">
              Plant care, fitness and nutrition tracked in one place, on one streak. Built to a
              written specification rather than a wireframe — {FACTS.requirements} functional
              requirements, each one traceable to the code that satisfies it.
            </p>

            <div className="mt-xl flex flex-wrap items-center gap-md">
              <Link
                to="/register"
                className="rounded-md bg-primary px-lg py-md text-base font-semibold text-on-primary shadow-glow-primary transition-colors duration-standard ease-state hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Start your ledger
              </Link>
              <Link
                to="/login"
                className="rounded-md border border-border-control bg-glass px-lg py-md text-base font-semibold text-text-main backdrop-blur-glass transition-colors duration-standard ease-state hover:border-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Sign in
              </Link>
            </div>
            </div>

            {/* Hidden below lg: at that width it would sit under the fold as a
                second screen of decoration before the argument starts. */}
            <div className="hidden lg:block">
              <HeroPanel />
            </div>
          </section>

          {/* ---------------------------------------------------- modules */}
          <section
            aria-labelledby="modules-heading"
            className="border-y border-glass-border bg-background-alt/60"
          >
            <div className="mx-auto max-w-6xl px-lg py-2xl">
              <h2
                id="modules-heading"
                className="max-w-2xl font-heading text-3xl font-bold tracking-tight text-text-main md:text-4xl"
              >
                Three habits, one streak.
              </h2>
              <p className="mt-md max-w-xl text-base text-text-muted">
                One system with three contextual lockups, not three apps wearing the same logo.
                Turn any module off and the rest carry on.
              </p>

              {/*
                A three-up grid rather than a stack of full-width rows. The
                rows put one short sentence in a 1140px column and left the
                right third of every one of them empty; three cards use the
                width the page already has, and put the three modules beside
                each other, which is the point the section is making.
              */}
              <dl className="mt-2xl grid gap-lg md:grid-cols-3">
                {[
                  {
                    ink: 'text-primary',
                    term: 'Plant care',
                    metric: '5 days',
                    detail:
                      'Watering intervals computed from species, pot size, light and season — not a fixed weekly reminder that ignores winter.',
                  },
                  {
                    ink: 'text-secondary',
                    term: 'Fitness',
                    metric: `${FACTS.exercises} exercises`,
                    detail:
                      'Steps, workouts and MET-based energy, with a streak that counts the day you showed up rather than the day you hit a target.',
                  },
                  {
                    ink: 'text-tertiary',
                    term: 'Nutrition',
                    metric: '4·4·9',
                    detail:
                      'Calories reconciled against the Atwater factors, so what you log and what it sums to cannot disagree.',
                  },
                ].map((m) => (
                  <Reveal key={m.term} className="h-full">
                    <div className="flex h-full flex-col rounded-xl border border-glass-border bg-surface/70 p-lg backdrop-blur-glass">
                      <dt className={`font-mono text-3xl font-semibold ${m.ink}`}>{m.metric}</dt>
                      <dd className="mt-sm text-sm font-semibold uppercase tracking-wide text-text-main">
                        {m.term}
                      </dd>
                      <p className="mt-md text-base leading-relaxed text-text-muted">{m.detail}</p>
                    </div>
                  </Reveal>
                ))}
              </dl>
            </div>
          </section>

          {/* -------------------------------------------------- catalogue */}
          <section aria-labelledby="catalogue-heading" className="mx-auto max-w-6xl px-lg py-2xl">
            <Reveal>
              <h2
                id="catalogue-heading"
                className="max-w-2xl font-heading text-3xl font-bold tracking-tight text-text-main md:text-4xl"
              >
                Seeded for the plants and food actually in your kitchen.
              </h2>
              <p className="mt-md max-w-xl text-base leading-relaxed text-text-muted">
                Most trackers ship a catalogue that assumes a temperate garden and a Western pantry.
                This one starts with tulsi, curry leaf and money plant, and with the foods an Indian
                household logs every day.
              </p>
              <div className="mt-xl grid grid-cols-2 gap-lg sm:grid-cols-3">
                <Figure value={String(FACTS.species)} label="plant species" tone="text-primary" />
                <Figure value={String(FACTS.foods)} label="foods, with macros" tone="text-tertiary" />
                <Figure value="0" label="rows you must type first" />
              </div>
            </Reveal>
          </section>

          {/* ------------------------------------------------- engineering */}
          <section
            aria-labelledby="engineering-heading"
            className="border-y border-glass-border bg-background-alt/60"
          >
            <div className="mx-auto max-w-6xl px-lg py-2xl">
              <Reveal>
                <h2
                  id="engineering-heading"
                  className="max-w-2xl font-heading text-3xl font-bold tracking-tight text-text-main md:text-4xl"
                >
                  The tests assert the specification, not the implementation.
                </h2>
                <p className="mt-md max-w-2xl text-base leading-relaxed text-text-muted">
                  The requirements publish worked examples, and those exact vectors are the test
                  cases. A behaviour change fails against the requirement rather than against a
                  number the code picked for itself.
                </p>

                <div className="mt-xl overflow-x-auto rounded-lg border border-glass-border bg-glass p-lg shadow-glass backdrop-blur-glass">
                  <pre className="font-mono text-sm leading-loose text-text-main">
                    <code>
                      <span className="text-text-muted">{'// watering interval\n'}</span>
                      {'7 × 0.80 × 1.10 × 0.80 × 1.00 = 4.928 → '}
                      <span className="text-primary">5 days</span>
                      {'\n\n'}
                      <span className="text-text-muted">{'// basal metabolic rate\n'}</span>
                      {'BMR 1345 × 1.375 → '}
                      <span className="text-secondary">1849 kcal</span>
                    </code>
                  </pre>
                </div>

                {/* A passing-test count would be the obvious figure here and is
                    deliberately not used: it changes with every commit, so it
                    would be stale on the day it shipped and there is no way to
                    verify it without running the suite from inside the suite.
                    These three are published in the README and hold still. */}
                <div className="mt-xl grid grid-cols-2 gap-lg sm:grid-cols-3">
                  <Figure value={String(FACTS.requirements)} label="functional requirements" />
                  <Figure value={String(FACTS.userStories)} label="user stories, with criteria" />
                  <Figure
                    value={String(FACTS.nonFunctional)}
                    label="non-functional requirements"
                    tone="text-primary"
                  />
                </div>
              </Reveal>
            </div>
          </section>

          {/* -------------------------------------------------------- cta */}
          <section className="mx-auto max-w-6xl px-lg py-2xl text-center">
            <Reveal>
              <h2 className="mx-auto max-w-2xl font-heading text-3xl font-bold tracking-tight text-text-main md:text-4xl">
                Start today's entry.
              </h2>
              <p className="mx-auto mt-md max-w-lg text-base text-text-muted">
                Free, and there is nothing to configure before the first log.
              </p>
              <Link
                to="/register"
                className="mt-xl inline-flex rounded-md bg-primary px-lg py-md text-base font-semibold text-on-primary shadow-glow-primary transition-colors duration-standard ease-state hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Create your account
              </Link>
            </Reveal>
          </section>
        </main>

        <footer className="border-t border-glass-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-sm px-lg py-lg text-sm text-text-muted md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-sm">
              <SproutMark className="h-5 w-5" />
              <span className="font-medium text-text-main">PlantPal+</span>
            </div>
            <p>A daily habit ledger for plant care, fitness and nutrition.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
