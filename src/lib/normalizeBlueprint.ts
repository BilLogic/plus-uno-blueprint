import type {
  BlueprintCell,
  BlueprintCellTrigger,
  BlueprintData,
  BlueprintLayer,
  BlueprintStep,
} from '@/types/blueprint'
import type { PathType, Json } from '@/types/database'
import { normalizeCellLinks } from '@/lib/cellMetadata'

type RawOutgoingTrigger = {
  id: string
  target_cell_id: string
}

export type RawCell = {
  id: string
  layer_id: string
  step_id: string
  content: string
  picture?: string | null
  description?: string | null
  links?: Json | null
  outgoing?: RawOutgoingTrigger[] | null
}

type RawPathStep = {
  column_position: number
  steps: { id: string; name: string } | null
}

export type RawPath = {
  id: string
  name: string
  description?: string | null
  path_type: PathType
  layers?: BlueprintLayer[] | null
  /** @deprecated Legacy shape; use path_steps */
  steps?: BlueprintStep[] | null
  path_steps?: RawPathStep[] | null
  cells?: RawCell[] | null
  cell_triggers?: BlueprintCellTrigger[] | null
}

/** Flatten path_steps junction rows into blueprint steps sorted by column. */
export function flattenPathSteps(raw: RawPathStep[]): BlueprintStep[] {
  return [...raw]
    .sort((a, b) => a.column_position - b.column_position)
    .flatMap((row) => {
      if (!row.steps) return []
      return [
        {
          id: row.steps.id,
          name: row.steps.name,
          column_position: row.column_position,
        },
      ]
    })
}

function resolveSteps(raw: RawPath): BlueprintStep[] {
  if (raw.path_steps && raw.path_steps.length > 0) {
    return flattenPathSteps(raw.path_steps)
  }
  return [...(raw.steps ?? [])].sort(
    (a, b) => a.column_position - b.column_position,
  )
}

function flattenTriggersFromCells(cells: RawCell[]): BlueprintCellTrigger[] {
  const triggers: BlueprintCellTrigger[] = []
  for (const cell of cells) {
    for (const outgoing of cell.outgoing ?? []) {
      triggers.push({
        id: outgoing.id,
        source_cell_id: cell.id,
        target_cell_id: outgoing.target_cell_id,
      })
    }
  }
  return triggers
}

export function normalizeBlueprint(raw: RawPath): BlueprintData {
  const layers = [...(raw.layers ?? [])].sort(
    (a, b) => a.row_position - b.row_position,
  )
  const steps = resolveSteps(raw)
  const rawCells = raw.cells ?? []
  const cells: BlueprintCell[] = rawCells.map((cell) => ({
    id: cell.id,
    layer_id: cell.layer_id,
    step_id: cell.step_id,
    content: cell.content,
    picture: cell.picture ?? null,
    description: cell.description ?? null,
    links: normalizeCellLinks(cell.links),
  }))
  const triggers =
    raw.cell_triggers && raw.cell_triggers.length > 0
      ? raw.cell_triggers
      : flattenTriggersFromCells(rawCells)

  return {
    path: {
      id: raw.id,
      name: raw.name,
      description: raw.description ?? null,
      path_type: raw.path_type,
    },
    layers,
    steps,
    cells,
    triggers,
  }
}

export function buildCellLookup(cells: BlueprintCell[]): Map<string, BlueprintCell> {
  const map = new Map<string, BlueprintCell>()
  for (const cell of cells) {
    map.set(`${cell.layer_id}:${cell.step_id}`, cell)
  }
  return map
}

export function getCellAt(
  lookup: Map<string, BlueprintCell>,
  layerId: string,
  stepId: string,
): BlueprintCell | undefined {
  return lookup.get(`${layerId}:${stepId}`)
}
