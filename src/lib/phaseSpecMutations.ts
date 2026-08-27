import type { SupabaseClient } from '@supabase/supabase-js'
import { recordChange } from '@/lib/authoringSession'
import { requireRowsWritten } from '@/lib/optimisticConcurrency'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

export type PhaseSpecUpdate = {
  summary: string
  businessImpact: string
  operationalRequirements: string
}

/**
 * Write a phase's spec columns.
 *
 * `business_impact` and `operational_requirements` have carried a column grant
 * since the analysis tier shipped; `summary` got one in
 * `20260820160000_phases_scenarios_description_to_summary.sql`, which is the
 * migration that made this panel possible at all — before it, the column the
 * panel labels Summary was not writable by anyone but the service key.
 *
 * `name` is not here: renaming a phase is a structural edit with its own RPC
 * and its own ledger entry.
 */
export async function updatePhaseSpec(
  client: Client,
  phaseId: string,
  update: PhaseSpecUpdate,
  /** The values being replaced — captured so the change can be reverted. */
  previous?: PhaseSpecUpdate,
  /** `record: false` = revert path; see updateCellSpec for the why. */
  options: { record?: boolean } = {},
): Promise<void> {
  const { data, error } = await client
    .from('phases')
    .update({
      summary: update.summary.trim() || null,
      business_impact: update.businessImpact.trim() || null,
      operational_requirements: update.operationalRequirements.trim() || null,
    })
    .eq('id', phaseId)
    .select('id')
  if (error) throw new Error(error.message)
  requireRowsWritten(data, 'phase')

  if (options.record !== false) {
    recordChange(
      'update_phase_spec',
      { phase_id: phaseId },
      previous
        ? {
            fn: 'update_phase_spec',
            args: { phase_id: phaseId, update: previous },
          }
        : undefined,
    )
  }
}
