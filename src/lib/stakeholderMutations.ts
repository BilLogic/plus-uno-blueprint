import type { SupabaseClient } from '@supabase/supabase-js'
import { recordChange } from '@/lib/authoringSession'
import { toAuthoringError } from '@/lib/authoringErrors'
import { requireRowsWritten } from '@/lib/optimisticConcurrency'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

export type StakeholderInput = {
  name: string
  kind: string
  /**
   * What this party IS, in one line. A DEFINITION, not an aside — the
   * column was called `note` until 20260830170000 and every row in it was
   * already a definition, which is how eighteen of them ended up written
   * into a column no reader had any reason to look in.
   */
  summary: string | null
  aliases: string[]
}

/**
 * Add someone to the deployment's cast.
 *
 * Deliberately rare: the registry is reference data, and the seed already
 * holds everyone this blueprint names. A new row means a new actor, not a new
 * spelling of an existing one — those go in `aliases`. The cast is the
 * deployment's, not a service's (ADR 0014), so no service is named on insert;
 * `name` is unique across the whole deployment.
 */
export async function createStakeholder(
  client: Client,
  input: StakeholderInput,
): Promise<string> {
  const { data, error } = await client
    .from('stakeholders')
    .insert({
      name: input.name.trim(),
      kind: input.kind,
      summary: input.summary?.trim() || null,
      aliases: input.aliases.map((entry) => entry.trim()).filter(Boolean),
    })
    .select('id')
    .single()
  if (error) throw toAuthoringError(error)
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
      summary: input.summary?.trim() || null,
      aliases: input.aliases.map((entry) => entry.trim()).filter(Boolean),
    })
    .eq('id', stakeholderId)
    .select('id')
  if (error) throw toAuthoringError(error)
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
  if (error) throw toAuthoringError(error)
}
