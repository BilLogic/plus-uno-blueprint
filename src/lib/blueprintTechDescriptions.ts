/**
 * What survives of the link-keyed touchpoint arrangement.
 *
 * The resolvers that read `cells.links` by label are gone — a placement
 * carries its own summary, screenshot and url, so `cellTouchpoints.ts`
 * answers those questions now, and it does so for all 92 touchpoints rather
 * than for the handful whose names had been written out by hand here.
 *
 * `TECH_DESCRIPTION_LINK_TYPE` and `techDescriptionLink` stay because the
 * hand-written fallback blueprints in `src/data` are not migrating: they
 * still express a touchpoint's detail this way, and the normalizer reads
 * that link type to resolve them into placements.
 */
import type { CellLink } from '@/types/blueprint'

export const TECH_DESCRIPTION_LINK_TYPE = 'tech_description'
export const URL_LINK_TYPE = 'url'

export function techDescriptionLink(
  techLabel: string,
  description?: string,
  picture?: string | readonly string[],
  url?: string,
): CellLink {
  const pictures = Array.isArray(picture)
    ? picture.map((entry) => entry.trim()).filter(Boolean)
    : undefined
  const singlePicture =
    typeof picture === 'string' && picture.trim() ? picture.trim() : undefined

  return {
    type: TECH_DESCRIPTION_LINK_TYPE,
    label: techLabel,
    ...(description ? { description } : {}),
    ...(pictures && pictures.length > 0
      ? { pictures, picture: pictures[0] }
      : singlePicture
        ? { picture: singlePicture }
        : {}),
    ...(url ? { url } : {}),
  }
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
  const fallbackUrlLabels = new Set(
    fallbackLinks
      .filter(
        (link) => link.type === URL_LINK_TYPE && link.label && link.url?.trim(),
      )
      .map((link) => link.label!),
  )

  // When fallback defines URL resource links, drop existing URL links that are
  // not in that set (removes obsolete onboarding / resource links).
  const baseLinks =
    fallbackUrlLabels.size > 0
      ? links.filter(
          (link) =>
            link.type !== URL_LINK_TYPE ||
            (link.label != null && fallbackUrlLabels.has(link.label)),
        )
      : links

  const merged = mergeUrlLinks(
    baseLinks.map((link) => ({ ...link })),
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
        pictures:
          existing.pictures?.length
            ? existing.pictures
            : fallbackLink.pictures?.length
              ? fallbackLink.pictures
              : undefined,
        url: existing.url?.trim() || fallbackLink.url || undefined,
      }
      continue
    }

    merged.push(fallbackLink)
  }

  return merged
}
