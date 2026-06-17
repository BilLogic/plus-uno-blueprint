import { buildCellLookup, getCellAt } from '@/lib/normalizeBlueprint'
import type { BlueprintData, BlueprintLayer } from '@/types/blueprint'
import type { PathType } from '@/types/database'

export const VISUAL_WALKTHROUGH_LAYER_NAMES = [
  'Partner Action: Teacher',
  'Lead Tutor',
  'Regular Tutor',
] as const

export type VisualWalkthroughLayerEntry = {
  layerName: string
  content: string
}

export type VisualWalkthroughStep = {
  stepIndex: number
  stepName: string
  layerEntries: VisualWalkthroughLayerEntry[]
}

export type VisualWalkthroughSession = {
  pathId: string
  pathName: string
  pathDescription: string | null
  pathType: PathType
  steps: VisualWalkthroughStep[]
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
  return (
    blueprints.find((blueprint) => blueprint.path.path_type === 'happy') ??
    blueprints[0]
  )
}

function resolveWalkthroughLayers(layers: BlueprintLayer[]): BlueprintLayer[] {
  const byName = new Map(layers.map((layer) => [layer.name, layer]))
  return VISUAL_WALKTHROUGH_LAYER_NAMES.flatMap((name) => {
    const layer = byName.get(name)
    return layer ? [layer] : []
  })
}

export function buildVisualWalkthroughSession(
  blueprint: BlueprintData,
): VisualWalkthroughSession {
  const cellLookup = buildCellLookup(blueprint.cells)
  const descriptionLayers = resolveWalkthroughLayers(blueprint.layers)
  const layerByName = new Map(
    descriptionLayers.map((layer) => [layer.name, layer]),
  )

  const steps = [...blueprint.steps]
    .sort((a, b) => a.column_position - b.column_position)
    .map((step, stepIndex) => ({
      stepIndex,
      stepName: step.name,
      layerEntries: VISUAL_WALKTHROUGH_LAYER_NAMES.map((name) => {
        const layer = layerByName.get(name)
        return {
          layerName: name,
          content: layer
            ? getCellAt(cellLookup, layer.id, step.id)?.content.trim() ?? ''
            : '',
        }
      }),
    }))
  return {
    pathId: blueprint.path.id,
    pathName: blueprint.path.name,
    pathDescription: blueprint.path.description,
    pathType: blueprint.path.path_type,
    steps,
  }
}
