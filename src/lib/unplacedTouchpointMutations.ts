/**
 * The two things an author can do with an unplaced touchpoint detail.
 *
 * Both go through an RPC rather than a table write, and the reason is the one
 * `20260830160000` learned the hard way: PostgREST gives every statement its
 * own transaction. Placing is two statements — write the detail onto the
 * placement, take the row off the queue — and a half-applied place would leave
 * the same words in two places with nothing to say which was real.
 *
 * `place_touchpoint_detail` REFUSES a touchpoint the cell does not display.
 * That refusal is the ticket: creating a placement to hold the detail would
 * put a tool on a cell whose text does not name it, and the next content save
 * would delete it again along with the writing. The queue's job is to offer
 * the cell's own touchpoints and let a person choose one.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json, UnplacedTouchpointDetail } from '@/types/database'
import { recordChange } from '@/lib/authoringSession'
import { toAuthoringError } from '@/lib/authoringErrors'

type Client = SupabaseClient<Database>

/** What a place did, and everything an inverse of it needs. */
export type PlacedDetail = {
  /** The queue row that went, kept whole so it can come back as itself. */
  detail: UnplacedTouchpointDetail
  cellId: string
  touchpointId: string
  touchpointName: string
  /** What the placement was carrying before, so a revert restores it. */
  previous: {
    summary: string | null
    screenshot: string | null
    url: string | null
    role: string | null
  }
}

/**
 * Read the answer, or refuse it.
 *
 * A zero-row write is a failure, not a no-op — the house rule the content
 * writes follow through `requireRowsWritten`. Both functions raise when the
 * row is gone, so this is not the ordinary path; what it catches is a response
 * shaped like a success that names nothing, which would let the caller record
 * an inverse for something that never happened.
 */
function readDetail(data: unknown): UnplacedTouchpointDetail {
  const row = (data as { detail?: unknown } | null)?.detail as
    | UnplacedTouchpointDetail
    | undefined
  if (!row || typeof row !== 'object' || typeof row.id !== 'string') {
    throw new Error('That detail is no longer waiting — nothing was changed.')
  }
  return row
}

/**
 * Put one detail's words onto a touchpoint the cell already shows.
 *
 * `touchpointId` must come from the cell's own placements — `unplacedQueue`
 * builds that list — and the database checks it again, because a client-side
 * list is a convenience and this is the invariant.
 */
export async function placeTouchpointDetail(
  client: Client,
  detailId: string,
  touchpointId: string,
  /**
   * Session-log participation, decided per call rather than by ambient module
   * state — the same reasoning as `updateCellContent`. A revert passes
   * `record: false` so taking a place back never logs a new place.
   */
  options: { record?: boolean } = {},
): Promise<PlacedDetail> {
  const { data, error } = await client.rpc('place_touchpoint_detail', {
    p_detail_id: detailId,
    p_touchpoint_id: touchpointId,
  })
  if (error) throw toAuthoringError(error)

  const detail = readDetail(data)
  const answer = data as {
    touchpoint_name?: unknown
    previous?: Record<string, string | null>
  }
  const placed: PlacedDetail = {
    detail,
    cellId: detail.cell_id,
    touchpointId,
    touchpointName:
      typeof answer.touchpoint_name === 'string' ? answer.touchpoint_name : '',
    previous: {
      summary: answer.previous?.summary ?? null,
      screenshot: answer.previous?.screenshot ?? null,
      url: answer.previous?.url ?? null,
      role: answer.previous?.role ?? null,
    },
  }

  if (options.record !== false) {
    recordChange(
      'place_touchpoint_detail',
      {
        detail_id: detailId,
        cell_id: placed.cellId,
        name: detail.name,
        touchpoint_name: placed.touchpointName,
      },
      // Both halves, in one call: the queue row comes back as itself — same
      // id — and the placement gets the words it had before. Restoring only
      // the queue row would leave the detail written in two places; restoring
      // only the placement would lose the row.
      {
        fn: 'restore_touchpoint_detail',
        args: {
          detail: detail as unknown as Json,
          placement: {
            cell_id: placed.cellId,
            touchpoint_id: touchpointId,
            ...placed.previous,
          },
        },
      },
    )
  }

  return placed
}

/** Throw one away. Destructive, so the row it destroyed rides in the inverse. */
export async function discardTouchpointDetail(
  client: Client,
  detailId: string,
  options: { record?: boolean } = {},
): Promise<UnplacedTouchpointDetail> {
  const { data, error } = await client.rpc('discard_touchpoint_detail', {
    p_detail_id: detailId,
  })
  if (error) throw toAuthoringError(error)

  const detail = readDetail(data)

  if (options.record !== false) {
    recordChange(
      'discard_touchpoint_detail',
      { detail_id: detailId, cell_id: detail.cell_id, name: detail.name },
      {
        fn: 'restore_touchpoint_detail',
        args: { detail: detail as unknown as Json, placement: null },
      },
    )
  }

  return detail
}

/** What a revert hands back to `restore_touchpoint_detail`. */
export type RestoredPlacement = {
  cell_id: string
  touchpoint_id: string
  summary: string | null
  screenshot: string | null
  url: string | null
  role: string | null
}

/**
 * The inverse of both, and never recorded itself — a revert that logged its
 * own undo would put the ledger into a loop.
 */
export async function restoreTouchpointDetail(
  client: Client,
  detail: UnplacedTouchpointDetail,
  placement: RestoredPlacement | null,
): Promise<void> {
  const { error } = await client.rpc('restore_touchpoint_detail', {
    p_detail: detail as unknown as Json,
    p_placement: (placement ?? null) as unknown as Json | null,
  })
  if (error) throw toAuthoringError(error)
}
