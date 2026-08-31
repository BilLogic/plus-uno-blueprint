import type { SupabaseClient } from '@supabase/supabase-js'
import { toAuthoringError } from '@/lib/authoringErrors'
import type { ChangeEntry } from '@/lib/authoringSession'
import {
  restoreCellTouchpoints,
  updateCellContent,
  type RemovedPlacement,
  type CellContentUpdate,
} from '@/lib/cellContentMutations'
import { updateCellSpec, type CellSpecUpdate } from '@/lib/cellSpecMutations'
import { updateLaneSpec, type LaneSpecUpdate } from '@/lib/laneSpecMutations'
import {
  updatePhaseSpec,
  type PhaseSpecUpdate,
} from '@/lib/phaseSpecMutations'
import {
  updatePathSpec,
  updateScenarioSummary,
  type PathSpecUpdate,
} from '@/lib/scenarioSpecMutations'
import {
  updateBusinessModel,
  updateServiceSummary,
  type BusinessModelUpdate,
} from '@/lib/serviceSpecMutations'
import { updateStepSummary } from '@/lib/stepSpecMutations'
import {
  deleteStakeholder,
  updateStakeholder,
  type StakeholderInput,
} from '@/lib/stakeholderMutations'
import {
  deleteEvidence,
  restoreEvidenceRow,
  updateEvidence,
  type EvidenceUpdate,
} from '@/lib/evidenceMutations'
import { setSliceFrameIllustration } from '@/lib/sliceMutations'
import {
  restoreTouchpointPlacement,
  type PlacementDetailColumns,
} from '@/lib/touchpointMutations'
import { updateFinding, type FindingUpdate } from '@/lib/findingMutations'
import { requireRowsWritten } from '@/lib/optimisticConcurrency'
import type { CellLink } from '@/types/blueprint'
import type { Database, Json } from '@/types/database'

type Client = SupabaseClient<Database>
type EvidenceRowType = Database['public']['Tables']['evidence']['Row']
type SliceItemRow = Database['public']['Tables']['slice_items']['Row']
/** The subset of `slices` that `updateSliceMeta` writes, and so restores. */
type SliceMetaFields = Pick<
  Database['public']['Tables']['slices']['Row'],
  'title' | 'summary' | 'kind' | 'actor' | 'authorship'
