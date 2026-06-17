import type { PathType } from '@/types/database'

export type BlueprintCellPathEntry = {
  cellId: string
  pathId: string
  pathName: string
  pathType: PathType
  content: string
}

export type BlueprintCellSelection = {
  scenarioName: string
  layerName: string
  stepId: string
  stepName: string
  stepIndex: number
  /** Set when a single Front Stage Tech pill is selected. */
  techItem?: string
  paths: BlueprintCellPathEntry[]
}
