/**
 * The rail crosses two gaps on its way to the board, and they must match.
 *
 *   label box │ 14px │ painted rail edge │ 14px │ path outline
 *
 * The left one is the label's own inset, shared with the cell slot so the rail
 * reads on the same rhythm as the grid. The right one is assembled from three
 * constants in two files, which is how it drifted to 32px against the left
 * one's 14 and made the rail look marooned.
 *
 * Pinned because the arithmetic is not local to any one of them: change
 * BLUEPRINT_SLOT_INSET and this test tells you COMPARE_RAIL_GUTTER has to
 * follow.
 */
import { describe, expect, it } from 'vitest'
import { BLUEPRINT_SLOT_INSET } from '@/lib/canvasHeaderStyle'
import {
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

describe('the rail sits in one rhythm', () => {
  it('reads the label inset off the class the rail actually uses', () => {
    expect(insetPx(BLUEPRINT_SLOT_INSET)).toBe(14)
  })

  it('gives the outline the same clearance the label has', () => {
    // What the outline's own placement adds, from ComparePathSectionFrame:
    //   left = labelTrack + STEP_COLUMN_GAP - COMPARE_PATH_SECTION_H_INSET
    // and labelTrack - paintedRail = COMPARE_RAIL_GUTTER.
    const railEdgeToOutline =
      COMPARE_RAIL_GUTTER + (STEP_COLUMN_GAP - COMPARE_PATH_SECTION_H_INSET)
    expect(railEdgeToOutline).toBe(insetPx(BLUEPRINT_SLOT_INSET))
  })

  it('keeps the gutter positive, so the outline is not the rail its own edge', () => {
    // At 0 the outline landed 16px from the rail and 5px from the first cell,
    // and read as an edge belonging to the rail rather than a frame around the
    // board. Whatever the rhythm, the two must not touch.
    expect(COMPARE_RAIL_GUTTER).toBeGreaterThan(0)
  })
})
