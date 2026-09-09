import { useState, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Plus,
} from 'lucide-react'
import { BlueprintTouchpointCell } from '@/components/blueprint/BlueprintTouchpointCell'
import {
  DependencyAddControl,
  DependencyAddRow,
  DependencyEditRow,
  InboundRowPencil,
  type DependencyEditing,
} from '@/components/blueprint/CellDependencyEditor'
import { useBlueprintCellDetailOptional } from '@/contexts/BlueprintCellDetailContext'
import type {
  BlueprintCellConnection,
  BlueprintCellConnections,
} from '@/lib/blueprintCellConnections'
import {
  DEPENDENCY_DIRECTION_LABELS,
  DEPENDENCY_EDIT_TEXT,
} from '@/lib/dependencyValidation'
import type { DependencyKind } from '@/lib/authoringRpc'
import { PANEL_TEXT } from '@/lib/panelText'
import { ROW_REVEAL_CLASS } from '@/lib/rowReveal'
import { cn } from '@/lib/utils'

export type CellDependencyTechEntry = {
  id: string
  cellId: string
  item: string
  laneName?: string
  stepIndex?: number
}

type SelectHandlers = {
  onCellSelect: (cellId: string) => void
  onTechSelect: (cellId: string, techItem: string) => void
}

type RowDirection = 'prev' | 'next' | 'both' | 'up' | 'down' | 'related'

/** Indents wrapped detail lines under the label: DirectionIcon width (size-3, 12px) + the row's 7px gap. */
const detailIndentClass = 'pl-[19px]'

/** Which list(s) a connection came from — drives the direction glyph. */
type RowFlow = 'in' | 'out' | 'both'

function resolveRowDirection(
  connection: BlueprintCellConnection,
  flow: RowFlow,
  selectedLaneRowPosition: number,
): RowDirection {
  if (connection.kind === 'interaction') {
    // Same step, different lane — vertical relationship.
    if (selectedLaneRowPosition < 0) return 'related'
    return connection.laneRowPosition < selectedLaneRowPosition
      ? 'up'
      : 'down'
  }
  if (flow === 'both') return 'both'
  return flow === 'in' ? 'prev' : 'next'
}

function DirectionIcon({ direction }: { direction: RowDirection }) {
  const iconClass = 'size-3 shrink-0 text-muted-foreground/70'

  switch (direction) {
    case 'up':
      return <ArrowUp className={iconClass} aria-hidden />
    case 'down':
      return <ArrowDown className={iconClass} aria-hidden />
    case 'both':
      return <ArrowLeftRight className={iconClass} aria-hidden />
    case 'prev':
      return <ArrowLeft className={iconClass} aria-hidden />
    case 'next':
      return <ArrowRight className={iconClass} aria-hidden />
    default:
      // Same-step relationship without an explicit directional connection.
      return <Plus className={iconClass} aria-hidden />
  }
}

/**
 * The why-line waits for a reader.
 *
 * A dependency row already says WHAT it points at — the lane, the step, the
 * edge's own name. The note says WHY the edge exists, which is worth reading
 * on one row at a time and not worth reading down a list of eight. Static, it
 * doubled the height of every row that had one and made the list's shape
 * depend on how talkative its author had been.
 *
 * Revealed rather than removed, by the one rule {@link ROW_REVEAL_CLASS}
 * states for every row control that waits for a reader — the resource list's
 * drag handle is the other (#549).
 */
const WHY_LINE_REVEAL_CLASS = ROW_REVEAL_CLASS

/** Lane and step, as the row itself says them — and as the pencil names them. */
function connectionRowLabel(connection: BlueprintCellConnection): string {
  return `${connection.laneName} · Step ${connection.stepIndex + 1}`
}

