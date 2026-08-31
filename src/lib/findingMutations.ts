import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { recordChange } from '@/lib/authoringSession'
import { toAuthoringError } from '@/lib/authoringErrors'
import { requireRowsWritten } from '@/lib/optimisticConcurrency'

type Client = SupabaseClient<Database>

/** Mirrors the DB CHECK constraint — a bad severity fails at compile time. */
export type FindingSeverity = 'info' | 'warn' | 'critical'
/** Mirrors `audit_findings_status_check`. */
export type FindingStatus = 'open' | 'resolved' | 'dismissed'
/** Mirrors `audit_findings_source_check`. */
export type FindingSource = 'audit' | 'whatif' | 'import-sweep'

/**
 * Findings writes, in the session ledger like every other write.
 *
 * `create_finding` and `update_finding` wrote the table straight from
 * `agent/tools/registry.ts` until 2026-08-25 — the last raw table writes in
 * the app, and the ones `AGENTS.md` says do not exist. They survived because
 * `writeBoundaryContract.test.ts` scanned `components/`, `contexts/` and
 * `hooks/` and never looked at `src/lib`, so the rule was prose exactly where
 * it was false. Three defects followed, none visible at the call site:
 *
 * 1. **Nothing reached the ledger.** An audit run rewrote severities and notes
 *    on findings a human had triaged, and left no row saying so.
 * 2. **⌘Z was worse than inert.** It takes "the newest entry that captured an
 *    inverse" — with the finding writes absent from the list, a press after an
 *    audit run reached past them and took back the human's own last edit
 *    instead, silently.
 * 3. **A zero-row update read as success.** The dedupe rewrite was
 *    `.update().eq('id')` with no `.select()`, which returns `error: null`
 *    when nothing matched — the same shape as the storyboard write fixed in
 *    #82.
 *
 * ## Why a created finding has no revert
 *
 * Every update here carries a captured inverse. The insert deliberately does
 * not, and that is a schema fact rather than an omission: DELETE on `audit_findings`
 * is revoked from `authenticated` and from `anon`, in both directions and with
 * no policy to reach it (`20260805120000_findings_canvas_writes.sql` — "Delete
 * stays revoked everywhere: supersede/triage are status flips").
 *
 * The only ways to make a finding go quiet are `resolved` and `dismissed`, and
 * neither is an inverse — both are triage decisions a human's own reading of
 * the finding is supposed to produce. `dismissed` is the worse of the two: the
 * dedupe rule below is "dismissed stays dismissed", so an undo that wrote it
 * would permanently suppress that check on every future run, invisibly, which
 * is precisely the harm `audit_findings_insert_auth`'s `status = 'open'` check
 * exists to prevent. An entry with no revert control is honest about what can
 * be taken back; one whose control quietly dismisses a check is not.
 */
export type FindingDraft = {
  serviceId: string
  runId: string
  source: FindingSource
  checkKey: string
  severity: FindingSeverity
  cellIds: readonly string[]
  /** IR key-paths paired with `cellIds`; the DB checks the cardinalities match. */
  cellKeys: readonly string[]
  summary: string
  fingerprint: string
}

/**
 * What `recordFinding` did. A tri-state rather than a boolean because the
 * third case writes nothing at all, and the caller has a different sentence
 * for each.
 */
export type FindingOutcome =
  | { kind: 'created'; findingId: string; reopened: boolean }
  | { kind: 'deduped'; findingId: string }
  | { kind: 'suppressed' }

/** The columns `authenticated` may update — the grant, mirrored in a type. */
export type FindingUpdate = {
  severity?: FindingSeverity
  summary?: string | null
  runId?: string
  cellIds?: readonly string[]
  cellKeys?: readonly string[]
  source?: FindingSource
  status?: FindingStatus
}

type FindingPatch = Database['public']['Tables']['audit_findings']['Update']

/** `FindingUpdate` in the column names the table uses. Named keys only — an
 *  absent key must stay absent so the inverse writes back only what moved. */
function toPatch(update: FindingUpdate): FindingPatch {
  const patch: FindingPatch = {}
  if (update.severity !== undefined) patch.severity = update.severity
  if (update.summary !== undefined) patch.summary = update.summary
  if (update.runId !== undefined) patch.run_id = update.runId
  if (update.cellIds !== undefined) patch.cell_ids = [...update.cellIds]
  if (update.cellKeys !== undefined) patch.cell_keys = [...update.cellKeys]
  if (update.source !== undefined) patch.source = update.source
  if (update.status !== undefined) patch.status = update.status
  return patch
}

