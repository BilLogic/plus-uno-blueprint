import { describe, expect, it } from 'vitest'

import {
  countsSentence,
  dimensions,
  idsIn,
  moduleToWrite,
  preferredPathIndex,
  toBlueprintData,
  toSampleBlueprintRegistry,
} from '../export-sample-board.mjs'

/**
 * THE EXPORTER'S SHAPING, HELD TO A FIXTURE RATHER THAN TO A DATABASE.
 *
 * `scripts/export-sample-board.mjs` is two things wearing one name: a read
 * against a live PostgREST surface, and a projection from the rows it gets to
 * the registry `sample.blueprints` takes. Only the first needs credentials, and
 * only the second has decisions in it — ordering, which path a scenario opens
 * on, which embedded row is dropped and why. So the projection is pure and
 * every case below is a row shape the live surface really returns.
 *
 * `deployment/data/sampleBlueprints.test.ts` is the other half: it holds the
 * COMMITTED export to the nav. This holds the function that writes it.
 */

/** One scenario, two paths, one lane, two steps, two cells and an edge. */
const SCENARIO = '11111111-1111-4111-8111-111111111111'

const cell = (id, overrides = {}) => ({
  id,
  cell_key: `svc/phase/scen/path/lane/${id}`,
  lane_id: 'lane-1',
  step_id: 'step-1',
  position: 0,
  content: `cell ${id}`,
  frame: null,
  summary: null,
  status: 'live',
  function: null,
  form: null,
  value_props: null,
  owner: null,
  perceived_owner: null,
  resources: [],
  cell_touchpoints: [],
  outgoing: [],
  ...overrides,
})

const path = (id, name, kind, overrides = {}) => ({
  id,
  name,
  summary: null,
  note: null,
  kind,
  status: 'live',
  scenario_id: SCENARIO,
  lanes: [{ id: 'lane-1', name: 'Tutor', lane_role: 'frontstage', position: 0, kpis: [], tools: [] }],
  path_steps: [
    { position: 1, steps: { id: 'step-2', name: 'Second', summary: null } },
    { position: 0, steps: { id: 'step-1', name: 'First', summary: 'the first moment' } },
  ],
  cells: [cell('cell-b'), cell('cell-a')],
  ...overrides,
})

describe('the ids the nav spells', () => {
  it('reads them in order, without repeats', () => {
    const text = `const A = '${SCENARIO}'\nconst B = '${SCENARIO}'\nconst C = '22222222-2222-4222-8222-222222222222'`
    expect(idsIn(text)).toEqual([SCENARIO, '22222222-2222-4222-8222-222222222222'])
  })

  it('finds none in a file that spells none', () => {
    expect(idsIn('export const SAMPLE_NAV = []')).toEqual([])
  })
})

describe('the path a scenario opens on', () => {
  // The registry's reader takes `blueprints[0]`; the live board takes
  // `pickPreferredPath`. The two disagreeing means the same scenario opens on a
  // different route offline than it does with a database.
  it('is the canonical Happy Path by name, before any other happy path', () => {
    const paths = [
      { name: 'Alternate', kind: 'happy' },
      { name: 'Happy Path', kind: 'happy' },
      { name: 'Sad', kind: 'sad' },
    ]
    expect(preferredPathIndex(paths)).toBe(1)
  })

  it('is any happy path when none carries the name', () => {
    expect(preferredPathIndex([{ name: 'Sad', kind: 'sad' }, { name: 'A', kind: 'happy' }])).toBe(1)
  })

  it('is the first path when none is happy', () => {
    expect(preferredPathIndex([{ name: 'Sad', kind: 'sad' }, { name: 'Edge', kind: 'edge' }])).toBe(0)
  })
})

