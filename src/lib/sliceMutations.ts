import type { SupabaseClient } from '@supabase/supabase-js'
import { recordChange } from '@/lib/authoringSession'
import {
  asUpdatedAtToken,
  readWriteOutcome,
  type UpdatedAtToken,
} from '@/lib/optimisticConcurrency'
import { originAfterEdit, type DraftFrame, type SliceType } from '@/lib/sliceValidation'
import type { Database, Slice } from '@/types/database'

type Client = SupabaseClient<Database>

/**
 * What deleting a slice would destroy.
 *
 * A separate read from `deletion_impact`, which does not and should not know
 * about slices: that function answers "how much of the BLUEPRINT dies", and a
 * slice delete destroys none of it. Trying to squeeze a slice into its shape
 * would put a cell count in front of someone about to delete a slice, which is
 * the exact wrong number — the reassuring fact here is that the cells survive.
 *
 * A plain read: it must never reach the session ledger.
 */
export type SliceDeletionImpact = {
  label: string
  frame_count: number
  /** Distinct blueprint cells this slice points at. They are not deleted. */
  referenced_cell_count: number
}

export async function sliceDeletionImpact(
  client: Client,
  sliceId: string,
): Promise<SliceDeletionImpact> {
  const { data: slice, error: sliceError } = await client
    .from('slices')
    .select('title')
    .eq('id', sliceId)
    .single()
  if (sliceError) throw new Error(sliceError.message)

  const { data: items, error: itemsError } = await client
    .from('slice_items')
    .select('cell_ids')
    .eq('slice_id', sliceId)
  if (itemsError) throw new Error(itemsError.message)

  const cells = new Set<string>()
  for (const item of items ?? []) {
    for (const cellId of item.cell_ids ?? []) cells.add(cellId)
  }

  return {
    label: slice.title,
    frame_count: (items ?? []).length,
    referenced_cell_count: cells.size,
  }
}

/**
 * Delete a slice; slice_items cascade in the database.
 *
 * Recorded in the session ledger with **no** revert, and named in `DESTRUCTIVE`
 * so Save asks twice. There is deliberately no captured inverse: unlike a
 * scenario or path delete there is no `deleted_structure` archive for slices,
 * so nothing exists to put back. An entry with a revert control that could not
 * actually restore the frames would be worse than one without.
 *
 * `title` is passed only so the change list can name what went — it is not
 * part of the delete.
 */
export async function deleteSlice(
  client: Client,
  sliceId: string,
  title?: string,
): Promise<void> {
  const { error } = await client.from('slices').delete().eq('id', sliceId)
  if (error) throw new Error(error.message)
  recordChange('delete_slice', { slice_id: sliceId, title: title ?? null })
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

/**
 * Copy a slice — row and frames — as "<title> copy".
 *
 * The copy is `origin: 'human'` regardless of the source's origin: the act
 * of duplicating is authorship, and a copy the slice skill could regenerate
 * over would not be the safe scratchpad duplication exists to provide.
 */
export async function duplicateSlice(
  client: Client,
  sliceId: string,
): Promise<Slice> {
  const { data: source, error: sourceError } = await client
    .from('slices')
    .select()
    .eq('id', sliceId)
    .single()
  if (sourceError) throw new Error(sourceError.message)

  const { data: items, error: itemsError } = await client
    .from('slice_items')
    .select()
    .eq('slice_id', sliceId)
    .order('position', { ascending: true })
  if (itemsError) throw new Error(itemsError.message)

  const { data: copy, error: insertError } = await client
    .from('slices')
    .insert({
      service_lifecycle_id: source.service_lifecycle_id,
      title: `${source.title} copy`,
      description: source.description,
      slice_type: source.slice_type,
      actor: source.actor,
      origin: 'human',
    })
    .select()
    .single()
  if (insertError) throw new Error(insertError.message)

  if ((items ?? []).length > 0) {
    const rows = (items ?? []).map((item) => ({
      slice_id: copy.id,
      position: item.position,
      cell_ids: item.cell_ids,
      cell_keys: item.cell_keys,
      caption: item.caption,
      narrative: item.narrative,
      illustration: item.illustration,
    }))
    const { error } = await client.from('slice_items').insert(rows)
    if (error) throw new Error(error.message)
  }

  return copy
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
