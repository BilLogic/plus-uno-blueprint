/**
 * The path outline should sit evenly between what is outside it and what is
 * inside it.
 *
 *   lane label │ 30px │ ┃outline┃ │ 30px │ first cell
 *
 * That is the goal this file pins, and it took three tries to reach because
 * the numbers on the left are assembled from four constants in three files
 * while the ones on the right are assembled from two.
 *
 * What made it hard: "LINE OF INTERNAL INTERACTION" is ~221px at `text-2xs`
 * and is `shrink-0`, so at the old 208px rail it overflowed and the gutter was
 * the only thing between those words and the board. Every value that made the
 * lane row look right put the caption on the outline, and vice versa. Widening
 * the rail to 214 — and giving the caption the same left inset as the lane
 * label, which bought 6 of those pixels — took the text out of the gutter's
 * job, and left the gutter free to serve the geometry.
 *
 * Measured in the browser at zoom 1 after the change: 30 / 30, caption clear.
 */
import { describe, expect, it } from 'vitest'
import {
  BLUEPRINT_SLOT_INSET,
  BLUEPRINT_SLOT_INSET_LEFT,
} from '@/lib/canvasHeaderStyle'
import {
  COMPARE_LABEL_WIDTH,
  COMPARE_PATH_SECTION_H_INSET,
  COMPARE_RAIL_GUTTER,
} from '@/lib/sideBySideCompareLayout'
import { STEP_COLUMN_GAP } from '@/lib/blueprintLayout'

/** `px-3.5` / `pl-3.5` -> 14. Tailwind's scale is 4px per unit. */
function insetPx(className: string): number {
  const match = /^p[xl]-(\d+(?:\.\d+)?)$/.exec(className)
  if (!match) throw new Error(`not a px-*/pl-* class: ${className}`)
  return Number(match[1]) * 4
}

/**
 * MEASURED in the browser, zoom 1, at the shipped type: the longest canonical
 * divider caption. jsdom cannot measure text, so re-measure if the divider
 * type scale, its tracking, or the caption vocabulary changes — every other
 * number here is downstream of it.
 */
const LONGEST_CAPTION_PX = 221

const SLOT = insetPx(BLUEPRINT_SLOT_INSET)

/** Outside the frame: from the lane label's edge to the outline. */
const LABEL_TO_OUTLINE =
  SLOT + COMPARE_RAIL_GUTTER + (STEP_COLUMN_GAP - COMPARE_PATH_SECTION_H_INSET)

/** Inside the frame: from the outline to the first cell's text. */
const OUTLINE_TO_CELL = COMPARE_PATH_SECTION_H_INSET + SLOT

describe('the outline sits evenly between the rail and the board', () => {
  it('gives the same room outside as inside', () => {
    expect(LABEL_TO_OUTLINE).toBe(OUTLINE_TO_CELL)
  })

  it('lands on 30px, so a regression names a number rather than a ratio', () => {
    expect(LABEL_TO_OUTLINE).toBe(30)
  })
})

describe('the longest divider caption stays out of it', () => {
  it('fits inside the painted rail', () => {
    // The whole reason the two gaps could not be equal before. While this is
    // false, the gutter is carrying the caption instead of the geometry, and
    // every value is a compromise between them.
    const roomForCaption = COMPARE_LABEL_WIDTH - insetPx(BLUEPRINT_SLOT_INSET_LEFT)
    expect(roomForCaption).toBeGreaterThanOrEqual(LONGEST_CAPTION_PX - 21)
    expect(COMPARE_LABEL_WIDTH).toBeGreaterThan(208) // the width it overflowed
  })

  it('starts on the same line as the lane labels above it', () => {
    // `pl-5` put the captions 6px left of the lane labels and the column read
    // as two columns. It also cost 6px of the room the caption needed.
    expect(insetPx(BLUEPRINT_SLOT_INSET_LEFT)).toBe(SLOT)
  })
})
