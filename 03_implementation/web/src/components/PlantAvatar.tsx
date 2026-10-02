/**
 * A plant's monogram tile: its initial on leaf-green glass, with a leaf tucked
 * into the corner. Decorative — the plant's name is always printed beside it.
 */
export function PlantAvatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase()
  const box =
    size === 'lg'
      ? 'h-16 w-16 rounded-[20px] text-[28px]'
      : 'h-11 w-11 rounded-[14px] text-lg'
  const leaf = size === 'lg' ? 'h-9 w-9' : 'h-6 w-6'
  return (
    <span
      aria-hidden
      className={`relative grid shrink-0 place-items-center overflow-hidden bg-gradient-to-br from-primary/90 to-primary-hover font-display font-semibold text-on-primary shadow-glow-primary ${box}`}
    >
      <svg viewBox="0 0 24 24" className={`absolute -bottom-1 -right-1 text-on-primary/25 ${leaf}`} fill="currentColor">
        <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" />
      </svg>
      <span className="relative">{initial}</span>
    </span>
  )
}
