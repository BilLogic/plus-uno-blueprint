import { describe, expect, it } from 'vitest'
import type { BlueprintData } from '@/types/blueprint'
import {
  buildScenarioReaderModel,
  readerSideForLayer,
} from '@/lib/scenarioReader'

function fixture(): BlueprintData {
  return {
    path: {
      id: 'p1',
      name: 'Happy Path',
      description: null,
      note: null,
      path_type: 'happy',
    },
    layers: [
      { id: 'l-customer', name: 'Customer', role: 'customer_actions', row_position: 1 },
      { id: 'l-front', name: 'Tutor', role: 'frontstage_actions', row_position: 2 },
      { id: 'l-back', name: 'Ops', role: 'backstage_actions', row_position: 3 },
      { id: 'l-support', name: 'Systems', role: 'support_systems', row_position: 4 },
      { id: 'l-generic', name: 'Notes', role: null, row_position: 5 },
    ],
    steps: [
      // Deliberately out of order — the model must sort by column_position.
      { id: 's2', name: 'Kick-off', column_position: 2 },
      { id: 's1', name: 'Arrive', column_position: 1 },
      { id: 's3', name: 'Wrap', column_position: 3 },
    ],
    cells: [
      { id: 'c1', layer_id: 'l-customer', step_id: 's1', content: 'Walk in', picture: null, description: null, links: [] },
      { id: 'c2', layer_id: 'l-back', step_id: 's1', content: 'Verify ID', picture: null, description: null, links: [] },
      { id: 'c3', layer_id: 'l-front', step_id: 's2', content: 'Greet', picture: null, description: null, links: [] },
      { id: 'c4', layer_id: 'l-support', step_id: 's3', content: 'Log session', picture: null, description: null, links: [] },
      { id: 'c5', layer_id: 'l-generic', step_id: 's1', content: 'Note', picture: null, description: null, links: [] },
    ],
    triggers: [
      // Forward arrow s1 → s2: earns a connector on step 1.
      { id: 't1', source_cell_id: 'c1', target_cell_id: 'c3' },
      // Same-step edge: never a connector.
      { id: 't2', source_cell_id: 'c1', target_cell_id: 'c2' },
      // Backward edge s3 → s1: never a connector (the reader flows down).
      { id: 't3', source_cell_id: 'c4', target_cell_id: 'c1' },
      // `needs` is panel-only on the canvas; the reader mirrors that.
      { id: 't4', source_cell_id: 'c3', target_cell_id: 'c4', kind: 'needs' },
    ],
  }
}

describe('readerSideForLayer', () => {
  const side = (role: string | null, name = 'Lane') =>
    readerSideForLayer({ name, role })

  it('splits the lane vocabulary across the line of visibility', () => {
    expect(side('customer_actions')).toBe('frontstage')
    expect(side('frontstage_tech')).toBe('frontstage')
    expect(side('backstage_actions')).toBe('backstage')
    expect(side('backstage_tech')).toBe('backstage')
    expect(side('support_systems')).toBe('backstage')
    // A lane the model cannot classify must stay visible, above the line.
    expect(side(null)).toBe('frontstage')
    expect(readerSideForLayer({ name: 'Notes' })).toBe('frontstage')
  })

  it('resolves legacy rows through the same name fallback as the canvas', () => {
    // Rows predating the layer_role backfill carry their role only in their
    // name — the reader must land them on the same side desktop does.
    expect(side(null, 'Back Stage Actions')).toBe('backstage')
    expect(side(null, 'Back Stage Tech')).toBe('backstage')
    expect(side(null, 'Computer Systems')).toBe('backstage')
    expect(side(null, 'Front Stage Actions')).toBe('frontstage')
    expect(side(null, 'Regular Tutor')).toBe('frontstage')
  })
})

describe('buildScenarioReaderModel', () => {
  it('folds the grid into ordered steps with lane bands', () => {
    const model = buildScenarioReaderModel(fixture())
    expect(model.pathName).toBe('Happy Path')
    expect(model.steps.map((s) => s.name)).toEqual(['Arrive', 'Kick-off', 'Wrap'])
    expect(model.steps.map((s) => s.index)).toEqual([1, 2, 3])

    const arrive = model.steps[0]
    expect(arrive.frontstage.map((e) => e.layer.id)).toEqual([
      'l-customer',
      'l-generic',
    ])
    expect(arrive.backstage.map((e) => e.layer.id)).toEqual(['l-back'])
    expect(arrive.frontstage[0].cells.map((c) => c.id)).toEqual(['c1'])

    // Empty lanes vanish from a step instead of rendering hollow bands.
    const kickoff = model.steps[1]
    expect(kickoff.frontstage.map((e) => e.layer.id)).toEqual(['l-front'])
    expect(kickoff.backstage).toEqual([])
  })

  it('keeps only forward trigger arrows as step connectors', () => {
    const model = buildScenarioReaderModel(fixture())
    expect(model.steps[0].triggersTo).toEqual(['s2'])
    expect(model.steps[1].triggersTo).toEqual([])
    expect(model.steps[2].triggersTo).toEqual([])
  })
})
