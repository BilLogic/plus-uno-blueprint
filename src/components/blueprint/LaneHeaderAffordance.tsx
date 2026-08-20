import { Info } from 'lucide-react'
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
 * with. The negative margin lets the ink block breathe into the rail's own
 * padding without moving the text a pixel.
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
  const { openEntity, selection } = useEntityDetail()
  const open = selection?.kind === 'lane' && selection.id === laneId

  return (
    <button
      type="button"
      data-blueprint-row-header=""
      data-lane-header-affordance=""
      aria-label={`View details: ${laneName}`}
      aria-pressed={open}
      onClick={(event) => {
        // The canvas pans on pointer-down anywhere it does not recognise;
        // opening a panel is neither a pan nor a selection.
        event.stopPropagation()
        openEntity({ kind: 'lane', id: laneId })
      }}
      className={cn(
        'group/lane-header -mx-2 -my-1 flex min-w-0 flex-1 items-start self-stretch text-left',
        CANVAS_HEADER_BOX,
        CANVAS_HEADER_STATE,
        className,
      )}
    >
      <span
        className={cn(
          'min-w-0 flex-1 whitespace-normal break-words',
          CANVAS_HEADER_TEXT,
        )}
        style={color ? { color } : undefined}
      >
        {laneName}
      </span>
      {/* Optically on the label's first line: the glyph's own box is taller
          than the cap height it has to sit beside. */}
      <Info
        className={cn(CANVAS_HEADER_HINT, 'mt-px', {
          'group-hover/lane-header:opacity-100': true,
          'group-focus-visible/lane-header:opacity-100': true,
          'group-aria-pressed/lane-header:opacity-100': true,
        })}
        aria-hidden
      />
    </button>
  )
}
