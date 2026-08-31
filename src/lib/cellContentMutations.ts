import type { EntityStatus } from '@/lib/entityStatus'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CellLink } from '@/types/blueprint'
import type { Database, Json } from '@/types/database'
import { recordChange } from '@/lib/authoringSession'
import { toAuthoringError } from '@/lib/authoringErrors'
import { requireRowsWritten } from '@/lib/optimisticConcurrency'
import { validateResourceUrl } from '@/lib/resourceUrl'
import { URL_LINK_TYPE } from '@/lib/blueprintTechDescriptions'
import { planTouchpointSync } from '@/lib/touchpointSync'
import {
  BACKSTAGE_TOUCHPOINTS_ROLE,
  FRONTSTAGE_TOUCHPOINTS_ROLE,
} from '@/lib/laneRoles'

/** Lanes whose cell text is a list of touchpoint names rather than prose. */
const TOUCHPOINT_LANE_ROLES: string[] = [
  FRONTSTAGE_TOUCHPOINTS_ROLE,
  BACKSTAGE_TOUCHPOINTS_ROLE,
]

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
    throw new Error('A cell needs text — an empty one reads as a gap in the grid.')
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
  await syncCellTouchpoints(client, cellId, content)
  // Direct table write, so `call()` never sees it — logged here for the same
  // reason and with the same after-success placement.
  if (options.record !== false) {
    recordChange(
      'update_cell_content',
      { cell_id: cellId },
      previous?.content.trim()
        ? {
            fn: 'update_cell_content',
            args: { cell_id: cellId, update: previous },
          }
        : undefined,
    )
  }
}

/**
 * Bring a cell's placements into line with the text just saved.
 *
 * Only touchpoint-bearing cells. This is the load-bearing condition, not a
 * shortcut: `cells.content` on an actor lane is a sentence describing what
 * somebody did, and syncing it would file that sentence in the catalog as a
 * touchpoint. A cell qualifies if it already HAS placements, or if its lane
 * is a touchpoint lane and so its text is a list of names by definition. The
 * second half is what lets an empty touchpoint cell gain its first pill.
 *
 * A name the catalog has never seen gets a catalog row. `origin` is 'app'
 * rather than 'import' — the distinction is which side authored it, and a
 * touchpoint typed into a cell today did not come from the sweep.
 *
 * Not recorded separately in the session log. The author performed one act,
 * "edited this cell", and `update_cell_content` already logs it with an
 * inverse that restores the previous text; replaying that inverse runs this
 * function again and restores the placements with it. A second entry would
 * make one edit read as two, and an inverse that only put the placements
 * back would leave the text saying something else.
 */
export async function syncCellTouchpoints(
  client: Client,
  cellId: string,
  content: string,
): Promise<void> {
  const { data: rows, error: readError } = await client
    .from('cell_touchpoints')
    .select('id, position, touchpoints (name)')
    .eq('cell_id', cellId)
  if (readError) throw toAuthoringError(readError)

  const existing = (rows ?? []).flatMap((row) =>
    row.touchpoints?.name
      ? [{ id: row.id, name: row.touchpoints.name, position: row.position }]
      : [],
  )

  // The cell's lane and service, in one read. The lane role answers "is this
  // text a list of touchpoints or a sentence", and the service scopes the
  // catalog a new name would join.
  const { data: owner, error: ownerError } = await client
    .from('cells')
    .select('lanes (lane_role), paths (scenarios (phases (service_id)))')
    .eq('id', cellId)
    .single()
  if (ownerError) throw toAuthoringError(ownerError)

  const bearing =
    existing.length > 0 ||
    TOUCHPOINT_LANE_ROLES.includes(owner?.lanes?.lane_role ?? '')
  if (!bearing) return

  const plan = planTouchpointSync(content, existing)
  if (!plan.added.length && !plan.removed.length && !plan.moved.length) return

  const serviceId = owner?.paths?.scenarios?.phases?.service_id
  if (!serviceId) {
    throw new Error(
      'This cell is not attached to a service, so its touchpoints have no catalog to live in.',
    )
  }

  const byName = new Map(existing.map((entry) => [entry.name, entry]))

  for (const name of plan.removed) {
    const row = byName.get(name)
    if (!row) continue
    const { error } = await client
      .from('cell_touchpoints')
      .delete()
      .eq('id', row.id)
    if (error) throw toAuthoringError(error)
  }

  for (const { name, position } of plan.moved) {
    const row = byName.get(name)
    if (!row) continue
    const { data: updated, error } = await client
      .from('cell_touchpoints')
      .update({ position })
      .eq('id', row.id)
      .select('id')
    if (error) throw toAuthoringError(error)
    requireRowsWritten(updated, 'cell touchpoint')
  }

  for (const { name, position } of plan.added) {
    const { error: catalogError } = await client
      .from('touchpoints')
      .upsert({ service_id: serviceId, name, origin: 'app' }, {
        onConflict: 'service_id,name',
        ignoreDuplicates: true,
      })
    if (catalogError) throw toAuthoringError(catalogError)

    const { data: entry, error: lookupError } = await client
      .from('touchpoints')
      .select('id')
      .eq('service_id', serviceId)
      .eq('name', name)
      .single()
    if (lookupError) throw toAuthoringError(lookupError)

    const { data: placed, error } = await client
      .from('cell_touchpoints')
      .insert({
        cell_id: cellId,
        touchpoint_id: entry.id,
        position,
        origin: 'app',
      })
      .select('id')
    if (error) throw toAuthoringError(error)
    requireRowsWritten(placed, 'cell touchpoint')
  }
}

export type ResourceDraft = { label: string; url: string }

/**
 * Replace the cell's resource links.
 *
 * `links` carries more than resources — tech descriptions, pictures, Figma
 * embeds all live in the same array keyed by `type`. So this rewrites *only*
 * the `URL_LINK_TYPE` entries and leaves every other kind untouched. Writing
 * the whole array from what the resources editor knows about would silently
 * delete the tech pills.
 */
export async function updateCellResources(
  client: Client,
  cellId: string,
  existing: CellLink[],
  drafts: ResourceDraft[],
): Promise<void> {
  const rebuilt: CellLink[] = []

  for (const draft of drafts) {
    const checked = validateResourceUrl(draft.url)
    if (!checked.ok) throw new Error(checked.problem)
    rebuilt.push({
      type: URL_LINK_TYPE,
      label: draft.label.trim() || hostOf(checked.url),
      url: checked.url,
    })
  }

  const preserved = existing.filter((link) => link.type !== URL_LINK_TYPE)
  const { data, error } = await client
    .from('cells')
    .update({ links: [...preserved, ...rebuilt] as unknown as Json })
    .eq('id', cellId)
    .select('id')
  if (error) throw toAuthoringError(error)
  requireRowsWritten(data, 'cell')
  recordChange(
    'update_cell_resources',
    { cell_id: cellId },
    // Reverting means writing back the full pre-write array — URL entries as
    // they were, plus the non-URL entries this write preserved anyway.
    { fn: 'update_cell_resources', args: { cell_id: cellId, links: existing } },
  )
}

/** A link with no label still needs to say something — its host will do. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Link'
  }
}
