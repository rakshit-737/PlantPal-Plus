/**
 * The PlantPal+ identity: the mark and the wordmark, drawn once and shared by
 * the landing page, the auth screens and the app shell.
 *
 * The mark is an app-icon tile — deep emerald glass with a sprout whose two
 * leaves carry two of the module inks (leaf green and nutrition gold). It is
 * decorative everywhere it appears: the wordmark beside it, or the link it
 * sits in, carries the name.
 */
export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 64 64" className={`${className} shrink-0`}>
      <rect width="64" height="64" rx="17" fill="#0d5c3c" />
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
