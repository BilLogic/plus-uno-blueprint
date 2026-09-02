import type { EntityStatus } from '@/lib/entityStatus'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CellResource } from '@/types/blueprint'
import type { Database, Json } from '@/types/database'
import { recordChange } from '@/lib/authoringSession'
import { toAuthoringError } from '@/lib/authoringErrors'
import { requireRowsWritten } from '@/lib/optimisticConcurrency'
import { validateResourceUrl } from '@/lib/resourceUrl'
import { hostOf } from '@/lib/cellResources'
import { parseCellContentItems } from '@/lib/parseCellContent'

type Client = SupabaseClient<Database>

export type CellContentUpdate = {
  /** The text in the cell on the grid. */
  content: string
  summary: string
  owner: string
  perceivedOwner: string
  status: EntityStatus
}

/**
 * Write the cell's own text.
 *
 * These columns carry a column-level grant from the authoring migration, for
 * the same reason the spec columns do: the panel can edit what a cell *says*
 * without that opening the cell's position — path, lane, step — to the same
 * path. Where a cell sits is structure, and structure goes through the RPCs.
 *
 * `content` is the one field that is never nulled. A cell with no text is a
 * blank box on the grid that cannot be told apart from a gap in the blueprint,
 * so an empty label is refused here rather than stored.
 */
export async function updateCellContent(
  client: Client,
  cellId: string,
  update: CellContentUpdate,
  /** The values being replaced — captured so the change can be reverted. */
  previous?: CellContentUpdate,
  /**
   * Session-log participation, decided per call rather than by ambient
   * module state: a revert passes `record: false` so undoing "edited text"
   * never logs a new edit — while a concurrent ordinary save, in flight at
   * the same moment, still logs itself. A global suspend flag around an
   * `await` swallowed exactly those saves.
   */
  options: { record?: boolean } = {},
): Promise<void> {
  const content = update.content.trim()
  if (!content) {
    throw new Error('A cell needs content — an empty one reads as a gap in the grid.')
  }

  const { data, error } = await client
    .from('cells')
    .update({
      content,
      // Empty means "not specified", stored as null so the read path has one
      // kind of empty to check rather than two.
      summary: update.summary.trim() || null,
      owner: update.owner.trim() || null,
      perceived_owner: update.perceivedOwner.trim() || null,
      // Never null: the column is `not null default 'live'`, and a cell with
      // no status would read as unassessed rather than current.
      status: update.status,
    })
    .eq('id', cellId)
    .select('id')
  if (error) throw toAuthoringError(error)
  // `.select('id')` + this check, not `error === null`: a matched-nothing
  // update is a 200 with an empty array. Without it, editing a cell whose
  // path was since deleted "succeeds", and its revert reports "taken back"
  // having written nothing.
  requireRowsWritten(data, 'cell')
  // The text the author typed IS the list of touchpoints, so the placements
  // the board reads have to follow it. Without this the two diverge from the
  // first save onward, which is the defect this ticket exists to end,
  // arrived at from the other direction.
  //
  // After the content write, not before: a save that fails should leave both
  // the text and the placements as they were, and the row check above is
  // what proves the write landed.
  const removedPlacements = await syncCellTouchpoints(client, cellId, content)
  // Direct table write, so `call()` never sees it — logged here for the same
  // reason and with the same after-success placement.
  if (options.record !== false) {
    recordChange(
      'update_cell_content',
      { cell_id: cellId },
      previous?.content.trim()
        ? {
            fn: 'update_cell_content',
            args: {
              cell_id: cellId,
              update: previous,
              // The writing on any placement this save removed. Restoring the
              // text alone brings the names back and leaves them blank.
              removed_placements: removedPlacements,
            },
          }
        : undefined,
    )
  }
}

/** A placement's per-moment writing, as the sync hands it back. */
export type RemovedPlacement = {
  name: string
  summary: string | null
  screenshot: string | null
  url: string | null
  role: string | null
}

/**
 * Bring a cell's placements into line with the text just saved.
 *
 * One RPC, because this has to be one transaction. The first version did the
 * diff here and issued a statement per row, and PostgREST gives each of those
 * its own transaction — which broke reordering outright. The position
 * constraint is DEFERRABLE INITIALLY DEFERRED, so it forgives a collision
 * only until COMMIT, and with a statement per request commit is the end of
 * that statement. Swapping two touchpoints raised 23505 every time. The unit test
 * covering reordering asserted the PLAN and never its application, so it
 * passed the whole way through.
 *
 * The gate on touchpoint-bearing cells lives in the function too: content on
 * an actor lane is a sentence about what somebody did, and syncing it would
 * file that sentence in the catalog as a tool.
 *
 * Returns the placements it removed, with their writing, so the caller can
 * put them in the inverse it records. Deleting a placement destroys the
 * per-moment summary and screenshot, and an inverse that restored only the
 * text would leave that gone for good.
 */