function DependencyRow({
  connection,
  direction,
  action,
  onCellSelect,
  onTechSelect,
}: {
  connection: BlueprintCellConnection
  direction: RowDirection
  /**
   * Absolutely positioned at the row's top right — the inbound row's pencil.
   *
   * Overlaid rather than laid out beside the text, because the row's tree is
   * asserted elsewhere by its exact shape (`mergedMembershipRailContract`), and
   * because the pencil belongs to the whole row rather than to its first line.
   */
  action?: ReactNode
} & SelectHandlers) {
  const detail = useBlueprintCellDetailOptional()

  const preview = (techItem: string | null) => {
    detail?.setPreviewHover({ cellId: connection.cellId, techItem })
  }
  const clearPreview = () => detail?.setPreviewHover(null)

  return (
    <li
      className={cn(
        'group border-b border-muted last:border-0',
        action ? 'relative' : undefined,
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-0.5 px-2 py-1.5 text-xs leading-snug transition-colors group-hover:bg-accent group-focus-within:bg-accent',
          action ? 'pr-8' : undefined,
        )}
      >
        <button
          type="button"
          className="flex min-w-0 flex-col items-stretch gap-0.5 text-left text-foreground/85 transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          onMouseEnter={() => preview(null)}
          onMouseLeave={clearPreview}
          onFocus={() => preview(null)}
          onBlur={clearPreview}
          onClick={() => {
            clearPreview()
            onCellSelect(connection.cellId)
          }}
        >
          <span className="flex min-w-0 items-center gap-[7px]">
            <DirectionIcon direction={direction} />
            <span className="min-w-0 truncate font-normal text-foreground/90">
              {connection.laneName}
              <span className="text-muted-foreground">
                {' '}
                · Step {connection.stepIndex + 1}
              </span>
            </span>
            {connection.linkName ? (
              <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-px text-3xs leading-tight text-muted-foreground">
                {connection.linkName}
              </span>
            ) : null}
          </span>
          {connection.contentPreview && !connection.isTech ? (
            <span className={cn('truncate text-2xs text-muted-foreground', detailIndentClass)}>
              {connection.contentPreview}
            </span>
          ) : null}
          {connection.linkNote ? (
            <span
              className={cn(
                WHY_LINE_REVEAL_CLASS,
                'text-2xs leading-snug text-muted-foreground italic',
                detailIndentClass,
              )}
            >
              {connection.linkNote}
            </span>
          ) : null}
        </button>
        {connection.isTech && connection.techItems.length > 0 ? (
          <span className={cn('flex flex-wrap gap-1 pt-0.5', detailIndentClass)}>
            {connection.techItems.map((item) => (
              <button
                key={item}
                type="button"
                className="focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                onMouseEnter={() => preview(item)}
                onMouseLeave={clearPreview}
                onFocus={() => preview(item)}
                onBlur={clearPreview}
                onClick={() => {
                  clearPreview()
                  onTechSelect(connection.cellId, item)
                }}
              >
                <BlueprintTouchpointCell
                  item={item}
                  compact
                  asSpan
                  inline
                  className="!w-fit max-w-full !px-2 !py-0.5 !text-3xs !font-normal leading-none text-foreground/75"
                />
              </button>
            ))}
          </span>
        ) : null}
        {action}
      </div>
    </li>
  )
}

function DependencyGroup({
  title,
  children,
  footer,
}: {
  title: string
  children: ReactNode
  /** Under the list, inside the group — where "Add a dependency" sits. */
  footer?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      {/* The same section-label role the spec sections use. Two treatments
          for one job — 11px medium sentence case here, 10px semibold
          uppercase there — read as two unrelated panels. */}
      <p className={PANEL_TEXT.sectionLabel}>
        {title}
      </p>
      <ul className="flex flex-col">{children}</ul>
      {footer}
    </div>
  )
}

type CellDependencySectionsProps = {
  connections: BlueprintCellConnections
  /** Same-step tech without an explicit dependency (kept from panel v1). */
  otherTech: CellDependencyTechEntry[]
  /** Lane row position of the selected cell — orients up/down glyphs. */
  selectedLaneRowPosition?: number
  /**
   * Present only in edit mode. Absent, this is exactly the read list it has
   * always been — the same component, not a second one, which is the whole
   * point of #550.
   */
  editing?: Omit<
    DependencyEditing,
    'activeDependencyId' | 'onActivate'
  > | null
  className?: string
} & SelectHandlers