describe('one path, as the board reads it', () => {
  const blueprint = toBlueprintData(
    path('path-1', 'Happy Path', 'happy', {
      cells: [
        cell('cell-b', { step_id: 'step-2' }),
        cell('cell-a', {
          resources: [
            { id: 'r-2', position: 1, kind: 'attachment', name: ' Spec ', url: ' https://x/y ', cell_touchpoint_id: 'tp-1', featured: false },
            { id: 'r-1', position: 0, kind: 'link', name: 'Doc', url: 'https://x/z', cell_touchpoint_id: null, featured: true },
            { id: 'r-0', position: 2, kind: 'link', name: '   ', url: 'https://x/nameless', cell_touchpoint_id: null, featured: false },
          ],
          cell_touchpoints: [
            { id: 'tp-1', touchpoint_id: 't-1', name: 'placement spelling', position: 0, summary: ' here ', role: 'core', touchpoints: { name: 'Zoom', kind: 'tool', icon_url: 'https://x/icon.svg' } },
            { id: 'tp-2', touchpoint_id: null, name: 'Notion', position: 1, summary: null, role: 'nonsense', touchpoints: null },
          ],
          outgoing: [{ id: 'e-1', target_cell_id: 'cell-b', kind: 'enables', name: 'Email', note: 'why' }],
        }),
      ],
    }),
  )

  it('orders steps by their position in this path, not by arrival', () => {
    expect(blueprint.steps.map((step) => step.id)).toEqual(['step-1', 'step-2'])
    expect(blueprint.steps[0].summary).toBe('the first moment')
  })

  it('reads the lane role out of the column the app names differently', () => {
    expect(blueprint.lanes[0].role).toBe('frontstage')
  })

  it('omits a lane spec nobody set rather than carrying an empty one', () => {
    expect('kpis' in blueprint.lanes[0]).toBe(false)
    expect('tools' in blueprint.lanes[0]).toBe(false)
  })

  it('orders cells down the lanes and across the steps', () => {
    expect(blueprint.cells.map((c) => c.id)).toEqual(['cell-a', 'cell-b'])
  })

  it('takes the registry spelling of a placement over the placement’s own', () => {
    const [placement] = blueprint.cells[0].touchpoints
    expect(placement.name).toBe('Zoom')
    expect(placement.touchpointId).toBe('t-1')
    expect(placement.kind).toBe('tool')
    expect(placement.iconUrl).toBe('https://x/icon.svg')
    expect(placement.summary).toBe('here')
    expect(placement.role).toBe('core')
  })

  it('keeps a name-only placement, and reads an unknown role as unsaid', () => {
    const [, placement] = blueprint.cells[0].touchpoints
    expect(placement.name).toBe('Notion')
    expect(placement.touchpointId).toBeNull()
    expect(placement.role).toBeNull()
  })

  it('orders resources by position, drops the unnamed one, and keeps the placement it hangs off', () => {
    const resources = blueprint.cells[0].resources
    expect(resources.map((r) => r.id)).toEqual(['r-1', 'r-2'])
    expect(resources[1].name).toBe('Spec')
    expect(resources[1].kind).toBe('attachment')
    expect(resources[1].url).toBe('https://x/y')
    expect(resources[1].placementId).toBe('tp-1')
    expect(resources[0].featured).toBe(true)
  })

  it('names the source of an edge the row itself does not carry', () => {
    expect(blueprint.dependencies).toEqual([
      {
        id: 'e-1',
        source_cell_id: 'cell-a',
        target_cell_id: 'cell-b',
        kind: 'enables',
        name: 'Email',
        note: 'why',
      },
    ])
  })

  it('gives a path with no status said the status a row gets by default', () => {
    expect(toBlueprintData(path('p', 'X', 'happy', { status: null })).path.status).toBe('live')
  })
})

describe('the registry', () => {
  const registry = toSampleBlueprintRegistry(
    [SCENARIO, '33333333-3333-4333-8333-333333333333'],
    [path('path-sad', 'Sad', 'sad'), path('path-happy', 'Happy Path', 'happy')],
  )

  it('puts the preferred path first, whatever order the rows arrived in', () => {
    expect(registry.blueprintsByScenario[SCENARIO].map((b) => b.path.id)).toEqual([
      'path-happy',
      'path-sad',
    ])
  })

  it('leaves out a scenario the read surface returned no path for', () => {
    expect('33333333-3333-4333-8333-333333333333' in registry.blueprintsByScenario).toBe(false)
  })

  it('hides no path, because no column says any is hidden', () => {
    expect(registry.uiHiddenPathIdsByScenario).toEqual({})
  })

  it('counts what it carries', () => {
    expect(dimensions(registry)).toMatchObject({ scenarios: 1, paths: 2, lanes: 2, steps: 4, cells: 4 })
    expect(countsSentence(dimensions(registry))).toContain('1 scenarios, 2 paths')
  })
})

describe('the module it writes', () => {
  const registry = toSampleBlueprintRegistry([SCENARIO], [path('path-1', 'Happy Path', 'happy')])

  it('says it is generated, names the command, and refuses hand edits', () => {
    const text = moduleToWrite(null, registry, '2026-01-01')
    expect(text).toContain('GENERATED by `npm run export:sample-board`')
    expect(text).toContain('DO NOT EDIT BY HAND')
    expect(text).toContain('// Generated on: 2026-01-01')
  })

  it('carries the old date forward when nothing but the date would change', () => {
    const first = moduleToWrite(null, registry, '2026-01-01')
    expect(moduleToWrite(first, registry, '2026-06-30')).toBe(first)
  })

  it('takes the new date the moment the board changes', () => {
    const first = moduleToWrite(null, registry, '2026-01-01')
    const moved = toSampleBlueprintRegistry([SCENARIO], [path('path-1', 'Renamed', 'happy')])
    expect(moduleToWrite(first, moved, '2026-06-30')).toContain('// Generated on: 2026-06-30')
  })
})