>

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
      // Restoring the text brings back the names of any touchpoints the
      // original save removed, but not what was written about them at this
      // moment — that went with the placement. This puts it back, and has to
      // run after the content write, which is what re-creates the rows.
      const removed = revert.args.removed_placements
      if (Array.isArray(removed) && removed.length > 0) {
        await restoreCellTouchpoints(client, cellId, removed as RemovedPlacement[])
      }
      return
    }
    case 'restore_touchpoint_placement': {
      // Undo of "edited a touchpoint at this cell". The captured payload is
      // the four detail COLUMNS as the database held them, written back
      // verbatim rather than rebuilt through the input validator — an
      // imported placement can carry a screenshot path or an http url the
      // validator would refuse, and undo has to be able to reach data that
      // was already there. Same rule, same reason, as update_cell_resources.
      //
      // Keyed on the placement id, so a revert after the pill was reordered
      // or the catalog entry renamed still lands on the row the edit came
      // from rather than on whatever now spells the same.
      const placementId = stringArg(revert.args, 'placement_id')
      const columns = revert.args.columns as PlacementDetailColumns | undefined
      if (!columns || typeof columns !== 'object') {
        throw new Error('This change’s captured placement detail is malformed.')
      }
      await restoreTouchpointPlacement(client, placementId, columns)
      return
    }
    case 'update_cell_spec': {
      const cellId = stringArg(revert.args, 'cell_id')
      const update = revert.args.update as CellSpecUpdate
      await updateCellSpec(client, cellId, update, undefined, { record: false })
      return
    }
    case 'update_lane_spec': {
      // Self-inverse, like update_cell_spec: the captured payload IS an
      // update. The lane ids are captured too — the fan-out has to land on
      // exactly the rows the save touched, not on whatever carries that label
      // now.
      const laneIds = revert.args.lane_ids
      if (!Array.isArray(laneIds) || laneIds.length === 0) {
        throw new Error("This change's revert is missing its lane ids.")
      }
      const update = revert.args.update as LaneSpecUpdate
      await updateLaneSpec(client, laneIds as string[], update, undefined, {
        record: false,
      })
      return
    }
    case 'update_phase_spec': {
      // Self-inverse, like update_cell_spec.
      const phaseId = stringArg(revert.args, 'phase_id')
      const update = revert.args.update as PhaseSpecUpdate
      await updatePhaseSpec(client, phaseId, update, undefined, {
        record: false,
      })
      return
    }
    case 'update_scenario_spec': {
      const scenarioId = stringArg(revert.args, 'scenario_id')
      // One column, and the captured value may legitimately be an empty
      // string — "it had no summary before" is a state worth restoring, so
      // this reads the arg directly rather than through `stringArg`, which
      // refuses empties.
      const summary = revert.args.summary
      if (typeof summary !== 'string') {
        throw new Error("This change's revert is missing its summary.")
      }
      await updateScenarioSummary(client, scenarioId, summary, undefined, {
        record: false,
      })
      return
    }
    case 'delete_stakeholder': {
      // Undo of "added someone to the cast".
      await deleteStakeholder(client, stringArg(revert.args, 'stakeholder_id'))
      return
    }
    case 'update_stakeholder': {
      const stakeholderId = stringArg(revert.args, 'stakeholder_id')
      const update = revert.args.update as StakeholderInput
      await updateStakeholder(client, stakeholderId, update, undefined, {
        record: false,
      })
      return
    }
    case 'update_step_spec': {
      const stepId = stringArg(revert.args, 'step_id')
      // Empty is a real prior value — a step that had no summary is a state
      // worth restoring — so this reads the arg directly rather than through
      // `stringArg`, which refuses empties.
      const summary = revert.args.summary
      if (typeof summary !== 'string') {
        throw new Error("This change's revert is missing its summary.")
      }
      await updateStepSummary(client, stepId, summary, undefined, {
        record: false,
      })
      return
    }
    case 'update_path_spec': {
      const pathId = stringArg(revert.args, 'path_id')
      const update = revert.args.update as PathSpecUpdate
      await updatePathSpec(client, pathId, update, undefined, {
        record: false,
      })
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
    case 'delete_evidence': {
      // Undo of "added a source": remove the row it created.
      const evidenceId = stringArg(revert.args, 'evidence_id')
      await deleteEvidence(client, evidenceId, undefined, { record: false })
      return
    }
    case 'update_evidence': {
      // Undo of "edited a source": write the captured prior values back.
      // Self-inverse, like update_cell_spec — the captured payload IS an
      // update, so the same function serves both directions.
      const evidenceId = stringArg(revert.args, 'evidence_id')
      const update = revert.args.update as EvidenceUpdate
      await updateEvidence(client, evidenceId, update, { record: false })
      return
    }
    case 'restore_evidence_row': {
      // Undo of "deleted a source": reinsert the captured row verbatim,
      // original id included, so references to it come back intact. The
      // ledger is in-memory today, but the shape check costs nothing and
      // pins the contract if persistence ever lands.
      const row = revert.args.row as EvidenceRowType
      if (
        !row ||
        typeof row !== 'object' ||
        typeof row.id !== 'string' ||
        typeof row.title !== 'string'
      ) {
        throw new Error('This change’s captured evidence row is malformed.')
      }
      await restoreEvidenceRow(client, row)
      return
    }
    case 'set_slice_illustration': {
      // Self-inverting: the undo of "set a storyboard image" is setting the
      // previous value back, which may be null (the frame had none). Keyed on
      // item_id, not position, so a revert after a reorder still lands on the
      // frame the picture came from. `record: false` — a revert must not log
      // its own undo.
      const sliceId = stringArg(revert.args, 'slice_id')
      const itemId = stringArg(revert.args, 'item_id')
      const illustration = (revert.args.illustration ?? null) as Json | null
      await setSliceFrameIllustration(client, sliceId, itemId, illustration, {
        record: false,
      })
      return
    }
    case 'restore_slice_frames': {
      // Undo of "rebuilt a slice's frames": clear whatever is there now and
      // put the captured rows back verbatim, original ids included, so a
      // frame's identity survives the round trip. Same shape check and same
      // reasoning as `restore_evidence_row` above.
      const sliceId = stringArg(revert.args, 'slice_id')
      const rows = revert.args.rows
      if (!Array.isArray(rows)) {
        throw new Error('This change’s captured frames are malformed.')
      }
      const cleared = await client
        .from('slice_items')
        .delete()
        .eq('slice_id', sliceId)
      if (cleared.error) throw toAuthoringError(cleared.error)
      // An empty capture is a real answer, not a failure: the slice genuinely
      // had no frames before the write, so putting none back IS the inverse.
      if (rows.length === 0) return
      const restored = await client
        .from('slice_items')
        .insert(rows as SliceItemRow[])
      if (restored.error) throw toAuthoringError(restored.error)
      return
    }
    case 'delete_slice_row': {
      // Undo of "added a slice" / "duplicated a slice": remove the row it
      // created. `slice_items` cascade, so the frames go with it — which is
      // why neither of those operations needs a frame capture of its own.
      //
      // A direct delete rather than `deleteSlice`: that wrapper records a
      // `delete_slice` entry, and undoing "Added a slice" must not append
      // "Deleted a slice" to the list the row was just removed from.
      const sliceId = stringArg(revert.args, 'slice_id')
      const { data, error } = await client
        .from('slices')
        .delete()
        .eq('id', sliceId)
        .select('id')
      if (error) throw toAuthoringError(error)
      requireRowsWritten(data, 'slice')
      return
    }
    case 'restore_slice_meta': {
      // Undo of a slice field edit. Writes `authorship` back too: the forward
      // write promotes `generated` to `customized` as a side effect, and an
      // inverse that left the promotion standing would mark a slice as
      // hand-edited when the edit has been taken back.
      const sliceId = stringArg(revert.args, 'slice_id')
      const row = revert.args.row as SliceMetaFields | undefined
      if (!row || typeof row !== 'object' || typeof row.title !== 'string') {
        throw new Error('This change’s captured slice fields are malformed.')
      }
      const { data, error } = await client
        .from('slices')
        .update({
          title: row.title,
          summary: row.summary,
          kind: row.kind,
          actor: row.actor,
          authorship: row.authorship,
        })
        .eq('id', sliceId)
        .select('id')
      if (error) throw toAuthoringError(error)
      requireRowsWritten(data, 'slice')
      return
    }
    case 'rename_owner_tag_scoped': {
      // Tag rename, inverted with precision: only the cells the rename
      // actually touched get the old name back. A name-based inverse would
      // also rewrite cells that legitimately adopted the new name since.
      const from = stringArg(revert.args, 'from')
      const to = stringArg(revert.args, 'to')
      const ids = revert.args.cell_ids
      if (!Array.isArray(ids) || ids.length === 0) return
      const ownerUpdate = await client
        .from('cells')
        .update({ owner: to })
        .eq('owner', from)
        .in('id', ids as string[])
      if (ownerUpdate.error) throw toAuthoringError(ownerUpdate.error)
      const perceivedUpdate = await client
        .from('cells')
        .update({ perceived_owner: to })
        .eq('perceived_owner', from)
        .in('id', ids as string[])
      if (perceivedUpdate.error) throw toAuthoringError(perceivedUpdate.error)
      return
    }
    case 'update_finding': {
      // Self-inverse, like update_evidence — the captured payload IS a
      // FindingUpdate, carrying the prior value of exactly the columns the
      // forward write touched and no others. Keyed on the finding id, so an
      // out-of-order revert lands on the finding the edit came from rather
      // than on whatever now shares its fingerprint.
      //
      // There is deliberately no `create_finding` case beside this one: DELETE
      // on `findings` is revoked from every client role, and the two states
      // that would silence a finding — resolved, dismissed — are human triage
      // decisions, not inverses. A created finding records with no revert and
      // shows no revert control.
      const findingId = stringArg(revert.args, 'finding_id')
      const update = revert.args.update as FindingUpdate
      await updateFinding(client, findingId, update, { record: false })
      return
    }
    case 'update_service_summary': {
      // Self-inverse, like update_cell_spec. Both service writes are direct
      // table updates, not RPCs — without these two cases they fell to the
      // default branch below and called a Postgres function that has never
      // existed, so every service edit recorded an undo that could only 404.
      const serviceId = stringArg(revert.args, 'service_id')
      const summary = stringArg(revert.args, 'summary')
      await updateServiceSummary(client, serviceId, summary, undefined, {
        record: false,
      })
      return
    }
    case 'update_business_model': {
      const serviceId = stringArg(revert.args, 'service_id')
      const update = revert.args.update as BusinessModelUpdate
      await updateBusinessModel(client, serviceId, update, undefined, {
        record: false,
      })
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
