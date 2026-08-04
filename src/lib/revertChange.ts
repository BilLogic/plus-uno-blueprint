import type { SupabaseClient } from '@supabase/supabase-js'
import { toAuthoringError } from '@/lib/authoringErrors'
import type { ChangeEntry } from '@/lib/authoringSession'
import {
  updateCellContent,
  type CellContentUpdate,
} from '@/lib/cellContentMutations'
import { updateCellSpec, type CellSpecUpdate } from '@/lib/cellSpecMutations'
import type { CellLink } from '@/types/blueprint'
import type { Database, Json } from '@/types/database'

type Client = SupabaseClient<Database>

function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key]
  if (typeof value !== 'string' || !value) {
    throw new Error(`This change's revert is missing its “${key}” value.`)
  }
  return value
}

/**
 * Execute a change's captured inverse.
 *
 * The revert's own writes pass `record: false` (or go straight to the
 * database) so undoing "Added a lane" never appends "Deleted a lane" to the
 * very list the row was just removed from. That decision travels *with each
 * call* rather than through a module-level suspend flag — an ambient flag
 * around an `await` also swallowed any ordinary save that happened to
 * resolve while a revert was in flight.
 *
 * The caller removes the entry (`forgetChange`) and re-reads the grid —
 * every revert is structural or content-bearing, and pessimistic re-read is
 * the house rule for both.
 */
export async function executeRevert(
  client: Client,
  entry: ChangeEntry,
): Promise<void> {
  const revert = entry.revert
  if (!revert) {
    throw new Error('This change has nothing recorded to revert it with.')
  }

  switch (revert.fn) {
    case 'update_cell_content': {
      const cellId = stringArg(revert.args, 'cell_id')
      const update = revert.args.update as CellContentUpdate
      await updateCellContent(client, cellId, update, undefined, {
        record: false,
      })
      return
    }
    case 'update_cell_spec': {
      const cellId = stringArg(revert.args, 'cell_id')
      const update = revert.args.update as CellSpecUpdate
      await updateCellSpec(client, cellId, update, undefined, { record: false })
      return
    }
    case 'update_cell_resources': {
      // The captured value is the full pre-write links array — write it
      // back verbatim rather than rebuilding through the draft validator,
      // which could refuse to restore a link it considers malformed.
      const cellId = stringArg(revert.args, 'cell_id')
      const links = revert.args.links as CellLink[]
      const { data, error } = await client
        .from('cells')
        .update({ links: links as unknown as Json })
        .eq('id', cellId)
        .select('id')
      if (error) throw toAuthoringError(error)
      // Zero rows is a real answer: the cell was deleted after this edit.
      if (!data || data.length === 0) {
        throw new Error('That cell no longer exists — nothing to revert onto.')
      }
      return
    }
    case 'rename_owner_tag': {
      // Bulk tag rename, inverted: put the old name back everywhere the
      // new one now appears, in both owner columns.
      const from = stringArg(revert.args, 'from')
      const to = stringArg(revert.args, 'to')
      const ownerUpdate = await client
        .from('cells')
        .update({ owner: to })
        .eq('owner', from)
      if (ownerUpdate.error) throw toAuthoringError(ownerUpdate.error)
      const perceivedUpdate = await client
        .from('cells')
        .update({ perceived_owner: to })
        .eq('perceived_owner', from)
      if (perceivedUpdate.error) throw toAuthoringError(perceivedUpdate.error)
      return
    }
    default: {
      // Authoring RPCs called directly never pass through `call()`, so
      // nothing here is recorded — same effect as record:false above.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same seam as authoringRpc.call()
      const { error } = await (client.rpc as any)(revert.fn, revert.args)
      if (error) throw toAuthoringError(error)
    }
  }
}
