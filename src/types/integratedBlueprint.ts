import type { BlueprintLayer, BlueprintStep } from '@/types/blueprint'
import type { PathType } from '@/types/database'

export const INTEGRATED_UNSELECTED_OPACITY = 0.18

export type IntegratedBlueprintStep = BlueprintStep & {
  pathStepIds: Record<string, string>
}

export type IntegratedBlueprintCell = {
  id: string
  layer_id: string
  step_id: string
  path_id: string
  path_type: PathType
  content: string
  opacity: number
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
  paths: Array<{ id: string; name: string; path_type: PathType }>
  layers: BlueprintLayer[]
  steps: IntegratedBlueprintStep[]
  cells: IntegratedBlueprintCell[]
  triggers: IntegratedBlueprintTrigger[]
}
