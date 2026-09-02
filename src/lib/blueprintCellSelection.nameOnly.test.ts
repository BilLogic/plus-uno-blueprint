import { describe, expect, it } from 'vitest'
import { getTouchpointEntries, getTouchpointNames } from '@/lib/blueprintCellSelection'
import { getMaxTouchpointCountInLane } from '@/lib/blueprintLayout'
import type { BlueprintData } from '@/types/blueprint'

/** #277 — a placement the registry lacks is drawn, dashed, and counted. */
describe('name-only placements on the board', () => {
  const cell = {
    content: 'Handshake',
    touchpoints: [
      { name: 'Handshake', touchpointId: 'tp-1' },
      { name: 'Handshake Employer Profile', touchpointId: null },
    ],
  }

  it('lists the name-only placement beside the linked one, flagged', () => {
    expect(getTouchpointEntries(cell)).toEqual([
      { name: 'Handshake', nameOnly: false },
      { name: 'Handshake Employer Profile', nameOnly: true },
    ])
    expect(getTouchpointNames(cell)).toEqual(['Handshake', 'Handshake Employer Profile'])
  })

  it('a cell with no placements is read from its text, nothing flagged', () => {
    expect(getTouchpointEntries({ content: 'Zoom, Slack' })).toEqual([
      { name: 'Zoom', nameOnly: false },
      { name: 'Slack', nameOnly: false },
    ])
  })

  it('sizes the lane by placements, so the dashed face is not clipped', () => {
    const data = {
      cells: [
        { id: 'c1', lane_id: 'lane', step_id: 's1', content: 'Handshake', touchpoints: cell.touchpoints },
        { id: 'c2', lane_id: 'lane', step_id: 's2', content: 'Zoom, Slack, Email' },
      ],
    } as unknown as BlueprintData
    // Step 2 has three names in its text and no placements; step 1 has one
    // name in its text and two placements. Before #277 step 1 counted one.
    expect(getMaxTouchpointCountInLane(data, 'lane')).toBe(3)
    const only = { cells: [data.cells[0]] } as unknown as BlueprintData
    expect(getMaxTouchpointCountInLane(only, 'lane')).toBe(2)
  })
})
