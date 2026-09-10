/**
 * A dependency arrives through one of two doors, and both hand back the same
 * edge.
 *
 * `normalizeBlueprint` reads the board's arrows from a top-level
 * `cell_dependencies` array when the path row carries one, and otherwise
 * flattens them out of each cell's `outgoing` embed. The board query uses the
 * second door; anything that hands the normalizer a path row with its edges
 * already gathered uses the first.
 *
 * The two mappings were written separately and drifted. #177 deleted the
 * `note` line from the top-level branch when the column went away; #220
 * brought the column back through the cells branch alone. What was left in
 * the top-level branch carried `note` only incidentally — an object spread
 * kept it, and kept every other column of the row alongside it, while an edge
 * with no stated reason came back with `note` MISSING rather than null. Two
 * doors, two shapes.
 *
 * These tests state the rule the doors now share: however an edge arrives, it
 * arrives as the same six fields.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import type { BlueprintCellDependency } from '@/types/blueprint'
import {
  normalizeBlueprint,
  type RawCell,
  type RawPath,
} from '@/lib/normalizeBlueprint'

const SOURCE = 'cell-source'
const TARGET = 'cell-target'

/** A path row as the board query returns it, with two cells to draw between. */
function boardWith(path: Partial<RawPath>): RawPath {
  return {
    id: 'path-1',
    name: 'Path',
    summary: null,
    note: null,
    kind: 'happy',
    status: 'live',
    lanes: [{ id: 'lane-a', name: 'Tutor', position: 1 }],
    path_steps: [
      { position: 1, steps: { id: 'step-1', name: 'Arrive', summary: null } },
      { position: 2, steps: { id: 'step-2', name: 'Leave', summary: null } },
    ],
    cells: [
      cellRow({ id: SOURCE, step_id: 'step-1' }),
      cellRow({ id: TARGET, step_id: 'step-2' }),
    ],
    ...path,
  }
}

function cellRow(cell: Partial<RawCell> & { id: string }): RawCell {
  return {
    lane_id: 'lane-a',
    step_id: 'step-1',
    content: 'Cell',
    cell_touchpoints: [],
    resources: [],
    outgoing: [],
    ...cell,
  }
}

function onlyEdge(raw: RawPath): BlueprintCellDependency {
  const { dependencies } = normalizeBlueprint(raw)
  assert.equal(dependencies.length, 1, 'expected the board to hold one edge')
  return dependencies[0]
}

test('an edge in the top-level array keeps its why-line', () => {
  const edge = onlyEdge(
    boardWith({
      cell_dependencies: [
        {
          id: 'edge-1',
          source_cell_id: SOURCE,
          target_cell_id: TARGET,
          kind: 'leads_to',
          name: 'Email',
          note: 'The tutor has to know before the room opens.',
        },
      ],
    }),
  )
  assert.equal(edge.note, 'The tutor has to know before the room opens.')
})

test('an edge in the top-level array with no why-line reads as null, not as missing', () => {
  // `note: undefined` and `note: null` are the same to a renderer and
  // different to everything that compares two boards — which is the whole of
  // compare. The cells door has always answered null here.
  const edge = onlyEdge(
    boardWith({
      cell_dependencies: [
        {
          id: 'edge-1',
          source_cell_id: SOURCE,
          target_cell_id: TARGET,
        },
      ],
    }),
  )
  assert.deepEqual(edge, {
    id: 'edge-1',
    source_cell_id: SOURCE,
    target_cell_id: TARGET,
    kind: 'leads_to',
    name: null,
    note: null,
  })
})

test('an edge nested under its cell keeps its why-line, as it always has', () => {
  const edge = onlyEdge(
    boardWith({
      cells: [
        cellRow({
          id: SOURCE,
          step_id: 'step-1',
          outgoing: [
            {
              id: 'edge-1',
              target_cell_id: TARGET,
              kind: 'enables',
              name: 'Email',
              note: 'The tutor has to know before the room opens.',
            },
          ],
        }),
        cellRow({ id: TARGET, step_id: 'step-2' }),
      ],
    }),
  )
  assert.equal(edge.note, 'The tutor has to know before the room opens.')
})

test('the same edge normalizes to the same six fields through either door', () => {
  const topLevel = onlyEdge(
    boardWith({
      cell_dependencies: [
        {
          id: 'edge-1',
          source_cell_id: SOURCE,
          target_cell_id: TARGET,
          kind: 'enables',
          name: 'Email',
          note: 'The tutor has to know before the room opens.',
        },
      ],
    }),
  )
  const nested = onlyEdge(
    boardWith({
      cells: [
        cellRow({
          id: SOURCE,
          step_id: 'step-1',
          outgoing: [
            {
              id: 'edge-1',
              target_cell_id: TARGET,
              kind: 'enables',
              name: 'Email',
              note: 'The tutor has to know before the room opens.',
            },
          ],
        }),
        cellRow({ id: TARGET, step_id: 'step-2' }),
      ],
    }),
  )
  assert.deepEqual(topLevel, nested)
})

test('a column the edge does not name does not ride along', () => {
  // An extra column reaches the normalizer the way every real one does: the
  // board query's rows are handed over through an `as unknown as RawPath`
  // cast, so PostgREST's answer is whatever the select asked for.
  const raw = {
    ...boardWith({}),
    cell_dependencies: [
      {
        id: 'edge-1',
        source_cell_id: SOURCE,
        target_cell_id: TARGET,
        kind: 'leads_to',
        name: null,
        note: null,
        created_at: '2026-09-10T00:00:00.000Z',
      },
    ],
  } as unknown as RawPath

  assert.deepEqual(Object.keys(onlyEdge(raw)).sort(), [
    'id',
    'kind',
    'name',
    'note',
    'source_cell_id',
    'target_cell_id',
  ])
})
