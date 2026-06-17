import {
  WARM_UP_ALTERNATE_PATH_ID,
  WARM_UP_SAD_PATH_ID,
} from '@/data/blueprintFallbacks'
import { BLUEPRINT_VISUAL_LAYER_UI_ENABLED } from '@/lib/blueprintDisplayFlags'
import { shouldUseVisualContent } from '@/lib/blueprintLayout'
import type { BlueprintData } from '@/types/blueprint'

/** Partner/lead lanes on multi-actor in-session paths render without arrows (for now). */
export const MULTI_ACTOR_NO_ARROW_LAYER_NAMES = [
  'Partner Action: Teacher',
  'Lead Tutor',
] as const

/** @deprecated Use MULTI_ACTOR_NO_ARROW_LAYER_NAMES */
export const WARM_UP_NO_ARROW_LAYER_NAMES = MULTI_ACTOR_NO_ARROW_LAYER_NAMES

function filterWarmUpNoArrowLayers(
  data: BlueprintData,
  _scenarioId?: string,
  pathId?: string,
): BlueprintData {
  const id = pathId ?? data.path.id
  if (id !== WARM_UP_ALTERNATE_PATH_ID && id !== WARM_UP_SAD_PATH_ID) {
    return data
  }

  const noArrowLayerIds = new Set(
    data.layers
      .filter((layer) =>
        (MULTI_ACTOR_NO_ARROW_LAYER_NAMES as readonly string[]).includes(
          layer.name,
        ),
      )
      .map((layer) => layer.id),
  )

  if (noArrowLayerIds.size === 0) {
    return data
  }

  const noArrowCellIds = new Set(
    data.cells
      .filter((cell) => noArrowLayerIds.has(cell.layer_id))
      .map((cell) => cell.id),
  )

  const triggers = data.triggers.filter(
    (trigger) =>
      !noArrowCellIds.has(trigger.source_cell_id) &&
      !noArrowCellIds.has(trigger.target_cell_id),
  )

  return { ...data, triggers }
}

function filterHiddenVisualLayers(data: BlueprintData): BlueprintData {
  if (BLUEPRINT_VISUAL_LAYER_UI_ENABLED) {
    return data
  }

  const hiddenLayerIds = new Set(
    data.layers
      .filter((layer) => shouldUseVisualContent(layer.name))
      .map((layer) => layer.id),
  )

  if (hiddenLayerIds.size === 0) {
    return data
  }

  const cells = data.cells.filter((cell) => !hiddenLayerIds.has(cell.layer_id))
  const hiddenCellIds = new Set(
    data.cells
      .filter((cell) => hiddenLayerIds.has(cell.layer_id))
      .map((cell) => cell.id),
  )
  const triggers = data.triggers.filter(
    (trigger) =>
      !hiddenCellIds.has(trigger.source_cell_id) &&
      !hiddenCellIds.has(trigger.target_cell_id),
  )

  return {
    ...data,
    layers: data.layers.filter((layer) => !hiddenLayerIds.has(layer.id)),
    cells,
    triggers,
  }
}

export function applyBlueprintDisplayFilters(
  data: BlueprintData,
  scenarioId?: string,
  pathId?: string,
): BlueprintData {
  return filterHiddenVisualLayers(
    filterWarmUpNoArrowLayers(data, scenarioId, pathId),
  )
}
