import type { SupabaseClient } from '@supabase/supabase-js'
import { toAuthoringError } from '@/lib/authoringErrors'
import type { SessionEntry } from '@/lib/authoringSession'
import {
  restoreCellTouchpoints,
  updateCellContent,
  writeCellResources,
  type RemovedPlacement,
  type CellContentUpdate,
  type ResourceRowInput,
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
  updateServiceEntityExamples,
  updateServiceSummary,
  type BusinessModelUpdate,
  type EntityExamplesUpdate,
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
import {
  writePlacementResources,
  type PlacementResourceRowInput,
} from '@/lib/placementResourceMutations'
import {
  restoreTouchpointPlacement,
  type PlacementDetailColumns,
} from '@/lib/touchpointMutations'
import { updateFinding, type FindingUpdate } from '@/lib/findingMutations'
import {
  restoreSlideImageSet,
  type SlideImageMemberInput,
} from '@/lib/sliceMutations'
import { removeSlideUploadObjects } from '@/lib/illustrationUpload'
import { requireRowsWritten } from '@/lib/optimisticConcurrency'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>
type EvidenceRowType = Database['public']['Tables']['evidence']['Row']
type SlideRow = Database['public']['Tables']['slides']['Row']
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
 * A captured value that is allowed to be empty.
 *
 * `stringArg` refuses `''` because an identifier never legitimately is one.
 * A one-column prose revert is the opposite case: "it had no summary before"
 * is a real prior state and the commonest one — the FIRST edit of any field
 * captures `''` as its previous value — so an empty string is the value, not
 * a missing one. Every self-inverse summary case reads its arg through here;
 * reading it through `stringArg` would make the first undo of a first summary
 * throw instead of clearing the field.
 */
function optionalStringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key]
  if (typeof value !== 'string') {
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
 *
 * ── WHERE THE INPUT MAY COME FROM ─────────────────────────────────────────
 *
 * A `SessionEntry`, and nothing else. That type is minted only by
 * `recordChange`, so the entry handed in here was assembled by the build that
 * is now reading it — never fetched, never deserialised, never older than the
 * code applying it. `public.authoring_changes` keeps the same information
 * durably and is not a source for this function: a row out of it is a
 * `ChangeEntry`-shaped object at best and will not type-check as a
 * `SessionEntry`. `revertBoundaryContract.test.ts` is the rest of that wall —
 * it refuses a cast that would mint the brand anywhere but the session module,
 * and refuses a signature here that widens the parameter back out.
 *
 * ── WHY THE CAPTURED PAYLOADS ARE READ THROUGH CASTS ──────────────────────
 *
 * `RevertSpec.args` is a `Record<string, unknown>`, so every case below has to
 * say what it expects. Ten of them do it with a bare `as`, and the boundary
 * above is the whole justification: each captured `update` was written into
 * the ledger by a mutation module in THIS build, out of a parameter already
 * typed as the thing being cast to, so the cast restates a fact the compiler
 * verified at the other end of the same session. Each site names its capture
 * point so the claim can be checked rather than taken.
 *
 * It is worth being exact about what the boundary is protecting against,
 * because it is not hypothetical. The ledger holds an `update_cell_content`
 * revert, written 2026-09-02, whose args are `{cell_id, content,
 * removed_placements}` with `content` a plain string; this build records
 * `{cell_id, update, removed_placements}` with `update` nested. Replaying that
 * row would read `revert.args.update` as `undefined`, cast it to a
 * `CellContentUpdate`, and throw inside `updateCellContent` on `.content`.
 *
 * And it is not an older version of this file's counterpart. The nested shape
 * has been recorded since 2026-08-04 and the flat one has never been recorded
 * at all; `record_authoring_change` accepts `args` and `revert` as free jsonb,
 * so the row came from a caller that is not this app and that no version
 * column would have made legible. Which is why the input is walled off rather
 * than parsed: a parse would still have to decide what an unrecognised shape
 * means, and the set of shapes is open by construction.
 *
 * Two of the ten do NOT rest on that argument alone, and are marked where they
 * sit: `update_evidence` and `update_finding` capture their payload from a
 * fresh read of the row they are about to write, so the object's *shape* is
 * this build's and its *values* are the database's.
 */
export async function executeRevert(
  client: Client,
  entry: SessionEntry,
): Promise<void> {
  const revert = entry.revert
  if (!revert) {
    throw new Error('This change has nothing recorded to revert it with.')
  }

  switch (revert.fn) {
    case 'update_cell_content': {
      const cellId = stringArg(revert.args, 'cell_id')
      // Captured by `updateCellContent`'s `previous: CellContentUpdate`, and
      // only when `previous.content` was non-empty — so under the boundary
      // this is that parameter, not a maybe. It is also the one operation the
      // ledger holds a foreign shape for; see the header for that row and what
      // reading it would do here.
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
      // the detail COLUMNS as the database held them, written back verbatim
      // rather than rebuilt through the input validator — undo has to be
      // able to reach data that was already there. Same rule, same reason,
      // as update_cell_resources.
      //
      // Two columns since #276. An entry recorded before 20260902160000 also
      // carries `screenshot` and `url`; those are not columns any more, so
      // only summary and role are read — the entry still restores what it
      // can name.
      //
      // Keyed on the placement id, so a revert after the touchpoint was reordered
      // or the catalog entry renamed still lands on the row the edit came
      // from rather than on whatever now spells the same.
      const placementId = stringArg(revert.args, 'placement_id')
      const captured = revert.args.columns as Partial<PlacementDetailColumns> | undefined
      if (!captured || typeof captured !== 'object') {
        throw new Error('This change’s captured placement detail is malformed.')
      }
      await restoreTouchpointPlacement(client, placementId, {
        summary: captured.summary ?? null,
        role: captured.role ?? null,
      })
      return
    }
    case 'update_cell_spec': {
      const cellId = stringArg(revert.args, 'cell_id')
      // Captured by `updateCellSpec`'s `previous: CellSpecUpdate`.
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
      // Captured by `updateLaneSpec`'s `previous: LaneSpecUpdate`.
      const update = revert.args.update as LaneSpecUpdate
      await updateLaneSpec(client, laneIds as string[], update, undefined, {
        record: false,
      })
      return
    }
    case 'update_phase_spec': {
      // Self-inverse, like update_cell_spec.
      const phaseId = stringArg(revert.args, 'phase_id')
      // Captured by `updatePhaseSpec`'s `previous: PhaseSpecUpdate`.
      const update = revert.args.update as PhaseSpecUpdate
      await updatePhaseSpec(client, phaseId, update, undefined, {
        record: false,
      })
      return
    }
    case 'update_scenario_spec': {
      const scenarioId = stringArg(revert.args, 'scenario_id')
      const summary = optionalStringArg(revert.args, 'summary')
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
      // Captured by `updateStakeholder`'s `previous: StakeholderInput` — the
      // same type its `input` parameter takes, which is what makes the write
      // self-inverse.
      const update = revert.args.update as StakeholderInput
      await updateStakeholder(client, stakeholderId, update, undefined, {
        record: false,
      })
      return
    }
    case 'update_step_spec': {
      const stepId = stringArg(revert.args, 'step_id')
      const summary = optionalStringArg(revert.args, 'summary')
      await updateStepSummary(client, stepId, summary, undefined, {
        record: false,
      })
      return
    }
    case 'update_path_spec': {
      const pathId = stringArg(revert.args, 'path_id')
      // Captured by `updatePathSpec`'s `previous: PathSpecUpdate`.
      const update = revert.args.update as PathSpecUpdate
      await updatePathSpec(client, pathId, update, undefined, {
        record: false,
      })
      return
    }
    case 'update_cell_resources': {
      // The captured value is the full pre-write list — written back
      // verbatim rather than rebuilt through the draft validator, which
      // could refuse to restore a resource it considers malformed.
      //
      // The RPC raises when the cell is gone, which is the "zero rows is a
      // real answer" check this arm used to make by hand.
      const cellId = stringArg(revert.args, 'cell_id')
      const resources = revert.args.resources as ResourceRowInput[]
      await writeCellResources(client, cellId, resources ?? [])
      return
    }
    case 'update_placement_resources': {
      // The same shape as update_cell_resources, for the touchpoint's list at
      // one cell (#273): the captured rows, by id, written back as they stood.
      // The RPC raises when the placement is gone.
      const placementId = stringArg(revert.args, 'placement_id')
      const resources = revert.args.resources as PlacementResourceRowInput[]
      await writePlacementResources(client, placementId, resources ?? [])
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
      //
      // One of the two casts the boundary does not fully answer for.
      // `updateEvidence` builds this payload inline from its own `select` of
      // the row it is about to write, and narrows the raw column with
      // `before.kind as EvidenceKind`. So the boundary proves the OBJECT is
      // this build's — the three keys are there, at the JS types the compiler
      // saw — while `kind`'s membership of the union is the database's word,
      // not ours. A parse here would be the wrong instrument: the value is
      // going straight back to the column it came out of, so refusing a kind
      // this build does not enumerate would block a legitimate round trip in
      // the name of a type the column does not enforce.
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
    case 'restore_slides': {
      // Undo of "rebuilt a slice's slides": clear whatever is there now and
      // put the captured rows back verbatim, original ids included, so a
      // slide's identity survives the round trip. Same shape check and same
      // reasoning as `restore_evidence_row` above.
      //
      // The image set comes back with the row. It was captured EMBEDDED in
      // each slide (`slide_images(*)`) because the members are keyed by
      // `slides.id` and the delete below cascades them away; and it is split
      // off before the insert, because `slide_images` is a table and not a
      // column of `slides`.
      const sliceId = stringArg(revert.args, 'slice_id')
      const rows = revert.args.rows
      if (!Array.isArray(rows)) {
        throw new Error('This change’s captured slides are malformed.')
      }
      // Which slides this undo is NOT bringing back — the ones the forward
      // write created. Read before the delete, while they are still there.
      const keepIds = new Set(
        rows.flatMap((raw) =>
          raw && typeof raw === 'object' && typeof (raw as { id?: unknown }).id === 'string'
            ? [(raw as { id: string }).id]
            : [],
        ),
      )
      const { data: current, error: currentError } = await client
        .from('slides')
        .select('id')
        .eq('slice_id', sliceId)
      if (currentError) throw toAuthoringError(currentError)
      const dropped = (current ?? []).filter((slide) => !keepIds.has(slide.id))
      const cleared = await client
        .from('slides')
        .delete()
        .eq('slice_id', sliceId)
      if (cleared.error) throw toAuthoringError(cleared.error)
      // An empty capture is a real answer, not a failure: the slice genuinely
      // had no slides before the write, so putting none back IS the inverse.
      if (rows.length > 0) {
        const payloads: SlideRow[] = []
        const memberSets: Array<{ slideId: string; members: SlideImageMemberInput[] }> = []
        for (const raw of rows) {
          if (!raw || typeof raw !== 'object') {
            throw new Error('This change’s captured slides are malformed.')
          }
          const { slide_images, ...rest } = raw as SlideRow & {
            slide_images?: SlideImageMemberInput[]
          }
          if (typeof rest.id !== 'string') {
            throw new Error('This change’s captured slides are malformed.')
          }
          payloads.push(rest)
          memberSets.push({
            slideId: rest.id,
            members: Array.isArray(slide_images)
              ? slide_images.map((member) => ({
                  position: member.position,
                  cell_id: member.cell_id ?? null,
                  image_url: member.image_url ?? null,
                }))
              : [],
          })
        }
        const restored = await client.from('slides').insert(payloads)
        if (restored.error) throw toAuthoringError(restored.error)
        for (const set of memberSets) {
          if (set.members.length === 0) continue
          const inserted = await client.from('slide_images').insert(
            set.members.map((member) => ({
              slide_id: set.slideId,
              position: member.position,
              cell_id: member.cell_id,
              image_url: member.image_url,
            })),
          )
          if (inserted.error) throw toAuthoringError(inserted.error)
        }
      }
      // The folders of the slides this undo did not put back. Their rows are
      // gone and no inverse names them any more, so this is the second of the
      // two paths that may remove objects. The captured slides keep theirs:
      // `replaceSlides` deliberately left those files alone so the verbatim
      // `image_url` above still points at something.
      for (const slide of dropped) {
        await removeSlideUploadObjects(client, sliceId, slide.id)
      }
      return
    }
    case 'restore_slide_images': {
      // Undo of a write to a slide's image set: the flag and the members as
      // they were, together, because the flag alone decides whether the
      // members are read at all. No file is touched — an object a member
      // named before the change is still in the bucket and still named by
      // this capture.
      const slideId = stringArg(revert.args, 'slide_id')
      const members = Array.isArray(revert.args.members)
        ? (revert.args.members as SlideImageMemberInput[])
        : []
      await restoreSlideImageSet(client, slideId, {
        shows_all_images: revert.args.shows_all_images === true,
        members,
      })
      return
    }
    case 'delete_slice_row': {
      // Undo of "added a slice" / "duplicated a slice": remove the row it
      // created. `slides` cascade, so the slides go with it — which is
      // why neither of those operations needs a slide capture of its own.
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
      //
      // The other cast the boundary does not fully answer for, for the same
      // reason as `update_evidence` and with three narrowings rather than one:
      // `updateFinding` assembles `previous: FindingUpdate` from a fresh read,
      // through `before.severity as FindingSeverity`, `before.source as
      // FindingSource` and `before.status as FindingStatus`. The keys present
      // are exactly the columns the forward write touched, which IS this
      // build's doing; the values in them are the row's. Same conclusion: it
      // goes back where it came from, so a parse would only be able to refuse
      // the restore.
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
      const summary = optionalStringArg(revert.args, 'summary')
      await updateServiceSummary(client, serviceId, summary, undefined, {
        record: false,
      })
      return
    }
    case 'update_business_model': {
      const serviceId = stringArg(revert.args, 'service_id')
      // Captured by `updateBusinessModel`'s `previous: BusinessModelUpdate`.
      const update = revert.args.update as BusinessModelUpdate
      await updateBusinessModel(client, serviceId, update, undefined, {
        record: false,
      })
      return
    }
    case 'update_service_entity_examples': {
      // Self-inverse, exactly like update_service_summary above: a direct
      // `services` update, so the previous map is handed straight back rather
      // than dispatched to an RPC that does not exist.
      const serviceId = stringArg(revert.args, 'service_id')
      // Captured by `updateServiceEntityExamples`'s
      // `previous: EntityExamplesUpdate`.
      const update = revert.args.update as EntityExamplesUpdate
      await updateServiceEntityExamples(client, serviceId, update, undefined, {
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
