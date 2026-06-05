import { getBlueprintFallback } from '@/data/blueprintFallbacks'
import { applyBlueprintDisplayFilters } from '@/lib/applyBlueprintDisplayFilters'
import { normalizeBlueprint } from '@/lib/normalizeBlueprint'
import type { BlueprintData } from '@/types/blueprint'
import type { PathType } from '@/types/database'

export type BlueprintSource = 'database' | 'fallback' | null

type RawPath = {
  id: string
  name: string
  path_type: PathType
  layers?: BlueprintData['layers']
  steps?: BlueprintData['steps']
  cells?: BlueprintData['cells']
}

export function isBlueprintEmpty(data: BlueprintData): boolean {
  return data.layers.length === 0 && data.steps.length === 0
}

/** Add fallback triggers that are missing from the loaded path (e.g. new migrations). */
function mergeMissingTriggers(
  data: BlueprintData,
  scenarioId: string | undefined,
  pathId: string | undefined,
): BlueprintData {
  const fallback = getBlueprintFallback(scenarioId, pathId ?? data.path.id)
  if (!fallback?.triggers.length) return data

  const seen = new Set(
    data.triggers.map((t) => `${t.source_cell_id}:${t.target_cell_id}`),
  )
  const merged = [...data.triggers]
  for (const trigger of fallback.triggers) {
    const key = `${trigger.source_cell_id}:${trigger.target_cell_id}`
    if (!seen.has(key)) {
      merged.push(trigger)
      seen.add(key)
    }
  }

  return merged.length === data.triggers.length
    ? data
    : { ...data, triggers: merged }
}

export function resolveBlueprintForScenario(
  scenarioId: string | undefined,
  rawPath: RawPath | null | undefined,
): { blueprint: BlueprintData | null; source: BlueprintSource } {
  const fallback = getBlueprintFallback(scenarioId, rawPath?.id)

  if (rawPath) {
    const fromDb = normalizeBlueprint(rawPath)
    if (!isBlueprintEmpty(fromDb)) {
      return {
        blueprint: applyBlueprintDisplayFilters(
          mergeMissingTriggers(fromDb, scenarioId, rawPath.id),
          scenarioId,
          rawPath.id,
        ),
        source: 'database',
      }
    }
  }

  if (fallback) {
    return {
      blueprint: applyBlueprintDisplayFilters(
        fallback,
        scenarioId,
        rawPath?.id ?? fallback.path.id,
      ),
      source: 'fallback',
    }
  }

  return { blueprint: null, source: null }
}
