import { useCallback } from 'react'
import { useSupabaseQuery, type QueryResult } from '@/hooks/useSupabaseQuery'
import { useSupabase } from '@/contexts/SupabaseProvider'
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
  /**
   * How the service is funded, priced and delivered.
   *
   * Restricted: `business_models` is readable by `authenticated` only. A
   * signed-out reader gets `businessModelVisible: false` and five empty
   * strings, and the panel leaves the section out entirely rather than showing
   * five blanks that look like an unauthored service.
   */
  businessModelVisible: boolean
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
 * row — so this panel paints its placeholder like the other three. The
 * business model rides the second trip beside the counts rather than embedding
 * in the first, because it is the one restricted table in the set.
 *
 * `business_models` is revoked from `anon` and its select policy names
 * `authenticated`. Embedded in the `services` select, a signed-out reader's
 * request is refused WHOLE — PostgREST returns 42501 for the join, not a null
 * column — so every anonymous visitor to production saw "permission denied for
 * table business_models" above the board and lost the summary and the
 * examples, which anon may read perfectly well (#442).
 *
 * Split out AND asked only when the reader may have it. `canReadPrivate` is
 * the provider's answer to "would the database let this client read a table
 * outside the public surface"; a request sent regardless would be refused for
 * every visitor on every load, and would have to swallow its own error to stay
 * harmless — which swallows a real outage with it.
 */
export function useServiceSpec(): QueryResult<ServiceSpec | null> {
  const { canReadPrivate, isLoading: sessionLoading } = useSupabase()
  const fallback = useCallback(() => null, [])

  return useSupabaseQuery<ServiceSpec | null>(
    /*
      Two keys, one per reader, because what the read ASKS FOR differs between
      them: `staleTime` is infinite, so a single key would serve an author the
      answer their signed-out first paint cached, and the business model would
      stay missing until a mutation or a reload. Both begin `service-spec:first`
      — the prefix `ServicePanel` invalidates — and both are gated until the
      session is known, so nobody pays for the anonymous read and then the
      signed-in one. `getSession()` resolves from storage; this is not a
      network wait.

      Constant otherwise: there is exactly one active service per page load
      (the switcher is a later ticket). The READ, below, scopes to the active
      service the URL slug names rather than always taking the first row.
    */
    sessionLoading
      ? null
      : `service-spec:first:${canReadPrivate ? 'auth' : 'anon'}`,
    async (client, signal) => {
      const { data: serviceRows, error } = await client
        .from('services')
        .select('id, name, slug, summary, entity_examples')
        .order('created_at')
        .abortSignal(signal)
      if (error) throw new Error(error.message)

      // The active service is the one the URL slug names, matched by its `slug`
      // column (see `serviceSlug` — a name-derived fallback covers a null
      // column). At the bare root — the single-service case — no slug is set
      // and this is the first row by `created_at`, as before.
      const slug = getActiveServiceSlug()
      const service = slug
        ? resolveServiceBySlug(serviceRows ?? [], slug)
        : (serviceRows?.[0] ?? null)
      if (!service) return null

      // Together, not one after the other: both need the service id and
      // neither needs the other, so an author pays the same two round trips a
      // visitor does rather than three.
      const [phaseResponse, modelResponse] = await Promise.all([
        client
          .from('phases')
          .select('id, scenarios(id)')
          .eq('service_id', service.id)
          .abortSignal(signal),
        canReadPrivate
          ? client
              .from('business_models')
              .select('funding, pricing, delivery_cost, revenue_model, partners')
              .eq('service_id', service.id)
              .abortSignal(signal)
              .maybeSingle()
          : null,
      ])

      if (phaseResponse.error) throw new Error(phaseResponse.error.message)
      // Surfaced, not swallowed. This request is only made by a reader the
      // grant covers, so an error here is a genuine failure rather than the
      // ordinary signed-out case — and the ordinary case never gets this far.
      if (modelResponse?.error) throw new Error(modelResponse.error.message)

      const model = modelResponse?.data ?? null
      const rows = phaseResponse.data ?? []
      return {
        id: service.id as string,
        name: service.name as string,
        summary: (service.summary as string | null) ?? '',
        businessModelVisible: Boolean(model),
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
