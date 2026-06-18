import {
  DISCOVERY_SCENARIO_ID,
} from '@/data/applicationHappyPathFallback'
import { getBlueprintFallback } from '@/data/blueprintFallbacks'
import { applyBlueprintDisplayFilters } from '@/lib/applyBlueprintDisplayFilters'
import { repairDiscoverySadPathBlueprint } from '@/lib/repairDiscoverySadPathBlueprint'
import {
  deduplicateBlueprintLayers,
  normalizeBlueprint,
  type RawPath,
} from '@/lib/normalizeBlueprint'
import type { BlueprintData } from '@/types/blueprint'

export type BlueprintSource = 'database' | 'fallback' | null

export function isBlueprintEmpty(data: BlueprintData): boolean {
  return data.layers.length === 0
}

/** Add fallback blueprint rows that are missing from a partially synced path. */
function mergeMissingBlueprintContent(
  data: BlueprintData,
  scenarioId: string | undefined,
  pathId: string | undefined,
): BlueprintData {
  const fallback = getBlueprintFallback(scenarioId, pathId ?? data.path.id)
  if (!fallback) return data

  const layerIds = new Set(data.layers.map((layer) => layer.id))
  const layerIdByName = new Map(
    data.layers.map((layer) => [layer.name, layer.id]),
  )
  const fallbackLayerIdRemap = new Map<string, string>()
  const layers = [...data.layers]
  for (const layer of fallback.layers) {
    if (layerIds.has(layer.id)) continue

    const existingLayerId = layerIdByName.get(layer.name)
    if (existingLayerId) {
      fallbackLayerIdRemap.set(layer.id, existingLayerId)
      continue
    }

    layers.push(layer)
    layerIds.add(layer.id)
    layerIdByName.set(layer.name, layer.id)
  }
  layers.sort((a, b) => a.row_position - b.row_position)

  const cellIds = new Set(data.cells.map((cell) => cell.id))
  const cells = [...data.cells]
  for (const cell of fallback.cells) {
    if (cellIds.has(cell.id)) continue

    const layerId =
      fallbackLayerIdRemap.get(cell.layer_id) ?? cell.layer_id
    cells.push({ ...cell, layer_id: layerId })
    cellIds.add(cell.id)
  }

  const stepIds = new Set(data.steps.map((step) => step.id))
  const steps = [...data.steps]
  for (const step of fallback.steps) {
    if (!stepIds.has(step.id)) {
      steps.push(step)
    }
  }
  steps.sort((a, b) => a.column_position - b.column_position)

  const triggerKeys = new Set(
    data.triggers.map((trigger) => `${trigger.source_cell_id}:${trigger.target_cell_id}`),
  )
  const triggers = [...data.triggers]
  for (const trigger of fallback.triggers) {
    const key = `${trigger.source_cell_id}:${trigger.target_cell_id}`
    if (!triggerKeys.has(key)) {
      triggers.push(trigger)
      triggerKeys.add(key)
    }
  }

  const changed =
    layers.length !== data.layers.length ||
    cells.length !== data.cells.length ||
    steps.length !== data.steps.length ||
    triggers.length !== data.triggers.length

  const merged = changed
    ? { ...data, layers, cells, steps, triggers }
    : data

  const deduped = deduplicateBlueprintLayers(merged)
  if (scenarioId === DISCOVERY_SCENARIO_ID) {
    return repairDiscoverySadPathBlueprint(deduped, fallback)
  }
  return deduped
}

export function resolveBlueprintForScenario(
  scenarioId: string | undefined,
  rawPath: RawPath | null | undefined,
): { blueprint: BlueprintData | null; source: BlueprintSource } {
  const pathId = rawPath?.id
  const fallback = getBlueprintFallback(scenarioId, pathId)

  if (rawPath) {
    const fromDb = normalizeBlueprint(rawPath)
    if (!isBlueprintEmpty(fromDb)) {
      return {
        blueprint: applyBlueprintDisplayFilters(
          mergeMissingBlueprintContent(fromDb, scenarioId, pathId),
          scenarioId,
          pathId,
        ),
        source: 'database',
      }
    }
  }

  if (fallback) {
    return {
      blueprint: applyBlueprintDisplayFilters(
        deduplicateBlueprintLayers(fallback),
        scenarioId,
        rawPath?.id ?? fallback.path.id,
      ),
      source: 'fallback',
    }
  }

  return { blueprint: null, source: null }
}