/**
 * Dependencies tab: grouped Follows (incoming `leads_to`) / Leads to
 * (outgoing `leads_to`) / Enables (`enables`, both directions). The
 * group headings are the stored kind values, minus the underscore — that is
 * the point of the rename: the product word and the column agree. Rows keep
 * the hover-preview and click-to-navigate behavior, with the direction
 * glyphs and indented detail lines from the previous dependency table.
 *
 * ONE LIST, IN BOTH MODES (#550). Edit mode does not append a second list of
 * the same edges below this one — it turns the rows this cell OWNS into the
 * fields for those rows, where they already sit, and hangs a pencil on the ones
 * it does not own. The headings, the grouping and the reading order are the
 * same in both modes, because they are the same list.
 *
 * WHAT #550 ASKED FOR AND DID NOT GET, so the next reader does not think it
 * was forgotten: READ mode is untouched. The why-line was to move into a
 * tooltip and the `linkName` badge was to stop rendering, and both are pinned
 * from outside this repository. `cellDependencyWhyLine.test.tsx` is enrolled
 * in the reconciled set as byte-identical to the template's copy, and it
 * asserts the reveal rule's exact class names and that a `linkName` renders —
 * so either change turns a shared test red, and the fix is not to unenrol it.
 * Both belong upstream in `agentic-service-blueprinting`, together with the
 * template's own copy of this component, and arrive here as a version bump.
 * Nothing below read mode depends on them: the edit half, the note field and
 * `update_cell_dependency` all landed.
 */
