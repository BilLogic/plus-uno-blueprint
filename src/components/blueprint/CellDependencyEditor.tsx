import { useState } from 'react'
import { Loader2, Pencil, Plus, X } from 'lucide-react'
import { IconTooltip } from '@/components/editor/IconTooltip'
import { OptionSelect } from '@/components/blueprint/OptionSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import {
  clearCellDependency,
  setCellDependency,
  updateCellDependency,
} from '@/lib/authoringRpc'
import {
  DEPENDENCY_DRAFT_ROW,
  DEPENDENCY_EDIT_TEXT,
  DEPENDENCY_KINDS,
  DEPENDENCY_KIND_HINTS,
  DEPENDENCY_KIND_LABELS,
  validateDraftDependency,
  type DependencyEndpoint,
  type DraftDependency,
} from '@/lib/dependencyValidation'
import type { DependencyKind } from '@/lib/authoringRpc'
import { cn, errorMessage } from '@/lib/utils'

export type ExistingDependency = {
  id: string
  targetCellId: string
  targetLabel: string
  kind: string
  note: string | null
}

/**
 * Editing a cell's connections, in the list that already shows them.
 *
 * `leads_to` draws an arrow; `enables` does not, and that asymmetry is the whole
 * point of having two kinds. A blueprint where every relationship is drawn is
 * unreadable, and most "this depends on that" facts are constraints rather
 * than handoffs — worth recording, not worth drawing. Nothing in this file
 * changes what either kind means; the kind control only moves an edge between
 * them, and `BlueprintDependencyArrows` keeps deciding which ones are drawn.
 *
 * WHAT THIS FILE STOPPED BEING (#550). It used to render its own `<ul>` of the
 * outgoing connections underneath `CellDependencySections`, which was already
 * showing them — the same edge twice, once as content and once as something
 * shaped like a field but inert. There is one list now, and these are the
 * controls a row wears when the cell owns it.
 *
 * OWNERSHIP. A cell edits only the arrows it is the SOURCE of. An incoming
 * arrow belongs to the cell at the other end and is edited from there, which is
 * what `InboundRowPencil` is: not a statement that the row is uneditable, but
 * the way to go and edit it.
 *
 * ONE PROSE FIELD. A row carries a kind, a target and a `note` — the third of
 * those is the only free text a dependency has since #550 retired `name`, and
 * it is general purpose: whatever is worth knowing about this dependency.
 *
 * Candidates come from the caller rather than a query here: the panel already
 * holds the version's cells, and re-reading them would be a second round trip
 * for data on screen.
 */
export type DependencyEditing = {
  source: DependencyEndpoint
  candidates: DependencyEndpoint[]
  /** Every edge this cell is the source of — the duplicate check reads it. */
  existing: ExistingDependency[]
  /** Which row has its note field open; one at a time, or null. */
  activeDependencyId: string | null
  onActivate: (dependencyId: string | null) => void
  /** Select the cell an inbound arrow belongs to, on its Dependencies tab. */
  onEditFromOwner: (cellId: string) => void
}

const KIND_OPTIONS = DEPENDENCY_KINDS.map((kind) => ({
  value: kind,
  label: DEPENDENCY_KIND_LABELS[kind],
}))

/*
  Two selects on one line, in a panel 264px wide.

  Not the `SegmentedControl` this file used to wear: a segmented control with
  both kind words in it, plus a target select, does not fit on one line, and the
  row has to be one line or it is not the row the reader was already looking at.
  `OptionSelect` is the control #548 put on the evidence Kind field, so the
  panel keeps one select vocabulary.
*/
const KIND_SELECT_CLASS = 'h-7 w-[5.75rem] shrink-0 gap-0.5 px-1.5 text-xs'
const TARGET_SELECT_CLASS = 'h-7 min-w-0 flex-1 gap-0.5 px-1.5 text-xs'

/** Indents the note field and the kind hint under the row they belong to. */
const ROW_DETAIL_INDENT = 'pl-1'

