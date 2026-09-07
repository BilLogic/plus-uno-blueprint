import { useCallback } from 'react'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'

export type RegistryTouchpoint = { id: string; name: string; kind: string }

/**
 * The registry a placement can link to: every touchpoint in the deployment
 * (#277).
 *
 * The registry belongs to the DEPLOYMENT, not to a service (ADR 0014), so the
 * read is unscoped — a touchpoint minted for one service is reachable from any
 * of them, which is the whole point of a shared pool. The template resolved a
 * cell's owning service through its path, scenario and phase and filtered on
 * that; the join went with the column, and both sides read the whole registry
 * now.
 *
 * `kind` comes back with the name because the picker shows what a touchpoint
 * IS as well as what it is called — two entries can be spelled almost the
 * same and be an app and a document.
 *
 * Still keyed by the cell, because that is what the panel has and the key
 * keeps each panel's query cached separately.
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
        .select('id, name, kind')
        .order('name')
        .abortSignal(signal)
      if (error) throw error
      return (data ?? []).map((row) => ({ id: row.id, name: row.name, kind: row.kind }))
    },
    fallback,
  )
}

/**
 * A cell's name-only placements — the rows a "Link to registry" acts on.
 *
 * Asked of the table rather than filtered out of the board's placements,
 * because the panel that offers the action is open on ONE cell and the
 * question is about that cell's rows. `is('touchpoint_id', null)` is the
 * whole predicate: a row with an id and no registry link is name-only. The
 * board-side predicate `isNameOnlyPlacement` also insists on a real row id,
 * because a fallback placement has neither half and reading the registry
 * link alone would call every touchpoint on a hand-written board name-only.
 */
export type NameOnlyPlacement = { id: string; name: string }

export function useNameOnlyPlacements(
  cellId: string | null,
): QueryResult<NameOnlyPlacement[]> {
  const fallback = useCallback(() => [], [])
  return useSupabaseQuery<NameOnlyPlacement[]>(
    cellId ? `name-only-placements:${cellId}` : null,
    async (client, signal) => {
      const { data, error } = await client
        .from('cell_touchpoints')
        .select('id, name')
        .eq('cell_id', cellId!)
        .is('touchpoint_id', null)
        .order('position')
        .abortSignal(signal)
      if (error) throw error
      return (data ?? []).flatMap((row) =>
        row.name ? [{ id: row.id, name: row.name }] : [],
      )
    },
    fallback,
  )
}
