import { useCallback } from 'react'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import type { EntityExamples } from '@/lib/panelTerms'

// Re-exported from its canonical home in `panelTerms`, beside the kinds it is
// keyed by, so a caller that already reads the service spec need not learn a
// second import path for the shape it carries.
export type { EntityExamples }

export type ServiceSpec = {
  id: string
  name: string
  summary: string
  /** How the service is funded, priced and delivered. One row, always present. */
  funding: string
  pricing: string
  deliveryCost: string
  revenueModel: string
  partners: string
  /** The six per-kind examples, `{}` until a deployer authors any. */
  entityExamples: EntityExamples
  /** What the panel says under the title: how much board there is. */
  phaseCount: number
  scenarioCount: number
}

/**
 * The service, and its business model.
 *
 * Two round-trips rather than one — the counts cannot be taken from the same
 * row — so this panel paints its placeholder like the other three.
 */
export function useServiceSpec(): QueryResult<ServiceSpec | null> {
  const fallback = useCallback(() => null, [])

  return useSupabaseQuery<ServiceSpec | null>(
    // One service per deployment, so the query takes the first by `created_at`
    // and the key is a constant. It used to accept a `serviceId` it never read
    // while still baking it into the cache key — so a real id would have
    // cached the FIRST service's data under that id's key, and ServicePanel's
    // hardcoded invalidation of `service-spec:first` would then have missed
    // it. Both callers passed null, so the lie never cost anything; the
    // parameter is gone rather than honoured because multi-service is plan
    // 004 and pinned.
    'service-spec:first',
    async (client, signal) => {
      const { data: service, error } = await client
        .from('services')
        .select('id, name, summary, entity_examples, business_models(funding, pricing, delivery_cost, revenue_model, partners)')
        .order('created_at')
        .limit(1)
        .abortSignal(signal)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!service) return null

      const model = (Array.isArray(service.business_models)
        ? service.business_models[0]
        : service.business_models) as
        | {
            funding: string | null
            pricing: string | null
            delivery_cost: string | null
            revenue_model: string | null
            partners: string | null
          }
        | null
        | undefined

      const { data: phases, error: phaseError } = await client
        .from('phases')
        .select('id, scenarios(id)')
        .eq('service_id', service.id)
        .abortSignal(signal)
      if (phaseError) throw new Error(phaseError.message)

      const rows = phases ?? []
      return {
        id: service.id as string,
        name: service.name as string,
        summary: (service.summary as string | null) ?? '',
        funding: model?.funding ?? '',
        pricing: model?.pricing ?? '',
        deliveryCost: model?.delivery_cost ?? '',
        revenueModel: model?.revenue_model ?? '',
        partners: model?.partners ?? '',
        // A jsonb object the app owns the shape of; `{}` when nothing is
        // authored, and never null (the column defaults to `{}`).
        entityExamples: (service.entity_examples as EntityExamples | null) ?? {},
        phaseCount: rows.length,
        scenarioCount: rows.reduce(
          (total, row) =>
            total + ((row.scenarios as unknown[] | null)?.length ?? 0),
          0,
        ),
      }
    },
    fallback,
  )
}
