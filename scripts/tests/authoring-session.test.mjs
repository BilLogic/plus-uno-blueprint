#!/usr/bin/env node
/**
 * The session change log.
 *
 * The list is what makes "discard all changes" trustworthy, so what is tested
 * here is that it never lies: it describes what was done rather than which
 * table moved, it groups changes that would otherwise be indistinguishable,
 * and it knows which of them stop being reversible once saved.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  clearSession,
  describeChange,
  groupChanges,
  recordChange,
  sessionHasDestructive,
  sessionSnapshot,
} from '../../src/lib/authoringSession.ts'

const entry = (fn, args = {}) => ({ id: 'x', fn, args, at: 0 })

test('a change is only logged once it has been recorded', () => {
  clearSession()
  assert.equal(sessionSnapshot().length, 0)
  recordChange('add_step', { path_id: 'p1', name: 'Greet' })
  assert.equal(sessionSnapshot().length, 1)
  clearSession()
  assert.equal(sessionSnapshot().length, 0)
})

test('saving clears the list without touching anything else', () => {
  clearSession()
  recordChange('add_step', { path_id: 'p1' })
  recordChange('add_lane', { scenario_id: 's1' })
  assert.equal(sessionSnapshot().length, 2)
  clearSession()
  assert.deepEqual(sessionSnapshot(), [])
})

test('the snapshot is a new array per change, so subscribers re-render', () => {
  clearSession()
  const before = sessionSnapshot()
  recordChange('add_step', {})
  assert.notEqual(sessionSnapshot(), before)
})

test('changes are named by what was done, never by table', () => {
  assert.equal(describeChange(entry('add_step', { name: 'Greet' })), 'Added step “Greet”')
  assert.equal(describeChange(entry('add_step', {})), 'Added a step')
  assert.equal(describeChange(entry('upsert_cell', {})), 'Added a cell')
  assert.equal(describeChange(entry('remove_lane', {})), 'Deleted a lane')
  assert.equal(
    describeChange(entry('set_cell_dependency', {})),
    'Connected two cells',
  )
})

test('an unknown operation still appears rather than vanishing', () => {
  // Silence would be the one failure the sheet exists to prevent: a change
  // that happened and is not listed.
  assert.equal(describeChange(entry('some_new_rpc', {})), 'some new rpc')
})

test('a blank name is not quoted as an empty string', () => {
  assert.equal(describeChange(entry('add_lane', { name: '   ' })), 'Added lane')
})

test('changes group by the path they touched', () => {
  const groups = groupChanges([
    entry('add_step', { path_id: 'p1' }),
    entry('upsert_cell', { path_id: 'p2' }),
    entry('add_step', { path_id: 'p1' }),
  ])
  assert.equal(groups.length, 2)
  assert.equal(groups[0].pathId, 'p1')
  assert.equal(groups[0].entries.length, 2)
  assert.equal(groups[1].pathId, 'p2')
})

test('changes with no path fall into their own bucket, not a wrong one', () => {
  const groups = groupChanges([
    entry('create_phase', { lifecycle_id: 'l1' }),
    entry('add_step', { path_id: 'p1' }),
  ])
  assert.equal(groups[0].pathId, null)
  assert.equal(groups[1].pathId, 'p1')
})

test('grouping preserves the order changes were made in', () => {
  const groups = groupChanges([
    entry('add_step', { path_id: 'p1', name: 'first' }),
    entry('add_step', { path_id: 'p1', name: 'second' }),
  ])
  assert.deepEqual(
    groups[0].entries.map((e) => e.args.name),
    ['first', 'second'],
  )
})

test('a destructive session is flagged, an additive one is not', () => {
  assert.equal(
    sessionHasDestructive([entry('add_step'), entry('upsert_cell')]),
    false,
  )
  assert.equal(
    sessionHasDestructive([entry('add_step'), entry('remove_lane')]),
    true,
  )
})

/**
 * Reads are not changes.
 *
 * `deletion_impact` used to go through the same seam as every write, so merely
 * opening a delete dialog logged a row named "deletion impact": the unsaved
 * count climbed with nothing changed, and because a read has no inverse the row
 * showed no revert control — which read as per-change revert being gone.
 *
 * The seam in `authoringRpc.ts` routes these through `read()` now. This is the
 * backstop at the ledger's own door, so a future read wired to `call()` by
 * mistake still cannot pollute the list.
 */
test('a read is never recorded as a change', () => {
  clearSession()
  recordChange('deletion_impact', { kind: 'scenario', target_id: 's1' })
  recordChange('cell_natural_key', { cell_id: 'c1' })
  recordChange('slices_referencing', { cell_ids: ['c1'] })
  assert.deepEqual(sessionSnapshot(), [])
})

test('reads do not consume ids, so real changes keep numbering cleanly', () => {
  clearSession()
  recordChange('deletion_impact', { kind: 'scenario', target_id: 's1' })
  recordChange('add_step', { path_id: 'p1', name: 'Greet' })
  const list = sessionSnapshot()
  assert.equal(list.length, 1)
  assert.equal(list[0].fn, 'add_step')
})

test('a slice delete is named and counts as destructive', () => {
  assert.equal(
    describeChange(entry('delete_slice', { slice_id: 's1', title: 'Tutor journey' })),
    'Deleted slice “Tutor journey”',
  )
  assert.equal(
    describeChange(entry('delete_slice', { slice_id: 's1', title: null })),
    'Deleted a slice',
  )
  assert.equal(sessionHasDestructive([entry('delete_slice', {})]), true)
})
