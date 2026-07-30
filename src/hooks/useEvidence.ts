import { useCallback } from 'react'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import type { Evidence } from '@/types/database'

/**
 * Evidence rows for one cell, newest first. Mount only for authenticated
 * sessions with the Evidence tab open — evidence SELECT is restricted, so an
 * anonymous fetch would return an empty set that must never be rendered as
 * "all assumptions". Bump `reloadToken` after inserting a source.
 */
export function useEvidence(
  cellId: string,
  reloadToken = 0,
): QueryResult<Evidence[]> {
  const fallback = useCallback(() => null, [])

  return useSupabaseQuery<Evidence[]>(
    `evidence:${cellId}:${reloadToken}`,
    async (client) => {
      const { data, error } = await client
        .from('evidence')
        .select('*')
        .eq('cell_id', cellId)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data ?? []
    },
    fallback,
  )
}
