/** Per-page document titles: "Plants · PlantPal+". Call once per page component. */
import { useEffect } from 'react'

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · PlantPal+` : 'PlantPal+'
  }, [title])
}