export function CellDependencySections({
  connections,
  otherTech,
  selectedLaneRowPosition = -1,
  editing = null,
  onCellSelect,
  onTechSelect,
  className,
}: CellDependencySectionsProps) {
  /*
    Which row is open for naming, and the draft row's own open/closed state.

    One at a time: "the row being edited" is a singular thing, and a name field
    under every owned row is eight fields for a column 426 of 434 rows leave
    empty. Set on focus or pointer-down within a row and cleared only when
    another row claims it — never on blur, because the select's list is a
    portal and losing focus to it would close the row that opened it.
  */
  const [activeDependencyId, setActiveDependencyId] = useState<string | null>(
    null,
  )
  const [adding, setAdding] = useState(false)
  const setOffBy = connections.incoming.filter(
    (connection) => connection.linkKind === 'leads_to',
  )
  const setsOff = connections.outgoing.filter(
    (connection) => connection.linkKind === 'leads_to',
  )

  const enablesById = new Map<
    string,
    { connection: BlueprintCellConnection; flow: RowFlow }
  >()
  for (const connection of connections.incoming) {
    if (connection.linkKind !== 'enables') continue
    if (!enablesById.has(connection.dependencyId)) {
      enablesById.set(connection.dependencyId, { connection, flow: 'in' })
    }
  }
  for (const connection of connections.outgoing) {
    if (connection.linkKind !== 'enables') continue
    const existing = enablesById.get(connection.dependencyId)
    if (existing) {
      existing.flow = 'both'
    } else {
      enablesById.set(connection.dependencyId, { connection, flow: 'out' })
    }
  }
  const enables = [...enablesById.values()]

  const linkedTechIds = new Set(
    [...connections.incoming, ...connections.outgoing].flatMap((connection) =>
      connection.techItems.map((item) => `${connection.cellId}:${item}`),
    ),
  )
  const remainingTech = otherTech.filter(
    (entry) => !linkedTechIds.has(entry.id),
  )

  const empty =
    setOffBy.length === 0 &&
    setsOff.length === 0 &&
    enables.length === 0 &&
    remainingTech.length === 0

  if (empty && !editing) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        No dependencies recorded for this cell.
      </p>
    )
  }

  const handlers = { onCellSelect, onTechSelect }
  const direction = (connection: BlueprintCellConnection, flow: RowFlow) =>
    resolveRowDirection(connection, flow, selectedLaneRowPosition)

  const rowEditing: DependencyEditing | null = editing
    ? { ...editing, activeDependencyId, onActivate: setActiveDependencyId }
    : null

  /** A row this cell is the source of, as the fields for that row. */
  const editableRow = (connection: BlueprintCellConnection) =>
    rowEditing ? (
      <DependencyEditRow
        key={`edit:${connection.dependencyId}`}
        dependencyId={connection.dependencyId}
        kind={connection.linkKind as DependencyKind}
        targetCellId={connection.cellId}
        note={connection.linkNote}
        editing={rowEditing}
      />
    ) : null

  /** A row the cell at the other end owns: flat text, and the way to go there. */
  const inboundPencil = (connection: BlueprintCellConnection) =>
    rowEditing ? (
      <InboundRowPencil
        ownerCellId={connection.cellId}
        ownerLabel={connectionRowLabel(connection)}
        onEditFromOwner={rowEditing.onEditFromOwner}
      />
    ) : undefined

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {empty && editing ? (
        <p className="text-xs text-muted-foreground">
          {DEPENDENCY_EDIT_TEXT.empty}
        </p>
      ) : null}
      {setOffBy.length > 0 ? (
        <DependencyGroup title={DEPENDENCY_DIRECTION_LABELS.incoming}>
          {setOffBy.map((connection) => (
            <DependencyRow
              key={`in:${connection.dependencyId}`}
              connection={connection}
              direction={direction(connection, 'in')}
              action={inboundPencil(connection)}
              {...handlers}
            />
          ))}
        </DependencyGroup>
      ) : null}
      {/*
        The outgoing group exists in edit mode even when it is empty, because
        it is where a new connection goes: one from this cell is always
        outgoing, so the draft row belongs at the bottom of this list and
        nowhere else.
      */}
      {setsOff.length > 0 || rowEditing ? (
        <DependencyGroup
          title={DEPENDENCY_DIRECTION_LABELS.outgoing}
          footer={
            rowEditing && !adding ? (
              <DependencyAddControl onOpen={() => setAdding(true)} />
            ) : null
          }
        >
          {setsOff.map(
            (connection) =>
              editableRow(connection) ?? (
                <DependencyRow
                  key={`out:${connection.dependencyId}`}
                  connection={connection}
                  direction={direction(connection, 'out')}
                  {...handlers}
                />
              ),
          )}
          {rowEditing && adding ? (
            <DependencyAddRow
              editing={rowEditing}
              onClose={() => setAdding(false)}
            />
          ) : null}
        </DependencyGroup>
      ) : null}
      {enables.length > 0 ? (
        <DependencyGroup title="Enables">
          {enables.map(({ connection, flow }) =>
            flow === 'in'
              ? (
                  <DependencyRow
                    key={`needs:${connection.dependencyId}`}
                    connection={connection}
                    direction={direction(connection, flow)}
                    action={inboundPencil(connection)}
                    {...handlers}
                  />
                )
              : editableRow(connection) ?? (
                  <DependencyRow
                    key={`needs:${connection.dependencyId}`}
                    connection={connection}
                    direction={direction(connection, flow)}
                    {...handlers}
                  />
                ),
          )}
        </DependencyGroup>
      ) : null}
      {remainingTech.length > 0 ? (
        <DependencyGroup title="Also on this step">
          <li className="px-2 py-1.5">
            <span className="flex flex-wrap gap-1">
              {remainingTech.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  onClick={() => onTechSelect(entry.cellId, entry.item)}
                >
                  <BlueprintTouchpointCell
                    item={entry.item}
                    compact
                    asSpan
                    inline
                    className="!w-fit max-w-full !px-2 !py-0.5 !text-3xs !font-normal leading-none text-foreground/75"
                  />
                </button>
              ))}
            </span>
          </li>
        </DependencyGroup>
      ) : null}
    </div>
  )
}
