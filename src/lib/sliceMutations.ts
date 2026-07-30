import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveFirstLifecycleId } from '@/lib/lifecycle'
import {
  updateWithConcurrency,
  type ConcurrencyOutcome,
} from '@/lib/mutations'
import type { Database, Slice, SliceItem } from '@/types/database'

type Client = SupabaseClient<Database>

/**
 * Create a slice from selected cells: one slices row plus a single
 * slice_items frame holding all cells in grid order (v1 — the slice skill
 * regroups frames per phase when it storyboards).
 *
 * TODO(map-skill): cell_keys carry the cell's own id as a placeholder —
 * real IR key-paths cannot be derived client-side and come from the skill.
 */
export async function createSliceFromCells(
  client: Client,
  options: {
    title: string
    cellIds: readonly string[]
    position: number
  },
): Promise<Slice> {
  const lifecycleId = await resolveFirstLifecycleId(client)

  const { data: slice, error: sliceError } = await client
    .from('slices')
    .insert({
      service_lifecycle_id: lifecycleId,
      slice_type: 'custom',
      title: options.title,
      origin: 'customized',
      position: options.position,
    })
    .select()
    .single()
  if (sliceError) throw new Error(sliceError.message)

  const { error: itemError } = await client.from('slice_items').insert({
    slice_id: slice.id,
    position: 1,
    cell_ids: [...options.cellIds],
    cell_keys: [...options.cellIds],
  })
  if (itemError) throw new Error(itemError.message)

  return slice
}

/** Delete a slice; slice_items cascade in the database. */
export async function deleteSlice(client: Client, sliceId: string): Promise<void> {
  const { error } = await client.from('slices').delete().eq('id', sliceId)
  if (error) throw new Error(error.message)
}

/** Any successful human edit flips origin so regeneration knows to confirm. */
export async function markSliceCustomized(
  client: Client,
  slice: Pick<Slice, 'id' | 'origin' | 'updated_at'>,
): Promise<void> {
  if (slice.origin === 'customized') return
  // Best effort: a conflict here means someone else already touched the
  // slice — the caller reloads either way.
  await updateWithConcurrency(
    client,
    'slices',
    slice.id,
    { origin: 'customized' },
    slice.updated_at,
  )
}

export async function updateSliceItem(
  client: Client,
  item: Pick<SliceItem, 'id' | 'updated_at'>,
  patch: Database['public']['Tables']['slice_items']['Update'],
): Promise<ConcurrencyOutcome<SliceItem>> {
  return updateWithConcurrency(client, 'slice_items', item.id, patch, item.updated_at)
}

export async function insertSliceItem(
  client: Client,
  row: Database['public']['Tables']['slice_items']['Insert'],
): Promise<SliceItem> {
  const { data, error } = await client
    .from('slice_items')
    .insert(row)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

/**
 * Renumber items to 1..n following `orderedItems`. The (slice_id, position)
 * unique constraint is deferrable but each PostgREST request commits its own
 * transaction, so a direct permutation write can still collide — two passes
 * through a disjoint temporary range keep every intermediate commit unique.
 * Returns false when a concurrent edit interrupted the renumber (caller
 * reloads).
 */
export async function renumberSliceItems(
  client: Client,
  orderedItems: readonly Pick<SliceItem, 'id' | 'position' | 'updated_at'>[],
): Promise<boolean> {
  const maxPosition = orderedItems.reduce(
    (max, item) => Math.max(max, item.position),
    0,
  )
  const offset = maxPosition + 1

  const tokens = new Map(
    orderedItems.map((item) => [item.id, item.updated_at]),
  )

  for (const [index, item] of orderedItems.entries()) {
    const outcome = await updateWithConcurrency(
      client,
      'slice_items',
      item.id,
      { position: offset + index },
      tokens.get(item.id) ?? item.updated_at,
    )
    if (outcome.conflict) return false
    tokens.set(item.id, outcome.row.updated_at)
  }

  for (const [index, item] of orderedItems.entries()) {
    const outcome = await updateWithConcurrency(
      client,
      'slice_items',
      item.id,
      { position: index + 1 },
      tokens.get(item.id) ?? item.updated_at,
    )
    if (outcome.conflict) return false
  }

  return true
}
