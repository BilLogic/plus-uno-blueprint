import { asEntityStatus } from '@/lib/entityStatus'
import {
  DISCOVERY_SCENARIO_ID,
} from '@/data/applicationHappyPathFallback'
import {
  getBlueprintFallback,
  getRawBlueprintFallback,
  WARM_UP_ALTERNATE_PATH_ID,
  WARM_UP_SCENARIO_ID,
} from '@/data/blueprintFallbacks'
import { applyBlueprintDisplayFilters } from '@/lib/applyBlueprintDisplayFilters'
import { repairDiscoverySadPathBlueprint } from '@/lib/repairDiscoverySadPathBlueprint'
import {
  repairWarmUpAlternatePathBlueprint,
  repairWarmUpPathLanePositions,
} from '@/lib/repairWarmUpAlternatePathBlueprint'
import { isBlueprintStepVisualPlaceholder } from '@/lib/blueprintVisualPlaceholder'
import {
  deduplicateBlueprintLanes,
  normalizeBlueprint,
  sortBlueprintLanes,
  type RawPath,
} from '@/lib/normalizeBlueprint'
import { cellResourcesFromLinks } from '@/lib/cellResources'
import type { BlueprintData } from '@/types/blueprint'
import type { CellLink, CellResource } from '@/types/blueprint'

export type BlueprintSource = 'database' | 'fallback' | null

export function isBlueprintEmpty(data: BlueprintData): boolean {
  return data.lanes.length === 0
}

function repairBlueprintLanePositionsFromFallback(
  data: BlueprintData,
  fallback: BlueprintData | null,
): BlueprintData {
  if (!fallback) {
    return sortBlueprintLanes(data)
  }

  return sortBlueprintLanes(
    repairWarmUpPathLanePositions(data, fallback.lanes),
  )
}

/** DB value wins when non-empty; fallback only fills empty/null fields. */
function preferNonEmpty(
  dbValue: string | null | undefined,
  fallbackValue: string | null | undefined,
): string | null {
  if (dbValue?.trim()) return dbValue
  return fallbackValue ?? dbValue ?? null
}

/**
 * DB-wins link merge: fallback links may fill empty fields on a link the DB
 * already has (matched by type + label) and append links the DB is missing
 * entirely. DB links are never removed or overwritten.
 */
function fillMissingCellLinks(
  links: CellLink[],
  fallbackLinks: CellLink[],
): CellLink[] {
  const fillField = (
    existing: string | undefined,
    fallbackValue: string | undefined,
  ): string | undefined => {
    if (existing?.trim()) return existing
    if (fallbackValue?.trim()) return fallbackValue
    return existing
  }

  const merged = links.map((link) => ({ ...link }))

  for (const fallbackLink of fallbackLinks) {
    const hasPayload =
      fallbackLink.url?.trim() ||
      fallbackLink.description?.trim() ||
      fallbackLink.picture?.trim() ||
      fallbackLink.pictures?.length
    if (!hasPayload) continue

    const existingIndex = merged.findIndex(
      (entry) =>
        entry.type === fallbackLink.type && entry.label === fallbackLink.label,
    )

    if (existingIndex === -1) {
      merged.push({ ...fallbackLink })
      continue
    }

    const existing = merged[existingIndex]!
    merged[existingIndex] = {
      ...existing,
      url: fillField(existing.url, fallbackLink.url),
      description: fillField(existing.description, fallbackLink.description),
      picture: fillField(existing.picture, fallbackLink.picture),
      pictures: existing.pictures?.length
        ? existing.pictures
        : fallbackLink.pictures?.length
          ? fallbackLink.pictures
          : existing.pictures,
    }
  }

  return merged
}

/**
 * DB-wins resource merge: fallback resources the database does not already
 * have, appended in order. Matched on name AND url, because a cell may
 * legitimately point at the same url twice under different names.
 *
 * The link merge above no longer reaches these. A database cell's resources
 * arrive as `resources` rows and its `links` is empty, so without this a dev
 * board with a stale database would show none of the fallback's resources —
 * which is exactly the gap `mergeMissingBlueprintContent` exists to fill.
 */
function fillMissingCellResources(
  resources: CellResource[],
  fallbackResources: CellResource[],
): CellResource[] {
  const merged = [...resources]
  for (const fallback of fallbackResources) {
    const present = merged.some(
      (entry) => entry.name === fallback.name && entry.url === fallback.url,
    )
    if (!present) merged.push({ ...fallback })
  }
  return merged
}

