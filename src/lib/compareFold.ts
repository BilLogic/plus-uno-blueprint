import type { CompareModel } from '@/lib/compareSlots'

/**
 * Fold (Compare v3, Phase 4a) — pure derivations behind the `[⇤ Fold]`
 * menubar toggle and the pleats that compress shared step columns.
 *
 * Fold state is per-scenario and session-only; it lives in
 * `compareReviewStore` and is deliberately MODE-AGNOSTIC: the same
 * folded/expanded facts drive per-band pleats in Stacked today and spine
 * pleats in Merged if the 4b gate ever passes. Everything here is
 * derived from the compare model + `computePinnedColumns` — never the
 * DOM — so "is this column folded?" has exactly one answer everywhere
 * (grid tracks, arrow filtering, the focus pipeline's auto-expand).
 */

export type CompareFoldState = {
  folded: boolean
  /** Pleat keys (fragment's first columnKey) the user re-expanded. */
  expandedPleats: ReadonlySet<string>
}

export const EMPTY_COMPARE_FOLD_STATE: CompareFoldState = {
  folded: false,
  expandedPleats: new Set(),
}

/**
 * One collapsible stretch of shared columns. A pinned column (one-hop
 * trigger/needs edge to a divergent cell — `computePinnedColumns`) never
 * folds, so it SPLITS its shared run: the fragments around it collapse,
 * the pin itself stays expanded as context.
 */
export type CompareFoldFragment = {
  /** Fragment identity = its first columnKey — also the pleat key. */
  key: string
  columnKeys: readonly string[]
  /** 1-based canonical column positions (the zone-label numbering). */
  startStep: number
  endStep: number
  firstLabel: string
  lastLabel: string
}

export function computeFoldableRunFragments(
  model: CompareModel,
  pinned: ReadonlySet<string>,
): CompareFoldFragment[] {
  const positionByKey = new Map(
    model.columns.map((column, index) => [column.columnKey, index + 1]),
  )
  const labelByKey = new Map(
    model.columns.map((column) => [column.columnKey, column.label]),
  )

  const fragments: CompareFoldFragment[] = []
  let current: string[] = []
  const flush = () => {
    if (current.length === 0) return
    const first = current[0]
    const last = current[current.length - 1]
    fragments.push({
      key: first,
      columnKeys: current,
      startStep: positionByKey.get(first) ?? 0,
      endStep: positionByKey.get(last) ?? 0,
      firstLabel: labelByKey.get(first) ?? first,
      lastLabel: labelByKey.get(last) ?? last,
    })
    current = []
  }

  for (const run of model.runs) {
    if (run.kind !== 'shared') {
      flush()
      continue
    }
    for (const columnKey of run.columnKeys) {
      if (pinned.has(columnKey)) flush()
      else current.push(columnKey)
    }
    flush()
  }
  flush()
  return fragments
}

/** Foldable column count — the menubar's "Fold N shared steps" N. */
export function countFoldableCompareColumns(
  model: CompareModel,
  pinned: ReadonlySet<string>,
): number {
  return computeFoldableRunFragments(model, pinned).reduce(
    (sum, fragment) => sum + fragment.columnKeys.length,
    0,
  )
}

/**
 * Fold is unavailable at zero differences (S7 — an unbroken board needs no
 * compression) and when no shared column survives the pin rule.
 */
export function isCompareFoldAvailable(
  model: CompareModel,
  pinned: ReadonlySet<string>,
): boolean {
  return (
    model.slots.some((slot) => slot.verdict !== 'shared') &&
    countFoldableCompareColumns(model, pinned) > 0
  )
}

/**
 * The display column axis under a fold state: each collapsed fragment
 * becomes ONE pleat track; expanded pleats, pinned columns and every
 * divergent/only column keep their normal column tracks.
 */
export type CompareDisplayTrack =
  | { kind: 'column'; columnKey: string }
  | { kind: 'pleat'; fragment: CompareFoldFragment }

export function buildCompareDisplayTracks(
  model: CompareModel,
  pinned: ReadonlySet<string>,
  fold: CompareFoldState,
): CompareDisplayTrack[] {
  if (!fold.folded) {
    return model.columns.map((column) => ({
      kind: 'column',
      columnKey: column.columnKey,
    }))
  }
  const fragmentByColumn = new Map<string, CompareFoldFragment>()
  for (const fragment of computeFoldableRunFragments(model, pinned)) {
    if (fold.expandedPleats.has(fragment.key)) continue
    for (const columnKey of fragment.columnKeys) {
      fragmentByColumn.set(columnKey, fragment)
    }
  }

  const tracks: CompareDisplayTrack[] = []
  const emitted = new Set<string>()
  for (const column of model.columns) {
    const fragment = fragmentByColumn.get(column.columnKey)
    if (!fragment) {
      tracks.push({ kind: 'column', columnKey: column.columnKey })
      continue
    }
    if (emitted.has(fragment.key)) continue
    emitted.add(fragment.key)
    tracks.push({ kind: 'pleat', fragment })
  }
  return tracks
}

