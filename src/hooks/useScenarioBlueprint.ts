import { useEffect, useMemo, useState } from 'react'
import {
  getBlueprintFallback,
  getFallbackPathsForScenario,
} from '@/data/blueprintFallbacks'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { usePathSelection } from '@/hooks/usePathSelection'
import { resolveBlueprintForScenario, type BlueprintSource } from '@/lib/resolveBlueprint'
import { mergeIntegratedBlueprint } from '@/lib/mergeIntegratedBlueprint'
import type { PathListItem } from '@/lib/pathSelection'
import { PATH_BLUEPRINT_SELECT, PATH_LIST_SELECT } from '@/lib/workflowQueries'
import type { BlueprintData } from '@/types/blueprint'

export function useScenarioBlueprint(serviceScenarioId: string | undefined) {
  const { client, configured } = useSupabase()
  const [paths, setPaths] = useState<PathListItem[]>([])
  const { selectedPathIds, setSelectedPathIds, togglePathSelection } =
    usePathSelection(paths)
  const [blueprintsByPathId, setBlueprintsByPathId] = useState<
    Record<string, BlueprintData>
  >({})
  const [source, setSource] = useState<BlueprintSource>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fallbackPaths = useMemo(
    () => getFallbackPathsForScenario(serviceScenarioId),
    [serviceScenarioId],
  )

  useEffect(() => {
    if (!serviceScenarioId) {
      setPaths([])
      setBlueprintsByPathId({})
      setSource(null)
      setLoading(false)
      setError(null)
      return
    }

    if (!configured || !client) {
      if (fallbackPaths.length > 0) {
        setPaths(fallbackPaths)
      } else {
        setPaths([])
        setBlueprintsByPathId({})
        setSource(null)
      }
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void client
      .from('paths')
      .select(PATH_LIST_SELECT)
      .eq('service_scenario_id', serviceScenarioId)
      .order('created_at', { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
          if (fallbackPaths.length > 0) {
            setPaths(fallbackPaths)
          } else {
            setPaths([])
            setBlueprintsByPathId({})
            setSource(null)
          }
          setLoading(false)
          return
        }

        const list = (data ?? []) as PathListItem[]
        if (list.length > 0) {
          setPaths(list)
        } else if (fallbackPaths.length > 0) {
          setPaths(fallbackPaths)
        } else {
          setPaths([])
          setBlueprintsByPathId({})
          setSource(null)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [client, configured, serviceScenarioId, fallbackPaths])

  const pathIds = useMemo(() => paths.map((path) => path.id), [paths])

  useEffect(() => {
    if (!serviceScenarioId || pathIds.length === 0) {
      setBlueprintsByPathId({})
      return
    }

    if (!configured || !client) {
      const next: Record<string, BlueprintData> = {}
      for (const pathId of pathIds) {
        const fallback = getBlueprintFallback(serviceScenarioId, pathId)
        if (fallback) next[pathId] = fallback
      }
      setBlueprintsByPathId(next)
      setSource(Object.keys(next).length > 0 ? 'fallback' : null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void Promise.all(
      pathIds.map(async (pathId) => {
        const { data, error: err } = await client
          .from('paths')
          .select(PATH_BLUEPRINT_SELECT)
          .eq('id', pathId)
          .single()

        if (err) {
          const fallback = getBlueprintFallback(serviceScenarioId, pathId)
          return { pathId, blueprint: fallback, source: 'fallback' as const }
        }

        const resolved = resolveBlueprintForScenario(
          serviceScenarioId,
          data ?? undefined,
        )
        return {
          pathId,
          blueprint: resolved.blueprint,
          source: resolved.source,
        }
      }),
    ).then((results) => {
      if (cancelled) return

      const next: Record<string, BlueprintData> = {}
      let anyFallback = false
      for (const result of results) {
        if (result.blueprint) {
          next[result.pathId] = result.blueprint
          if (result.source === 'fallback') anyFallback = true
        }
      }

      setBlueprintsByPathId(next)
      setSource(
        anyFallback
          ? 'fallback'
          : Object.keys(next).length > 0
            ? 'database'
            : null,
      )
      setError(null)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [client, configured, pathIds, serviceScenarioId])

  const allBlueprints = useMemo(
    () =>
      paths
        .map((path) => blueprintsByPathId[path.id])
        .filter((blueprint): blueprint is BlueprintData => blueprint !== undefined),
    [paths, blueprintsByPathId],
  )

  const blueprints = useMemo(
    () =>
      paths
        .filter((path) => selectedPathIds.includes(path.id))
        .map((path) => blueprintsByPathId[path.id])
        .filter((blueprint): blueprint is BlueprintData => blueprint !== undefined),
    [paths, selectedPathIds, blueprintsByPathId],
  )

  const integratedBlueprint = useMemo(
    () => mergeIntegratedBlueprint(allBlueprints, selectedPathIds),
    [allBlueprints, selectedPathIds],
  )

  const blueprint = blueprints[0] ?? null

  const selectedPath = useMemo(
    () => paths.find((p) => p.id === selectedPathIds[0]) ?? null,
    [paths, selectedPathIds],
  )

  return {
    paths,
    selectedPathIds,
    setSelectedPathIds,
    togglePathSelection,
    selectedPath,
    blueprint,
    blueprints,
    allBlueprints,
    integratedBlueprint,
    source,
    loading,
    error,
    configured,
  }
}
