import { useCallback } from 'react'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'

export type RegistryTouchpoint = { id: string; name: string }

/**
 * The registry a cell's service keeps: every touchpoint it could be linked
 * to (#277).
 *
 * Keyed by the cell because that is what the panel has. The service is
 * reached through the cell's path, scenario and phase — two reads, one key —
 * rather than threaded through six components that never needed it before.
 */
export function useRegistryTouchpoints(
  cellId: string | null,
): QueryResult<RegistryTouchpoint[]> {
  const fallback = useCallback(() => [], [])
  return useSupabaseQuery<RegistryTouchpoint[]>(
    cellId ? `registry-touchpoints:${cellId}` : null,
    async (client, signal) => {
      const { data: cell, error: cellError } = await client
        .from('cells')
        .select('paths ( scenarios ( phases ( service_id ) ) )')
        .eq('id', cellId!)
        .abortSignal(signal)
        .maybeSingle()
      if (cellError) throw cellError
      const serviceId = (
        cell as { paths?: { scenarios?: { phases?: { service_id?: string | null } | null } | null } | null } | null
      )?.paths?.scenarios?.phases?.service_id
      if (!serviceId) return []
      const { data, error } = await client
        .from('touchpoints')
        .select('id, name')
        .eq('service_id', serviceId)
        .order('name')
        .abortSignal(signal)
      if (error) throw error
      return (data ?? []).map((row) => ({ id: row.id, name: row.name }))
    },
    fallback,
  )
}
