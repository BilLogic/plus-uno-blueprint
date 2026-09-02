/**
 * Writing a touchpoint — the catalog entry, and one placement of it.
 *
 * Two writes with one subject and two scopes. `renameTouchpoint` changes what
 * the tool is CALLED, everywhere it is used at once, because the catalog owns
 * the name. `updateTouchpointPlacement` changes what an author has to say
 * about it AT ONE CELL — its summary, its screenshot, its design link and
 * whether the moment happens through it — because the placement owns those,
 * and the same tool at the next step keeps its own.
 *
 * That split is the whole of #172's touchpoint work stated as two functions,
 * and it is why they share a module: a reader who finds one has to meet the
 * other, or the next rename will be attempted a cell at a time.
 *
 * ── The placement write UPDATES. It never creates one, and that is a gate ──
 *
 * A placement exists because a cell's text names a touchpoint. `content` is
 * the list, `sync_cell_touchpoints` turns it into rows, and that function
 * holds the one rule that matters: only a touchpoint-BEARING cell gets
 * placements, because `cells.content` on an actor lane is a sentence about
 * what somebody did and filing it in the catalog would make a tool out of it.
 *
 * So the placement write goes by placement id and touches only the four
 * detail columns. It cannot insert, so it cannot place a touchpoint on a cell
 * that is not touchpoint-bearing; and `cell_id` and `touchpoint_id` are
 * outside the `authenticated` column grant (20260830140000, asserted in
 * 20260830250000), so it cannot move an existing placement onto one either.
 * The gate is not re-implemented here — it is routed around by nothing, which
 * is a stronger property than a second copy of the check.
 * `placementGateContract.test.ts` is what holds that.
 *
 * ── The placement inverse is identity-keyed and writes columns, not a form ─
 *
 * `previous` is captured as COLUMN values — nulls where the row was empty —
 * rather than as the strings the form held, and the revert writes them back
 * verbatim without re-validating. `update_cell_resources` learned this first:
 * a revert that rebuilds through the input validator can refuse to restore a
 * link the validator considers malformed, which means an author cannot undo
 * their way back to data that was already there. Imported placements carry
 * urls and screenshot paths this module did not choose.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { recordChange } from '@/lib/authoringSession'
import { toAuthoringError } from '@/lib/authoringErrors'
import { requireRowsWritten } from '@/lib/optimisticConcurrency'
import { parseCellContentItems } from '@/lib/parseCellContent'
import { validateResourceUrl } from '@/lib/resourceUrl'
import type { TouchpointRoleValue } from '@/lib/touchpointRole'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

// ---------------------------------------------------------------------------
// The catalog: what the tool is called, everywhere at once.
// ---------------------------------------------------------------------------

/** What `rename_touchpoint` hands back. */
export type TouchpointRename = {
  /** The catalog row that was renamed. */
  touchpointId: string
  /** What it is called now. */
  name: string
  /** What it was called — the value an inverse needs. */
  previousName: string
  /** The cells whose text the rename rewrote. */
  cellIds: string[]
}

/**
 * Rename a touchpoint everywhere it is.
 *
 * One RPC, because a rename has two halves and they have to move together.
 * The catalog row is what the board draws, so changing it alone moves every
 * touchpoint on screen at once — and `cells.content` still holds the OLD string,
 * which a content save re-derives placements from. Leave the text behind and
 * the next edit to any affected cell hands `sync_cell_touchpoints` the stale
 * name, the renamed placement is deleted with its summary and screenshot,
 * and a fresh catalog entry appears under the old name in its place. The
 * rename undoes itself and the authored detail is gone.
 *
 * A client loop could not fix that: PostgREST gives every statement its own
 * transaction, so a failure part-way would leave the catalog and the text
 * disagreeing, which is the state this ticket exists to end. The function
 * does the catalog row and every bearing cell in one go, matching whole
 * items in the delimited text — renaming `Zoom` leaves `Zoom Recording`
 * alone — and refuses to finish if any bearing cell still names the old
 * value.
 *
 * Which cells it rewrites is decided from the PLACEMENTS, not from a text
 * search, so a cell that happens to spell the same word for another reason
 * is untouched.
 */
