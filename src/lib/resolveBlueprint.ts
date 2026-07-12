import {
  DISCOVERY_SCENARIO_ID,
} from '@/data/applicationHappyPathFallback'
import {
  getBlueprintFallback,
  getRawBlueprintFallback,
  WARM_UP_ALTERNATE_PATH_ID,
  WARM_UP_SCENARIO_ID,
} from '@/data/blueprintFallbacks'
import { applyBlueprintDisplayFilters } from '@/lib/applyBlueprintDisplayFilters'
import { repairDiscoverySadPathBlueprint } from '@/lib/repairDiscoverySadPathBlueprint'
import {
  repairWarmUpAlternatePathBlueprint,
  repairWarmUpPathLayerPositions,
} from '@/lib/repairWarmUpAlternatePathBlueprint'
import { mergeTechDescriptionLinks } from '@/lib/blueprintTechDescriptions'
import { isBlueprintStepVisualPlaceholder } from '@/lib/blueprintVisualPlaceholder'
import {
  deduplicateBlueprintLayers,
  normalizeBlueprint,
  sortBlueprintLayers,
  type RawPath,
} from '@/lib/normalizeBlueprint'
import type { BlueprintData } from '@/types/blueprint'

export type BlueprintSource = 'database' | 'fallback' | null

export function isBlueprintEmpty(data: BlueprintData): boolean {
  return data.layers.length === 0
}

function repairBlueprintLayerPositionsFromFallback(
  data: BlueprintData,
  fallback: BlueprintData | null,
): BlueprintData {
  if (!fallback) {
    return sortBlueprintLayers(data)
  }

  return sortBlueprintLayers(
    repairWarmUpPathLayerPositions(data, fallback.layers),
  )
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
  let layersChanged = false
  for (const layer of fallback.layers) {
    const existingByIdIndex = layers.findIndex((entry) => entry.id === layer.id)
    if (existingByIdIndex !== -1) {
      const existing = layers[existingByIdIndex]!
      if (existing.row_position !== layer.row_position) {
        layers[existingByIdIndex] = {
          ...existing,
          row_position: layer.row_position,
        }
        layersChanged = true
      }
      continue
    }

    const existingLayerId = layerIdByName.get(layer.name)
    if (existingLayerId) {
      fallbackLayerIdRemap.set(layer.id, existingLayerId)
      const existingIndex = layers.findIndex(
        (entry) => entry.id === existingLayerId,
      )
      if (existingIndex !== -1) {
        const existing = layers[existingIndex]!
        if (existing.row_position !== layer.row_position) {
          layers[existingIndex] = {
            ...existing,
            row_position: layer.row_position,
          }
          layersChanged = true
        }
      }
      continue
    }

    layers.push(layer)
    layerIds.add(layer.id)
    layerIdByName.set(layer.name, layer.id)
    layersChanged = true
  }
  layers.sort((a, b) => a.row_position - b.row_position)

  const fallbackCellById = new Map(
    fallback.cells.map((cell) => [cell.id, cell]),
  )

  const cellIds = new Set(data.cells.map((cell) => cell.id))
  const cells = data.cells.map((cell) => {
    const fallbackCell = fallbackCellById.get(cell.id)
    if (!fallbackCell) return cell

    let changed = false
    let next = cell

    if (fallbackCell.picture?.trim()) {
      const cellPicture = cell.picture?.trim()
      if (
        !cellPicture ||
        (isBlueprintStepVisualPlaceholder(cellPicture) &&
          !isBlueprintStepVisualPlaceholder(fallbackCell.picture))
      ) {
        next = { ...next, picture: fallbackCell.picture }
        changed = true
      }
    }

    if (fallbackCell.description?.trim() && !cell.description?.trim()) {
      next = { ...next, description: fallbackCell.description }
      changed = true
    }

    if (
      fallbackCell.content.trim() &&
      fallbackCell.content.trim() !== cell.content.trim()
    ) {
      next = { ...next, content: fallbackCell.content }
      changed = true
    }

    const mergedLinks = mergeTechDescriptionLinks(
      cell.links,
      fallbackCell.links,
    )
    if (JSON.stringify(mergedLinks) !== JSON.stringify(cell.links)) {
      next = { ...next, links: mergedLinks }
      changed = true
    }

    return changed ? next : cell
  })
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

  const fallbackTriggerKeys = new Set(
    fallback.triggers.map(
      (trigger) => `${trigger.source_cell_id}:${trigger.target_cell_id}`,
    ),
  )
  const fallbackCellIds = new Set(fallback.cells.map((cell) => cell.id))

  const triggers = [
    ...data.triggers.filter((trigger) => {
      const touchesFallback =
        fallbackCellIds.has(trigger.source_cell_id) ||
        fallbackCellIds.has(trigger.target_cell_id)
      if (!touchesFallback) return true
      return fallbackTriggerKeys.has(
        `${trigger.source_cell_id}:${trigger.target_cell_id}`,
      )
    }),
  ]

  const triggerKeys = new Set(
    triggers.map(
      (trigger) => `${trigger.source_cell_id}:${trigger.target_cell_id}`,
    ),
  )
  for (const trigger of fallback.triggers) {
    const key = `${trigger.source_cell_id}:${trigger.target_cell_id}`
    if (!triggerKeys.has(key)) {
      triggers.push(trigger)
      triggerKeys.add(key)
    }
  }

  const picturesMerged = data.cells.some((cell, index) => {
    const mergedCell = cells[index]
    return mergedCell !== undefined && mergedCell.picture !== cell.picture
  })

  const descriptionsMerged = data.cells.some((cell, index) => {
    const mergedCell = cells[index]
    return mergedCell !== undefined && mergedCell.description !== cell.description
  })

  const contentMerged = data.cells.some((cell, index) => {
    const mergedCell = cells[index]
    return mergedCell !== undefined && mergedCell.content !== cell.content
  })

  const linksMerged = data.cells.some((cell, index) => {
    const mergedCell = cells[index]
    if (!mergedCell) return false
    return JSON.stringify(mergedCell.links) !== JSON.stringify(cell.links)
  })

  const triggersMerged =
    triggers.length !== data.triggers.length ||
    triggers.some(
      (trigger) =>
        !data.triggers.some(
          (previous) =>
            previous.id === trigger.id &&
            previous.source_cell_id === trigger.source_cell_id &&
            previous.target_cell_id === trigger.target_cell_id,
        ),
    )

  const changed =
    layersChanged ||
    layers.length !== data.layers.length ||
    cells.length !== data.cells.length ||
    steps.length !== data.steps.length ||
    triggersMerged ||
    picturesMerged ||
    descriptionsMerged ||
    contentMerged ||
    linksMerged

  const merged = changed
    ? { ...data, layers, cells, steps, triggers }
    : data

  const deduped = deduplicateBlueprintLayers(merged)
  if (scenarioId === DISCOVERY_SCENARIO_ID) {
    return repairDiscoverySadPathBlueprint(deduped, fallback)
  }
  if (
    scenarioId === WARM_UP_SCENARIO_ID &&
    pathId === WARM_UP_ALTERNATE_PATH_ID
  ) {
    return repairWarmUpAlternatePathBlueprint(deduped)
  }
  return deduped
}

