import {
  DEV_FALLBACK_SLICES,
  DEV_FALLBACK_SLIDES,
} from '@/data/devSlices'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import { awaitOrAbort, findActiveServiceId } from '@/lib/service'
import type { Slice, Slide } from '@/types/database'

/** Slim frame projection carried on the list — powers client-side
 * membership checks (panel "In slices" footer) without per-cell queries. */
export type SlideListItem = Pick<Slide, 'id' | 'position' | 'cell_ids'>

export type SliceListEntry = Slice & { slides: SlideListItem[] }

// TODO(dev-only): remove after DB slices exist — no-DB dev mode only.
const slicesFallback = (): SliceListEntry[] | null =>
  import.meta.env.DEV
    ? DEV_FALLBACK_SLICES.map((slice) => ({
        ...slice,
        slides: (DEV_FALLBACK_SLIDES[slice.id] ?? []).map((item) => ({
          id: item.id,
          position: item.position,
          cell_ids: item.cell_ids,
        })),
      }))
    : null

/**
 * All slices for one service, ordered by position, each carrying
 * its frames' cell ids. With no explicit `serviceId`, the ACTIVE service is
 * used — the same resolution as `useServicePhases`.
 */
export function useSlices(serviceId?: string): QueryResult<SliceListEntry[]> {
  return useSupabaseQuery<SliceListEntry[]>(
    `slices:${serviceId ?? 'first'}`,
    async (client, signal) => {
      let resolvedServiceId = serviceId
      if (!resolvedServiceId) {
        resolvedServiceId = (await awaitOrAbort(findActiveServiceId(client), signal)) ?? undefined
        if (!resolvedServiceId) return []
      }

      const { data, error } = await client
        .from('slices')
        .select('*, slides (id, position, cell_ids)')
        .eq('service_id', resolvedServiceId)
        .order('position', { ascending: true })
        .abortSignal(signal)
      if (error) throw new Error(error.message)
      return data ?? []
    },
    slicesFallback,
  )
}
