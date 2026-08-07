import type { IntegratedBlueprintTrigger } from '@/types/integratedBlueprint'

/**
 * Merged view (Compare v3, Phase 4b) — the pure derivations behind ONE
 * combined blueprint: one lane set, one canonical step axis, and per SLOT
 * (lane × canonical column) either one cell (every path agrees) or each
 * present path's cell(s) stacked inside that slot.
 *
 * This is a per-slot merge, so it is independent of the branch-canvas data
 * gate: it needs no long shared RUNS of columns (the measured median was
 * 13% spine coverage), only agreement inside individual slots. Cell height
 * grows exactly where paths disagree, and that vertical swell IS the diff
 * signal — no extra paint beyond the existing divergent-column tint.
 *
 * Every sub-cell keeps its own real `cellId`, so the 1:1 selection
 * machinery (`selectionContext`, `data-blueprint-cell`, focusCells/pulse,
 * agent `focus_cell`) keeps working unchanged. Nothing here invents a
 * composite id.
 */

/** One path's contribution to a merged slot. */
export type MergedSubCell = {
  readonly pathId: string
  /** That path's step id backing this canonical column. */
  readonly stepId: string
  /** Real cell ids — never merged, never synthesized (bar the visual-lane
   *  `visual-<stepId>` anchor the stacked grid already uses). */
  readonly cellIds: readonly string[]
}

/**
 * What one slot renders as.
 *
 * - `shared` — every compared path is present with the same merge
 *   signature, so ONE cell is drawn, exactly like a normal blueprint cell,
 *   with no path rail: it belongs to every path. `hidden` carries the
 *   paths the drawn cell stands in for (the arrow remap needs them).
 * - `split` — the paths disagree, or only some are present: each present
 *   path's cell(s) stack vertically inside the slot, each with a
 *   path-coloured rail. A single sub-cell is the 'only in one path' case.
 * - `empty` — no path has anything here.
 */
export type MergedSlotAssembly =
  | { readonly kind: 'empty' }
  | {
      readonly kind: 'shared'
      readonly representative: MergedSubCell
      readonly hidden: readonly MergedSubCell[]
    }
  | { readonly kind: 'split'; readonly subCells: readonly MergedSubCell[] }

/**
 * One path's candidate for a slot. `signature` is the MERGE signature —
 * the canvas fork condition is "content differs OR presence differs", so
 * callers pass the content-only signature: a detail-only difference (V7,
 * description/links only) must not fork the canvas, it lives in the ledger.
 */
export type MergedSlotCandidate = MergedSubCell & {
  readonly signature: string
}

/**
 * Assemble one slot. Sub-cells come out in `pathIds` order — the sidebar's
 * path selection order — so slot contents read in the same order as the
 * legend and never reshuffle between recomputes.
 */
export function assembleMergedSlot(
  pathIds: readonly string[],
  candidates: readonly MergedSlotCandidate[],
): MergedSlotAssembly {
  const byPathId = new Map(
    candidates.map((candidate) => [candidate.pathId, candidate]),
  )
  const present = pathIds
    .map((pathId) => byPathId.get(pathId))
    .filter((candidate): candidate is MergedSlotCandidate => candidate !== undefined)

  if (present.length === 0) return { kind: 'empty' }

  const allPresent = present.length === pathIds.length
  const agree = present.every(
    (candidate) => candidate.signature === present[0].signature,
  )
  if (allPresent && agree) {
    const [representative, ...hidden] = present
    return {
      kind: 'shared',
      representative: toSubCell(representative),
      hidden: hidden.map(toSubCell),
    }
  }
  return { kind: 'split', subCells: present.map(toSubCell) }
}

function toSubCell(candidate: MergedSlotCandidate): MergedSubCell {
  return {
    pathId: candidate.pathId,
    stepId: candidate.stepId,
    cellIds: candidate.cellIds,
  }
}

/**
 * Short per-path labels for the sub-cell rails — word initials ("Happy
 * Path" → HP), uppercased, deduplicated with a 1-based ordinal suffix so
 * two paths never share a label (the rail carries colour + dash too, but
 * the label must still be readable on its own).
 */
export function buildComparePathShortLabels(
  paths: ReadonlyArray<{ id: string; name: string }>,
): Map<string, string> {
  const labels = new Map<string, string>()
  const used = new Set<string>()
  paths.forEach((path, index) => {
    const initials = path.name
      .split(/\s+/)
      .map((word) => word.replace(/[^\p{L}\p{N}]/gu, '').charAt(0))
      .filter(Boolean)
      .join('')
      .toUpperCase()
      .slice(0, 3)
    const base = initials || `P${index + 1}`
    let label = base
    if (used.has(label)) label = `${base}${index + 1}`
    used.add(label)
    labels.set(path.id, label)
  })
  return labels
}

/**
 * How each path's trigger arrows map onto what the merged grid actually
 * renders.
 *
 * A shared slot draws ONE cell, so the other paths' cell ids have no DOM
 * anchor: their arrows would silently vanish at the overlay's
 * `querySelector`. Both fixes happen here, at the data level (the same
 * discipline as the folded-arrow drop):
 *
 * - `aliasByCellId` rewrites a hidden path's cell id to the id that is
 *   drawn, so the arrow anchors on the shared cell.
 * - `sharedCellIds` lets a caller drop an arrow whose BOTH endpoints are
 *   shared from every path but the first — one arrow between two shared
 *   cells belongs to every path, so drawing it N times just stacks N
 *   identical strokes with only the last one visible.
 */
export type MergedArrowRemap = {
  readonly aliasByCellId: ReadonlyMap<string, string>
  readonly sharedCellIds: ReadonlySet<string>
}

export function buildMergedArrowRemap(
  assemblies: Iterable<MergedSlotAssembly>,
): MergedArrowRemap {
  const aliasByCellId = new Map<string, string>()
  const sharedCellIds = new Set<string>()
  for (const assembly of assemblies) {
    if (assembly.kind !== 'shared') continue
    const drawn = assembly.representative.cellIds
    for (const cellId of drawn) sharedCellIds.add(cellId)
    for (const hidden of assembly.hidden) {
      hidden.cellIds.forEach((cellId, index) => {
        // Index-wise where the multiset lines up (equal signature ⇒ equal
        // count), else onto the drawn slot's first cell.
        aliasByCellId.set(cellId, drawn[index] ?? drawn[0])
        sharedCellIds.add(cellId)
      })
    }
  }
  return { aliasByCellId, sharedCellIds }
}

/**
 * Rewrite one path's triggers for the merged canvas: endpoints on hidden
 * shared cells move to the cell that is drawn, and a wholly-shared arrow
 * survives only for the primary path.
 */
export function remapMergedPathTriggers(
  triggers: readonly IntegratedBlueprintTrigger[],
  remap: MergedArrowRemap,
  isPrimaryPath: boolean,
): IntegratedBlueprintTrigger[] {
  const result: IntegratedBlueprintTrigger[] = []
  for (const trigger of triggers) {
    const sourceShared = remap.sharedCellIds.has(trigger.source_cell_id)
    const targetShared = remap.sharedCellIds.has(trigger.target_cell_id)
    if (sourceShared && targetShared && !isPrimaryPath) continue
    const source =
      remap.aliasByCellId.get(trigger.source_cell_id) ?? trigger.source_cell_id
    const target =
      remap.aliasByCellId.get(trigger.target_cell_id) ?? trigger.target_cell_id
    result.push(
      source === trigger.source_cell_id && target === trigger.target_cell_id
        ? trigger
        : { ...trigger, source_cell_id: source, target_cell_id: target },
    )
  }
  return result
}