/**
 * Record a finding, honouring the dedupe contract.
 *
 * The read, the branch and both writes live together because the branch *is*
 * the write path: "an open twin exists" and "a human dismissed this" are the
 * two answers that decide whether anything is written at all, and splitting
 * them across the registry would put half the rule outside the module the
 * boundary test protects.
 *
 * The suppressed case records nothing — not an entry without a revert, but no
 * entry. The ledger's claim is that it lists writes that landed, and this one
 * did not happen.
 */
export async function recordFinding(
  client: Client,
  draft: FindingDraft,
): Promise<FindingOutcome> {
  const { data: existing, error: readError } = await client
    .from('audit_findings')
    .select('id, status')
    .eq('service_id', draft.serviceId)
    .eq('fingerprint', draft.fingerprint)
    .order('updated_at', { ascending: false })
  if (readError) throw toAuthoringError(readError)

  const open = existing?.find((row) => row.status === 'open')
  if (open) {
    await updateFinding(client, open.id, {
      severity: draft.severity,
      summary: draft.summary,
      runId: draft.runId,
      cellIds: draft.cellIds,
      cellKeys: draft.cellKeys,
      source: draft.source,
    })
    return { kind: 'deduped', findingId: open.id }
  }

  if (existing?.some((row) => row.status === 'dismissed')) {
    return { kind: 'suppressed' }
  }

  const { data, error } = await client
    .from('audit_findings')
    .insert({
      service_id: draft.serviceId,
      run_id: draft.runId,
      source: draft.source,
      check_key: draft.checkKey,
      severity: draft.severity,
      summary: draft.summary,
      cell_ids: [...draft.cellIds],
      cell_keys: [...draft.cellKeys],
      fingerprint: draft.fingerprint,
    })
    .select('id')
    .single()
  if (error) throw toAuthoringError(error)

  // No inverse — see the module header. The entry is still recorded: a change
  // with no revert control is recoverable from, a missing one is not.
  recordChange('create_finding', {
    finding_id: data.id,
    check_key: draft.checkKey,
    severity: draft.severity,
    run_id: draft.runId,
  })

  return {
    kind: 'created',
    findingId: data.id,
    reopened: (existing?.length ?? 0) > 0,
  }
}

/**
 * Edit one finding, capturing the prior value of every column it writes.
 *
 * Self-inverse, like `updateEvidence` and `updateCellSpec`: the captured
 * payload IS a `FindingUpdate`, so `executeRevert` hands it straight back to
 * this function. Keyed on the finding id, so an out-of-order revert lands on
 * the finding the edit came from rather than on whatever now carries that
 * fingerprint — the fingerprint is deliberately *not* an identity here,
 * because reopening a resolved twin mints a second row that shares it.
 *
 * Only the named fields are captured. An inverse that wrote all seven granted
 * columns back would undo a status flip that happened between the edit and the
 * undo, which is a different change belonging to a different person.
 */
export async function updateFinding(
  client: Client,
  findingId: string,
  update: FindingUpdate,
  options: { record?: boolean } = {},
): Promise<void> {
  const patch = toPatch(update)
  const keys = Object.keys(patch)
  if (keys.length === 0) {
    throw new Error('An empty finding update writes nothing — pass a field.')
  }

  // Before the write, while the previous values are still knowable.
  const { data: before, error: readError } = await client
    .from('audit_findings')
    .select('id, check_key, severity, summary, run_id, cell_ids, cell_keys, source, status')
    .eq('id', findingId)
    .maybeSingle()
  if (readError) throw toAuthoringError(readError)
  if (!before) throw new Error(`No finding with id ${findingId}.`)

  const previous: FindingUpdate = {}
  if (update.severity !== undefined)
    previous.severity = before.severity as FindingSeverity
  if (update.summary !== undefined) previous.summary = before.summary
  if (update.runId !== undefined) previous.runId = before.run_id
  if (update.cellIds !== undefined) previous.cellIds = before.cell_ids
  if (update.cellKeys !== undefined) previous.cellKeys = before.cell_keys
  if (update.source !== undefined) previous.source = before.source as FindingSource
  if (update.status !== undefined) previous.status = before.status as FindingStatus

  const { data, error } = await client
    .from('audit_findings')
    .update(patch)
    .eq('id', findingId)
    .select('id')
  if (error) throw toAuthoringError(error)
  // `.select()` is what makes this check real: without it there are no rows to
  // count and a write that matched nothing reports success.
  requireRowsWritten(data, 'finding')

  if (options.record !== false) {
    recordChange(
      'update_finding',
      {
        finding_id: findingId,
        check_key: before.check_key,
        ...(update.status !== undefined ? { status: update.status } : {}),
      },
      { fn: 'update_finding', args: { finding_id: findingId, update: previous } },
    )
  }
}
