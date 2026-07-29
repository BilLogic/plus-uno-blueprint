import { useCallback } from 'react'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import { findFallbackScenarioForCells } from '@/lib/sliceCells'

/** Scenario owning a slice's cells (v1 slices are single-scenario). */
export function useSliceScenarioId(
  cellIds: readonly string[],
): QueryResult<string> {
  const fallback = useCallback(
    () => findFallbackScenarioForCells(cellIds),
    [cellIds],
  )

  return useSupabaseQuery<string>(
    `slice-scenario:${cellIds.join('|')}`,
    async (client) => {
      if (cellIds.length === 0) throw new Error('The slice has no cells')

      const { data, error } = await client
        .from('cells')
        .select('id, paths(service_scenario_id)')
        .in('id', [...cellIds])
      if (error) throw new Error(error.message)

      const scenarioId = (data ?? []).find((row) => row.paths !== null)?.paths
        ?.service_scenario_id
      if (scenarioId) return scenarioId

      // Cells may live only in the local fallback content.
      const fallbackScenarioId = findFallbackScenarioForCells(cellIds)
      if (fallbackScenarioId) return fallbackScenarioId

      throw new Error('The slice cells are no longer in the blueprint')
    },
    fallback,
  )
}
