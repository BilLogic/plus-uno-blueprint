import { ENTITY_STATUS, type EntityStatus } from '@/lib/entityStatus'
import type {
  BlueprintCell,
  BlueprintCellDependency,
  BlueprintData,
  BlueprintLane,
  BlueprintStep,
} from '@/types/blueprint'
import type { PathType, Json } from '@/types/database'
import { normalizeCellLinks } from '@/lib/cellMetadata'

type RawOutgoingDependency = {
  id: string
  target_cell_id: string
  /** Fallback data omits these — default kind 'leads_to', label/note null. */
  kind?: string | null
  label?: string | null
  note?: string | null
}

/** Normalize a raw kind column value; anything unknown is a plain dependency. */
function normalizeDependencyKind(kind: string | null | undefined): 'leads_to' | 'enables' {
  return kind === 'enables' ? 'enables' : 'leads_to'
}

export type RawCell = {
  id: string
  lane_id: string
  step_id: string
  position?: number | null
  content: string
  picture?: string | null
  summary?: string | null
  status?: string | null
  links?: Json | null
  outgoing?: RawOutgoingDependency[] | null
}

type RawPathStep = {
  position: number
  steps: { id: string; name: string; summary?: string | null } | null
}

export type RawLane = {
  id: string
  name: string
  position: number
  /** Semantic role column as selected from the DB. */
  lane_role?: string | null
  /** Normalized shape (fallback data passes BlueprintLane directly). */
  role?: string | null
}

export type RawPath = {
  id: string
  name: string
  summary?: string | null
  note?: string | null
  path_type: PathType
  lanes?: RawLane[] | null
  /** @deprecated Legacy shape; use path_steps */
  steps?: BlueprintStep[] | null
  path_steps?: RawPathStep[] | null
  cells?: RawCell[] | null
  cell_dependencies?: BlueprintCellDependency[] | null
}

/** Flatten path_steps junction rows into blueprint steps sorted by column. */
export function flattenPathSteps(raw: RawPathStep[]): BlueprintStep[] {
  return [...raw]
    .sort((a, b) => a.position - b.position)
    .flatMap((row) => {
      if (!row.steps) return []
      return [
        {
          id: row.steps.id,
          name: row.steps.name,
          position: row.position,
          summary: row.steps.summary ?? null,
        },
      ]
    })
}

function resolveSteps(raw: RawPath): BlueprintStep[] {
  if (raw.path_steps && raw.path_steps.length > 0) {
    return flattenPathSteps(raw.path_steps)
  }
  return [...(raw.steps ?? [])].sort(
    (a, b) => a.position - b.position,
  )
}

function flattenDependenciesFromCells(cells: RawCell[]): BlueprintCellDependency[] {
  const dependencies: BlueprintCellDependency[] = []
  for (const cell of cells) {
    for (const outgoing of cell.outgoing ?? []) {
      dependencies.push({
        id: outgoing.id,
        source_cell_id: cell.id,
        target_cell_id: outgoing.target_cell_id,
        kind: normalizeDependencyKind(outgoing.kind),
        label: outgoing.label ?? null,
        note: outgoing.note ?? null,
      })
    }
  }
  return dependencies
}

/** Collapse duplicate swim lanes that share a name (e.g. legacy + fallback lane IDs). */
export function deduplicateBlueprintLayers(data: BlueprintData): BlueprintData {
  const layersByName = new Map<string, BlueprintLane[]>()
  for (const lane of data.lanes) {
    const group = layersByName.get(lane.name) ?? []
    group.push(lane)
    layersByName.set(lane.name, group)
  }

  const duplicateGroups = [...layersByName.values()].filter(
    (group) => group.length > 1,
  )
  if (duplicateGroups.length === 0) {
    return data
  }

  const cellCountByLayerId = new Map<string, number>()
  for (const cell of data.cells) {
    cellCountByLayerId.set(
      cell.lane_id,
      (cellCountByLayerId.get(cell.lane_id) ?? 0) + 1,
    )
  }

  const layerIdRemap = new Map<string, string>()
  const keptLayers: BlueprintLane[] = []

  for (const group of layersByName.values()) {
    if (group.length === 1) {
      keptLayers.push(group[0])
      continue
    }

    const canonical = [...group].sort((a, b) => {
      const cellDiff =
        (cellCountByLayerId.get(b.id) ?? 0) -
        (cellCountByLayerId.get(a.id) ?? 0)
      if (cellDiff !== 0) return cellDiff
      return a.position - b.position
    })[0]

    keptLayers.push({
      ...canonical,
      position: Math.min(...group.map((lane) => lane.position)),
    })

    for (const lane of group) {
      if (lane.id !== canonical.id) {
        layerIdRemap.set(lane.id, canonical.id)
      }
    }
  }

  const cellByLayerStep = new Map<string, BlueprintCell>()
  for (const cell of data.cells) {
    const laneId = layerIdRemap.get(cell.lane_id) ?? cell.lane_id
    const key = `${laneId}:${cell.step_id}`
    const existing = cellByLayerStep.get(key)
    const nextCell = { ...cell, lane_id: laneId }

    if (!existing) {
      cellByLayerStep.set(key, nextCell)
      continue
    }

    if (!existing.content.trim() && nextCell.content.trim()) {
      cellByLayerStep.set(key, nextCell)
    }
  }

  const cells = [...cellByLayerStep.values()]
  const cellIds = new Set(cells.map((cell) => cell.id))
  const dependencies = data.dependencies.filter(
    (dependency) =>
      cellIds.has(dependency.source_cell_id) &&
      cellIds.has(dependency.target_cell_id),
  )

  keptLayers.sort((a, b) => a.position - b.position)

  return { ...data, lanes: keptLayers, cells, dependencies }
}

