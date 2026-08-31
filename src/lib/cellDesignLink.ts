/**
 * The design reference behind one moment: the placement's own link first,
 * then any Figma link on the cell.
 *
 * A placement's url is per-moment — two PLUS App placements point at
 * different screens — so it has to win over a cell-wide link. It replaced a
 * resolver that searched `cells.links` by label and had a
 * `content === 'PLUS App'` branch bolted on, which is the arrangement #178
 * unwound.
 *
 * **The placement's link now wins whatever it points AT.** The first version
 * only preferred it when the host was figma.com, so an author who attached a
 * Pencil file, a Notion page or a prototype URL to one moment watched a
 * cell-wide Figma link answer for it instead: a placement field overruled by
 * a cell field, which is the precedence this whole change exists to invert.
 * The host now decides only what the link is CALLED.
 *
 * Lives in `lib` rather than in the panel because it is the rule #188's
 * acceptance criterion is about — "a design link is preferred over a
 * cell-wide link" — and a rule that can only be exercised by mounting a
 * drawer is a rule nothing exercises.
 */
import { URL_LINK_TYPE } from '@/lib/blueprintTechDescriptions'
import type { CellLink } from '@/types/blueprint'

export function isFigmaUrl(url: string): boolean {
  return /figma\.com/i.test(url)
}

export function resolveDesignUrl(
  placementUrl: string | null | undefined,
  links: readonly CellLink[],
): string | null {
  if (placementUrl?.trim()) return placementUrl.trim()

  for (const link of links) {
    if (link.type !== URL_LINK_TYPE || !link.url?.trim()) continue
    // A cell-wide link qualifies as the design reference only when it looks
    // like one. The cell's resources are a mixed bag — a ticket, a doc, a
    // recording — and promoting the first of them to "the design" would put
    // a link behind a screenshot that has nothing to do with it.
    if (isFigmaUrl(link.url) || /figma/i.test(link.label ?? '')) {
      return link.url.trim()
    }
  }

  return null
}

/**
 * What to call the link, given where it lands.
 *
 * "View in Figma" is a promise about the destination, so it is made only
 * where it is true. Everything else says what it can honestly say.
 */
export function designLinkLabel(url: string | null): string {
  return url && isFigmaUrl(url) ? 'View in Figma' : 'Open the design'
}
