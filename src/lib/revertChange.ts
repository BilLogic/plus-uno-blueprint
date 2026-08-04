import type { SupabaseClient } from '@supabase/supabase-js'
import { toAuthoringError } from '@/lib/authoringErrors'
import {
  withRecordingSuspended,
  type ChangeEntry,
} from '@/lib/authoringSession'
import {
  updateCellContent,
  type CellContentUpdate,
} from '@/lib/cellContentMutations'
import { updateCellSpec, type CellSpecUpdate } from '@/lib/cellSpecMutations'
import type { CellLink } from '@/types/blueprint'
import type { Database, Json } from '@/types/database'

type Client = SupabaseClient<Database>

/**
 * Execute a change's captured inverse.
 *
 * Recording is suspended for the duration: undoing "Added a lane" must not
 * append "Deleted a lane" to the very list the row was just removed from.
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

  await withRecordingSuspended(async () => {
    switch (revert.fn) {
      case 'update_cell_content': {
        const cellId = revert.args.cell_id as string
        const update = revert.args.update as CellContentUpdate
        await updateCellContent(client, cellId, update)
        return
      }
      case 'update_cell_spec': {
        const cellId = revert.args.cell_id as string
        const update = revert.args.update as CellSpecUpdate
        await updateCellSpec(client, cellId, update)
        return
      }
      case 'update_cell_resources': {
        // The captured value is the full pre-write links array — write it
        // back verbatim rather than rebuilding through the draft validator,
        // which could refuse to restore a link it considers malformed.
        const cellId = revert.args.cell_id as string
        const links = revert.args.links as CellLink[]
        const { error } = await client
          .from('cells')
          .update({ links: links as unknown as Json })
          .eq('id', cellId)
        if (error) throw toAuthoringError(error)
        return
      }
      default: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same seam as authoringRpc.call()
        const { error } = await (client.rpc as any)(revert.fn, revert.args)
        if (error) throw toAuthoringError(error)
      }
    }
  })
}
