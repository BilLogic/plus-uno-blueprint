/**
 * The design reference behind one moment: the placement's own link first,
 * then any Figma link on the cell.
 *
 * A placement's url is per-moment — two PLUS App placements point at
 * different screens — so it has to win over a cell-wide one. It replaced a
 * resolver that searched `cells.links` by label and had a
 * `content === 'PLUS App'` branch bolted on, which is the arrangement #178
 * unwound; #181 finished it, and the cell's side of the question is now a
 * list of `resources` rows rather than the `url` entries of a jsonb array.
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
import type { CellResource } from '@/types/blueprint'

export function isFigmaUrl(url: string): boolean {
  return /figma\.com/i.test(url)
}

export function resolveDesignUrl(
  placementUrl: string | null | undefined,
  resources: readonly CellResource[],
): string | null {
  if (placementUrl?.trim()) return placementUrl.trim()

  for (const resource of resources) {
    const url = resource.url?.trim()
    if (!url) continue
    // A cell-wide resource qualifies as the design reference only when it
    // looks like one. A cell's resources are a mixed bag — a ticket, a doc, a
    // recording — and promoting the first of them to "the design" would put a
    // link behind a screenshot that has nothing to do with it.
    //
    // No `type` test any more: the array this used to read held touchpoint
    // detail and provenance beside the resources, and `resources` holds one
    // thing. Reading past that `type` is how the old resolver found a
    // screenshot's own url and called it the design.
    if (isFigmaUrl(url) || /figma/i.test(resource.name)) return url
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
