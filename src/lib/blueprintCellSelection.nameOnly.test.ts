/**
 * #277 — a placement the registry lacks is drawn, dashed, and counted.
 *
 * Two readers share the work and neither may do the other's. `getTouchpointNames`
 * decides WHICH names a cell shows, preferring placements over the cell's text
 * because a name-only placement's name is in no text and splitting the string
 * would drop it silently. `isNameOnlyPlacement` decides which of those names the
 * registry lacks, and it is the only place that decides it.
 *
 * That predicate reads the placement's row id as well as its registry link, and
 * the last test here is why: a fallback board's placements are minted with both
 * halves null, so a predicate that asked about the registry link alone would
 * call every touchpoint on a hand-written board name-only and draw a whole lane
 * dashed.
 */
import { describe, expect, it } from 'vitest'
import { getTouchpointNames } from '@/lib/blueprintCellSelection'
import { getMaxTouchpointCountInLane } from '@/lib/blueprintLayout'
import { cellTouchpointsFromLinks, isNameOnlyPlacement } from '@/lib/cellTouchpoints'
import { TECH_DESCRIPTION_LINK_TYPE } from '@/lib/blueprintTechDescriptions'
import type { BlueprintData, CellTouchpoint } from '@/types/blueprint'

const placement = (
  over: Pick<CellTouchpoint, 'id' | 'touchpointId' | 'name'>,
): CellTouchpoint => ({
  kind: null,
  summary: null,
  role: null,
  ...over,
})

describe('name-only placements on the board', () => {
  // The cell's text names the registered touchpoint and nothing else, which is
  // the ordinary case: an author placed the second one by name from the panel
  // and never went back to retype the grid.
  const touchpoints = [
    placement({ id: 'ct-1', touchpointId: 'tp-1', name: 'Handshake' }),
    placement({ id: 'ct-2', touchpointId: null, name: 'Handshake Employer Profile' }),
  ]
  const cell = { content: 'Handshake', touchpoints }

  it('lists the name-only placement beside the registered one', () => {
    expect(getTouchpointNames(cell)).toEqual(['Handshake', 'Handshake Employer Profile'])
  })

  it('leaves which of them the registry lacks to the one predicate', () => {
    expect(touchpoints.map(isNameOnlyPlacement)).toEqual([false, true])
  })

  it('reads a cell that has no placements from its text, in order', () => {
    expect(getTouchpointNames({ content: 'Zoom, Slack' })).toEqual(['Zoom', 'Slack'])
    expect(getTouchpointNames({})).toEqual([])
  })

  it('sizes the lane by placements, so the dashed face is not clipped', () => {
    const data = {
      cells: [
        { id: 'c1', lane_id: 'lane', step_id: 's1', content: 'Handshake', touchpoints },
        { id: 'c2', lane_id: 'lane', step_id: 's2', content: 'Zoom, Slack, Email' },
      ],
    } as unknown as BlueprintData
    // Step 2 has three names in its text and no placements; step 1 has one
    // name in its text and two placements. Before #277 step 1 counted one.
    expect(getMaxTouchpointCountInLane(data, 'lane')).toBe(3)
    const only = { cells: [data.cells[0]] } as unknown as BlueprintData
    expect(getMaxTouchpointCountInLane(only, 'lane')).toBe(2)
  })

  it('calls nothing on a fallback board name-only, detail or no detail', () => {
    // A hand-written fixture board, resolved the way the normalizer resolves
    // one: the delimited content string decides what exists, and a
    // `tech_description` link contributes prose to the item its label names.
    // Neither half of that mints a row or a registry link, so every placement
    // here has `id: null` and `touchpointId: null` — and none of them is a
    // name-only placement, because a name-only placement IS a row.
    const fallback = cellTouchpointsFromLinks('Handshake, Zoom, Email', [
      {
        type: TECH_DESCRIPTION_LINK_TYPE,
        label: 'Zoom',
        description: 'The advisor opens the scheduled call.',
      },
    ])

    expect(fallback.map((entry) => entry.name)).toEqual(['Handshake', 'Zoom', 'Email'])
    expect(fallback.every((entry) => entry.touchpointId === null)).toBe(true)
    expect(fallback.map(isNameOnlyPlacement)).toEqual([false, false, false])
  })
})
