import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconTooltip } from '@/components/editor/IconTooltip'
import {
  CELL_PANEL_FOOTER_ID,
  Field,
  PANEL_TEXTAREA_CLASS,
} from '@/components/blueprint/panelShell'
import { OwnerTagSelect } from '@/components/blueprint/OwnerTagSelect'
import { invalidateCanvasBlueprintsForPath } from '@/hooks/useCanvasBlueprints'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useBlueprintCell } from '@/hooks/useBlueprintCell'
import { useValueAudiences } from '@/hooks/useValueAudiences'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import { invalidateUnplacedQueue } from '@/hooks/useUnplacedTouchpointDetails'
import { upsertCell } from '@/lib/authoringRpc'
import {
  CELL_CONTENT_TARGET,
  CELL_CONTENT_WARNING,
  TOUCHPOINT_LABEL_TARGET,
  TOUCHPOINT_LABEL_WARNING,
} from '@/lib/cellContentLimits'
import { parseCellContentItems } from '@/lib/parseCellContent'
import { PANEL_TEXT } from '@/lib/panelText'
import { updateCellContent } from '@/lib/cellContentMutations'
import { RoleSelect } from '@/components/blueprint/RoleSelect'
import { PlacementResourcesList } from '@/components/blueprint/PlacementResourcesList'
import {
  placementSurvivesContent,
  updateTouchpointPlacement,
  type PlacementDetailColumns,
  type PlacementDetailDraft,
} from '@/lib/touchpointMutations'
import type { CellResource, CellTouchpoint } from '@/types/blueprint'
import {
  DEFAULT_ENTITY_STATUS,
  type EntityStatus,
} from '@/lib/entityStatus'
import { StatusSelect } from '@/components/blueprint/StatusSelect'
import { updateCellSpec } from '@/lib/cellSpecMutations'
import { parseValueProps, type ValueProp } from '@/lib/valueProps'
import { cn, errorMessage } from '@/lib/utils'

/** Where a not-yet-created cell would go — the draft the editor writes on Save. */
export type DraftCellTarget = {
  pathId: string
  laneId: string
  stepId: string
  laneName: string
  stepName: string
  stepIndex: number
  scenarioName?: string
  phaseName?: string
}

type FormState = {
  content: string
  summary: string
  owner: string
  perceivedOwner: string
  /**
   * `cells.function` and `cells.form`, under a suffix (#257). `function` is a
   * keyword, so a key by that name cannot be destructured, and `form` is the
   * name of this state object itself, so `form.form` would read as a typo.
   * The suffix is the whole of the difference; `a-form-key-is-a-column`
   * knows it and strips it before matching the key to its column.
   */
  functionText: string
  formText: string
  /** `cells.value_props`: one line per audience, see CONTEXT.md's label table. */
  valueProps: ValueProp[]
  status: EntityStatus
  /**
   * The selected touchpoint's own detail, when a touchpoint was clicked to open
   * this panel. Part of the SAME form state as the cell's fields, and
   * deliberately so: the panel is showing one cell and one of its
   * placements, and two Save buttons for what a reader experiences as one
   * screen is the arrangement this editor was built to end.
   */
  placement: PlacementDetailDraft
}

/** An unmarked, unwritten placement — the state a cell with no touchpoint selected sits in. */
const EMPTY_PLACEMENT: PlacementDetailDraft = {
  summary: '',
  role: null,
}

/**
 * The columns to restore, read back out of the FROZEN baseline draft.
 *
 * Not off the `placement` prop, which keeps tracking the live query: a ⌘Z
 * revert of this same cell refetches it and changes the prop mid-edit, and an
 * inverse captured from it would then promise to restore values that were
 * already gone when editing began. Same reason the baseline is frozen at all.
 *
 * The round trip through the draft normalises an empty string to null, which
 * is the shape the column holds anyway — the read path checks for null, and
 * restoring `''` where the row had NULL would be restoring a second spelling
 * of empty that nothing else in the app writes.
 */
function placementColumns(draft: PlacementDetailDraft): PlacementDetailColumns {
  return {
    summary: draft.summary || null,
    role: draft.role,
  }
}

/**
 * The form's fields for a placement, seeded from its OWN values.
 *
 * Never from `resolveTouchpointDetail`'s resolved text, which falls back to
 * the cell's summary when the placement has none: seeding with that would
 * copy the cell's sentence onto the placement the first time anybody pressed
 * Save, and the two would then say the same thing forever without anyone
 * having decided that they should.
 */
function placementDraft(placement: CellTouchpoint): PlacementDetailDraft {
  return {
    summary: placement.summary ?? '',
    role: placement.role,
  }
}

