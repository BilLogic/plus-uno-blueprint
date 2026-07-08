import type { BlueprintCell, CellLink } from '@/types/blueprint'
import { parseCellContentItems } from '@/lib/parseCellContent'

export const TECH_DESCRIPTION_LINK_TYPE = 'tech_description'
export const URL_LINK_TYPE = 'url'

export function techDescriptionLink(
  techLabel: string,
  description?: string,
  picture?: string,
  url?: string,
): CellLink {
  return {
    type: TECH_DESCRIPTION_LINK_TYPE,
    label: techLabel,
    ...(description ? { description } : {}),
    ...(picture ? { picture } : {}),
    ...(url ? { url } : {}),
  }
}

function getTechUrlFromLinks(
  links: CellLink[],
  techItem: string,
): string | null {
  for (const link of links) {
    if (
      link.type === TECH_DESCRIPTION_LINK_TYPE &&
      link.label === techItem &&
      link.url?.trim()
    ) {
      return link.url.trim()
    }
  }
  return null
}

function getTechDescriptionFromLinks(
  links: CellLink[],
  techItem: string,
): string | null {
  for (const link of links) {
    if (
      link.type === TECH_DESCRIPTION_LINK_TYPE &&
      link.label === techItem &&
      link.description?.trim()
    ) {
      return link.description.trim()
    }
  }
  return null
}

/** Tech pill label for the detail panel heading (Front Stage Tech). */
export function resolveTechCellDetailLabel(
  techItem: string | undefined,
  cell: Pick<BlueprintCell, 'content'>,
): string | null {
  if (techItem?.trim()) return techItem.trim()

  const items = parseCellContentItems(cell.content)
  return items.length === 1 ? items[0]! : null
}

/** Detail panel body copy for a tech pill or single-tech cell. */
export function resolveTechCellDetailText(
  techItem: string | undefined,
  cell: Pick<BlueprintCell, 'content' | 'description' | 'links'>,
): string {
  const content = cell.content.trim()

  if (techItem) {
    const fromLinks = getTechDescriptionFromLinks(cell.links, techItem)
    if (fromLinks) return fromLinks

    if (techItem === 'Zoom/Pencil' && cell.description?.trim()) {
      return cell.description.trim()
    }

    return techItem
  }

  if (content === 'Zoom/Pencil' && cell.description?.trim()) {
    return cell.description.trim()
  }

  if (content === 'PLUS App') {
    const fromLinks = getTechDescriptionFromLinks(cell.links, 'PLUS App')
    if (fromLinks) return fromLinks
  }

  if (cell.description?.trim()) {
    return cell.description.trim()
  }

  return content
}

/** External design reference (e.g. Figma) for a tech pill detail panel. */
export function resolveTechCellDetailUrl(
  techItem: string | undefined,
  cell: Pick<BlueprintCell, 'content' | 'links'>,
): string | null {
  const content = cell.content.trim()

  if (techItem) {
    return getTechUrlFromLinks(cell.links, techItem)
  }

  if (content === 'PLUS App') {
    return getTechUrlFromLinks(cell.links, 'PLUS App')
  }

  return null
}

export function mergeUrlLinks(
  links: CellLink[],
  fallbackLinks: CellLink[],
): CellLink[] {
  const merged = links.map((link) => ({ ...link }))

  for (const fallbackLink of fallbackLinks) {
    if (fallbackLink.type !== URL_LINK_TYPE || !fallbackLink.url?.trim()) continue

    const existingIndex = merged.findIndex(
      (entry) => entry.type === URL_LINK_TYPE && entry.label === fallbackLink.label,
    )

    if (existingIndex >= 0) {
      const existing = merged[existingIndex]
      merged[existingIndex] = {
        ...existing,
        url: existing.url?.trim() || fallbackLink.url,
      }
      continue
    }

    merged.push(fallbackLink)
  }

  return merged
}

export function mergeTechDescriptionLinks(
  links: CellLink[],
  fallbackLinks: CellLink[],
): CellLink[] {
  const merged = mergeUrlLinks(
    links.map((link) => ({ ...link })),
    fallbackLinks,
  )

  for (const fallbackLink of fallbackLinks) {
    if (fallbackLink.type !== TECH_DESCRIPTION_LINK_TYPE) continue

    const existingIndex = merged.findIndex(
      (entry) =>
        entry.type === TECH_DESCRIPTION_LINK_TYPE &&
        entry.label === fallbackLink.label,
    )

    if (existingIndex >= 0) {
      const existing = merged[existingIndex]
      merged[existingIndex] = {
        ...existing,
        description:
          existing.description?.trim() || fallbackLink.description || undefined,
        picture: existing.picture?.trim() || fallbackLink.picture || undefined,
        url: existing.url?.trim() || fallbackLink.url || undefined,
      }
      continue
    }

    merged.push(fallbackLink)
  }

  return merged
}
