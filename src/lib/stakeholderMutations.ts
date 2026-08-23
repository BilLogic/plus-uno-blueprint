import type { SupabaseClient } from '@supabase/supabase-js'
import { recordChange } from '@/lib/authoringSession'
import { requireRowsWritten } from '@/lib/optimisticConcurrency'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

export type StakeholderInput = {
  name: string
  kind: string
  note: string | null
  aliases: string[]
}

/**
 * Add someone to the service's cast.
 *
 * Deliberately rare: the registry is reference data, and the seed already
 * holds everyone this blueprint names. A new row means a new actor in the
 * service, not a new spelling of an existing one — those go in `aliases`.
 */
export async function createStakeholder(
  client: Client,
  serviceId: string,
  input: StakeholderInput,
): Promise<string> {
  const { data, error } = await client
    .from('stakeholders')
    .insert({
      service_id: serviceId,
      name: input.name.trim(),
      kind: input.kind,
      note: input.note?.trim() || null,
      aliases: input.aliases.map((entry) => entry.trim()).filter(Boolean),
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  recordChange(
    'create_stakeholder',
    { stakeholder_id: data.id, name: input.name.trim() },
    { fn: 'delete_stakeholder', args: { stakeholder_id: data.id } },
  )
  return data.id
}

/**
 * Edit one. Renaming rewrites `slices.actor` on every linked slice through a
 * database trigger — the registry owns that text once a slice is linked, so a
 * rename cannot leave a slice quoting the old spelling.
 */
export async function updateStakeholder(
  client: Client,
  stakeholderId: string,
  input: StakeholderInput,
  previous?: StakeholderInput,
  options: { record?: boolean } = {},
): Promise<void> {
  const { data, error } = await client
    .from('stakeholders')
    .update({
      name: input.name.trim(),
      kind: input.kind,
      note: input.note?.trim() || null,
      aliases: input.aliases.map((entry) => entry.trim()).filter(Boolean),
    })
    .eq('id', stakeholderId)
    .select('id')
  if (error) throw new Error(error.message)
  requireRowsWritten(data, 'stakeholder')
  if (options.record !== false) {
    recordChange(
      'update_stakeholder',
      { stakeholder_id: stakeholderId, name: input.name.trim() },
      previous
        ? {
            fn: 'update_stakeholder',
            args: { stakeholder_id: stakeholderId, update: previous },
          }
        : undefined,
    )
  }
}

/** Undo of "added someone" — never offered as a tool of its own. */
export async function deleteStakeholder(
  client: Client,
  stakeholderId: string,
): Promise<void> {
  const { error } = await client
    .from('stakeholders')
    .delete()
    .eq('id', stakeholderId)
  if (error) throw new Error(error.message)
}
