import { DEV_FALLBACK_SLICES } from '@/data/devSlices'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import type { Slice } from '@/types/database'

// TODO(dev-only): remove after DB slices exist — no-DB dev mode only.
const slicesFallback = (): Slice[] | null =>
  import.meta.env.DEV ? DEV_FALLBACK_SLICES : null

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
    slicesFallback,
  )
}