export async function renameTouchpoint(
  client: Client,
  touchpointId: string,
  name: string,
  /**
   * Session-log participation, decided per call rather than by ambient
   * module state — the same reasoning as `updateCellContent`. A revert
   * passes `record: false` so taking a rename back never logs a new rename.
   */
  options: { record?: boolean } = {},
): Promise<TouchpointRename> {
  const wanted = name.trim()
  if (!wanted) {
    throw new Error('A touchpoint needs a name — an empty one is a blank cell face.')
  }

  const { data, error } = await client.rpc('rename_touchpoint', {
    p_touchpoint_id: touchpointId,
    p_name: wanted,
  })
  if (error) throw toAuthoringError(error)

  const result = readRename(data)

  if (options.record !== false) {
    recordChange(
      'rename_touchpoint',
      {
        touchpoint_id: touchpointId,
        new_name: result.name,
        // The cells the rename actually rewrote, so the sheet can say how
        // far a one-word edit reached.
        cell_ids: result.cellIds,
      },
      // The inverse is the same operation pointed the other way, keyed on
      // the touchpoint's id rather than on either name. That is what makes
      // it restore BOTH halves: running it puts the catalog row back and
      // rewrites the same cells' text back, in one transaction, exactly as
      // the forward call did. A text-keyed inverse would also rewrite cells
      // that adopted the new name in between.
      {
        fn: 'rename_touchpoint',
        args: { p_touchpoint_id: touchpointId, p_name: result.previousName },
      },
    )
  }

  return result
}

/**
 * Read the rename's answer, or refuse it.
 *
 * A zero-row write is a failure, not a no-op — the house rule the content
 * writes already follow through `requireRowsWritten`. The function raises
 * when the touchpoint is gone, so nothing here is the ordinary path; what
 * this catches is a response that came back shaped like a success while
 * naming nothing, which would let the caller record an inverse for a rename
 * that never happened.
 */
function readRename(data: unknown): TouchpointRename {
  const row = data as {
    touchpoint_id?: unknown
    name?: unknown
    previous_name?: unknown
    cell_ids?: unknown
  } | null

  if (
    !row ||
    typeof row.touchpoint_id !== 'string' ||
    typeof row.name !== 'string' ||
    typeof row.previous_name !== 'string'
  ) {
    throw new Error('That touchpoint no longer exists — nothing was renamed.')
  }

  return {
    touchpointId: row.touchpoint_id,
    name: row.name,
    previousName: row.previous_name,
    cellIds: Array.isArray(row.cell_ids) ? (row.cell_ids as string[]) : [],
  }
}

// ---------------------------------------------------------------------------
// The placement: what an author has to say about it at one cell.
// ---------------------------------------------------------------------------

/** What the placement editor holds while it is being typed into. */
export type PlacementDetailDraft = {
  /** This touchpoint's own words about this moment. */
  summary: string
  /** An image of it here — an app asset path or an https URL. */
  screenshot: string
  /** The design reference for this moment specifically. */
  url: string
  role: TouchpointRoleValue
}

/**
 * The four columns as the table holds them.
 *
 * Empty is `null`, never `''`: the read path already treats null as "not
 * specified", and two spellings of empty is how a field ends up rendering an
 * empty frame instead of nothing at all.
 */
export type PlacementDetailColumns = {
  summary: string | null
  screenshot: string | null
  url: string | null
  role: TouchpointRoleValue
}

export type PlacementNormalizeResult =
  | { ok: true; columns: PlacementDetailColumns }
  | { ok: false; problem: string }

/**
 * A screenshot reference, checked before it is stored.
 *
 * Two shapes are legitimate and the difference is not cosmetic. Every one of
 * the 52 imported screenshots is a root-relative path into this app's own
 * `public/` tree (`/blueprint-images/...`), and refusing those would make the
 * editor unable to re-save a placement it can already display. An https URL is
 * the other shape, for an image that lives somewhere else.
 *
 * A protocol-relative `//host/x` is refused rather than upgraded: it looks
 * like a path and behaves like a URL, and guessing which one was meant is the
 * kind of silent coercion `validateResourceUrl` deliberately does not do for
 * `http:`.
 */
export function validateScreenshotReference(
  raw: string,
): { ok: true; value: string | null } | { ok: false; problem: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: null }

  if (trimmed.startsWith('//')) {
    return {
      ok: false,
      problem:
        'Write the whole link — “//” leaves the scheme to whatever page it is opened from.',
    }
  }
  if (trimmed.startsWith('/')) {
    if (trimmed.includes('..')) {
      return { ok: false, problem: 'An image path cannot climb out with “..”.' }
    }
    return { ok: true, value: trimmed }
  }

  const checked = validateResourceUrl(trimmed)
  if (!checked.ok) return { ok: false, problem: checked.problem }
  return { ok: true, value: checked.url }
}

