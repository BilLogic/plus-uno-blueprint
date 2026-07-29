import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import type { Slice, SliceItem } from '@/types/database'

export type SliceDetail = {
  slice: Slice
  items: SliceItem[]
}

const noSliceFallback = (): SliceDetail | null => null

/** One slice with its frames (`slice_items`), items ordered by position. */
export function useSlice(sliceId: string): QueryResult<SliceDetail> {
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
    noSliceFallback,
  )
}
