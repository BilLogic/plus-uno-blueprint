import type { SupabaseClient } from '@supabase/supabase-js'
import { recordChange } from '@/lib/authoringSession'
import { requireRowsWritten } from '@/lib/optimisticConcurrency'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

export type ServiceSummaryUpdate = { summary: string }

export type BusinessModelUpdate = {
  funding: string
  pricing: string
  deliveryCost: string
  revenueModel: string
  partners: string
}

/**
 * The service's own sentence.
 *
 * `name` is not writable from here for the same reason a scenario's is not:
 * renaming the root is structure, and structure goes through an RPC.
 */
export async function updateServiceSummary(
  client: Client,
  serviceId: string,
  summary: string,
  previous?: string,
  options: { record?: boolean } = {},
): Promise<void> {
  const { data, error } = await client
    .from('services')
    .update({ summary: summary.trim() || null })
    .eq('id', serviceId)
    .select('id')
  if (error) throw new Error(error.message)
  requireRowsWritten(data, 'service')

  if (options.record !== false) {
    recordChange(
      'update_service_summary',
      { service_id: serviceId },
      previous === undefined
        ? undefined
        : {
            fn: 'update_service_summary',
            args: { service_id: serviceId, summary: previous },
          },
    )
  }
}

/**
 * How the service is funded, priced and delivered.
 *
 * Five columns on one row, written together: they are one answer, and a
 * partial save would leave the panel describing a business model nobody
 * chose. The row is guaranteed to exist — the migration that renamed this
 * table also seeded it — so this is always an update, never an upsert.
 */
export async function updateBusinessModel(
  client: Client,
  serviceId: string,
  update: BusinessModelUpdate,
  previous?: BusinessModelUpdate,
  options: { record?: boolean } = {},
): Promise<void> {
  const { data, error } = await client
    .from('business_model')
    .update({
      funding: update.funding.trim() || null,
      pricing: update.pricing.trim() || null,
      delivery_cost: update.deliveryCost.trim() || null,
      revenue_model: update.revenueModel.trim() || null,
      partners: update.partners.trim() || null,
    })
    .eq('service_id', serviceId)
    .select('service_id')
  if (error) throw new Error(error.message)
  requireRowsWritten(data, 'business model')

  if (options.record !== false) {
    recordChange(
      'update_business_model',
      { service_id: serviceId },
      previous === undefined
        ? undefined
        : {
            fn: 'update_business_model',
            args: { service_id: serviceId, ...previous },
          },
    )
  }
}
