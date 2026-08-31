/**
 * A cell's touchpoints, resolved from whichever source the board came from.
 *
 * The database stores placements: one `cell_touchpoints` row per touchpoint
 * used at a cell, carrying its own summary, screenshot and url, joined to a
 * catalog entry that owns the name. Nothing has to match a string.
 *
 * The hand-written fallback blueprints in `src/data` predate all of that.
 * They carry a delimited list in `content` and a parallel array of
 * `tech_description` links keyed by label — the arrangement this ticket
 * retires, and the reason 57 of the 117 authored details in production
 * resolve to nothing. That data is not migrating, so the label join has to
 * survive somewhere, and it lives here rather than in the components: the
 * normalizer is already the seam between how a source stored something and
 * what the app renders, and every reader downstream then sees placements.
 *
 * A link that names nothing in its cell's content is DROPPED. Attaching it to
 * whatever the cell does show would be the guess that produced the orphans in
 * the first place; #180 is where a person places them deliberately.
 */
import { parseCellContentItems } from '@/lib/parseCellContent'
import { TECH_DESCRIPTION_LINK_TYPE } from '@/lib/blueprintTechDescriptions'
import type { CellLink, CellTouchpoint } from '@/types/blueprint'

/** A `cell_touchpoints` row as the board query selects it. */
export type RawCellTouchpoint = {
  position: number
  summary?: string | null
  screenshot?: string | null
  url?: string | null
  prominence?: string | null
  /** The joined catalog row. PostgREST names the embed after the table. */
  touchpoints: { name: string; kind?: string | null; url?: string | null } | null
}

/** Only the two values the placement's check constraint admits. */
function normalizeProminence(value: string | null | undefined) {
  return value === 'core' || value === 'peripheral' ? value : null
}

/** Placements from database rows, ordered by the position the author chose. */
export function cellTouchpointsFromRows(
  rows: readonly RawCellTouchpoint[] | null | undefined,
): CellTouchpoint[] {
  if (!rows || rows.length === 0) return []

  return rows
    .filter((row) => row.touchpoints?.name)
    .slice()
    // Sorted here rather than trusted: PostgREST does not promise an order
    // for an embedded resource, and the pills would otherwise come back in
    // whatever order the planner chose.
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      name: row.touchpoints!.name,
      kind: row.touchpoints!.kind ?? null,
      summary: row.summary ?? null,
      screenshot: row.screenshot ?? null,
      url: row.url ?? null,
      prominence: normalizeProminence(row.prominence),
    }))
}

/**
 * Placements from fallback content and links.
 *
 * The content string decides what exists and in what order — it is what the
 * board draws — and a link contributes detail only when its label is one of
 * those items.
 */
export function cellTouchpointsFromLinks(
  content: string | undefined,
  links: readonly CellLink[] | null | undefined,
): CellTouchpoint[] {
  const items = parseCellContentItems(content ?? '')
  if (items.length === 0) return []

  const detail = new Map<string, CellLink>()
  for (const link of links ?? []) {
    if (link.type !== TECH_DESCRIPTION_LINK_TYPE) continue
    if (!detail.has(link.label)) detail.set(link.label, link)
  }

  return items.map((name) => {
    const link = detail.get(name)
    return {
      name,
      // The fallback shape has nowhere to record a kind or a prominence, and
      // inventing either would make this source disagree with the database
      // for the same board.
      kind: null,
      summary: link?.description ?? null,
      screenshot: link?.picture ?? null,
      url: link?.url ?? null,
      prominence: null,
    }
  })
}
