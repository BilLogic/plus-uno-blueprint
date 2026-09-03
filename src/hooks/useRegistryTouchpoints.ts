import { useCallback } from 'react'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'

export type RegistryTouchpoint = { id: string; name: string }

/**
 * The registry a placement can link to: every touchpoint in the deployment
 * (#277).
 *
 * The catalog is the deployment's, not the service's (ADR 0014), so the read
 * is unscoped — a touchpoint minted for one service is reachable from any of
 * them, which is the whole point of a shared catalog. Still keyed by the cell
 * because that is what the panel has, and the key keeps each panel's query
 * cached separately.
 */
export function useRegistryTouchpoints(
  cellId: string | null,
): QueryResult<RegistryTouchpoint[]> {
  const fallback = useCallback(() => [], [])
  return useSupabaseQuery<RegistryTouchpoint[]>(
    cellId ? `registry-touchpoints:${cellId}` : null,
    async (client, signal) => {
      const { data, error } = await client
        .from('touchpoints')
        .select('id, name')
        .order('name')
        .abortSignal(signal)
      if (error) throw error
      return (data ?? []).map((row) => ({ id: row.id, name: row.name }))
    },
    fallback,
  )
}
