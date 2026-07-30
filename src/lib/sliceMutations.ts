import type { SupabaseClient } from '@supabase/supabase-js'
import {
  asUpdatedAtToken,
  readWriteOutcome,
  type UpdatedAtToken,
} from '@/lib/optimisticConcurrency'
import { originAfterEdit, type DraftFrame, type SliceType } from '@/lib/sliceValidation'
import type { Database, Slice } from '@/types/database'

type Client = SupabaseClient<Database>

/** Delete a slice; slice_items cascade in the database. */
export async function deleteSlice(client: Client, sliceId: string): Promise<void> {
  const { error } = await client.from('slices').delete().eq('id', sliceId)
  if (error) throw new Error(error.message)
}

export type NewSlice = {
  lifecycleId: string
  title: string
  description: string
  sliceType: SliceType
  actor: string
  /** Ordered cell ids; one frame per cell unless `frames` is given. */
  cellIds: readonly string[]
  frames?: readonly DraftFrame[]
}

/**
 * Create a slice and its frames.
 *
 * `origin` is `human` — this slice was authored here, so the slice skill will
 * never regenerate over it. Frames default to one cell each: that is the
 * honest reading of a selection made by clicking cells one at a time, and
 * merging them afterwards is one click in the editor.
 *
 * The two inserts are not one transaction (PostgREST has no multi-statement
 * write). The slice row is therefore inserted first and the frames second: a
 * failure between them leaves an empty slice, which is visible and
 * deletable — the reverse order would leave orphan frames pointing at
 * nothing.
 */
export async function createSlice(
  client: Client,
  input: NewSlice,
): Promise<Slice> {
  const { data, error } = await client
    .from('slices')
    .insert({
      service_lifecycle_id: input.lifecycleId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      slice_type: input.sliceType,
      actor: input.actor.trim() || null,
      origin: 'human',
    })
    .select()
    .single()
  if (error) throw new Error(error.message)

  const frames: DraftFrame[] =
    input.frames?.map((frame) => ({ ...frame })) ??
    input.cellIds.map((cellId) => ({ cells: [cellId], caption: '', narrative: '' }))

  await replaceSliceFrames(client, data.id, frames)
  return data
}

/**
 * Replace a slice's frames wholesale.
 *
 * Delete-then-insert rather than a per-row diff: frame identity is position,
 * and reordering by position update trips the uniqueness constraint halfway
 * through unless every move is staged. Replacing sidesteps the whole class of
 * problem, and a slice has tens of frames, not thousands.
 *
 * `cell_keys` is written as the cell ids themselves. Human-authored slices
 * have no IR key path to record — the slice skill fills real key paths when
 * it generates one. The column is a recovery trail, and an id is a better
 * trail than an empty array.
 */
export async function replaceSliceFrames(
  client: Client,
  sliceId: string,
  frames: readonly DraftFrame[],
): Promise<void> {
  const { error: deleteError } = await client
    .from('slice_items')
    .delete()
    .eq('slice_id', sliceId)
  if (deleteError) throw new Error(deleteError.message)

  if (frames.length === 0) return

  const rows = frames.map((frame, position) => ({
    slice_id: sliceId,
    position,
    cell_ids: [...frame.cells],
    cell_keys: [...frame.cells],
    caption: frame.caption.trim() || null,
    narrative: frame.narrative.trim() || null,
  }))

  const { error } = await client.from('slice_items').insert(rows)
  if (error) throw new Error(error.message)
}

export type SliceMetaUpdate = {
  title: string
  description: string
  sliceType: SliceType
  actor: string
  /** Current origin; an edit promotes `generated` to `customized`. */
  origin: string
}

/**
 * Update a slice's own fields under an optimistic-concurrency guard.
 *
 * Returns `conflict` when the row moved under us — the caller refetches to
 * find out whether it was edited elsewhere or deleted outright.
 */
export async function updateSliceMeta(
  client: Client,
  sliceId: string,
  token: UpdatedAtToken,
  update: SliceMetaUpdate,
) {
  const { data, error } = await client
    .from('slices')
    .update({
      title: update.title.trim(),
      description: update.description.trim() || null,
      slice_type: update.sliceType,
      actor: update.actor.trim() || null,
      origin: originAfterEdit(update.origin),
      // updated_at is trigger-maintained — never set it here.
    })
    .eq('id', sliceId)
    .eq('updated_at', token)
    .select()
  return readWriteOutcome<Slice>(data, error)
}

/** The token a guarded update needs, taken verbatim from a loaded row. */
export function sliceToken(slice: Pick<Slice, 'updated_at'>): UpdatedAtToken {
  return asUpdatedAtToken(slice.updated_at)
}
