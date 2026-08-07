#!/usr/bin/env node
/**
 * Deletion guardrails (phase 7).
 *
 * The plan's ordering rule is that no delete affordance ships before its
 * archive exists. These tests hold that rule and the two ways a confirm dialog
 * can quietly lie: undercounting the cascade, and implying an undo it cannot
 * perform.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  DELETION_NOUNS,
  confirmationMatches,
  deletionReadiness,
  splitByRecoverability,
  summarizeImpact,
  summarizeSliceImpact,
} from '../../src/lib/deletionSafety.ts'

test('deleting is unavailable without the archive', () => {
  const result = deletionReadiness(false)
  assert.equal(result.canDelete, false)
  assert.match(result.reason, /could not be undone/)
})

test('deleting is available once the archive exists', () => {
  assert.deepEqual(deletionReadiness(true), { canDelete: true })
})

test('a slice with a null key is not counted as recoverable', () => {
  const { recoverable, unrecoverable } = splitByRecoverability([
    { slice_id: '1', title: 'Good', cell_keys: ['a/b/c/d/e'] },
    { slice_id: '2', title: 'Orphan', cell_keys: ['a/b/c/d/e', null] },
    { slice_id: '3', title: 'Blank', cell_keys: [''] },
  ])
  assert.deepEqual(recoverable.map((s) => s.title), ['Good'])
  assert.deepEqual(unrecoverable.map((s) => s.title), ['Orphan', 'Blank'])
})

/**
 * The inverted case. A slice is in this list *because* it loses cells, so no
 * keys at all is the least recoverable state there is — but `.some()` on an
 * empty array is false, which would have read as "nothing missing, fine".
 */
test('a slice with no keys at all is unrecoverable, not recoverable', () => {
  const { recoverable, unrecoverable } = splitByRecoverability([
    { slice_id: '1', title: 'No keys', cell_keys: [] },
  ])
  assert.deepEqual(recoverable, [])
  assert.deepEqual(unrecoverable.map((s) => s.title), ['No keys'])
})

test('the impact counts cells and arrows, and names affected slices', () => {
  const summary = summarizeImpact('lane', {
    label: 'Regular Tutor',
    cell_count: 6,
    dependency_count: 4,
    affected_slices: [
      { slice_id: '1', title: 'Warm-up journey', cell_keys: ['k1'] },
    ],
  })
  assert.deepEqual(summary.facts, [
    { count: 6, noun: 'cell' },
    { count: 4, noun: 'arrow' },
  ])
  assert.match(summary.warnings[0], /1 slice will lose frames: “Warm-up journey”/)
})

test('unrecoverable slices are called out separately', () => {
  const { warnings } = summarizeImpact('scenario', {
    label: 'Discovery',
    cell_count: 2,
    dependency_count: 0,
    affected_slices: [{ slice_id: '1', title: 'Old', cell_keys: [null] }],
  })
  assert.ok(!warnings.some((line) => /will lose frames/.test(line)))
  assert.ok(warnings.some((line) => /cannot be restored by undo/.test(line)))
})

test('no arrows means no arrow count', () => {
  const summary = summarizeImpact('step', {
    label: 'Step 1',
    cell_count: 1,
    dependency_count: 0,
    affected_slices: [],
  })
  assert.deepEqual(summary.facts, [{ count: 1, noun: 'cell' }])
  assert.deepEqual(summary.warnings, [])
})

/**
 * A slice delete must never lead with a cell count. Cells are the one thing it
 * does NOT destroy, and putting their number in the destruction column is the
 * scariest possible way to say "nothing happens to these".
 */
test('a slice delete counts frames, and says the cells survive', () => {
  const summary = summarizeSliceImpact({
    label: 'Tutor journey',
    frame_count: 5,
    referenced_cell_count: 12,
  })
  assert.deepEqual(summary.facts, [{ count: 5, noun: 'frame' }])
  assert.ok(summary.reassurances.some((line) => /12 blueprint cells/.test(line)))
  assert.ok(summary.reassurances.some((line) => /stay exactly as they are/.test(line)))
})

test('a slice delete admits it has no archive behind it', () => {
  const { warnings } = summarizeSliceImpact({
    label: 'Empty',
    frame_count: 0,
    referenced_cell_count: 0,
  })
  assert.ok(warnings.some((line) => /no archive for slices/.test(line)))
})

test('every deletable kind has a noun for the confirm sentence', () => {
  for (const kind of ['scenario', 'path', 'step', 'lane', 'slice']) {
    assert.equal(typeof DELETION_NOUNS[kind], 'string')
    assert.ok(DELETION_NOUNS[kind].length > 0)
  }
})

test('the confirmation is exact and case-sensitive', () => {
  assert.equal(confirmationMatches('Happy Path', 'Happy Path'), true)
  assert.equal(confirmationMatches('  Happy Path  ', 'Happy Path'), true)
  assert.equal(confirmationMatches('happy path', 'Happy Path'), false)
  assert.equal(confirmationMatches('Happy', 'Happy Path'), false)
})

test('an empty label can never be confirmed', () => {
  assert.equal(confirmationMatches('', ''), false)
  assert.equal(confirmationMatches('   ', '   '), false)
})