/** Every columnKey currently hidden inside a collapsed pleat. */
export function computeFoldedColumnKeys(
  model: CompareModel,
  pinned: ReadonlySet<string>,
  fold: CompareFoldState,
): ReadonlySet<string> {
  const folded = new Set<string>()
  if (!fold.folded) return folded
  for (const fragment of computeFoldableRunFragments(model, pinned)) {
    if (fold.expandedPleats.has(fragment.key)) continue
    for (const columnKey of fragment.columnKeys) folded.add(columnKey)
  }
  return folded
}

/** Pleat label copy — `▸ N` on the track, the range in its tooltip. */
export function compareFoldPleatTitle(fragment: CompareFoldFragment): string {
  const count = fragment.columnKeys.length
  const range =
    fragment.firstLabel === fragment.lastLabel
      ? fragment.firstLabel
      : `${fragment.firstLabel} → ${fragment.lastLabel}`
  return `${count} identical ${count === 1 ? 'step' : 'steps'}: ${range}`
}

/**
 * Folded columns per path as step-id sets — the DATA-level input for arrow
 * filtering. Arrows with either endpoint on one of these steps are dropped
 * before render (a declared drop, not a silent DOM-anchor miss).
 */
export function computeFoldedStepIdsByPath(
  model: CompareModel,
  foldedColumnKeys: ReadonlySet<string>,
): ReadonlyMap<string, ReadonlySet<string>> {
  const byPath = new Map<string, Set<string>>()
  for (const column of model.columns) {
    if (!foldedColumnKeys.has(column.columnKey)) continue
    for (const [pathId, stepId] of Object.entries(column.stepIdByPath)) {
      let set = byPath.get(pathId)
      if (!set) {
        set = new Set()
        byPath.set(pathId, set)
      }
      set.add(stepId)
    }
  }
  return byPath
}

/**
 * Which pleats must open before a focus request can measure its targets:
 * every collapsed fragment holding a cell from `cellIds`. Empty when
 * nothing is folded — the caller flies immediately.
 */
export function computePleatsToExpandForCells(
  model: CompareModel,
  pinned: ReadonlySet<string>,
  fold: CompareFoldState,
  cellIds: readonly string[],
): string[] {
  if (!fold.folded || cellIds.length === 0) return []
  const folded = computeFoldedColumnKeys(model, pinned, fold)
  if (folded.size === 0) return []

  const columnByCellId = new Map<string, string>()
  for (const slot of model.slots) {
    for (const entry of Object.values(slot.perPath)) {
      if (!entry.present) continue
      for (const cellId of entry.cellIds) {
        columnByCellId.set(cellId, slot.columnKey)
      }
    }
  }

  const fragmentKeyByColumn = new Map<string, string>()
  for (const fragment of computeFoldableRunFragments(model, pinned)) {
    if (fold.expandedPleats.has(fragment.key)) continue
    for (const columnKey of fragment.columnKeys) {
      fragmentKeyByColumn.set(columnKey, fragment.key)
    }
  }

  const pleats: string[] = []
  for (const cellId of cellIds) {
    const columnKey = columnByCellId.get(cellId)
    if (!columnKey || !folded.has(columnKey)) continue
    const pleatKey = fragmentKeyByColumn.get(columnKey)
    if (pleatKey && !pleats.includes(pleatKey)) pleats.push(pleatKey)
  }
  return pleats
}

/**
 * Resolve the agent's `toggle_pleat` argument: a 1-based pleat index
 * (left to right) or any columnKey inside a fragment.
 */
export function resolveCompareFoldFragment(
  fragments: readonly CompareFoldFragment[],
  ref: string,
): CompareFoldFragment | null {
  const trimmed = ref.trim()
  if (/^\d+$/.test(trimmed)) {
    const index = Number(trimmed)
    return fragments[index - 1] ?? null
  }
  return (
    fragments.find((fragment) => fragment.columnKeys.includes(trimmed)) ?? null
  )
}