/**
 * Fill DB gaps from the fallback blueprint — DB wins.
 *
 * Merge policy (applies only when the blueprint source is 'database'):
 * - Field values already present in the DB (non-empty after trim) are kept.
 * - Fallback values only fill DB fields that are null/empty (a placeholder
 *   step visual counts as empty when the fallback has a real frame).
 * - Fallback lanes/cells/steps/dependencies/links that are entirely missing from
 *   the DB are appended; nothing in the DB is removed or repositioned.
 */
function mergeMissingBlueprintContent(
  data: BlueprintData,
  scenarioId: string | undefined,
  pathId: string | undefined,
): BlueprintData {
  const fallback = getBlueprintFallback(scenarioId, pathId ?? data.path.id)
  if (!fallback) return data

  const laneIds = new Set(data.lanes.map((lane) => lane.id))
  const laneIdByName = new Map(
    data.lanes.map((lane) => [lane.name, lane.id]),
  )
  const fallbackLaneIdRemap = new Map<string, string>()
  const lanes = [...data.lanes]
  for (const lane of fallback.lanes) {
    if (laneIds.has(lane.id)) continue

    const existingLaneId = laneIdByName.get(lane.name)
    if (existingLaneId) {
      fallbackLaneIdRemap.set(lane.id, existingLaneId)
      continue
    }

    lanes.push(lane)
    laneIds.add(lane.id)
    laneIdByName.set(lane.name, lane.id)
  }
  lanes.sort((a, b) => a.position - b.position)

  const fallbackCellById = new Map(
    fallback.cells.map((cell) => [cell.id, cell]),
  )

  const cellIds = new Set(data.cells.map((cell) => cell.id))
  let cellsChanged = false
  const cells = data.cells.map((cell) => {
    const fallbackCell = fallbackCellById.get(cell.id)
    if (!fallbackCell) return cell

    let changed = false
    let next = cell

    if (fallbackCell.frame?.trim()) {
      const cellFrame = cell.frame?.trim()
      if (
        !cellFrame ||
        (isBlueprintStepVisualPlaceholder(cellFrame) &&
          !isBlueprintStepVisualPlaceholder(fallbackCell.frame))
      ) {
        next = { ...next, frame: fallbackCell.frame }
        changed = true
      }
    }

    if (fallbackCell.summary?.trim() && !cell.summary?.trim()) {
      next = { ...next, summary: fallbackCell.summary }
      changed = true
    }

    if (fallbackCell.content.trim() && !cell.content.trim()) {
      next = { ...next, content: fallbackCell.content }
      changed = true
    }

    const mergedLinks = fillMissingCellLinks(cell.links, fallbackCell.links)
    if (JSON.stringify(mergedLinks) !== JSON.stringify(cell.links)) {
      next = { ...next, links: mergedLinks }
      changed = true
    }

    const mergedResources = fillMissingCellResources(
      cell.resources ?? [],
      fallbackCell.resources ?? cellResourcesFromLinks(fallbackCell.links),
    )
    if (JSON.stringify(mergedResources) !== JSON.stringify(cell.resources ?? [])) {
      next = { ...next, resources: mergedResources }
      changed = true
    }

    if (changed) cellsChanged = true
    return changed ? next : cell
  })
  for (const cell of fallback.cells) {
    if (cellIds.has(cell.id)) continue

    const laneId =
      fallbackLaneIdRemap.get(cell.lane_id) ?? cell.lane_id
    cells.push({ ...cell, lane_id: laneId })
    cellIds.add(cell.id)
  }

  const stepIds = new Set(data.steps.map((step) => step.id))
  const steps = [...data.steps]
  for (const step of fallback.steps) {
    if (!stepIds.has(step.id)) {
      steps.push(step)
    }
  }
  steps.sort((a, b) => a.position - b.position)

  const dependencyKeys = new Set(
    data.dependencies.map(
      (dependency) => `${dependency.source_cell_id}:${dependency.target_cell_id}`,
    ),
  )
  const dependencies = [...data.dependencies]
  for (const dependency of fallback.dependencies) {
    const key = `${dependency.source_cell_id}:${dependency.target_cell_id}`
    if (!dependencyKeys.has(key)) {
      dependencies.push(dependency)
      dependencyKeys.add(key)
    }
  }

  const changed =
    cellsChanged ||
    lanes.length !== data.lanes.length ||
    cells.length !== data.cells.length ||
    steps.length !== data.steps.length ||
    dependencies.length !== data.dependencies.length

  const merged = changed
    ? { ...data, lanes, cells, steps, dependencies }
    : data

  return deduplicateBlueprintLanes(merged)
}

