import { useCallback } from 'react'
import {
  DEV_FALLBACK_SLICES,
  DEV_FALLBACK_SLICE_ITEMS,
} from '@/data/devSlices'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import type { Slice, SliceItem } from '@/types/database'

export type SliceDetail = {
  slice: Slice
  items: SliceItem[]
}

// TODO(dev-only): remove after DB slices exist — no-DB dev mode only.
function devSliceFallback(sliceId: string): SliceDetail | null {
  if (!import.meta.env.DEV) return null
  const slice = DEV_FALLBACK_SLICES.find((entry) => entry.id === sliceId)
  if (!slice) return null
  return { slice, items: DEV_FALLBACK_SLICE_ITEMS[slice.id] ?? [] }
}

/**
 * One slice with its frames (`slice_items`), items ordered by position.
 * Cached across mounts; `invalidateQueries('slice:')` drops it.
 */
export function useSlice(sliceId: string): QueryResult<SliceDetail> {
  const fallback = useCallback(() => devSliceFallback(sliceId), [sliceId])

  return useSupabaseQuery<SliceDetail>(
    `slice:${sliceId}`,
    async (client) => {
      const { data: slice, error: sliceError } = await client
        .from('slices')
        .select('*')
        .eq('id', sliceId)
        .maybeSingle()
      if (sliceError) throw new Error(sliceError.message)
      if (!slice) throw new Error('Slice not found')

      const { data: items, error: itemsError } = await client
        .from('slice_items')
        .select('*')
        .eq('slice_id', sliceId)
        .order('position', { ascending: true })
      if (itemsError) throw new Error(itemsError.message)

      return { slice, items: items ?? [] }
    },
    fallback,
  )
}
