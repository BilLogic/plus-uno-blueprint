import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { toAuthoringError } from '@/lib/authoringErrors'
import { recordChange } from '@/lib/authoringSession'

type Client = SupabaseClient<Database>

/** What `rename_touchpoint` hands back. */
export type TouchpointRename = {
  /** The catalog row that was renamed. */
  touchpointId: string
  /** What it is called now. */
  name: string
  /** What it was called — the value an inverse needs. */
  previousName: string
  /** The cells whose text the rename rewrote. */
  cellIds: string[]
}

/**
 * Rename a touchpoint everywhere it is.
 *
 * One RPC, because a rename has two halves and they have to move together.
 * The catalog row is what the board draws, so changing it alone moves every
 * pill on screen at once — and `cells.content` still holds the OLD string,
 * which a content save re-derives placements from. Leave the text behind and
 * the next edit to any affected cell hands `sync_cell_touchpoints` the stale
 * name, the renamed placement is deleted with its summary and screenshot,
 * and a fresh catalog entry appears under the old name in its place. The
 * rename undoes itself and the authored detail is gone.
 *
 * A client loop could not fix that: PostgREST gives every statement its own
 * transaction, so a failure part-way would leave the catalog and the text
 * disagreeing, which is the state this ticket exists to end. The function
 * does the catalog row and every bearing cell in one go, matching whole
 * items in the delimited text — renaming `Zoom` leaves `Zoom Recording`
 * alone — and refuses to finish if any bearing cell still names the old
 * value.
 *
 * Which cells it rewrites is decided from the PLACEMENTS, not from a text
 * search, so a cell that happens to spell the same word for another reason
 * is untouched.
 */
export async function renameTouchpoint(
  client: Client,
  touchpointId: string,
  name: string,
  /**
   * Session-log participation, decided per call rather than by ambient
   * module state — the same reasoning as `updateCellContent`. A revert
   * passes `record: false` so taking a rename back never logs a new rename.
   */
  options: { record?: boolean } = {},
): Promise<TouchpointRename> {
  const wanted = name.trim()
  if (!wanted) {
    throw new Error('A touchpoint needs a name — an empty one is a blank pill.')
  }

  const { data, error } = await client.rpc('rename_touchpoint', {
    p_touchpoint_id: touchpointId,
    p_name: wanted,
  })
  if (error) throw toAuthoringError(error)

  const result = readRename(data)

  if (options.record !== false) {
    recordChange(
      'rename_touchpoint',
      {
        touchpoint_id: touchpointId,
        new_name: result.name,
        // The cells the rename actually rewrote, so the sheet can say how
        // far a one-word edit reached.
        cell_ids: result.cellIds,
      },
      // The inverse is the same operation pointed the other way, keyed on
      // the touchpoint's id rather than on either name. That is what makes
      // it restore BOTH halves: running it puts the catalog row back and
      // rewrites the same cells' text back, in one transaction, exactly as
      // the forward call did. A text-keyed inverse would also rewrite cells
      // that adopted the new name in between.
      {
        fn: 'rename_touchpoint',
        args: { p_touchpoint_id: touchpointId, p_name: result.previousName },
      },
    )
  }

  return result
}

/**
 * Read the rename's answer, or refuse it.
 *
 * A zero-row write is a failure, not a no-op — the house rule the content
 * writes already follow through `requireRowsWritten`. The function raises
 * when the touchpoint is gone, so nothing here is the ordinary path; what
 * this catches is a response that came back shaped like a success while
 * naming nothing, which would let the caller record an inverse for a rename
 * that never happened.
 */
function readRename(data: unknown): TouchpointRename {
  const row = data as {
    touchpoint_id?: unknown
    name?: unknown
    previous_name?: unknown
    cell_ids?: unknown
  } | null

  if (
    !row ||
    typeof row.touchpoint_id !== 'string' ||
    typeof row.name !== 'string' ||
    typeof row.previous_name !== 'string'
  ) {
    throw new Error('That touchpoint no longer exists — nothing was renamed.')
  }

  return {
    touchpointId: row.touchpoint_id,
    name: row.name,
    previousName: row.previous_name,
    cellIds: Array.isArray(row.cell_ids) ? (row.cell_ids as string[]) : [],
  }
}
