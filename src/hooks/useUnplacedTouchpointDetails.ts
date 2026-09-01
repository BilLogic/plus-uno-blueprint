import { useCallback } from 'react'
import {
  invalidateQueries,
  useSupabaseQuery,
  type QueryResult,
} from '@/hooks/useSupabaseQuery'
import {
  unplacedQueue,
  type RawUnplacedDetail,
  type UnplacedDetail,
} from '@/lib/unplacedTouchpointDetails'

/** One key for the whole queue — it is one list, read whole. */
export const UNPLACED_QUEUE_KEY = 'unplaced-touchpoint-details'

/**
 * Drop the cached queue and refetch mounted readers.
 *
 * Called from four places, and each of them REMOVES or ADDS a row: placing,
 * discarding, reverting either, and a content save that took a written-on
 * touchpoint out of a cell. The last is the one that is easy to forget — the
 * queue grows without anybody having opened it.
 */
export function invalidateUnplacedQueue(): void {
  invalidateQueries(UNPLACED_QUEUE_KEY)
}

/*
  Nothing in here may carry a comment: PostgREST parses this string.

  The cell comes with the row because the queue is unreadable without it. A
  name that matched nothing is not a question anybody can answer; the same name
  beside what the cell actually shows, and where that cell is, is.
*/
const UNPLACED_QUEUE_SELECT = `
  id,
  cell_id,
  name,
  summary,
  screenshot,
  url,
  origin,
  created_at,
  cells (
    content,
    lanes!cells_lane_id_fkey ( name ),
    steps ( name ),
    paths (
      name,
      scenarios ( name, phases ( name ) )
    ),
    cell_touchpoints (
      position,
      touchpoint_id,
      touchpoints ( name )
    )
  )
`

/**
 * Every touchpoint detail waiting for somebody to say where it belongs.
 *
 * Whole-service rather than per-cell, because the queue is a body of work and
 * its size is the fact worth knowing: 57 of the 117 authored details were in
 * this state and nothing anywhere reported it. The fallback returns an empty
 * list rather than null, so a no-database board says "nothing waiting" instead
 * of erroring — the hand-written blueprints in `src/data` carry no queue and
 * never will.
 */
export function useUnplacedTouchpointDetails(): QueryResult<UnplacedDetail[]> {
  const fallback = useCallback(() => [] as UnplacedDetail[], [])

  return useSupabaseQuery<UnplacedDetail[]>(
    UNPLACED_QUEUE_KEY,
    async (client, signal) => {
      const { data, error } = await client
        .from('unplaced_touchpoint_details')
        .select(UNPLACED_QUEUE_SELECT)
        .abortSignal(signal)
      if (error) throw new Error(error.message)
      return unplacedQueue((data ?? []) as unknown as RawUnplacedDetail[])
    },
    fallback,
  )
}
