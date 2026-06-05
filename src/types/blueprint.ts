import type { PathType } from '@/types/database'

export type BlueprintPath = {
  id: string
  name: string
  path_type: PathType
}

export type BlueprintLayer = {
  id: string
  name: string
  row_position: number
}

export type BlueprintStep = {
  id: string
  name: string
  column_position: number
}

export type BlueprintCell = {
  id: string
  layer_id: string
  step_id: string
  content: string
}

export type BlueprintCellTrigger = {
  id: string
  source_cell_id: string
  target_cell_id: string
}

export type BlueprintData = {
  path: BlueprintPath
  layers: BlueprintLayer[]
  steps: BlueprintStep[]
  cells: BlueprintCell[]
  triggers: BlueprintCellTrigger[]
}