function targetOptions(
  candidates: DependencyEndpoint[],
  sourceCellId: string,
  withPlaceholder: boolean,
) {
  const options = candidates
    .filter((entry) => entry.cellId !== sourceCellId)
    .map((entry) => ({ value: entry.cellId, label: entry.label }))
  return withPlaceholder
    ? [{ value: '', label: DEPENDENCY_EDIT_TEXT.connectTo }, ...options]
    : options
}

/**
 * The trailing control on an editable row: remove, or — while its write is in
 * flight — the row's own spinner.
 *
 * Per row, deliberately. A tab-wide busy state would freeze seven rows because
 * the eighth is saving, and a tab-wide error would put the message as far from
 * the row that failed as the panel allows.
 */
function RowAction({
  busy,
  label,
  onClick,
}: {
  busy: boolean
  label: string
  onClick: () => void
}) {
  if (busy) {
    return (
      <span
        className="flex size-7 shrink-0 items-center justify-center"
        role="status"
        aria-label="Saving"
      >
        <Loader2 className="size-3 animate-spin text-muted-foreground" aria-hidden />
      </span>
    )
  }
  return (
    <IconTooltip label={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground hover:text-foreground"
        aria-label={label}
        onClick={onClick}
      >
        <X className="size-3" />
      </Button>
    </IconTooltip>
  )
}

/** The kind hint, attached to the control it describes and nothing else. */
function KindHint({ kind }: { kind: DependencyKind }) {
  return (
    <p className={cn('text-xs text-muted-foreground', ROW_DETAIL_INDENT)}>
      {DEPENDENCY_KIND_HINTS[kind]}
    </p>
  )
}

/**
 * The one prose field a dependency has, labelled.
 *
 * LABELLED, and the label is not the placeholder — the rule #548 established on
 * the evidence form: a placeholder describes the box only until somebody types
 * into it, which is exactly when a half-filled form most needs to say what its
 * boxes hold.
 *
 * THE TWO PANELS NO LONGER SAY IT THE SAME WAY, and that is worth recording
 * rather than leaving to be found. #548 gave both this row and the evidence
 * form the word "optional" beside the name; #553 moved the evidence form onto
 * `panelShell`'s `Field`, which marks the field that CANNOT be left empty with
 * an asterisk and says nothing about the ones that can. Every other panel in
 * this app already reads that way, so the evidence form joined the majority
 * and this row is now the last place the word appears. Moving it is a
 * one-line change and belongs with whoever next has a reason to open this
 * file; what it is not is an accident.
 */
function NoteField({
  value,
  disabled,
  onChange,
  onCommit,
}: {
  value: string
  disabled: boolean
  onChange: (next: string) => void
  onCommit: () => void
}) {
  return (
    <label className={cn('flex flex-col gap-1', ROW_DETAIL_INDENT)}>
      <span className="text-xs font-medium text-muted-foreground">
        {DEPENDENCY_EDIT_TEXT.noteLabel}
        {DEPENDENCY_EDIT_TEXT.noteOptional ? (
          <span className="font-normal text-muted-foreground/70"> · optional</span>
        ) : null}
      </span>
      <Input
        value={value}
        disabled={disabled}
        placeholder={DEPENDENCY_EDIT_TEXT.notePlaceholder}
        className="h-7 text-xs"
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
      />
    </label>
  )
}

/** The message goes under the row that produced it, never at the top of a tab. */
function RowError({ message }: { message: string }) {
  return (
    <p
      className={cn('text-xs text-destructive', ROW_DETAIL_INDENT)}
      data-dependency-row-error=""
    >
      {message}
    </p>
  )
}

function refresh() {
  // Arrows are drawn from the grid read, so the canvas has to re-read —
  // invalidating a panel-local query would leave the line on screen.
  invalidateQueries('service-phases')
}

/**
 * One connection this cell owns, as fields, where the row already sits.
 *
 * Kind and target save the moment they change; the note saves on blur, because
 * a round trip per keystroke is a write per letter of a sentence.
 *
 * Every one of those goes through `updateCellDependency`, and it has to.
 * `setCellDependency` upserts on (source, target, kind): a new kind or a new
 * target is a new conflict key, so editing either through it INSERTS a second
 * row and orphans the first, which the board keeps drawing.
 *
 * The note travels on EVERY write, including the two that are not about it.
 * The function takes all three or none — an update told nothing about the note
 * would clear it — so changing a kind carries the sentence along unchanged.
 */
export function DependencyEditRow({
  dependencyId,
  kind,
  targetCellId,
  note,
  editing,
}: {
  dependencyId: string
  kind: DependencyKind
  targetCellId: string
  note: string | null
  editing: DependencyEditing
}) {
  const { client } = useSupabase()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState(note ?? '')
  const [seed, setSeed] = useState(note ?? '')

  // The stored note changed under us — a save landed, or another session wrote
  // it. Re-seed rather than keep showing a draft of a value that is gone.
  if (seed !== (note ?? '')) {
    setSeed(note ?? '')
    setDraftNote(note ?? '')
  }

  const active = editing.activeDependencyId === dependencyId

  const write = async (next: {
    kind: DependencyKind
    targetCellId: string
    note: string
  }) => {
    if (!client || busy) return
    setBusy(true)
    setError(null)
    try {
      await updateCellDependency(client, {
        dependencyId,
        kind: next.kind,
        targetCellId: next.targetCellId,
        note: next.note.trim() || null,
      })
      refresh()
    } catch (writeError) {
      setError(errorMessage(writeError))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!client || busy) return
    setBusy(true)
    setError(null)
    try {
      await clearCellDependency(client, dependencyId)
      refresh()
    } catch (removeError) {
      setError(errorMessage(removeError))
    } finally {
      setBusy(false)
    }
  }

  const targetLabel =
    editing.candidates.find((entry) => entry.cellId === targetCellId)?.label ??
    targetCellId

  return (
    <li
      className="border-b border-muted px-2 py-1.5 last:border-0"
      data-dependency-row={dependencyId}
      onFocusCapture={() => editing.onActivate(dependencyId)}
      onPointerDownCapture={() => editing.onActivate(dependencyId)}
    >
      {/* Dimmed while its own write is in flight. The rest of the list stays
          live — nothing about this row's save makes the next one untrue. */}
      <div
        className={cn(
          'flex flex-col gap-1.5 transition-opacity duration-(--motion-micro)',
          busy ? 'opacity-60' : undefined,
        )}
      >
        <div className="flex items-center gap-1.5">
          <OptionSelect
            value={kind}
            options={KIND_OPTIONS}
            disabled={busy}
            className={KIND_SELECT_CLASS}
            aria-label={`Connection kind for ${targetLabel}`}
            onChange={(next) => {
              editing.onActivate(dependencyId)
              void write({ kind: next, targetCellId, note: draftNote })
            }}
          />
          <OptionSelect
            value={targetCellId}
            options={targetOptions(
              editing.candidates,
              editing.source.cellId,
              false,
            )}
            disabled={busy}
            className={TARGET_SELECT_CLASS}
            aria-label={`Connects to ${targetLabel}`}
            onChange={(next) => {
              editing.onActivate(dependencyId)
              void write({ kind, targetCellId: next, note: draftNote })
            }}
          />
          <RowAction
            busy={busy}
            label={`Remove the connection to ${targetLabel}`}
            onClick={() => void remove()}
          />
        </div>
        {active ? <KindHint kind={kind} /> : null}
        {active ? (
          <NoteField
            value={draftNote}
            disabled={busy}
            onChange={setDraftNote}
            onCommit={() => {
              if (draftNote.trim() === (note ?? '')) return
              void write({ kind, targetCellId, note: draftNote })
            }}
          />
        ) : null}
        {error ? <RowError message={error} /> : null}
      </div>
    </li>
  )
}

/**
 * A connection this cell does not own, and the way to go and edit it.
 *
 * The sentence that stood here — "Edited from the other cell" — is gone. A
 * control that states a fact is not a control, and the fact was only ever
 * interesting to someone who wanted to change the row.
 */
export function InboundRowPencil({
  ownerCellId,
  ownerLabel,
  onEditFromOwner,
}: {
  ownerCellId: string
  ownerLabel: string
  onEditFromOwner: (cellId: string) => void
}) {
  const label = `Edit in “${ownerLabel}”`
  return (
    <span className="absolute top-1 right-1">
      <IconTooltip label={label}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          aria-label={label}
          onClick={() => onEditFromOwner(ownerCellId)}
        >
          <Pencil className="size-3" />
        </Button>
      </IconTooltip>
    </span>
  )
}

/**
 * The new connection, as a row of the same shape at the bottom of the same
 * list. Not a form below it: a form below a list is a second list, which is
 * the defect #550 is named after.
 *
 * It opens under **Leads to**, because a new connection from this cell is
 * always outgoing.
 */
export function DependencyAddRow({
  editing,
  onClose,
}: {
  editing: DependencyEditing
  onClose: () => void
}) {
  const { client } = useSupabase()
  const [draft, setDraft] = useState<DraftDependency>({
    sourceCellId: editing.source.cellId,
    targetCellId: null,
    kind: 'leads_to',
    note: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const target =
    editing.candidates.find((entry) => entry.cellId === draft.targetCellId) ??
    null
  const problems = validateDraftDependency(
    draft,
    editing.source,
    target,
    editing.existing,
  )
  const active = editing.activeDependencyId === DEPENDENCY_DRAFT_ROW

  const connect = async (next: DraftDependency) => {
    if (!client || busy || !next.targetCellId) return
    if (
      validateDraftDependency(
        next,
        editing.source,
        editing.candidates.find(
          (entry) => entry.cellId === next.targetCellId,
        ) ?? null,
        editing.existing,
      ).length > 0
    ) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await setCellDependency(client, {
        sourceCellId: next.sourceCellId,
        targetCellId: next.targetCellId,
        kind: next.kind,
        note: next.note.trim() || null,
      })
      refresh()
      onClose()
    } catch (connectError) {
      setError(errorMessage(connectError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li
      className="border-b border-muted px-2 py-1.5 last:border-0"
      data-dependency-row={DEPENDENCY_DRAFT_ROW}
      onFocusCapture={() => editing.onActivate(DEPENDENCY_DRAFT_ROW)}
      onPointerDownCapture={() => editing.onActivate(DEPENDENCY_DRAFT_ROW)}
    >
      <div
        className={cn(
          'flex flex-col gap-1.5 transition-opacity duration-(--motion-micro)',
          busy ? 'opacity-60' : undefined,
        )}
      >
        <div className="flex items-center gap-1.5">
          <OptionSelect
            value={draft.kind}
            options={KIND_OPTIONS}
            disabled={busy}
            className={KIND_SELECT_CLASS}
            aria-label="Connection kind for the new connection"
            onChange={(kind) => setDraft((current) => ({ ...current, kind }))}
          />
          <OptionSelect
            value={draft.targetCellId ?? ''}
            options={targetOptions(
              editing.candidates,
              editing.source.cellId,
              true,
            )}
            disabled={busy}
            className={TARGET_SELECT_CLASS}
            aria-label={DEPENDENCY_EDIT_TEXT.connectTo}
            onChange={(targetCellId) => {
              const next = {
                ...draft,
                targetCellId: targetCellId || null,
              }
              setDraft(next)
              void connect(next)
            }}
          />
          <RowAction
            busy={busy}
            label="Discard this new connection"
            onClick={onClose}
          />
        </div>
        {active ? <KindHint kind={draft.kind} /> : null}
        {active ? (
          <NoteField
            value={draft.note}
            disabled={busy}
            onChange={(note) => setDraft((current) => ({ ...current, note }))}
            onCommit={() => {}}
          />
        ) : null}
        {problems.length > 0 && draft.targetCellId ? (
          <ul
            className={cn(
              'flex flex-col gap-1 text-xs text-muted-foreground',
              ROW_DETAIL_INDENT,
            )}
            data-dependency-problems=""
          >
            {problems.map((problem) => (
              <li key={problem}>· {problem}</li>
            ))}
          </ul>
        ) : null}
        {error ? <RowError message={error} /> : null}
      </div>
    </li>
  )
}

/** The one control that opens a draft row. */
export function DependencyAddControl({ onOpen }: { onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 w-fit gap-1 self-start px-2 text-xs text-muted-foreground hover:text-foreground"
      onClick={onOpen}
    >
      <Plus className="size-3" aria-hidden />
      {DEPENDENCY_EDIT_TEXT.add}
    </Button>
  )
}
