import { EntityDefinitionPopover } from '@/components/blueprint/EntityDefinitionPopover'
import { useBlueprintCellDetailOptional } from '@/contexts/BlueprintCellDetailContext'
import { useScenarioBoardInScope } from '@/contexts/scenarioBoardScopeContext'
import { useEntityDetail } from '@/contexts/EntityDetailContext'
import {
  CANVAS_HEADER_BOX,
  CANVAS_HEADER_NAME,
  CANVAS_HEADER_OPENER,
  CANVAS_HEADER_STATE,
  CANVAS_HEADER_TEXT,
} from '@/lib/canvasHeaderStyle'
import { cn } from '@/lib/utils'

/**
 * The lane's name, what a lane IS, and the way into this one's properties.
 *
 * TWO facts and therefore two targets, which is what #140 changed. The name
 * carries the definition — hovering, focusing or tapping the word you do not
 * recognise is where anyone looks first, and it is where `PanelTermLabel`
 * already puts the definition of every word inside a panel. Everything else in
 * the block opens the panel: the opener is an invisible button filling the
 * box, so the target is still the whole label block rather than a 24px icon,
 * and the ⓘ marks it.
 *
 * The block was one control until #140, with "View details" in its hover slot.
 * That slot was the only place a definition could live and it was spending it
 * on a sentence the ⓘ already said.
 *
 * Top-left aligned, because a lane label reads down a tall row — the only
 * thing it does differently from the column header it shares a treatment
 * with.
 *
 * The box IS the block the grid gives the lane — full width of the rail's
 * content column, full height of the row. A label sitting in a 192px row with
 * a target the height of one line of text is a target nobody finds, and the
 * selected state has to mark the row, not a badge inside it.
 *
 * What was actually wrong was never the size: it was that the ring drew
 * OUTSIDE the box, inside a rail that clips, so the wash and the ring came
 * back sheared along the edge they met. `ring-inset` in CANVAS_HEADER_STATE
 * fixes that at the source, for this header and the column header both.
 *
 * NOT used where the label already means something else. In the compare
 * rail's Design mode the label is a *selection* handle — clicking takes every
 * cell in the lane — and a second meaning on the same word would make both
 * ambiguous. There the ⓘ stays a button of its own, beside it
 * (`EntityPropertiesButton`).
 */
export function LaneHeaderAffordance({
  laneId,
  laneName,
  color,
  className,
}: {
  laneId: string
  laneName: string
  /** The lane's own label ink — role-derived, passed by the caller. */
  color?: string
  className?: string
}) {
  const { toggleEntity, selection } = useEntityDetail()
  const detail = useBlueprintCellDetailOptional()
  const boardInScope = useScenarioBoardInScope()
  /*
    TWO facts, and the bug was shipping with only the first.

    `detail.enabled` is the feature flag and the detail view — but it is ONE
    boolean on a provider mounted above the entire canvas, and every scenario
    board stays mounted behind the focused one. So focusing any single
    scenario turned this header live on all of them: 176 lane headers wearing
    hover, a focus ring and a pointer, and a click on a band the reader had
    never chosen opening a panel reading "Nothing recorded for this lane
    yet." — an affordance offering emptiness on somebody else's board.

    `boardInScope` is the missing half: this board is the focused/solo
    scenario, not merely a mounted one. One board's worth of detail is not
    addressable from a view that shows many, so everywhere else the label goes
    back to being what it looks like from there: a word naming a row.
  */
  const isInteractive = Boolean(detail?.enabled) && boardInScope
  const open = selection?.kind === 'lane' && selection.id === laneId

  /*
    The definition is on the word whether the panel is reachable or not.

    Two different questions were being answered by one flag. "Can this board's
    lane be opened?" depends on which scenario the reader is looking at; "what
    is a lane?" does not, and a reader on the overview is if anything the one
    more likely to be asking it.
  */
  const name = (
    <EntityDefinitionPopover kind="lane" side="right">
      <span
        className={cn(
          'min-w-0 flex-1 whitespace-normal break-words',
          CANVAS_HEADER_TEXT,
          CANVAS_HEADER_NAME,
        )}
        style={color ? { color } : undefined}
      >
        {laneName}
      </span>
    </EntityDefinitionPopover>
  )

  // Inert prose, not a disabled button: there is nothing to enable here, so a
  // control that announces itself and refuses is worse than no control. The
  // name still explains itself — that is not a control, it is the word.
  if (!isInteractive) {
    return (
      <div
        data-blueprint-row-header=""
        className={cn(
          'group/lane-header flex min-w-0 flex-1 items-start self-stretch text-left',
          CANVAS_HEADER_BOX,
          className,
        )}
      >
        {name}
      </div>
    )
  }

  return (
    <div
      data-blueprint-row-header=""
      data-open={open ? '' : undefined}
      className={cn(
        // No negative margins. They pulled the ink block outside the rail,
        // which clips (`overflow-hidden`) — so the hover surface came back
        // cut off on one edge and left a hairline artefact where it met the
        // clip. The rail's own padding gives the room.
        'group/lane-header flex min-w-0 flex-1 items-start self-stretch text-left',
        CANVAS_HEADER_BOX,
        CANVAS_HEADER_STATE,
        className,
      )}
    >
      {/* Under the name and the ⓘ, over everything else: the block is the
          target, and the one word inside it that explains itself is not. */}
      <button
        type="button"
        data-lane-header-affordance=""
        aria-label={`View details: ${laneName}`}
        aria-pressed={open}
        onClick={(event) => {
          // The canvas pans on pointer-down anywhere it does not recognise;
          // opening a panel is neither a pan nor a selection.
          event.stopPropagation()
          toggleEntity({ kind: 'lane', id: laneId })
        }}
        className={CANVAS_HEADER_OPENER}
      />
      {name}
    </div>
  )
}