/**
 * The draft as columns, or the one sentence explaining why it cannot be.
 *
 * Pure, so the rules are testable without a database — which matters most for
 * the two that are easy to get subtly wrong: that an emptied field clears the
 * column rather than storing a blank, and that an unmarked role stays
 * unmarked instead of being defaulted into a judgement.
 */
export function normalizePlacementDetail(
  draft: PlacementDetailDraft,
): PlacementNormalizeResult {
  const screenshot = validateScreenshotReference(draft.screenshot)
  if (!screenshot.ok) return { ok: false, problem: screenshot.problem }

  let url: string | null = null
  const rawUrl = draft.url.trim()
  if (rawUrl) {
    const checked = validateResourceUrl(rawUrl)
    if (!checked.ok) return { ok: false, problem: checked.problem }
    url = checked.url
  }

  if (
    draft.role !== null &&
    draft.role !== 'core' &&
    draft.role !== 'peripheral'
  ) {
    return {
      ok: false,
      problem: 'A placement is core, peripheral, or unmarked — nothing else.',
    }
  }

  return {
    ok: true,
    columns: {
      summary: draft.summary.trim() || null,
      screenshot: screenshot.value,
      url,
      role: draft.role,
    },
  }
}

/**
 * True when the cell text being saved still names this touchpoint.
 *
 * The panel saves the cell's text and this placement's detail in one action,
 * and the text is the list of placements: dropping a name from it makes
 * `sync_cell_touchpoints` delete that placement, detail and all. Writing the
 * detail afterwards would then fail on zero rows — correctly, but with a
 * message about a placement that no longer exists, on a save that did exactly
 * what the author asked. So the caller asks first and skips the write.
 *
 * Not a re-implementation of the sync's diff: it answers one question about
 * one name, using the same parser the sync is handed its names from.
 */
export function placementSurvivesContent(
  content: string,
  name: string,
): boolean {
  return parseCellContentItems(content).includes(name.trim())
}

/**
 * Write one placement's detail.
 *
 * `.select('id')` and `requireRowsWritten`, not `error === null`: a matched-
 * nothing update is a 200 with an empty array, so without the row check
 * editing a placement whose touchpoint was removed elsewhere would report success
 * having written nothing.
 */
export async function updateTouchpointPlacement(
  client: Client,
  placement: { id: string; cellId?: string; name?: string },
  draft: PlacementDetailDraft,
  /** The columns being replaced — captured so the change can be reverted. */
  previous?: PlacementDetailColumns,
  /**
   * Session-log participation, decided per call rather than by ambient module
   * state, for the reason `cellContentMutations` states: a global suspend flag
   * around an `await` also swallows an ordinary save that happens to resolve
   * while a revert is in flight.
   */
  options: { record?: boolean } = {},
): Promise<void> {
  const normalized = normalizePlacementDetail(draft)
  if (!normalized.ok) throw new Error(normalized.problem)

  await writePlacementDetail(client, placement.id, normalized.columns)

  if (options.record === false) return
  recordChange(
    'update_touchpoint_placement',
    {
      placement_id: placement.id,
      ...(placement.cellId ? { cell_id: placement.cellId } : {}),
      ...(placement.name ? { name: placement.name } : {}),
    },
    previous
      ? {
          fn: 'restore_touchpoint_placement',
          args: { placement_id: placement.id, columns: previous },
        }
      : undefined,
  )
}

/**
 * Put a placement's four columns back exactly as they were.
 *
 * No validation and no log entry. Both are the point: the captured values
 * came out of the database and go back into it unchanged, and undoing an edit
 * must not append an edit to the list the row was just removed from.
 */
export async function restoreTouchpointPlacement(
  client: Client,
  placementId: string,
  columns: PlacementDetailColumns,
): Promise<void> {
  await writePlacementDetail(client, placementId, columns)
}

/** The one statement both paths run, so they cannot disagree about columns. */
async function writePlacementDetail(
  client: Client,
  placementId: string,
  columns: PlacementDetailColumns,
): Promise<void> {
  const { data, error } = await client
    .from('cell_touchpoints')
    .update({
      summary: columns.summary,
      screenshot: columns.screenshot,
      url: columns.url,
      role: columns.role,
    })
    .eq('id', placementId)
    .select('id')
  if (error) throw toAuthoringError(error)
  requireRowsWritten(data, 'touchpoint placement')
}