/**
 * The whole cell in one form, one Save.
 *
 * This replaced two stacked editors (text/owners and function/form/value)
 * that each carried their own Save and Cancel — four buttons for one cell,
 * and a Save that only saved half of what was on screen. Here Save writes
 * everything that changed and Cancel discards everything, at page level.
 *
 * Two modes share the form: editing an existing cell, and a **draft** — a
 * cell that does not exist yet. The draft writes *nothing* until Save; a
 * cancelled draft never touches the database. That is the fix for creation
 * feeling broken: the row used to be written first and filled in later.
 */
export function CellPanelEditor({
  cellId,
  draft,
  laneName,
  placement = null,
  placementResources = [],
  fallbackDescription = '',
  onDone,
}: {
  /** Existing cell to edit; null when creating from a draft target. */
  cellId: string | null
  draft?: DraftCellTarget
  /** Selects narrative-copy versus technology-label guidance. */
  laneName?: string
  /**
   * The touchpoint placement the panel was opened on, when a touchpoint was
   * clicked. Its four detail fields join this form.
   *
   * A placement with no `id` is not editable and is passed through as absent:
   * that is a fallback board, where the placements are derived from a cell's
   * links and there is no row to write into.
   */
  placement?: CellTouchpoint | null
  /**
   * The cell's resources, from which the placement's list keeps its own
   * (#273). Read here, written by `PlacementResourcesList` on its own
   * button — see the note at the list.
   */
  placementResources?: readonly CellResource[]
  /**
   * What the panel displays as this cell's description when the column is
   * empty (a touchpoint cell's prose is its placement's summary). Seeded into
   * the field so the editor shows the same text the reader saw — saving moves
   * it into the column, which takes precedence from then on.
   */
  fallbackDescription?: string
  onDone: () => void
}) {
  const { configured } = useSupabase()
  // One read from the board, where two queries used to be. There is no
  // loading branch left, and no error branch: the panel cannot be open
  // without the board it was opened from.
  const cell = useBlueprintCell(configured && cellId ? cellId : null)
  // A placement is editable only when it has a row behind it.
  const editable = placement?.id ? placement : null

  if (cellId) {
    const content = cell
    const spec = cell
    if (!content) return null

    const baseline: FormState = {
      content: content.content,
      // The DB truth. The *field* may be seeded with the placement-derived
      // fallback below, but diffs and reverts compare against this — an
      // owner-only edit must not smuggle the fallback prose into the
      // description column, and undo must restore what the DB actually held.
      summary: content.summary ?? '',
      owner: content.owner ?? '',
      perceivedOwner: content.perceived_owner ?? '',
      functionText: spec?.function ?? '',
      formText: spec?.form ?? '',
      valueProps: parseValueProps(spec?.value_props ?? null),
      status: content.status ?? DEFAULT_ENTITY_STATUS,
      placement: editable ? placementDraft(editable) : EMPTY_PLACEMENT,
    }

    return (
      <CellPanelEditorForm
        // Keyed on the placement as well as the cell: clicking a second touchpoint
        // on the same cell keeps the same cell id, and without the placement
        // in the key the frozen baseline below would still describe the touchpoint
        // the author had finished with.
        key={editable ? `${cellId}:${editable.id}` : cellId}
        cellId={cellId}
        draft={undefined}
        laneName={laneName}
        placement={editable}
        placementResources={placementResources}
        baseline={baseline}
        seededDescription={content.summary ?? fallbackDescription}
        onDone={onDone}
      />
    )
  }

  if (!draft) return null
  return (
    <CellPanelEditorForm
      key={`${draft.laneId}:${draft.stepId}`}
      cellId={null}
      draft={draft}
      laneName={laneName ?? draft.laneName}
      baseline={{
        content: '',
        summary: '',
        status: DEFAULT_ENTITY_STATUS,
        owner: '',
        perceivedOwner: '',
        functionText: '',
        formText: '',
        valueProps: [],
        // A cell that does not exist yet holds no placements: its touchpoints come
        // into being when its text is first saved and synced.
        placement: EMPTY_PLACEMENT,
      }}
      seededDescription=""
      placement={null}
      placementResources={[]}
      onDone={onDone}
    />
  )
}