export async function syncCellTouchpoints(
  client: Client,
  cellId: string,
  content: string,
): Promise<RemovedPlacement[]> {
  const { data, error } = await client.rpc('sync_cell_touchpoints', {
    p_cell_id: cellId,
    p_names: parseCellContentItems(content),
  })
  if (error) throw toAuthoringError(error)

  const removed = (data as { removed?: unknown } | null)?.removed
  return Array.isArray(removed) ? (removed as RemovedPlacement[]) : []
}

/** Put back the writing a removed placement was carrying. */
export async function restoreCellTouchpoints(
  client: Client,
  cellId: string,
  rows: RemovedPlacement[],
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await client.rpc('restore_cell_touchpoints', {
    p_cell_id: cellId,
    p_rows: rows as unknown as Json,
  })
  if (error) throw toAuthoringError(error)
}

/**
 * A row as the editor holds it. `id` is the row it came from; absent on a row
 * typed since the last save. `kind` is `attachment` for an upload (#274) and
 * `link` otherwise; the sync leaves a kept row's kind alone either way.
 */
export type ResourceDraft = {
  id?: string | null
  kind?: 'link' | 'attachment'
  label: string
  url: string
}

/** The rows `sync_cell_resources` takes, and the shape a revert carries. */
export type ResourceRowInput = {
  /** Null for a row to insert; the row's own id for one to update in place (#270). */
  id: string | null
  kind: string
  name: string
  url: string | null
}

/**
 * Replace the cell's resources.
 *
 * One RPC, because this has to be one transaction — the same reason
 * `syncCellTouchpoints` is one. The editor replaces a whole list, PostgREST
 * gives every statement its own transaction, and the position constraint is
 * DEFERRABLE INITIALLY DEFERRED, so a reorder issued row by row collides on
 * the first statement.
 *
 * This used to rewrite a jsonb array on `cells`, and had to filter itself to
 * survive: the same column held touchpoint detail and provenance citations,
 * and writing the whole array from what this editor could see would have
 * deleted both. The filter worked and the citations were kept — and stayed
 * invisible, because nothing rendered them either. `20260830280000` moved the
 * three contents apart, and a table this editor owns end to end is why the
 * filter is gone rather than tightened.
 */
export async function updateCellResources(
  client: Client,
  cellId: string,
  /** The rows being replaced — captured so the change can be reverted. */
  existing: readonly CellResource[],
  drafts: ResourceDraft[],
): Promise<void> {
  const rows: ResourceRowInput[] = []

  for (const draft of drafts) {
    const checked = validateResourceUrl(draft.url)
    if (!checked.ok) throw new Error(checked.problem)
    rows.push({
      id: draft.id ?? null,
      kind: draft.kind ?? 'link',
      name: draft.label.trim() || hostOf(checked.url),
      url: checked.url,
    })
  }

  await writeCellResources(client, cellId, rows)
  recordChange(
    'update_cell_resources',
    { cell_id: cellId },
    // The captured list, written back as it stood. A resource carries nothing
    // that is not in this list, so restoring the list restores the state —
    // unlike a placement, whose per-moment writing a delete destroys.
    //
    // The cell's OWN rows only. A placement's resources sit in the same list
    // to be read (#271) but are the touchpoint's to write, and the sync
    // refuses their ids — so the inverse names none of them.
    {
      fn: 'update_cell_resources',
      args: {
        cell_id: cellId,
        resources: existing.filter((resource) => !resource.placementId).map((resource) => ({
          // By id, so the revert restores the rows themselves, not look-alikes.
          id: resource.id,
          kind: resource.kind,
          name: resource.name,
          url: resource.url,
        })),
      },
    },
  )
}

/** The write itself, shared by the save and by its revert. */
export async function writeCellResources(
  client: Client,
  cellId: string,
  rows: readonly ResourceRowInput[],
): Promise<void> {
  const { error } = await client.rpc('sync_cell_resources', {
    p_cell_id: cellId,
    p_rows: rows as unknown as Json,
  })
  if (error) throw toAuthoringError(error)
}
