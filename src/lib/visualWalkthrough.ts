import { buildCellLookup, getCellAt } from '@/lib/normalizeBlueprint'
import { isBlueprintStepVisualPlaceholder } from '@/lib/blueprintVisualPlaceholder'
import { pickPreferredPath } from '@/lib/pathSelection'
import type { BlueprintData } from '@/types/blueprint'
import type { PathKind } from '@/types/database'

export const VISUAL_WALKTHROUGH_LANE_NAMES = [
  'Teacher',
  'Lead Tutor',
  'Regular Tutor',
] as const

export const VISUAL_LANE_SHORT_LABELS: Record<string, string> = {
  Teacher: 'Teacher',
  'Lead Tutor': 'Lead Tutor',
  'Regular Tutor': 'Regular Tutor',
}

/** In-session artwork batches whose gray rounded frame is baked into the PNG. */
export function hasEmbeddedVisualFrame(frame: string): boolean {
  return (
    frame.includes('/warm-up/') ||
    frame.includes('/goal-setting/') ||
    frame.includes('/help-request/')
  )
}

export type VisualWalkthroughLaneEntry = {
  laneName: string
  content: string
  frame: string
}

export type StoryboardFrameEntry = {
  laneName: string
  label: string
  frame: string
  description: string
}

export type VisualWalkthroughStep = {
  stepIndex: number
  stepName: string
  laneEntries: VisualWalkthroughLaneEntry[]
  frames: string[]
}

export type VisualWalkthroughSession = {
  pathId: string
  pathName: string
  pathDescription: string | null
  pathKind: PathKind
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

type StoryboardBlueprint = Pick<BlueprintData, 'lanes' | 'cells'>

function resolveCellDescription(cell: BlueprintData['cells'][number] | undefined): string {
  return cell?.summary?.trim() || cell?.content.trim() || ''
}

export function resolveStoryboardStripEntries(
  blueprint: StoryboardBlueprint,
  stepId: string,
): StoryboardFrameEntry[] {
  const cellLookup = buildCellLookup(blueprint.cells)
  const laneByName = new Map(blueprint.lanes.map((lane) => [lane.name, lane]))

  return VISUAL_WALKTHROUGH_LANE_NAMES.flatMap((name) => {
    const lane = laneByName.get(name)
    if (!lane) return []
    const cell = getCellAt(cellLookup, lane.id, stepId)
    if (!cell?.content.trim()) return []
    const frame = cell.frame?.trim()
    if (!frame || isBlueprintStepVisualPlaceholder(frame)) return []
    return [
      {
        laneName: name,
        label: VISUAL_LANE_SHORT_LABELS[name] ?? name,
        frame,
        description: resolveCellDescription(cell),
      },
    ]
  })
}

/** True when Partner, Lead Tutor, or Regular Tutor has a cell in this step. */
export function stepHasVisualWalkthroughLaneCells(
  blueprint: StoryboardBlueprint,
  stepId: string,
): boolean {
  const cellLookup = buildCellLookup(blueprint.cells)
  const laneByName = new Map(blueprint.lanes.map((lane) => [lane.name, lane]))

  return VISUAL_WALKTHROUGH_LANE_NAMES.some((name) => {
    const lane = laneByName.get(name)
    if (!lane) return false
    const cell = getCellAt(cellLookup, lane.id, stepId)
    return Boolean(cell?.content.trim())
  })
}

export function resolveStoryboardStrip(
  blueprint: StoryboardBlueprint,
  stepId: string,
): string[] {
  return resolveStoryboardStripEntries(blueprint, stepId).map(
    (entry) => entry.frame,
  )
}

export function buildVisualWalkthroughSession(
  blueprint: BlueprintData,
  meta?: VisualWalkthroughContextMeta,
): VisualWalkthroughSession {
  const steps = [...blueprint.steps]
    .sort((a, b) => a.position - b.position)
    .map((step, stepIndex) => {
      const frameEntries = resolveStoryboardStripEntries(blueprint, step.id)
      return {
        stepIndex,
        stepName: step.name,
        laneEntries: frameEntries.map((entry) => ({
          laneName: entry.laneName,
          content: entry.description,
          frame: entry.frame,
        })),
        frames: frameEntries.map((entry) => entry.frame),
      }
    })
  return {
    pathId: blueprint.path.id,
    pathName: blueprint.path.name,
    pathDescription: blueprint.path.summary,
    pathKind: blueprint.path.kind,
    scenarioName: meta?.scenarioName?.trim() || undefined,
    phaseName: meta?.phaseName?.trim() || undefined,
    steps,
  }
}