// ---------------------------------------------------------------------------
// PLUS legacy repairs
//
// Instance-specific data fixups for the original PLUS content. Every repair
// below is gated on hardcoded PLUS scenario/path UUIDs (and the shims are
// additionally ID-gated internally), so foreign (non-PLUS) content provably
// never enters these code paths. The shim modules do not exist upstream and
// are quarantined here (scripts/template-quarantine.json), so a template
// merge can neither take them nor remove them — do not add new callers.
// ---------------------------------------------------------------------------

function applyPlusLegacyRepairs(
  data: BlueprintData,
  scenarioId: string | undefined,
  pathId: string | undefined,
  fallback: BlueprintData | null,
): BlueprintData {
  let repaired = data

  // Discovery sad path: move outcome cells onto their own step column
  // (shim is internally gated on APPLICATION_SAD_PATH_ID).
  if (scenarioId === DISCOVERY_SCENARIO_ID && fallback) {
    repaired = repairDiscoverySadPathBlueprint(repaired, fallback)
  }

  if (scenarioId === WARM_UP_SCENARIO_ID) {
    // Warm-Up alternate path: reassign cells to the correct swimlanes
    // (shim is internally gated on WARM_UP_ALTERNATE_PATH_ID).
    if (pathId === WARM_UP_ALTERNATE_PATH_ID) {
      repaired = repairWarmUpAlternatePathBlueprint(repaired)
    }

    // Warm-Up legacy DB drift: realign lane row positions to the fallback
    // reference swimlanes. Only for the Warm-Up scenario — DB row positions
    // win everywhere else.
    if (fallback) {
      repaired = repairWarmUpPathLanePositions(repaired, fallback.lanes)
    }
  }

  return repaired
}

function sortBlueprintSteps(data: BlueprintData): BlueprintData {
  return {
    ...data,
    steps: [...data.steps].sort(
      (a, b) => a.position - b.position,
    ),
  }
}

export function resolveBlueprintForScenario(
  scenarioId: string | undefined,
  rawPath: RawPath | null | undefined,
): { blueprint: BlueprintData | null; source: BlueprintSource } {
  const pathId = rawPath?.id
  const fallback = getBlueprintFallback(scenarioId, pathId)

  // PLUS legacy repair (see block above): the Warm-Up alternate path renders
  // from its curated fallback regardless of DB state. Gated on PLUS UUIDs.
  if (
    scenarioId === WARM_UP_SCENARIO_ID &&
    pathId === WARM_UP_ALTERNATE_PATH_ID &&
    fallback
  ) {
    const corrected = repairWarmUpAlternatePathBlueprint({
      ...fallback,
      path: rawPath
        ? {
            id: rawPath.id,
            name: fallback.path.name,
            summary:
              fallback.path.summary ?? rawPath.summary ?? null,
            note: fallback.path.note ?? rawPath.note ?? null,
            kind: rawPath.kind,
            status:
              asEntityStatus(rawPath.status) ?? fallback.path.status,
          }
        : fallback.path,
    })

    return {
      blueprint: applyBlueprintDisplayFilters(
        repairBlueprintLanePositionsFromFallback(corrected, fallback),
        scenarioId,
        pathId,
      ),
      source:
        rawPath && !isBlueprintEmpty(normalizeBlueprint(rawPath))
          ? 'database'
          : 'fallback',
    }
  }

  if (rawPath) {
    const fromDb = normalizeBlueprint(rawPath)
    if (!isBlueprintEmpty(fromDb)) {
      const merged = mergeMissingBlueprintContent(fromDb, scenarioId, pathId)
      const rawFallback = getRawBlueprintFallback(
        scenarioId,
        pathId,
        merged.path.kind,
      )
      // DB-wins path metadata: fallback only fills empty name/description/note.
      const blueprint = rawFallback
        ? {
            ...merged,
            path: {
              ...merged.path,
              name: merged.path.name.trim()
                ? merged.path.name
                : rawFallback.path.name,
              description: preferNonEmpty(
                merged.path.summary,
                rawFallback.path.summary,
              ),
              note: preferNonEmpty(merged.path.note, rawFallback.path.note),
            },
          }
        : merged

      return {
        blueprint: applyBlueprintDisplayFilters(
          sortBlueprintSteps(
            sortBlueprintLanes(
              applyPlusLegacyRepairs(blueprint, scenarioId, pathId, fallback),
            ),
          ),
          scenarioId,
          pathId,
        ),
        source: 'database',
      }
    }
  }

  if (fallback) {
    return {
      blueprint: applyBlueprintDisplayFilters(
        sortBlueprintSteps(
          repairBlueprintLanePositionsFromFallback(
            deduplicateBlueprintLanes(fallback),
            fallback,
          ),
        ),
        scenarioId,
        rawPath?.id ?? fallback.path.id,
      ),
      source: 'fallback',
    }
  }

  return { blueprint: null, source: null }
}
