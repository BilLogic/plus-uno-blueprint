import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  getBlueprintFallback,
  getFallbackPathsForScenario,
  mergePathsWithFallback,
} from '@/data/blueprintFallbacks'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { raceSupabaseQuery } from '@/lib/supabaseFetchTimeout'
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
 * How many scenarios ride one request. Small enough that the progress bar's
 * per-chunk ticks are REAL network completions (the reason the fetch is
 * chunked at all), large enough that a full board is a handful of requests.
 */
const SCENARIOS_PER_CHUNK = 8

function chunkIds(ids: string[]): string[][] {
  const chunks: string[][] = []
  for (let at = 0; at < ids.length; at += SCENARIOS_PER_CHUNK) {
    chunks.push(ids.slice(at, at + SCENARIOS_PER_CHUNK))
  }
  return chunks
}

/**
 * Blueprints for a set of scenarios, fetched in chunked `paths` queries so
 * loading progress is measurable: each chunk completing is one real tick of
 * `progress` (no synthetic percentages). Chunks are cached individually
 * under the `canvas-blueprints:` prefix (the same one mutations invalidate),
 * so every mount of the same scenario set — overview canvas, slice tabs, tab
 * switches — reuses the fetches. Errors, timeouts, and no-DB sessions fall
 * back to the static local blueprints.
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

  const { client, configured } = useSupabase()
  const noDb = !configured || !client
  const chunks = useMemo(
    () => chunkIds(orderedScenarioIds),
    [orderedScenarioIds],
  )

  const results = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: [`canvas-blueprints:chunk:${chunk.join(',')}`],
      enabled: !noDb,
      queryFn: async (): Promise<CanvasRawPath[]> => {
        const outcome = await raceSupabaseQuery(
          (async () => {
            const { data, error } = await client!
              .from('paths')
              .select(PATH_BLUEPRINT_SELECT)
              .in('service_scenario_id', chunk)
            if (error) throw new Error(error.message)
            return (data ?? []) as CanvasRawPath[]
          })(),
        )
        if (outcome === 'timeout') throw new Error('The request timed out')
        return outcome as CanvasRawPath[]
      },
    })),
  })

  const loadedChunks = results.filter(
    (result) => result.data !== undefined || result.error !== null,
  ).length
  const anyError = results.some((result) => result.error !== null)
  const allSettled = noDb || loadedChunks === results.length
  const loading = orderedScenarioIds.length > 0 && !allSettled

  const rowsKey = results
    .map((result) => (result.data ? 'y' : result.error ? 'e' : 'n'))
    .join('')
  const derived = useMemo<CanvasBlueprintMaps>(() => {
    if (orderedScenarioIds.length === 0) return EMPTY_MAPS
    if (noDb || !allSettled) {
      // Still on the wire → empty (the skeleton owns the canvas); no DB at
      // all → the static local fallbacks, same as before the split.
      return noDb ? staticFallbacks : EMPTY_MAPS
    }
    if (anyError) return staticFallbacks
    const rows = results.flatMap((result) => result.data ?? [])
    return deriveFromRows(rows, orderedScenarioIds, staticFallbacks)
    // rowsKey stands in for the results array's per-render identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedScenarioIds, noDb, allSettled, anyError, rowsKey, staticFallbacks])

  const firstError = results.find((result) => result.error)?.error
  const error = anyError
    ? firstError instanceof Error
      ? firstError.message
      : String(firstError)
    : null

  return {
    blueprintsByScenario: derived.blueprintsByScenario,
    pathsByScenario: derived.pathsByScenario,
    blueprintsByPathId: derived.blueprintsByPathId,
    loading,
    error,
    usingFallback: derived.usingFallback,
    /** Real network progress: settled chunks over total chunks. */
    progress: { loaded: loadedChunks, total: results.length },
  }
}
