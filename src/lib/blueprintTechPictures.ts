import type { CellLink } from '@/types/blueprint'
import { TECH_DESCRIPTION_LINK_TYPE } from '@/lib/blueprintTechDescriptions'

export const ZOOM_TECH_LOGO =
  '/blueprint-images/goal-setting/shared/front-stage-tech/zoom-logo.png'

export const PENCIL_TECH_LOGO =
  '/blueprint-images/goal-setting/shared/front-stage-tech/pencil-logo.png'

export const ZOOM_PENCIL_TECH_PICTURES = [
  ZOOM_TECH_LOGO,
  PENCIL_TECH_LOGO,
] as const

const TECH_ITEM_DETAIL_PICTURES: Record<string, readonly string[]> = {
  'Zoom/Pencil': ZOOM_PENCIL_TECH_PICTURES,
}

function getTechPictureFromLinks(
  links: CellLink[],
  techItem: string,
): string | null {
  for (const link of links) {
    if (
      link.type === TECH_DESCRIPTION_LINK_TYPE &&
      link.label === techItem &&
      link.picture?.trim()
    ) {
      return link.picture.trim()
    }
  }
  return null
}

export function getTechItemDetailPictures(
  techItem: string,
): readonly string[] | null {
  return TECH_ITEM_DETAIL_PICTURES[techItem] ?? null
}

export function resolveCellDetailPictures(input: {
  techItem?: string | null
  cellContent?: string | null
  cellPicture?: string | null
  cellLinks?: CellLink[]
}): readonly string[] | null {
  const links = input.cellLinks ?? []

  if (input.techItem) {
    const techPictures = getTechItemDetailPictures(input.techItem)
    if (techPictures) return techPictures

    const fromLinks = getTechPictureFromLinks(links, input.techItem)
    if (fromLinks) return [fromLinks]
  }

  const content = input.cellContent?.trim() ?? ''
  if (
    content === 'Zoom/Pencil' ||
    content.startsWith('Zoom/Pencil\n') ||
    content.startsWith('Zoom/Pencil,')
  ) {
    return getTechItemDetailPictures('Zoom/Pencil')
  }

  if (content === 'PLUS App') {
    const fromLinks = getTechPictureFromLinks(links, 'PLUS App')
    if (fromLinks) return [fromLinks]
  }

  const picture = input.cellPicture?.trim()
  return picture ? [picture] : null
}
