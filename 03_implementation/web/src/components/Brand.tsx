/**
 * The PlantPal+ identity: the mark and the wordmark, drawn once and shared by
 * the landing page, the auth screens and the app shell.
 *
 * The mark is an app-icon tile — deep emerald glass with a sprout whose two
 * leaves carry two of the module inks (leaf green and nutrition gold). It is
 * decorative everywhere it appears: the wordmark beside it, or the link it
 * sits in, carries the name.
 */
import { useId } from 'react'

export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  // Gradient ids are per instance: the mark appears more than once on a page,
  // and duplicate ids are invalid even where they happen to render.
  const uid = useId().replace(/:/g, '')
  const bg = `pp-mark-bg-${uid}`
  const sheen = `pp-mark-sheen-${uid}`
  return (
    <svg aria-hidden viewBox="0 0 64 64" className={`${className} shrink-0`}>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1a7f54" />
          <stop offset="0.55" stopColor="#0d5c3c" />
          <stop offset="1" stopColor="#063522" />
        </linearGradient>
        <linearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="17" fill={`url(#${bg})`} />
      <rect width="64" height="64" rx="17" fill={`url(#${sheen})`} />
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="16.25" fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1.5" />
      <path d="M32 50V31.5" stroke="#eaf8f0" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M32 34c0-8.4-5.8-14.2-14.2-14.2 0 8.4 5.8 14.2 14.2 14.2Z" fill="#eaf8f0" />
      <path d="M32 28.2c0-7.3 4.9-12.9 13.2-12.9 0 7.3-4.9 12.9-13.2 12.9Z" fill="#e6bd6a" />
    </svg>
  )
}

/** Mark plus name. `size` scales both together. */
export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const mark = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-11 w-11' }[size]
  const type = { sm: 'text-lg', md: 'text-[22px]', lg: 'text-[26px]' }[size]
  return (
    <span className="flex items-center gap-[10px]">
      <BrandMark className={mark} />
      <span className={`font-display font-semibold leading-none tracking-[-0.02em] text-text-main ${type}`}>
        PlantPal<span className="text-primary">+</span>
      </span>
    </span>
  )
}
