/**
 * What decides how far the path outline sits from the label rail.
 *
 * The tempting answer is symmetry: a lane label has 14px between itself and
 * the rail's edge, so give the rail's edge 14px to the outline and the whole
 * column reads on one rhythm. That was tried on 2026-08-21 and reverted the
 * same hour, because it is measuring the wrong element.
 *
 * The binding constraint is the longest divider caption. "LINE OF INTERNAL
 * INTERACTION" measures ~221px at `text-2xs` with its tracking, while the
 * painted rail offers COMPARE_LABEL_WIDTH minus its 20px left inset — 188px.
 * The caption is `shrink-0`: it does not wrap and it does not truncate. It
 * overflows past the painted rail into the gutter, so on a divider row that
 * gutter is not empty at all, and squeezing it put the words 2px from the
 * board.
 *
 * So this file pins the clearance the CAPTION gets, not the symmetry a lane
 * label would like. Same number — one slot inset — applied to the element
 * that actually constrains the column.
 */
import { describe, expect, it } from 'vitest'
import { BLUEPRINT_SLOT_INSET } from '@/lib/canvasHeaderStyle'
import {
  COMPARE_LABEL_WIDTH,
  COMPARE_PATH_SECTION_H_INSET,
  COMPARE_RAIL_GUTTER,
} from '@/lib/sideBySideCompareLayout'
import { STEP_COLUMN_GAP } from '@/lib/blueprintLayout'

/** `px-3.5` -> 14. Tailwind's scale is 4px per unit. */
function insetPx(className: string): number {
  const match = /^px-(\d+(?:\.\d+)?)$/.exec(className)
  if (!match) throw new Error(`not a px-* class: ${className}`)
  return Number(match[1]) * 4
}

/**
 * MEASURED in the browser on 2026-08-21 at the shipped type, at zoom 1:
 *
 *   painted rail   452 -> 660   (208px, = COMPARE_LABEL_WIDTH)
 *   caption        453 -> 674   ("LINE OF INTERNAL INTERACTION", 221px)
 *
 * so the caption ends 14px past the rail's right edge.
 *
 * Taken as a measurement rather than reconstructed from `pl-5` and the rail
 * width — that reconstruction is off by 19px, because the divider row is
 * absolutely positioned against the grid row and its `left: 0` is not the
 * painted rail's left edge. Deriving this number instead of measuring it is
 * how the first version of this test "proved" a clearance the screen did not
 * have.
 *
 * jsdom cannot measure text, so if the divider type scale, its tracking, or
 * the caption vocabulary changes, re-measure. This number is the input to
 * every other number here.
 */
const LONGEST_CAPTION_PX = 221
const CAPTION_OVERFLOW_PAST_RAIL = 14

/** Where the outline lands, measured from the painted rail's right edge. */
const RAIL_EDGE_TO_OUTLINE =
  COMPARE_RAIL_GUTTER + (STEP_COLUMN_GAP - COMPARE_PATH_SECTION_H_INSET)

describe('the divider caption clears the board', () => {
  it('still overflows the painted rail, which is why the gutter exists', () => {
    // If this ever goes to zero the caption fits inside the rail, and the
    // gutter is free to shrink to whatever the lane rhythm wants.
    expect(CAPTION_OVERFLOW_PAST_RAIL).toBeGreaterThan(0)
  })

  it('leaves at least one slot inset between the words and the outline', () => {
    // At least, not exactly. The overflow constant is a text measurement and
    // carries a couple of pixels of slack; pinning equality would make this
    // test fail on a font-rendering difference rather than on a real
    // regression. Measured on screen at this gutter: 18px, against a 14px
    // floor. What matters is that it never approaches zero — at gutter 6 it
    // was 2px and the words read as touching the board.
    const clearance = RAIL_EDGE_TO_OUTLINE - CAPTION_OVERFLOW_PAST_RAIL
    expect(clearance).toBeGreaterThanOrEqual(insetPx(BLUEPRINT_SLOT_INSET))
  })

  it('names the width that would let the gutter shrink', () => {
    // The alternative lever, kept honest: widen the painted rail until the
    // longest caption fits inside it with its own inset, and the gutter stops
    // carrying this constraint. Costs that many pixels of horizontal room on
    // every board, which is why it is a decision rather than a tweak.
    const railWidthThatFitsCaption =
      COMPARE_LABEL_WIDTH +
      CAPTION_OVERFLOW_PAST_RAIL +
      insetPx(BLUEPRINT_SLOT_INSET)
    expect(railWidthThatFitsCaption).toBe(236)
    expect(COMPARE_LABEL_WIDTH).toBeLessThan(railWidthThatFitsCaption)
    // Sanity: the caption really is wider than the room the rail gives it.
    expect(LONGEST_CAPTION_PX).toBeGreaterThan(COMPARE_LABEL_WIDTH)
  })
})
