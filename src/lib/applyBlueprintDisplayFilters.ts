import {
  WARM_UP_ALTERNATE_PATH_ID,
  WARM_UP_HAPPY_PATH_ID,
  WARM_UP_SAD_PATH_ID,
  WARM_UP_SCENARIO_ID,
} from '@/data/blueprintFallbacks'
import type { BlueprintData } from '@/types/blueprint'

/** Layers shown on Warm-Up paths but without trigger arrows (for now). */
export const WARM_UP_NO_ARROW_LAYER_NAMES = [
  'Partner Action: Teacher',
  'Lead Tutor',
] as const

function isWarmUpComparePath(
  data: BlueprintData,
  scenarioId?: string,
  pathId?: string,
): boolean {
  const id = pathId ?? data.path.id
  return (
    scenarioId === WARM_UP_SCENARIO_ID ||
    id === WARM_UP_HAPPY_PATH_ID ||
    id === WARM_UP_ALTERNATE_PATH_ID ||
    id === WARM_UP_SAD_PATH_ID
  )
}

export function applyBlueprintDisplayFilters(
  data: BlueprintData,
  scenarioId?: string,
  pathId?: string,
): BlueprintData {
  if (!isWarmUpComparePath(data, scenarioId, pathId)) {
    return data
  }

  const noArrowLayerIds = new Set(
    data.layers
      .filter((layer) =>
        (WARM_UP_NO_ARROW_LAYER_NAMES as readonly string[]).includes(
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