export function resolveBlueprintForScenario(
  scenarioId: string | undefined,
  rawPath: RawPath | null | undefined,
): { blueprint: BlueprintData | null; source: BlueprintSource } {
  const pathId = rawPath?.id
  const fallback = getBlueprintFallback(scenarioId, pathId)

  if (
    scenarioId === WARM_UP_SCENARIO_ID &&
    pathId === WARM_UP_ALTERNATE_PATH_ID &&
    fallback
  ) {
    const corrected = repairWarmUpAlternatePathBlueprint({
      ...fallback,
      path: rawPath
        ? {
            id: rawPath.id,
            name: fallback.path.name,
            description:
              fallback.path.description ?? rawPath.description ?? null,
            note: fallback.path.note ?? rawPath.note ?? null,
            path_type: rawPath.path_type,
          }
        : fallback.path,
    })

    return {
      blueprint: applyBlueprintDisplayFilters(
        repairBlueprintLayerPositionsFromFallback(corrected, fallback),
        scenarioId,
        pathId,
      ),
      source:
        rawPath && !isBlueprintEmpty(normalizeBlueprint(rawPath))
          ? 'database'
          : 'fallback',
    }
  }

  if (rawPath) {
    const fromDb = normalizeBlueprint(rawPath)
    if (!isBlueprintEmpty(fromDb)) {
      const merged = mergeMissingBlueprintContent(fromDb, scenarioId, pathId)
      const rawFallback = getRawBlueprintFallback(
        scenarioId,
        pathId,
        merged.path.path_type,
      )
      const blueprint = rawFallback
        ? {
            ...merged,
            path: {
              ...merged.path,
              name: rawFallback.path.name,
              description:
                rawFallback.path.description ?? merged.path.description,
              note: rawFallback.path.note ?? merged.path.note,
            },
          }
        : merged

      return {
        blueprint: applyBlueprintDisplayFilters(
          repairBlueprintLayerPositionsFromFallback(blueprint, fallback),
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
        repairBlueprintLayerPositionsFromFallback(
          deduplicateBlueprintLayers(fallback),
          fallback,
        ),
        scenarioId,
        rawPath?.id ?? fallback.path.id,
      ),
      source: 'fallback',
    }
  }

  return { blueprint: null, source: null }
}
