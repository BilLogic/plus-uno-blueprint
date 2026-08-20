import { buildCellLookup, getCellAt } from '@/lib/normalizeBlueprint'
import { isBlueprintStepVisualPlaceholder } from '@/lib/blueprintVisualPlaceholder'
import { pickPreferredPath } from '@/lib/pathSelection'
import type { BlueprintData } from '@/types/blueprint'
import type { PathType } from '@/types/database'

export const VISUAL_WALKTHROUGH_LAYER_NAMES = [
  'Partner Action: Teacher',
  'Lead Tutor',
  'Regular Tutor',
] as const

export const VISUAL_LAYER_SHORT_LABELS: Record<string, string> = {
  'Partner Action: Teacher': 'Partner',
  'Lead Tutor': 'Lead Tutor',
  'Regular Tutor': 'Regular Tutor',
}

/** In-session artwork batches whose gray rounded frame is baked into the PNG. */
export function hasEmbeddedVisualFrame(picture: string): boolean {
  return (
    picture.includes('/warm-up/') ||
    picture.includes('/goal-setting/') ||
    picture.includes('/help-request/')
  )
}

export type VisualWalkthroughLayerEntry = {
  laneName: string
  content: string
  picture: string
}

export type VisualStepPictureEntry = {
  laneName: string
  label: string
  picture: string
  description: string
}

export type VisualWalkthroughStep = {
  stepIndex: number
  stepName: string
  layerEntries: VisualWalkthroughLayerEntry[]
  pictures: string[]
}

export type VisualWalkthroughSession = {
  pathId: string
  pathName: string
  pathDescription: string | null
  pathType: PathType
  scenarioName?: string
  phaseName?: string
  steps: VisualWalkthroughStep[]
}

export type VisualWalkthroughContextMeta = {
  scenarioName?: string
  phaseName?: string
}

export function filterWalkthroughBlueprints(
  blueprints: BlueprintData[],
): BlueprintData[] {
  return blueprints.filter(
    (blueprint) => buildVisualWalkthroughSession(blueprint).steps.length > 0,
  )
}

export function pickWalkthroughBlueprint(
  blueprints: BlueprintData[],
): BlueprintData | null {
  if (blueprints.length === 0) return null
  const preferredPath = pickPreferredPath(
    blueprints.map((blueprint) => blueprint.path),
  )
  return (
    blueprints.find((blueprint) => blueprint.path.id === preferredPath?.id) ??
    blueprints[0]
  )
}

type VisualPictureBlueprint = Pick<BlueprintData, 'lanes' | 'cells'>

function resolveCellDescription(cell: BlueprintData['cells'][number] | undefined): string {
  return cell?.summary?.trim() || cell?.content.trim() || ''
}

export function resolveVisualStepPictureEntries(
  blueprint: VisualPictureBlueprint,
  stepId: string,
): VisualStepPictureEntry[] {
  const cellLookup = buildCellLookup(blueprint.cells)
  const layerByName = new Map(blueprint.lanes.map((lane) => [lane.name, lane]))

  return VISUAL_WALKTHROUGH_LAYER_NAMES.flatMap((name) => {
    const lane = layerByName.get(name)
    if (!lane) return []
    const cell = getCellAt(cellLookup, lane.id, stepId)
    if (!cell?.content.trim()) return []
    const picture = cell.picture?.trim()
    if (!picture || isBlueprintStepVisualPlaceholder(picture)) return []
    return [
      {
        laneName: name,
        label: VISUAL_LAYER_SHORT_LABELS[name] ?? name,
        picture,
        description: resolveCellDescription(cell),
      },
    ]
  })
}

/** True when Partner, Lead Tutor, or Regular Tutor has a cell in this step. */
export function stepHasVisualWalkthroughLayerCells(
  blueprint: VisualPictureBlueprint,
  stepId: string,
): boolean {
  const cellLookup = buildCellLookup(blueprint.cells)
  const layerByName = new Map(blueprint.lanes.map((lane) => [lane.name, lane]))

  return VISUAL_WALKTHROUGH_LAYER_NAMES.some((name) => {
    const lane = layerByName.get(name)
    if (!lane) return false
    const cell = getCellAt(cellLookup, lane.id, stepId)
    return Boolean(cell?.content.trim())
  })
}

export function resolveVisualStepPictures(
  blueprint: VisualPictureBlueprint,
  stepId: string,
): string[] {
  return resolveVisualStepPictureEntries(blueprint, stepId).map(
    (entry) => entry.picture,
  )
}

export function buildVisualWalkthroughSession(
  blueprint: BlueprintData,
  meta?: VisualWalkthroughContextMeta,
): VisualWalkthroughSession {
  const steps = [...blueprint.steps]
    .sort((a, b) => a.position - b.position)
    .map((step, stepIndex) => {
      const pictureEntries = resolveVisualStepPictureEntries(blueprint, step.id)
      return {
        stepIndex,
        stepName: step.name,
        layerEntries: pictureEntries.map((entry) => ({
          laneName: entry.laneName,
          content: entry.description,
          picture: entry.picture,
        })),
        pictures: pictureEntries.map((entry) => entry.picture),
      }
    })
  return {
    pathId: blueprint.path.id,
    pathName: blueprint.path.name,
    pathDescription: blueprint.path.summary,
    pathType: blueprint.path.path_type,
    scenarioName: meta?.scenarioName?.trim() || undefined,
    phaseName: meta?.phaseName?.trim() || undefined,
    steps,
  }
}
