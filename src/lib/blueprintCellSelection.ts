import { parseCellContentItems } from '@/lib/parseCellContent'
import type { PathType } from '@/types/database'
import type { BlueprintCellSelection } from '@/types/blueprintCellDetail'

export type BlueprintCellSelectionContext = {
  scenarioName: string
  layerName: string
  stepId: string
  stepName: string
  stepIndex: number
  cellId: string
  cellContent: string
  cellPicture?: string | null
  cellDescription?: string | null
  pathId: string
  pathName: string
  pathDescription?: string | null
  pathType: PathType
}

export function buildBlueprintCellSelection(
  context: BlueprintCellSelectionContext,
): BlueprintCellSelection {
  return {
    scenarioName: context.scenarioName,
    layerName: context.layerName,
    stepId: context.stepId,
    stepName: context.stepName,
    stepIndex: context.stepIndex,
    paths: [
      {
        cellId: context.cellId,
        pathId: context.pathId,
        pathName: context.pathName,
        pathDescription: context.pathDescription ?? null,
        pathType: context.pathType,
        content: context.cellContent,
        picture: context.cellPicture ?? null,
        description: context.cellDescription ?? null,
      },
    ],
  }
}

export function buildTechPillSelection(
  context: BlueprintCellSelectionContext,
  techItem: string,
): BlueprintCellSelection {
  return {
    scenarioName: context.scenarioName,
    layerName: context.layerName,
    stepId: context.stepId,
    stepName: context.stepName,
    stepIndex: context.stepIndex,
    techItem,
    paths: [
      {
        cellId: context.cellId,
        pathId: context.pathId,
        pathName: context.pathName,
        pathDescription: context.pathDescription ?? null,
        pathType: context.pathType,
        content: techItem,
        description: context.cellDescription ?? null,
      },
    ],
  }
}

export function getTechPillItems(content: string | undefined): string[] {
  return parseCellContentItems(content ?? '')
}

export function isSameBlueprintCellSelection(
  current: BlueprintCellSelection | null,
  next: BlueprintCellSelection,
): boolean {
  if (!current) return false
  if (current.scenarioName !== next.scenarioName) return false
  if (current.layerName !== next.layerName) return false
  if (current.stepName !== next.stepName) return false
  if (current.stepIndex !== next.stepIndex) return false
  if ((current.techItem ?? null) !== (next.techItem ?? null)) return false
  if (current.paths.length !== next.paths.length) return false

  return current.paths.every(
    (entry, index) => entry.cellId === next.paths[index]?.cellId,
  )
}
