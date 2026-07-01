import type { PathType } from '@/types/database'

export type BlueprintCellPathEntry = {
  cellId: string
  pathId: string
  pathName: string
  pathDescription?: string | null
  pathType: PathType
  content: string
  picture?: string | null
  description?: string | null
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
