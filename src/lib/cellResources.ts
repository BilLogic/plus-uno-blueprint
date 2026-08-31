/**
 * A cell's resources, resolved from whichever source the board came from.
 *
 * The database stores them: one `resources` row per thing a cell points at,
 * carrying its own name, url, kind and order. That column used to be a jsonb
 * array on `cells` holding three unrelated things at once — 475 resources,
 * 117 touchpoint details and 64 provenance citations — under a name that
 * described one of them.
 *
 * The hand-written fallback blueprints in `src/data` predate the table and
 * are not migrating, so they still carry the array. The `url`-typed entries
 * of it are their resources, and reading them here rather than in the
 * components keeps the old shape behind the same seam that already hides the
 * old touchpoint shape: `cellTouchpoints.ts` is the sibling, and the
 * normalizer calls both.
 *
 * A fallback entry with no usable url is DROPPED. That is not a narrowing —
 * it is what the resources tab already did, because a resource with nothing
 * on the other end has nothing to render. The entries that were in that state
 * in production were provenance citations, and they belong in `evidence`.
 */
import { URL_LINK_TYPE } from '@/lib/blueprintTechDescriptions'
import type { CellLink, CellResource } from '@/types/blueprint'

/** A `resources` row as the board query selects it. */
export type RawCellResource = {
  position: number
  kind?: string | null
  name?: string | null
  url?: string | null
}

/** Resources from database rows, in the order the author put them. */
export function cellResourcesFromRows(
  rows: readonly RawCellResource[] | null | undefined,
): CellResource[] {
  if (!rows || rows.length === 0) return []

  return rows
    .filter((row) => (row.name ?? '').trim())
    .slice()
    // Sorted here rather than trusted: PostgREST does not promise an order
    // for an embedded resource, so the list would otherwise come back in
    // whatever order the planner chose.
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      name: row.name!.trim(),
      kind: row.kind?.trim() || 'link',
      url: row.url?.trim() || null,
    }))
}

/** Resources from a fallback blueprint's links, in array order. */
export function cellResourcesFromLinks(
  links: readonly CellLink[] | null | undefined,
): CellResource[] {
  if (!links || links.length === 0) return []

  return links.flatMap((link) => {
    if (link.type !== URL_LINK_TYPE) return []
    const url = link.url?.trim()
    if (!url) return []
    return [
      {
        // A link with no label still has to say something. The host is what
        // the editor falls back to when an author leaves the field empty, so
        // the two sources answer this the same way.
        name: link.label?.trim() || hostOf(url),
        kind: 'link',
        url,
      },
    ]
  })
}

/** The host of a url, for a resource nobody named. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Link'
  }
}
