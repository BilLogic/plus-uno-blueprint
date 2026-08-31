/**
 * The diff that keeps placements honest when a cell's text changes.
 *
 * The case worth reading is the last one. Reordering two touchpoints must not lose
 * the writing attached to them, and a delete-all/insert-all sync would do
 * exactly that — silently, and only for authors who reorder.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { planTouchpointSync } from '@/lib/touchpointSync'

test('a new name is placed at its position', () => {
  assert.deepEqual(planTouchpointSync('Zoom, Email', [{ name: 'Zoom', position: 1 }]), {
    added: [{ name: 'Email', position: 2 }],
    removed: [],
    moved: [],
  })
})

test('a name taken out of the text loses its placement', () => {
  assert.deepEqual(
    planTouchpointSync('Zoom', [
      { name: 'Zoom', position: 1 },
      { name: 'Email', position: 2 },
    ]),
    { added: [], removed: ['Email'], moved: [] },
  )
})

test('reordering moves placements and never re-creates them', () => {
  // The one that matters. Both names survive with their detail; nothing is
  // removed and nothing is added, so no summary or screenshot is discarded.
  const plan = planTouchpointSync('Email, Zoom', [
    { name: 'Zoom', position: 1 },
    { name: 'Email', position: 2 },
  ])
  assert.deepEqual(plan.added, [])
  assert.deepEqual(plan.removed, [])
  assert.deepEqual(
    [...plan.moved].sort((a, b) => a.name.localeCompare(b.name)),
    [
      { name: 'Email', position: 1 },
      { name: 'Zoom', position: 2 },
    ],
  )
})

test('an unchanged cell plans no work at all', () => {
  assert.deepEqual(
    planTouchpointSync('Zoom\nEmail', [
      { name: 'Zoom', position: 1 },
      { name: 'Email', position: 2 },
    ]),
    { added: [], removed: [], moved: [] },
  )
})

test('a name repeated in the text is placed once', () => {
  // `unique (cell_id, touchpoint_id)` would reject the second, so the plan
  // must not ask for it.
  assert.deepEqual(planTouchpointSync('Zoom, Zoom', []), {
    added: [{ name: 'Zoom', position: 1 }],
    removed: [],
    moved: [],
  })
})

test('emptying the text removes every placement', () => {
  assert.deepEqual(
    planTouchpointSync('', [
      { name: 'Zoom', position: 1 },
      { name: 'Email', position: 2 },
    ]),
    { added: [], removed: ['Zoom', 'Email'], moved: [] },
  )
})

test('positions are 1-based, matching the import', () => {
  assert.deepEqual(planTouchpointSync('Zoom', []).added, [
    { name: 'Zoom', position: 1 },
  ])
})
