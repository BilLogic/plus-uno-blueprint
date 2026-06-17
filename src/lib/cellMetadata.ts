import type { Json } from '@/types/database'
import type { CellLink } from '@/types/blueprint'

/** Default metadata for cells without optional fields populated. */
export const EMPTY_CELL_METADATA = {
  picture: null,
  description: null,
  links: [] as CellLink[],
} as const

/** Parse links JSON from Supabase into typed link objects. */
export function normalizeCellLinks(raw: Json | null | undefined): CellLink[] {
  if (!Array.isArray(raw)) return []

  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []

    const record = item as Record<string, Json | undefined>
    const type = record.type
    const label = record.label
    if (typeof type !== 'string' || typeof label !== 'string') return []

    const link: CellLink = { type, label }
    if (typeof record.url === 'string') {
      link.url = record.url
    }
    return [link]
  })
}
