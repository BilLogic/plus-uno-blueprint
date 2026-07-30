import { useCallback, useMemo } from 'react'
import {
  getBlueprintFallback,
  getFallbackPathsForScenario,
  mergePathsWithFallback,
} from '@/data/blueprintFallbacks'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { resolveBlueprintForScenario } from '@/lib/resolveBlueprint'
import type { RawPath } from '@/lib/normalizeBlueprint'
import type { PathListItem } from '@/lib/pathSelection'
import { pickPreferredPath } from '@/lib/pathSelection'
import { PATH_BLUEPRINT_SELECT } from '@/lib/workflowQueries'
import type { BlueprintData } from '@/types/blueprint'

type CanvasRawPath = RawPath & {
  service_scenario_id: string
}

type CanvasBlueprintMaps = {
  blueprintsByScenario: Map<string, BlueprintData>
  pathsByScenario: Map<string, PathListItem[]>
  blueprintsByPathId: Map<string, BlueprintData>
  usingFallback: boolean
}

const EMPTY_MAPS: CanvasBlueprintMaps = {
  blueprintsByScenario: new Map(),
  pathsByScenario: new Map(),
  blueprintsByPathId: new Map(),
  usingFallback: false,
}

function pickPathForScenario(paths: CanvasRawPath[]): CanvasRawPath | null {
  if (paths.length === 0) return null
  return pickPreferredPath(paths) ?? null
}

function buildFallbackMaps(scenarioIds: string[]): CanvasBlueprintMaps {
  const blueprintsByScenario = new Map<string, BlueprintData>()
  const pathsByScenario = new Map<string, PathListItem[]>()
  const blueprintsByPathId = new Map<string, BlueprintData>()

  for (const scenarioId of scenarioIds) {
    const paths = getFallbackPathsForScenario(scenarioId)
    if (paths.length > 0) {
      pathsByScenario.set(scenarioId, paths)
    }

    for (const path of paths) {
      const blueprint = getBlueprintFallback(scenarioId, path.id)
      if (blueprint) {
        blueprintsByPathId.set(path.id, blueprint)
      }
    }

    const defaultBlueprint = getBlueprintFallback(scenarioId)
    if (defaultBlueprint) {
      blueprintsByScenario.set(scenarioId, defaultBlueprint)
    }
  }

  return {
    blueprintsByScenario,
    pathsByScenario,
    blueprintsByPathId,
    usingFallback: blueprintsByScenario.size > 0,
  }
}

/** Group fetched path rows into the per-scenario / per-path blueprint maps. */
function deriveFromRows(
  rows: CanvasRawPath[],
  orderedScenarioIds: string[],
  staticFallbacks: CanvasBlueprintMaps,
): CanvasBlueprintMaps {
  const grouped = new Map<string, CanvasRawPath[]>()
  const byPathId = new Map<string, BlueprintData>()
  let anyFallback = false

  for (const row of rows) {
    const list = grouped.get(row.service_scenario_id) ?? []
    list.push(row)
    grouped.set(row.service_scenario_id, list)

    const resolved = resolveBlueprintForScenario(row.service_scenario_id, row)
    if (resolved.blueprint) {
      byPathId.set(row.id, resolved.blueprint)
      if (resolved.source === 'fallback') anyFallback = true
    }
  }

  const byScenario = new Map<string, BlueprintData>()
  const pathsMap = new Map<string, PathListItem[]>()

  for (const scenarioId of orderedScenarioIds) {
    const scenarioPaths = grouped.get(scenarioId) ?? []
    if (scenarioPaths.length > 0) {
      pathsMap.set(
        scenarioId,
        mergePathsWithFallback(
          scenarioId,
          scenarioPaths.map((path) => ({
            id: path.id,
            name: path.name,
            description: path.description ?? null,
            note: path.note ?? null,
            path_type: path.path_type,
          })),
        ),
      )
    } else {
      const fallbackPaths = getFallbackPathsForScenario(scenarioId)
      if (fallbackPaths.length > 0) {
        pathsMap.set(scenarioId, fallbackPaths)
      }
    }

    const chosen = pickPathForScenario(scenarioPaths)
    const resolved = resolveBlueprintForScenario(scenarioId, chosen)
    if (resolved.blueprint) {
      byScenario.set(scenarioId, resolved.blueprint)
      if (resolved.source === 'fallback') anyFallback = true
    } else {
      const fallback = getBlueprintFallback(scenarioId)
      if (fallback) {
        byScenario.set(scenarioId, fallback)
        anyFallback = true
      }
    }
  }

  if (
    byScenario.size === 0 &&
    staticFallbacks.blueprintsByScenario.size > 0
  ) {
    return { ...staticFallbacks, usingFallback: true }
  }

  return {
    blueprintsByScenario: byScenario,
    pathsByScenario:
      pathsMap.size > 0 ? pathsMap : staticFallbacks.pathsByScenario,
    blueprintsByPathId:
      byPathId.size > 0 ? byPathId : staticFallbacks.blueprintsByPathId,
    usingFallback:
      anyFallback ||
      (byScenario.size === 0 &&
        staticFallbacks.blueprintsByScenario.size > 0),
  }
}

/**
 * Blueprints for a set of scenarios, one `paths` query for the whole set.
 * Backed by the shared `useSupabaseQuery` cache keyed on the sorted id set,
 * so every mount of the same scenario set (overview canvas, slice tabs, tab
 * switches back and forth) reuses one fetch. Errors, timeouts, and no-DB
 * sessions fall back to the static local blueprints.
 */
export function useCanvasBlueprints(scenarioIds: string[]) {
  const idsKey = scenarioIds.slice().sort().join(',')
  const orderedScenarioIds = useMemo(
    () => (idsKey ? idsKey.split(',') : []),
    [idsKey],
  )
  const staticFallbacks = useMemo(
    () => buildFallbackMaps(orderedScenarioIds),
    [orderedScenarioIds],
  )

  const fallback = useCallback(() => null, [])
  const result = useSupabaseQuery<CanvasRawPath[]>(
    orderedScenarioIds.length === 0 ? null : `canvas-blueprints:${idsKey}`,
    async (client) => {
      const { data, error } = await client
        .from('paths')
        .select(PATH_BLUEPRINT_SELECT)
        .in('service_scenario_id', orderedScenarioIds)
      if (error) throw new Error(error.message)
      return (data ?? []) as CanvasRawPath[]
    },
    fallback,
  )

  const derived = useMemo<CanvasBlueprintMaps>(() => {
    if (orderedScenarioIds.length === 0) return EMPTY_MAPS
    switch (result.status) {
      case 'loading':
        return EMPTY_MAPS
      case 'error':
        // DB error, timeout, or no-DB session — static local fallbacks.
        return staticFallbacks
      case 'ready':
        return result.source === 'database'
          ? deriveFromRows(result.data, orderedScenarioIds, staticFallbacks)
          : staticFallbacks
    }
  }, [orderedScenarioIds, result, staticFallbacks])

  const loading =
    orderedScenarioIds.length > 0 && result.status === 'loading'
  const error = result.status === 'error' ? result.message : null

  return {
    blueprintsByScenario: derived.blueprintsByScenario,
    pathsByScenario: derived.pathsByScenario,
    blueprintsByPathId: derived.blueprintsByPathId,
    loading,
    error,
    usingFallback: derived.usingFallback,
  }
}