function CellPanelEditorForm({
  cellId,
  draft,
  laneName,
  placement,
  placementResources,
  baseline: baselineProp,
  seededDescription,
  onDone,
}: {
  cellId: string | null
  draft: DraftCellTarget | undefined
  laneName: string | undefined
  /** Non-null only when it carries a row id — see CellPanelEditor. */
  placement: CellTouchpoint | null
  placementResources: readonly CellResource[]
  baseline: FormState
  seededDescription: string
  onDone: () => void
}) {
  const { client } = useSupabase()
  const audiencesResult = useValueAudiences()
  const audiences =
    audiencesResult.status === 'ready' ? audiencesResult.data : []
  // The footer host mounts in the same commit as this form; looked up once
  // after mount so the portal lands below the scroll region.
  const [footerHost, setFooterHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot DOM lookup of the portal host; it only exists after the panel's first commit
    setFooterHost(document.getElementById(CELL_PANEL_FOOTER_ID))
  }, [])
  /*
    Frozen at mount (state initializer, never re-set). The props keep
    tracking the live query — a ⌘Z revert of this same cell refetches it
    and changes them mid-edit — but the form's diff and its captured
    `previous` must speak about the world as it was when editing began, or
    Save quietly writes reverted values back.
  */
  const [baseline] = useState(baselineProp)
  const [form, setForm] = useState<FormState>({
    ...baseline,
    summary: seededDescription,
  })
  // Only a deliberate edit persists the seeded fallback prose into the
  // description column; an untouched field keeps whatever the DB held.
  const [descriptionTouched, setDescriptionTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A save that resolves after this form unmounted (the user switched
  // cells) must not call onDone — that would slam shut whatever panel they
  // are reading now.
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])
  // A draft that created its row but failed a later write resumes on retry
  // instead of upserting a second time (which would log a second "Added a
  // cell" whose revert deletes the same row).
  const [createdId, setCreatedId] = useState<string | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const setPlacement = <K extends keyof PlacementDetailDraft>(
    key: K,
    value: PlacementDetailDraft[K],
  ) =>
    setForm((current) => ({
      ...current,
      placement: { ...current.placement, [key]: value },
    }))

  const blocked = !form.content.trim()
  const isTechCell =
    laneName === 'Front Stage Tech' || laneName === 'Back Stage Tech'
  const techItems = isTechCell ? parseCellContentItems(form.content) : []
  const longestTechItem = techItems.reduce(
    (longest, item) => Math.max(longest, item.length),
    0,
  )
  const contentTarget = isTechCell
    ? TOUCHPOINT_LABEL_TARGET
    : CELL_CONTENT_TARGET
  const contentWarning = isTechCell
    ? TOUCHPOINT_LABEL_WARNING
    : CELL_CONTENT_WARNING
  const measuredLength = isTechCell ? longestTechItem : form.content.length
  const overContentWarning = measuredLength > contentWarning

  const effectiveSummary = descriptionTouched
    ? form.summary
    : baseline.summary
  const contentChanged =
    form.content !== baseline.content ||
    effectiveSummary !== baseline.summary ||
    form.owner !== baseline.owner ||
    form.perceivedOwner !== baseline.perceivedOwner ||
    form.status !== baseline.status
  const specChanged =
    form.functionText !== baseline.functionText ||
    form.formText !== baseline.formText ||
    JSON.stringify(form.valueProps) !== JSON.stringify(baseline.valueProps)
  const placementChanged =
    Boolean(placement) &&
    (form.placement.summary !== baseline.placement.summary ||
      form.placement.role !== baseline.placement.role)

  const handleSave = async () => {
    if (!client || busy || blocked) return
    setBusy(true)
    setError(null)
    try {
      let targetId = cellId ?? createdId
      const creating = targetId === null
      if (targetId === null) {
        // The draft becomes real here and only here. Cancel never writes.
        targetId = await upsertCell(client, {
          pathId: draft!.pathId,
          laneId: draft!.laneId,
          stepId: draft!.stepId,
          content: form.content.trim(),
        })
        setCreatedId(targetId)
      }

      const draftExtras =
        !cellId &&
        Boolean(
          form.summary.trim() ||
            form.owner.trim() ||
            form.perceivedOwner.trim(),
        )
      if ((cellId && contentChanged) || (!cellId && (draftExtras || !creating))) {
        await updateCellContent(
          client,
          targetId,
          {
            content: form.content,
            summary: cellId ? effectiveSummary : form.summary,
            owner: form.owner,
            perceivedOwner: form.perceivedOwner,
            status: form.status,
          },
          cellId
            ? {
                content: baseline.content,
                summary: baseline.summary,
                owner: baseline.owner,
                perceivedOwner: baseline.perceivedOwner,
                status: baseline.status,
              }
            : undefined,
          // The create already logs "Added a cell"; its field fill-in is
          // part of the same user action, not a second change.
          { record: Boolean(cellId) },
        )
      }
      if (specChanged) {
        await updateCellSpec(
          client,
          targetId,
          {
            function: form.functionText,
            form: form.formText,
            valueProps: form.valueProps,
          },
          cellId
            ? {
                function: baseline.functionText,
                form: baseline.formText,
                valueProps: baseline.valueProps,
              }
            : undefined,
          { record: Boolean(cellId) },
        )
      }

      /*
        The placement, after the cell — and after the sync the cell's save
        runs, which is what makes the order load-bearing rather than tidy.

        `updateCellContent` calls `sync_cell_touchpoints`, and a save that
        removed this touchpoint's name from the text deletes its placement
        along with everything written about it. Writing the detail first would
        write words onto a row about to be destroyed; writing it afterwards
        without asking would fail on zero rows, on a save that did exactly
        what the author asked for. So it asks.
      */
      if (
        placement?.id &&
        placementChanged &&
        placementSurvivesContent(form.content, placement.name)
      ) {
        await updateTouchpointPlacement(
          client,
          { id: placement.id, cellId: targetId, name: placement.name },
          form.placement,
          placementColumns(baseline.placement),
        )
      }

      invalidateQueries('service-phases')
      // Content edit: only the edited path's scenario is stale (todo 029).
      // Existing-cell edits mount with draft undefined and don't know their
      // path, so they fall back to invalidating every scenario's blueprint.
      if (draft) {
        invalidateCanvasBlueprintsForPath(draft.pathId)
      } else {
        invalidateQueries('canvas-blueprints')
      }
      invalidateQueries(`cell-content:${targetId}`)
      invalidateQueries(`cell-spec:${targetId}`)
      invalidateQueries('owner-tags')
      // A save can introduce a new value audience; the autocomplete list
      // caches under its own key and never refetches on its own.
      invalidateQueries('value-audiences')
      // Taking a touchpoint out of the text deletes its placement, and if that
      // placement carried a summary or a featured resource the database parks the
      // writing in the unplaced queue rather than destroying it. The queue is
      // cached under its own key, so without this the new row is invisible
      // until a reload — which is the disappearance this ticket is about.
      invalidateUnplacedQueue()
      if (aliveRef.current) onDone()
    } catch (saveError) {
      if (aliveRef.current) {
        setError(errorMessage(saveError))
      }
    } finally {
      if (aliveRef.current) setBusy(false)
    }
  }

  return (
    <div
      className="flex flex-col gap-3"
      data-panel-editor=""
      // Read by the panel's dismiss paths: Escape while a save is in flight
      // must not close the drawer — "cancelled" a beat after clicking Create
      // would otherwise materialize the cell into a panel-less silence.
      data-busy={busy || undefined}
    >
      <Field label="Content" hint="What this cell says on the grid." required>
        <Input
          value={form.content}
          autoFocus={cellId === null}
          onChange={(event) => set('content', event.target.value)}
        />
        <p
          className={cn(
            'text-3xs',
            overContentWarning ? 'text-warning-600' : 'text-muted-foreground',
          )}
          data-cell-content-guidance=""
        >
          {isTechCell
            ? `${measuredLength} characters in the longest touchpoint · ${contentTarget} recommended per label${overContentWarning ? ` · review above ${contentWarning}` : ''}`
            : `${measuredLength} characters · ${contentTarget} recommended${overContentWarning ? ` · review above ${contentWarning}` : ''}`}
        </p>
      </Field>

      {/*
        The placement, directly under the text that lists it.

        Enclosed and headed rather than mixed into the cell's fields, because
        these four belong to a DIFFERENT thing: the cell is the moment, the
        placement is one touchpoint used at it, and the same tool at the next
        step keeps its own words. Two fields called Summary on one screen is
        exactly why the group draws a border and says whose it is.

        Directly under Content and not at the bottom because the author reached
        this panel by clicking that touchpoint. Making them scroll past six of the
        cell's fields to reach the thing they clicked is how an editor teaches
        people it is not for them.
      */}
      {placement ? (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-3">
          <div className="flex flex-col gap-0.5">
            <span className={PANEL_TEXT.sectionLabel}>
              “{placement.name}” at this step
            </span>
            <p className="text-3xs text-muted-foreground">
              This touchpoint’s own words here. The same tool at another step
              keeps its own.
            </p>
          </div>
          <Field
            label="Summary"
            hint="What this touchpoint does at this moment — the screen, the message, the part of it being used."
          >
            <textarea
              value={form.placement.summary}
              rows={3}
              onChange={(event) =>
                setPlacement('summary', event.target.value)
              }
              className={PANEL_TEXTAREA_CLASS}
            />
          </Field>
          <Field
            label="Role"
            hint="Whether the moment happens through this touchpoint or merely alongside it. Most placements are never marked, and leaving it unmarked is not the same as calling it peripheral."
          >
            <RoleSelect
              value={form.placement.role}
              aria-label="Role"
              onChange={(next) => setPlacement('role', next)}
            />
          </Field>
          {/*
            The one exception to "one Save": the list has its own. A reorder
            is a whole-list fact and featuring is one row's flag that the
            database settles in its own transaction (#273) — folding either
            into the four-field Save would make that button write things it
            cannot show as unsaved. The list says so on its own button.
          */}
          {placement.id && cellId ? (
            <PlacementResourcesList
              placement={{
                id: placement.id,
                cellId,
                name: placement.name,
              }}
              resources={placementResources}
            />
          ) : null}
        </div>
      ) : null}

      {/* The tl;dr that consolidates what the detailed fields (function,
          form, value) spell out. The column is `summary` too now — this used
          to carry a note explaining why the label and the column disagreed. */}
      {/* The hint no longer opens by naming the field: the card's eyebrow
          prints "Summary" above it (#243). */}
      <Field label="Summary" hint="What the detailed fields below add up to.">
        <textarea
          value={form.summary}
          rows={3}
          onChange={(event) => {
            setDescriptionTouched(true)
            set('summary', event.target.value)
          }}
          className={PANEL_TEXTAREA_CLASS}
        />
      </Field>

      <Field
        label="Status"
        hint="How far along the thing this cell describes is, from proposed to live to on its way out."
      >
        <StatusSelect
          value={form.status}
          onChange={(next) => set('status', next)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Owner" hint="The team accountable for this moment.">
          <OwnerTagSelect
            value={form.owner}
            ariaLabel="Owner"
            onChange={(value) => set('owner', value)}
          />
        </Field>
        <Field
          label="Perceived owner"
          hint="Who the person on the other side thinks they are dealing with. A gap between the two is a finding."
        >
          <OwnerTagSelect
            value={form.perceivedOwner}
            ariaLabel="Perceived owner"
            onChange={(value) => set('perceivedOwner', value)}
          />
        </Field>
      </div>

      <Field label="Function" hint="What this cell has to accomplish.">
        <textarea
          value={form.functionText}
          rows={2}
          onChange={(event) => set('functionText', event.target.value)}
          className={PANEL_TEXTAREA_CLASS}
        />
      </Field>
      <Field label="Form" hint="How it comes across.">
        <textarea
          value={form.formText}
          rows={2}
          onChange={(event) => set('formText', event.target.value)}
          className={PANEL_TEXTAREA_CLASS}
        />
      </Field>

      <Field
        label="Value proposition"
        hint="Who gets what from it — one line per audience."
      >
        <div className="flex flex-col gap-1.5">
          {form.valueProps.map((entry, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <Input
                value={entry.for}
                placeholder="For…"
                // Suggests the audiences already in use — same tag logic as
                // owners, lighter control: a datalist suggests, never blocks.
                list="cell-value-audiences"
                className="h-7 w-24 shrink-0 text-xs"
                onChange={(event) =>
                  set(
                    'valueProps',
                    form.valueProps.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, for: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <Input
                value={entry.value}
                placeholder="…gets this"
                className="h-7 min-w-0 flex-1 text-xs"
                onChange={(event) =>
                  set(
                    'valueProps',
                    form.valueProps.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, value: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <IconTooltip label="Remove this value proposition">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove value proposition"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    set(
                      'valueProps',
                      form.valueProps.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    )
                  }
                >
                  <X className="size-3" />
                </Button>
              </IconTooltip>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 self-start px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() =>
              set('valueProps', [...form.valueProps, { for: '', value: '' }])
            }
          >
            <Plus className="size-3" />
            Add value proposition
          </Button>
          <datalist id="cell-value-audiences">
            {audiences.map((audience) => (
              <option key={audience} value={audience} />
            ))}
          </datalist>
        </div>
      </Field>

      {blocked ? (
        <p className="text-xs text-muted-foreground">
          A cell needs content.
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {(() => {
        const controls = (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || blocked}
              onClick={handleSave}
            >
              {busy ? 'Saving…' : cellId ? 'Save' : 'Create cell'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onDone}
            >
              Cancel
            </Button>
          </div>
        )
        // Pinned to the drawer bottom when the host exists — shared footing
        // for everything on the panel. Inline only as a fallback.
        return footerHost ? createPortal(controls, footerHost) : controls
      })()}
    </div>
  )
}
