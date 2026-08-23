import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useBlueprintCellDetailOptional } from '@/contexts/BlueprintCellDetailContext'
import { useScenarioBoardInScope } from '@/contexts/scenarioBoardScopeContext'
import { useEntityDetail } from '@/contexts/EntityDetailContext'
import {
  CANVAS_HEADER_BOX,
  CANVAS_HEADER_HINT,
  CANVAS_HEADER_STATE,
  CANVAS_HEADER_TEXT,
} from '@/lib/canvasHeaderStyle'
import { cn } from '@/lib/utils'

/**
 * The lane's name, and the way into its properties — one control filling the
 * label block rather than a 24px icon beside an inert word.
 *
 * The label block is dead space otherwise: it holds one word and the rest of
 * its height is padding. Giving the whole block the hover, the focus ring and
 * the click makes the affordance findable at the size it actually is, and the
 * ⓘ stops being the target and becomes the hint that there is one.
 *
 * Top-left aligned, because a lane label reads down a tall row — the only
 * thing it does differently from the column header it shares a treatment
 * with.
 *
 * The box IS the block the grid gives the lane — full width of the rail's
 * content column, full height of the row. A label sitting in a 192px row with
 * a target the height of one line of text is a target nobody finds, and the
 * selected state has to mark the row, not a chip inside it.
 *
 * What was actually wrong was never the size: it was that the ring drew
 * OUTSIDE the box, inside a rail that clips, so the wash and the ring came
 * back sheared along the edge they met. `ring-inset` in CANVAS_HEADER_STATE
 * fixes that at the source, for this header and the column header both.
 *
 * NOT used where the label already means something else. In the compare
 * rail's Design mode the label is a *selection* handle — clicking takes every
 * cell in the lane — and a second meaning on the same word would make both
 * ambiguous. There the ⓘ stays a button of its own, beside it.
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

  const label = (
    <span
      className={cn(
        'min-w-0 flex-1 whitespace-normal break-words',
        CANVAS_HEADER_TEXT,
      )}
      style={color ? { color } : undefined}
    >
      {laneName}
    </span>
  )

  // Inert prose, not a disabled button: there is nothing to enable here, so a
  // control that announces itself and refuses is worse than no control.
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
        {label}
      </div>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-blueprint-row-header=""
            data-lane-header-affordance=""
            aria-label={`View details: ${laneName}`}
            aria-pressed={open}
            onClick={(event) => {
              // The canvas pans on pointer-down anywhere it does not
              // recognise; opening a panel is neither a pan nor a selection.
              event.stopPropagation()
              toggleEntity({ kind: 'lane', id: laneId })
            }}
            className={cn(
              // No negative margins. They pulled the ink block outside the
              // rail, which clips (`overflow-hidden`) — so the hover surface
              // came back cut off on one edge and left a hairline artefact
              // where it met the clip. The rail's own padding gives the room.
              'group/lane-header flex min-w-0 flex-1 items-start self-stretch text-left',
              CANVAS_HEADER_BOX,
              CANVAS_HEADER_STATE,
              className,
            )}
          />
        }
      >
        {label}
        {/* Optically on the label's first line: the glyph's own box is taller
            than the cap height it has to sit beside. */}
        <Info
          className={cn(
            CANVAS_HEADER_HINT,
            'mt-px',
            'group-hover/lane-header:opacity-100',
            'group-focus-visible/lane-header:opacity-100',
            'group-aria-pressed/lane-header:opacity-100',
          )}
          aria-hidden
        />
      </TooltipTrigger>
      {/* Same words as the column header's: one affordance, one sentence. */}
      <TooltipContent side="right">View details</TooltipContent>
    </Tooltip>
  )
}
