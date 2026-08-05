import { useCallback } from 'react'
import {
  invalidateQueries,
  useSupabaseQuery,
  type QueryResult,
} from '@/hooks/useSupabaseQuery'
import type { Evidence } from '@/types/database'

/**
 * Drop the cached evidence for one cell and refetch mounted readers. Call
 * after inserting or deleting a source. (This replaced a component-local
 * reload token baked into the key: the token reset to 0 on remount, so with
 * staleTime Infinity a reopened panel served the pre-insert list forever,
 * and every dead token generation stayed cached.)
 */
export function invalidateEvidence(cellId: string): void {
  invalidateQueries(`evidence:${cellId}`)
}

/**
 * Evidence rows for one cell, newest first. Mount only for authenticated
 * sessions with the Evidence tab open — evidence SELECT is restricted, so an
 * anonymous fetch would return an empty set that must never be rendered as
 * "all assumptions". Call `invalidateEvidence` after inserting a source.
 */
export function useEvidence(cellId: string): QueryResult<Evidence[]> {
  const fallback = useCallback(() => null, [])

  return useSupabaseQuery<Evidence[]>(
    `evidence:${cellId}`,
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
