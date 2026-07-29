import { useCallback } from 'react'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import type { Proposition } from '@/types/database'

export type PropositionDetail = {
  lifecycleId: string
  /** Null until the first save creates the row (one per lifecycle). */
  row: Proposition | null
}

/**
 * The lifecycle's business-proposition record. SELECT is restricted to
 * authenticated sessions — callers must gate on canWrite before rendering an
 * empty state (an anonymous read is empty by policy, not by content). Bump
 * `reloadToken` after a save.
 */
export function useProposition(reloadToken = 0): QueryResult<PropositionDetail> {
  const fallback = useCallback(() => null, [])

  return useSupabaseQuery<PropositionDetail>(
    `proposition:first:${reloadToken}`,
    async (client) => {
      const { data: lifecycles, error: lifecycleError } = await client
        .from('service_lifecycles')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
      if (lifecycleError) throw new Error(lifecycleError.message)
      const lifecycleId = lifecycles?.[0]?.id
      if (!lifecycleId) throw new Error('No service lifecycle exists')

      const { data, error } = await client
        .from('propositions')
        .select('*')
        .eq('service_lifecycle_id', lifecycleId)
        .maybeSingle()
      if (error) throw new Error(error.message)

      return { lifecycleId, row: data ?? null }
    },
    fallback,
  )
}
