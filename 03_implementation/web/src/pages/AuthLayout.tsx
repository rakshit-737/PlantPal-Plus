import { motion } from 'motion/react'
import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import hangingPlant from '../assets/hanging-plant.png'
import { BrandMark, Wordmark } from '../components/Brand'
import { ThemeToggle } from '../components/ThemeToggle'

const MODULES = [
  { label: 'Plant care', body: 'Watering that follows the season', dot: '#3aa56f' },
  { label: 'Fitness', body: 'Steps and workouts, measured honestly', dot: '#2f8f6a' },
  { label: 'Nutrition', body: 'Meals and water that add up', dot: '#e6bd6a' },
]

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
      {/* Three hanging planters across the top of the page, behind everything. */}
      {['left-[13%]', 'left-1/2 -translate-x-1/2', 'right-[2%]'].map((pos) => (
        <img
          key={pos}
          aria-hidden
          alt=""
          src={hangingPlant}
          draggable={false}
          className={`pointer-events-none absolute -top-6 z-0 w-[min(22vw,42vh,380px)] select-none opacity-60 ${pos}`}
        />
      ))}

      {/* ------------------------------------------------ the picture */}
      <aside className="relative z-10 hidden w-[46%] max-w-[680px] self-start overflow-hidden p-md lg:sticky lg:top-0 lg:block lg:h-screen">
        <div className="relative flex h-full flex-col p-xl pt-[min(14vw,28vh)] text-text-main">
          {/* Fine botanical linework, drawn in a single stroke weight. */}
          <svg aria-hidden viewBox="0 0 400 400" className="pointer-events-none absolute -right-16 bottom-24 h-[420px] w-[420px] text-text-muted/[0.12]" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M200 390C200 250 230 140 330 60" />
            <path d="M226 260c40-6 74-34 92-80-44 2-80 30-92 80z" />
            <path d="M212 318c-36-14-58-48-60-92 38 16 58 48 60 92z" />
            <path d="M246 196c34-14 56-44 60-84-36 12-58 42-60 84z" />
            <path d="M206 250c-30-20-44-54-38-92 30 22 44 54 38 92z" />
          </svg>

          <Link to="/" className="absolute left-xl top-lg z-10 flex w-fit items-center gap-[10px] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <BrandMark className="h-9 w-9" />
            <span className="font-display text-[22px] font-semibold tracking-[-0.02em] text-text-main">
              PlantPal<span className="text-primary">+</span>
            </span>
          </Link>

          <div className="relative mt-[2vh] pl-[5vw] text-left">
            <p className="font-display text-[clamp(40px,7.5vh,88px)] font-medium leading-[1.04] tracking-[-0.035em] text-text-main">
              Tend to what
              <br />
              keeps you <em className="italic text-tertiary">well.</em>
            </p>
            <ul className="mt-[3.5vh] flex flex-col gap-[2.5vh]">
              {MODULES.map((m) => (
                <li key={m.label} className="flex items-start gap-md">
                  <span aria-hidden className="mt-[1.6vh] h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.dot }} />
                  <span>
                    <span className="block font-display text-[clamp(20px,3.6vh,32px)] font-semibold text-text-main">{m.label}</span>
                    <span className="block text-[clamp(14px,2.3vh,20px)] text-text-muted">{m.body}</span>
                  </span>
                </li>
              ))}
            </ul>
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
