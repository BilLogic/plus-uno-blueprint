/**
 * Keeping a cell's placements in step with the text an author just saved.
 *
 * The board reads placements, and `cells.content` is still what an author
 * types: a delimited list of touchpoint names. If a save writes the text and
 * leaves the placements alone, the two disagree from that moment on — which
 * is the same divergence, arrived at from the other direction, that left 57
 * authored details unreachable. So every content save recomputes them.
 *
 * The diff is pure and lives here so it can be tested without a database.
 * Three separate operations, and they are separate on purpose:
 *
 * - REMOVED names are deleted. Their per-moment summary and screenshot go
 *   with them, which is correct: the author took the touchpoint off this
 *   cell, and a placement for a touchpoint the cell no longer shows is
 *   precisely the orphan this work exists to end.
 * - ADDED names are inserted at their position.
 * - KEPT names may have MOVED. Their detail must survive the move, so they
 *   are repositioned rather than deleted and re-added — which would silently
 *   discard an author's writing every time they reordered two touchpoints.
 *
 * That last one is the whole reason this is a diff and not a delete-all
 * followed by an insert-all.
 */
import { parseCellContentItems } from '@/lib/parseCellContent'

export type TouchpointSyncPlan = {
  /** Names to place, with the position each takes. */
  added: { name: string; position: number }[]
  /** Names no longer in the text; their placements go. */
  removed: string[]
  /** Names that stayed but sit somewhere else now. */
  moved: { name: string; position: number }[]
}

/**
 * What must change for `content` to be the truth about this cell.
 *
 * Positions are 1-based to match the ordinality the import migration used,
 * so a cell migrated from content and a cell saved through the app number
 * their placements the same way.
 */
export function planTouchpointSync(
  content: string,
  existing: readonly { name: string; position: number }[],
): TouchpointSyncPlan {
  const names = parseCellContentItems(content)
  const before = new Map(existing.map((entry) => [entry.name, entry.position]))

  const added: { name: string; position: number }[] = []
  const moved: { name: string; position: number }[] = []
  const seen = new Set<string>()

  names.forEach((name, index) => {
    const position = index + 1
    // A name repeated in the text is one touchpoint, placed once. The table
    // says so too — `unique (cell_id, touchpoint_id)` — so the second
    // mention would be rejected rather than stored.
    if (seen.has(name)) return
    seen.add(name)

    const was = before.get(name)
    if (was === undefined) added.push({ name, position })
    else if (was !== position) moved.push({ name, position })
  })

  const removed = existing
    .map((entry) => entry.name)
    .filter((name) => !seen.has(name))

  return { added, removed, moved }
}
