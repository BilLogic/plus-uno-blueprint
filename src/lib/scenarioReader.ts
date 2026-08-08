import type {
  BlueprintCell,
  BlueprintData,
  BlueprintLayer,
} from '@/types/blueprint'
import { buildCellLookup, getCellsAt } from '@/lib/normalizeBlueprint'

/**
 * The mobile reader's decomposition of one path's blueprint: the 2-D board
 * folded into a 1-D journey. Time (steps) becomes the outer sequence; the
 * lane axis survives inside each step as two bands split by the line of
 * visibility. Same grid, different projection — nothing here invents
 * structure the canvas does not already draw.
 */

export type ReaderSide = 'frontstage' | 'backstage'

export type ReaderLaneEntry = {
  layer: BlueprintLayer
  cells: BlueprintCell[]
}

export type ReaderStep = {
  id: string
  /** 1-based journey position — steps ARE an ordered sequence in time. */
  index: number
  name: string
  /** Above the line: customer + frontstage lanes, in row order. */
  frontstage: ReaderLaneEntry[]
  /** Below the line: backstage + support lanes, in row order. */
  backstage: ReaderLaneEntry[]
  /** Step ids this step's cells trigger into (forward arrows only). */
  triggersTo: string[]
}

export type ScenarioReaderModel = {
  pathId: string
  pathName: string
  steps: ReaderStep[]
}

/** Which side of the line of visibility a lane draws on. Unknown or generic
 * lanes read as frontstage — the reader must never hide a lane it cannot
 * classify. */
export function readerSideForRole(role: string | null | undefined): ReaderSide {
  if (!role) return 'frontstage'
  return role.startsWith('backstage') || role.startsWith('support')
    ? 'backstage'
    : 'frontstage'
}

export function buildScenarioReaderModel(
  blueprint: BlueprintData,
): ScenarioReaderModel {
  const lookup = buildCellLookup(blueprint.cells)
  const layers = [...blueprint.layers].sort(
    (a, b) => a.row_position - b.row_position,
  )
  const steps = [...blueprint.steps].sort(
    (a, b) => a.column_position - b.column_position,
  )

  const stepIdByCellId = new Map<string, string>()
  for (const cell of blueprint.cells) stepIdByCellId.set(cell.id, cell.step_id)

  return {
    pathId: blueprint.path.id,
    pathName: blueprint.path.name,
    steps: steps.map((step, position) => {
      const frontstage: ReaderLaneEntry[] = []
      const backstage: ReaderLaneEntry[] = []
      for (const layer of layers) {
        const cells = getCellsAt(lookup, layer.id, step.id)
        if (cells.length === 0) continue
        const entry = { layer, cells }
        if (readerSideForRole(layer.role) === 'backstage') backstage.push(entry)
        else frontstage.push(entry)
      }

      // Forward triggers only: the reader scrolls down through time, so only
      // arrows that point at a LATER step earn a connector. Same-step and
      // backward edges stay panel-only, exactly like `needs` on the canvas.
      const triggersTo: string[] = []
      for (const trigger of blueprint.triggers) {
        if ((trigger.kind ?? 'trigger') !== 'trigger') continue
        const sourceStepId = stepIdByCellId.get(trigger.source_cell_id)
        if (sourceStepId !== step.id) continue
        const targetStepId = stepIdByCellId.get(trigger.target_cell_id)
        if (!targetStepId || targetStepId === step.id) continue
        const targetPosition = steps.findIndex((s) => s.id === targetStepId)
        if (targetPosition > position && !triggersTo.includes(targetStepId))
          triggersTo.push(targetStepId)
      }

      return {
        id: step.id,
        index: position + 1,
        name: step.name,
        frontstage,
        backstage,
        triggersTo,
      }
    }),
  }
}
