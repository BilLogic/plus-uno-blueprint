import { useCallback } from 'react'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import { getActiveServiceSlug } from '@/contexts/activeServiceStore'
import { resolveServiceBySlug } from '@/lib/serviceSlug'
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
    // The key stays constant: there is exactly one active service per page load
    // (the switcher is a later ticket), and `ServicePanel` invalidates this
    // literal key. The READ, below, now scopes to the active service the URL
    // slug names rather than always taking the first row.
    'service-spec:first',
    async (client, signal) => {
      const { data: serviceRows, error } = await client
        .from('services')
        .select(
          'id, name, summary, entity_examples, business_models(funding, pricing, delivery_cost, revenue_model, partners)',
        )
        .order('created_at')
        .abortSignal(signal)
      if (error) throw new Error(error.message)

      // The active service is the one the URL slug names; production has no
      // `slug` column, so it is matched by the slug derived from the name (see
      // `serviceSlug`). At the bare root — the single-service case — no slug is
      // set and this is the first row by `created_at`, as before.
      const slug = getActiveServiceSlug()
      const service = slug
        ? resolveServiceBySlug(serviceRows ?? [], slug)
        : (serviceRows?.[0] ?? null)
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
