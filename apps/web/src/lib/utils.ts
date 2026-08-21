/**
 * `cn` — the class-name merger every shadcn-convention component expects at
 * `@/lib/utils`. clsx resolves conditionals into a class string; tailwind-merge
 * then drops earlier Tailwind classes that a later one overrides, so a caller's
 * `className` wins over a component's own defaults instead of both landing in
 * the attribute and letting source order decide.
 *
 * The canonical published snippet is `import { ClassValue, clsx } from 'clsx'`,
 * which fails typecheck here: `verbatimModuleSyntax` requires the type import
 * to be marked. Every component adapted into this app needs the same treatment.
 */
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
