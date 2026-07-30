import {
  getBlueprintFallback,
  getFallbackPathsForScenario,
} from '@/data/blueprintFallbacks'
import { resolveBlueprintCellId } from '@/lib/resolveBlueprintCellId'
import { FALLBACK_NAV, getBlueprintScenarioId } from '@/types/nav'
import type { BlueprintData } from '@/types/blueprint'
import type { Json, SliceItem } from '@/types/database'

/** Cell ids across a slice's items, in frame order then in-frame order. */
export function orderedSliceCellIds(items: readonly SliceItem[]): string[] {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .flatMap((item) => item.cell_ids)
}

/** Scan the local fallback registry for the scenario owning these cells. */
export function findFallbackScenarioForCells(
  cellIds: readonly string[],
): string | null {
  if (cellIds.length === 0) return null
  const wanted = new Set(cellIds.map(resolveBlueprintCellId))

  for (const slide of FALLBACK_NAV) {
    const scenarioId = getBlueprintScenarioId(slide)
    if (!scenarioId) continue
    for (const path of getFallbackPathsForScenario(scenarioId)) {
      const blueprint = getBlueprintFallback(scenarioId, path.id, path.path_type)
      if (blueprint?.cells.some((cell) => wanted.has(cell.id))) {
        return scenarioId
      }
    }
  }

  return null
}

/** The scenario blueprint containing the most of the slice's cells. */
export function pickBlueprintForCells(
  blueprints: readonly BlueprintData[],
  cellIds: readonly string[],
): BlueprintData | null {
  let best: BlueprintData | null = null
  let bestCount = 0

  for (const blueprint of blueprints) {
    const ids = new Set(blueprint.cells.map((cell) => cell.id))
    const count = cellIds.filter((cellId) =>
      ids.has(resolveBlueprintCellId(cellId)),
    ).length
    if (count > bestCount) {
      best = blueprint
      bestCount = count
    }
  }

  return best
}

export type SliceCellPlacement = {
  /** Canonical blueprint cell id (integrated overlay ids resolved). */
  cellId: string
  /** 1-based sequence number across the slice; dangling cells are skipped. */
  order: number
  layerId: string
  stepIndex: number
  /** Index of the owning frame in position-sorted slice items. */
  itemIndex: number
}

export type SliceCellResolution = {
  placements: SliceCellPlacement[]
  /** Slice cell ids that no longer resolve in the rendered blueprint. */
  missingCellIds: string[]
  /** Raw + resolved member ids, for `data-slice-member` matching. */
  memberCellIds: ReadonlySet<string>
  /**
   * Raw + resolved member id → 1-based sequence number (tombstones skipped),
   * for the badge each member cell renders on its own corner.
   */
  sequenceByCellId: ReadonlyMap<string, number>
}

/** Place a slice's cells on one blueprint; unresolvable ids become tombstones. */
export function resolveSliceCells(
  blueprint: BlueprintData | null,
  items: readonly SliceItem[],
): SliceCellResolution {
  const sorted = [...items].sort((a, b) => a.position - b.position)
  const cellById = new Map(
    (blueprint?.cells ?? []).map((cell) => [cell.id, cell]),
  )
  const stepIndexById = new Map(
    (blueprint?.steps ?? []).map((step, index) => [step.id, index]),
  )

  const placements: SliceCellPlacement[] = []
  const missingCellIds: string[] = []
  const memberCellIds = new Set<string>()
  const sequenceByCellId = new Map<string, number>()
  let order = 0

  sorted.forEach((item, itemIndex) => {
    for (const rawCellId of item.cell_ids) {
      const cellId = resolveBlueprintCellId(rawCellId)
      const cell = cellById.get(cellId)
      const stepIndex = cell ? stepIndexById.get(cell.step_id) : undefined
      if (!cell || stepIndex === undefined) {
        missingCellIds.push(rawCellId)
        continue
      }
      order += 1
      placements.push({
        cellId,
        order,
        layerId: cell.layer_id,
        stepIndex,
        itemIndex,
      })
      memberCellIds.add(cellId)
      memberCellIds.add(rawCellId)
      sequenceByCellId.set(cellId, order)
      sequenceByCellId.set(rawCellId, order)
    }
  })

  return { placements, missingCellIds, memberCellIds, sequenceByCellId }
}

export type SliceIllustration = {
  src: string
  updatedAt: string | null
}

/** Validated illustration JSON — `https://` or `/storyboards/` sources only. */
export function parseSliceIllustration(
  value: Json | null,
): SliceIllustration | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const src = value.src
  if (typeof src !== 'string') return null
  if (!src.startsWith('https://') && !src.startsWith('/storyboards/')) {
    return null
  }
  const updatedAt = value.updated_at
  return { src, updatedAt: typeof updatedAt === 'string' ? updatedAt : null }
}

/** Illustration URL with a `?v=` cache-buster when `updated_at` is present. */
export function sliceIllustrationUrl(illustration: SliceIllustration): string {
  return illustration.updatedAt
    ? `${illustration.src}?v=${encodeURIComponent(illustration.updatedAt)}`
    : illustration.src
}
