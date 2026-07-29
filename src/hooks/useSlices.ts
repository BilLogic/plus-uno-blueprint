import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import type { Slice } from '@/types/database'

const noSlicesFallback = (): Slice[] | null => null

/**
 * All slices for one service lifecycle, ordered by position. With no explicit
 * `lifecycleId`, the first lifecycle by `created_at` is used — the same
 * resolution as `useLifecyclePhases`.
 */
export function useSlices(lifecycleId?: string): QueryResult<Slice[]> {
  return useSupabaseQuery<Slice[]>(
    `slices:${lifecycleId ?? 'first'}`,
    async (client) => {
      let resolvedLifecycleId = lifecycleId
      if (!resolvedLifecycleId) {
        const { data, error } = await client
          .from('service_lifecycles')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(1)
        if (error) throw new Error(error.message)
        resolvedLifecycleId = data?.[0]?.id
        if (!resolvedLifecycleId) return []
      }

      const { data, error } = await client
        .from('slices')
        .select('*')
        .eq('service_lifecycle_id', resolvedLifecycleId)
        .order('position', { ascending: true })
      if (error) throw new Error(error.message)
      return data ?? []
    },
    noSlicesFallback,
  )
}
