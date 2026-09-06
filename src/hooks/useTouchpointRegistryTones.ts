import { useCallback } from 'react'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import { TOUCHPOINT_REGISTRY_FALLBACK } from '@/data/touchpointRegistryFallback'
import type { TouchpointRegistryEntry } from '@/lib/touchpointColors'

/**
 * Every touchpoint's stored colour and its other spellings (#326 S6).
 *
 * Separate from `useRegistryTouchpoints`, which the placement picker uses,
 * because the two ask different questions of the same table. The picker wants
 * the names one panel can choose between and keys its query by the cell it is
 * open on; this wants what the WHOLE BOARD draws with, so its key is a
 * constant and every consumer shares one cached response — the difference
 * between one round trip per session and one per cell anybody opens.
 *
 * The catalog is the deployment's, not the service's (ADR 0014), so the read
 * is unscoped: a colour chosen for a tool is that tool's colour on every
 * board.
 *
 * With no database the answer is `TOUCHPOINT_REGISTRY_FALLBACK`, for the same
 * reason `getBlueprintFallback` answers a board read — the fixture boards in
 * `src/data` have to draw in the colours they were authored with, and no
 * column exists for them to read.
 */
export function useTouchpointRegistryTones(): QueryResult<
  readonly TouchpointRegistryEntry[]
> {
  const fallback = useCallback(() => TOUCHPOINT_REGISTRY_FALLBACK, [])

  return useSupabaseQuery<readonly TouchpointRegistryEntry[]>(
    'touchpoint-registry-tones',
    async (client, signal) => {
      const { data, error } = await client
        .from('touchpoints')
        .select('name, tone, aliases')
        .order('name')
        .abortSignal(signal)
      if (error) throw new Error(error.message)
      return (data ?? []).map((row) => ({
        name: row.name,
        tone: row.tone,
        aliases: row.aliases,
      }))
    },
    fallback,
  )
}
