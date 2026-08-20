import { isBlueprintVisualLayerEnabled } from '@/lib/blueprintDisplayFlags'
import { shouldUseVisualContent } from '@/lib/blueprintLayout'
import type { BlueprintData } from '@/types/blueprint'

function filterHiddenVisualLayers(
  data: BlueprintData,
  scenarioId?: string,
): BlueprintData {
  if (isBlueprintVisualLayerEnabled(scenarioId)) {
    return data
  }

  const hiddenLayerIds = new Set(
    data.lanes
      .filter((lane) => shouldUseVisualContent(lane))
      .map((lane) => lane.id),
  )

  if (hiddenLayerIds.size === 0) {
    return data
  }

  const cells = data.cells.filter((cell) => !hiddenLayerIds.has(cell.lane_id))
  const hiddenCellIds = new Set(
    data.cells
      .filter((cell) => hiddenLayerIds.has(cell.lane_id))
      .map((cell) => cell.id),
  )
  const triggers = data.triggers.filter(
    (trigger) =>
      !hiddenCellIds.has(trigger.source_cell_id) &&
      !hiddenCellIds.has(trigger.target_cell_id),
  )

  return {
    ...data,
    lanes: data.lanes.filter((lane) => !hiddenLayerIds.has(lane.id)),
    cells,
    triggers,
  }
}

export function applyBlueprintDisplayFilters(
  data: BlueprintData,
  scenarioId?: string,
  _pathId?: string,
): BlueprintData {
  return filterHiddenVisualLayers(data, scenarioId)
}
