import { useCallback } from 'react'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import type { Cell } from '@/types/database'

/** The human-editable spec columns of one cell (column-scoped UPDATE grant). */
export type CellSpec = Pick<
  Cell,
  | 'id'
  | 'function'
  | 'form'
  | 'value_props'
  | 'owner'
  | 'perceived_owner'
  | 'updated_at'
>

const CELL_SPEC_SELECT =
  'id, function, form, value_props, owner, perceived_owner, updated_at'

/**
 * Spec fields for one cell (panel Overview tab). The grid query deliberately
 * omits these columns; the panel fetches them on open. `null` data = the
 * cell only exists in local fallback content — spec sections stay hidden.
 * Bump `reloadToken` to refetch after a save.
 */
export function useCellSpec(
  cellId: string | null,
  reloadToken = 0,
): QueryResult<CellSpec | null> {
  const fallback = useCallback(() => null, [])

  return useSupabaseQuery<CellSpec | null>(
    `cell-spec:${cellId ?? 'none'}:${reloadToken}`,
    async (client) => {
      if (!cellId) return null
      const { data, error } = await client
        .from('cells')
        .select(CELL_SPEC_SELECT)
        .eq('id', cellId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data ?? null
    },
    fallback,
  )
}