export function sortBlueprintLayers(data: BlueprintData): BlueprintData {
  const lanes = [...data.lanes].sort(
    (a, b) => a.position - b.position,
  )
  const unchanged = lanes.every(
    (lane, index) => lane.id === data.lanes[index]?.id,
  )
  return unchanged ? data : { ...data, lanes }
}

export function normalizeBlueprint(raw: RawPath): BlueprintData {
  const lanes: BlueprintLane[] = [...(raw.lanes ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((lane) => ({
      id: lane.id,
      name: lane.name,
      role: lane.lane_role ?? lane.role ?? null,
      position: lane.position,
    }))
  const steps = resolveSteps(raw)
  const rawCells = raw.cells ?? []
  const cells: BlueprintCell[] = rawCells.map((cell) => ({
    id: cell.id,
    lane_id: cell.lane_id,
    step_id: cell.step_id,
    // Without this the slot sort below is `0 - 0` for every pair, and the
    // 63 slots that hold more than one cell render in whatever order the
    // database happened to return. Selected since the tech-cell split in
    // August, typed on BlueprintCell, sorted on — and never mapped.
    position: cell.position ?? 0,
    content: cell.content,
    picture: cell.picture ?? null,
    summary: cell.summary ?? null,
    // Narrowed rather than passed through: the column is a plain text with a
    // check constraint, so a value the renderer has no treatment for should
    // read as shipped rather than as an unrecognised marker.
    status: (ENTITY_STATUS as readonly string[]).includes(cell.status ?? '')
      ? (cell.status as EntityStatus)
      : null,
    links: normalizeCellLinks(cell.links),
  }))
  const dependencies =
    raw.cell_dependencies && raw.cell_dependencies.length > 0
      ? raw.cell_dependencies.map((dependency) => ({
          ...dependency,
          kind: normalizeDependencyKind(dependency.kind),
          label: dependency.label ?? null,
          note: dependency.note ?? null,
        }))
      : flattenDependenciesFromCells(rawCells)

  return sortBlueprintLayers({
    path: {
      id: raw.id,
      name: raw.name,
      summary: raw.summary ?? null,
      note: raw.note ?? null,
      path_type: raw.path_type,
    },
    lanes,
    steps,
    cells,
    dependencies,
  })
}

/**
 * Cells by slot. A slot — one lane, one step — holds a *list*: tech lanes
 * carry one cell per touchpoint (`position` orders them), and the old
 * single-cell map silently dropped every sibling but the last, which is the
 * kind of data loss that never throws. Non-tech lanes still hold one.
 */
export function buildCellLookup(
  cells: BlueprintCell[],
): Map<string, BlueprintCell[]> {
  const map = new Map<string, BlueprintCell[]>()
  for (const cell of cells) {
    const key = `${cell.lane_id}:${cell.step_id}`
    const slot = map.get(key)
    if (slot) slot.push(cell)
    else map.set(key, [cell])
  }
  for (const slot of map.values()) {
    slot.sort(
      (left, right) => (left.position ?? 0) - (right.position ?? 0),
    )
  }
  return map
}

/** Every cell in the slot, in `position` order. */
export function getCellsAt(
  lookup: Map<string, BlueprintCell[]>,
  laneId: string,
  stepId: string,
): BlueprintCell[] {
  return lookup.get(`${laneId}:${stepId}`) ?? []
}

/**
 * The slot's first cell — the right question for non-tech lanes, which hold
 * at most one, and for anything that needs "the" cell of a slot (arrows,
 * upserts, walkthroughs target slot position 0).
 */
export function getCellAt(
  lookup: Map<string, BlueprintCell[]>,
  laneId: string,
  stepId: string,
): BlueprintCell | undefined {
  return lookup.get(`${laneId}:${stepId}`)?.[0]
}
