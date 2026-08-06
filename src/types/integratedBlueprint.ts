import type { BlueprintLayer, BlueprintStep, CellLink } from '@/types/blueprint'
import type { PathType } from '@/types/database'

export const INTEGRATED_UNSELECTED_OPACITY = 0.18

export type IntegratedBlueprintStep = BlueprintStep & {
  pathStepIds: Record<string, string>
}

/** Opacity for an integrated cell from path filter + whether the path uses this step column. */
export function getIntegratedCellDisplayOpacity(
  cell: IntegratedBlueprintCell,
  integratedStep: IntegratedBlueprintStep,
): number {
  if (!(cell.path_id in integratedStep.pathStepIds)) {
    return INTEGRATED_UNSELECTED_OPACITY
  }
  return cell.opacity
}

/**
 * How a cell relates to its counterparts across the compared paths.
 *
 * `shared` — every compared path holds this cell with the same text; one
 * copy is drawn, desaturated, as the spine. `divergent` — the paths disagree
 * here; each path's cell renders as a color-keyed band. `only` — exactly one
 * path has anything in this slot; hatched outline in that path's color.
 */
export type CompareStatus = 'shared' | 'divergent' | 'only'

export type IntegratedBlueprintCell = {
  id: string
  layer_id: string
  step_id: string
  path_id: string
  path_type: PathType
  content: string
  picture: string | null
  description: string | null
  links: CellLink[]
  opacity: number
  /** Set only in compare mode. */
  compare?: CompareStatus
}

export type IntegratedBlueprintTrigger = {
  id: string
  source_cell_id: string
  target_cell_id: string
  path_id: string
  path_type: PathType
  opacity: number
}

export type IntegratedBlueprintData = {
  paths: Array<{
    id: string
    name: string
    description: string | null
    note: string | null
    path_type: PathType
  }>
  layers: BlueprintLayer[]
  steps: IntegratedBlueprintStep[]
  cells: IntegratedBlueprintCell[]
  triggers: IntegratedBlueprintTrigger[]
}
