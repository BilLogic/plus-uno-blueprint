import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'

import { BLUEPRINTS, idsIn } from '../render-walk.mjs'
import {
  countsSentence,
  dimensions,
  driftReport,
  firstDrift,
  moduleToWrite,
  preferredPathIndex,
  registryIn,
  renderModule,
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

// `idsIn` lives with the render walk's gate, which asks the same question of
// the same file; it is exercised here because the exporter's subject is what it
// returns.
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
    // Singular where there is one of a thing: a generated header that reads
            // "1 scenarios" is a generated header nobody trusts the rest of.
    expect(countsSentence(dimensions(registry))).toContain('1 scenario, 2 paths')
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

/**
 * WHAT A RED `--check` SAYS, which is the whole value of running it nightly.
 *
 * A run that says only "the file is not what the database says" sends a reader
 * to a 1.4 MB generated diff with nothing to look for. These hold the sentence
 * it says instead: both boards' counts, and the first scenario in nav order
 * that moved, with what moved about it. Pure, so they read the report rather
 * than a runner's scrollback.
 */
const SECOND = '22222222-2222-4222-8222-222222222222'

const registryOf = (...paths) => toSampleBlueprintRegistry([SCENARIO], paths)

describe('the drift a red check reports', () => {
  const live = registryOf(path('path-1', 'Happy Path', 'happy'))

  it('reads a written module back out of its own literal', () => {
    const text = moduleToWrite(null, live, '2026-01-01')
    expect(registryIn(text)).toEqual(live)
  })

  it('calls a module with no literal in it unreadable rather than drifted', () => {
    expect(registryIn('// somebody hand-edited this away\n')).toBe(null)
    expect(registryIn(null)).toBe(null)
    const lines = driftReport({ previous: '// nothing here', live, scenarioIds: [SCENARIO] })
    expect(lines.join('\n')).toContain('unreadable')
    expect(lines.join('\n')).toContain('hand edit')
  })

  it('calls a tree with no committed board nothing, rather than a hand edit', () => {
    const lines = driftReport({ previous: null, live, scenarioIds: [SCENARIO] })
    expect(lines[2]).toContain('nothing')
    expect(lines.join('\n')).not.toContain('hand edit')
  })

  it('says nothing differs when the two boards agree', () => {
    expect(firstDrift([SCENARIO], live, live)).toBe(null)
  })

  it('names the scenario the committed board lacks', () => {
    const committed = toSampleBlueprintRegistry([], [])
    const drift = firstDrift([SCENARIO], committed, live)
    expect(drift.scenarioId).toBe(SCENARIO)
    expect(drift.said).toContain('carries no entry for it')
    expect(drift.said).toContain('1 path')
  })

  it('names the scenario the database no longer answers for', () => {
    const drift = firstDrift([SCENARIO], live, toSampleBlueprintRegistry([], []))
    expect(drift.said).toContain('returned no path for it')
  })

  it('gives both counts when a row was added or lost', () => {
    const wider = registryOf(path('path-1', 'Happy Path', 'happy'), path('path-2', 'Sad', 'sad'))
    // Spelled out rather than rendered with the function under test, which
    // would pass for any wording however wrong.
    expect(firstDrift([SCENARIO], live, wider).said).toBe(
      'committed 1 path, 1 lane, 2 steps, 2 cells, 0 dependencies, ' +
        '0 touchpoint placements, 0 resources; ' +
        'live 2 paths, 2 lanes, 4 steps, 4 cells, 0 dependencies, ' +
        '0 touchpoint placements, 0 resources',
    )
  })

  it('says the move is inside a row when the counts agree and the content does not', () => {
    const renamed = registryOf(path('path-1', 'Happy Path', 'happy', { summary: 'moved' }))
    const drift = firstDrift([SCENARIO], live, renamed)
    expect(drift.said).toContain('INSIDE a row')
  })

  it('takes the scenarios in NAV order, not the registry\'s', () => {
    // Both scenarios differ; the nav names the second one first, so that is
    // the one a reader is sent to.
    const committed = toSampleBlueprintRegistry(
      [SCENARIO, SECOND],
      [path('path-1', 'Happy Path', 'happy'), path('path-2', 'Other', 'happy', { scenario_id: SECOND })],
    )
    const moved = toSampleBlueprintRegistry([SCENARIO, SECOND], [])
    expect(firstDrift([SECOND, SCENARIO], committed, moved).scenarioId).toBe(SECOND)
  })

  it('still names a scenario the nav has stopped listing', () => {
    const committed = toSampleBlueprintRegistry([SCENARIO], [path('path-1', 'Happy Path', 'happy')])
    expect(firstDrift([], committed, toSampleBlueprintRegistry([], [])).scenarioId).toBe(SCENARIO)
  })

  it('opens on one annotation and puts the rest in the log under it', () => {
    const previous = moduleToWrite(null, registryOf(path('path-1', 'Happy Path', 'happy'), path('p2', 'Sad', 'sad')), '2026-01-01')
    const lines = driftReport({ previous, live, scenarioIds: [SCENARIO] })
    expect(lines.filter((line) => line.startsWith('::error::'))).toHaveLength(1)
    expect(lines[1]).toContain('live:')
    expect(lines[2]).toContain('committed:')
    expect(lines[3]).toContain(`first differing scenario: ${SCENARIO}`)
  })

  it('says so when the module moved and no scenario did', () => {
    const previous = moduleToWrite(null, live, '2026-01-01').replace('// Board:', '// Boards:')
    const lines = driftReport({ previous, live, scenarioIds: [SCENARIO] })
    expect(lines[3]).toContain('OUTSIDE `blueprintsByScenario`')
  })
})

/**
 * THE COMMITTED FILE AGAINST THE FUNCTION THAT WRITES IT, WITH NO DATABASE.
 *
 * `renderModule` holds the module's header and its type import, and the file
 * it writes is committed — two copies of the same text, in two files, edited by
 * hand whenever the package changes what a deployment should import. The only
 * guard on that pair was `npm run check:sample-board`, which needs
 * `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` and is deliberately not a gate
 * (the board moves whenever somebody authors a cell). So a hand edit to one
 * copy and not the other was a silent defect until the next credentialled run.
 *
 * This asks the cheap half of that question and needs nothing: the registry is
 * read back OUT of the committed file — its literal is plain JSON — and
 * re-rendered with the file's own carried date. A disagreement is an exporter
 * whose next run would rewrite a file nobody meant to change.
 */
describe('the committed export and the function that writes it', () => {
  const committed = readFileSync(BLUEPRINTS, 'utf8')
  // The read-back is the exporter's own, not a second spelling of its marker
  // kept here — a copy of that line is a copy to forget when the module header
  // moves, and `--check` reads it back the same way to name a drifted scenario.
  const registry = registryIn(committed)
  const generatedOn = /^\/\/ Generated on: (.+)$/m.exec(committed)[1]

  it('agree byte for byte', () => {
    expect(renderModule({ registry, generatedOn })).toBe(committed)
  })

  it('so a re-export of the same board would write nothing', () => {
    expect(moduleToWrite(committed, registry, '2099-12-31')).toBe(committed)
  })
})
