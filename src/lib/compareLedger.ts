import {
  isDetailOnlyCompareSlot,
  normalizeCompareName,
  type CompareModel,
  type CompareSlot,
  type CompareStatus,
} from '@/lib/compareSlots'

export { isDetailOnlyCompareSlot }

/**
 * Pure derivations behind the difference ledger and the divergence strip:
 * zone grouping (numbered ①②③ shared by strip, canvas, ledger and the
 * `jump_divergence` agent command), the detail-only split, and the
 * `[Filter ▾]` / `differences_filter` grammar. No DOM, no React — vitest
 * colocated.
 */

export type CompareZone = {
  /** 1-based — the shared ①②③ numbering. */
  index: number
  columnKeys: readonly string[]
  /** 1-based canonical column positions, e.g. "Steps 3–4" / "Step 6". */
  stepRangeLabel: string
  /** First → last column labels, e.g. "Pay → Callback" / "Rate". */
  titleLabel: string
  /** Canvas-difference slots in this zone (detail-only slots excluded). */
  slots: readonly CompareSlot[]
}

/** Ledger rows that render inside numbered zones (order preserved). */
function isZoneCompareSlot(slot: CompareSlot): boolean {
  return slot.verdict !== 'shared' && !isDetailOnlyCompareSlot(slot)
}

/**
 * Divergent runs → numbered zones, left-to-right. Zone slots keep the
 * model's column-then-lane order (a tested invariant upstream).
 */
export function deriveCompareZones(model: CompareModel): CompareZone[] {
  const columnPosition = new Map(
    model.columns.map((column, index) => [column.columnKey, index + 1]),
  )
  const columnLabel = new Map(
    model.columns.map((column) => [column.columnKey, column.label]),
  )

  const zones: CompareZone[] = []
  for (const run of model.runs) {
    if (run.kind !== 'divergent') continue
    const keys = run.columnKeys
    const start = columnPosition.get(keys[0]) ?? 0
    const end = columnPosition.get(keys[keys.length - 1]) ?? start
    const keySet = new Set(keys)
    const firstLabel = columnLabel.get(keys[0]) ?? ''
    const lastLabel = columnLabel.get(keys[keys.length - 1]) ?? firstLabel
    zones.push({
      index: zones.length + 1,
      columnKeys: keys,
      stepRangeLabel: start === end ? `Step ${start}` : `Steps ${start}–${end}`,
      titleLabel:
        firstLabel === lastLabel ? firstLabel : `${firstLabel} → ${lastLabel}`,
      slots: model.slots.filter(
        (slot) => keySet.has(slot.columnKey) && isZoneCompareSlot(slot),
      ),
    })
  }
  return zones
}

export function getDetailOnlyCompareSlots(
  model: CompareModel,
): CompareSlot[] {
  return model.slots.filter(isDetailOnlyCompareSlot)
}

/** The `[≠ N]` count — the ledger's authoritative completeness number. */
export function countCompareDifferences(model: CompareModel): number {
  return model.slots.filter((slot) => slot.verdict !== 'shared').length
}

export type CompareLedgerFilter = {
  /** Normalized lane keys; empty = all lanes. */
  lanes: readonly string[]
  /** Verdicts to keep; empty = all. */
  verdicts: readonly CompareStatus[]
}

export const EMPTY_COMPARE_LEDGER_FILTER: CompareLedgerFilter = {
  lanes: [],
  verdicts: [],
}

export type ParsedCompareLedgerFilter = CompareLedgerFilter & {
  /** Tokens the grammar rejected — callers report these verbatim. */
  errors: readonly string[]
}

const FILTER_TOKEN = /(lane|verdict):(?:"([^"]*)"|(\S+))/g
const FILTER_VERDICTS = new Set<CompareStatus>(['divergent', 'only'])

/**
 * The `differences_filter` mini-grammar: whitespace-separated
 * `lane:"Front Stage"` / `lane:frontstage` / `verdict:divergent` tokens,
 * multi-select per key; an empty string clears the filter. Lane values are
 * matched through the same normalization the compare model aligns lanes
 * with, so an agent may quote the display label or the key.
 */
export function parseCompareLedgerFilter(
  input: string,
): ParsedCompareLedgerFilter {
  const lanes: string[] = []
  const verdicts: CompareStatus[] = []
  const errors: string[] = []

  for (const match of input.matchAll(FILTER_TOKEN)) {
    const key = match[1]
    const value = (match[2] ?? match[3] ?? '').trim()
    if (key === 'lane') {
      const laneKey = normalizeCompareName(value)
      if (laneKey && !lanes.includes(laneKey)) lanes.push(laneKey)
      else if (!laneKey) errors.push(match[0])
      continue
    }
    const verdict = value.toLowerCase() as CompareStatus
    if (FILTER_VERDICTS.has(verdict)) {
      if (!verdicts.includes(verdict)) verdicts.push(verdict)
    } else {
      errors.push(match[0])
    }
  }

  // Anything left after removing matched tokens is an unparseable token.
  const leftovers = input
    .replace(FILTER_TOKEN, '')
    .split(/\s+/)
    .filter(Boolean)
  errors.push(...leftovers)

  return { lanes, verdicts, errors }
}

/** Apply a ledger filter; empty facets pass everything. */
export function filterCompareSlots<T extends CompareSlot>(
  slots: readonly T[],
  filter: CompareLedgerFilter,
): T[] {
  return slots.filter((slot) => {
    if (filter.lanes.length > 0 && !filter.lanes.includes(slot.laneKey)) {
      return false
    }
    if (
      filter.verdicts.length > 0 &&
      !filter.verdicts.includes(slot.verdict)
    ) {
      return false
    }
    return true
  })
}

/**
 * The fly-to target list for one ledger row: every present cell across
 * paths, first present path's first cell leading (the camera flies to the
 * first id; the rest pulse as counterparts).
 */
export function compareSlotFocusCellIds(slot: CompareSlot): string[] {
  const ids: string[] = []
  for (const entry of Object.values(slot.perPath)) {
    if (entry.present) ids.push(...entry.cellIds)
  }
  return ids
}

/** The fly-to target list for a zone: its first divergent slot's cells. */
export function compareZoneFocusCellIds(zone: CompareZone): string[] {
  const first = zone.slots[0]
  return first ? compareSlotFocusCellIds(first) : []
}
