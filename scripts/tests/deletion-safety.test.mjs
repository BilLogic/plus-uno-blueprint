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
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  confirmationMatches,
  deletionReadiness,
  describeImpact,
  splitByRecoverability,
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

test('the impact names cells, arrows and affected slices', () => {
  const lines = describeImpact('lane', {
    label: 'Regular Tutor',
    cell_count: 6,
    dependency_count: 4,
    affected_slices: [
      { slice_id: '1', title: 'Warm-up journey', cell_keys: ['k1'] },
    ],
  })
  assert.match(lines[0], /removes 6 cells/)
  assert.match(lines[1], /4 arrows/)
  assert.match(lines[2], /1 slice will lose frames: “Warm-up journey”/)
})

test('unrecoverable slices are called out separately', () => {
  const lines = describeImpact('scenario', {
    label: 'Discovery',
    cell_count: 2,
    dependency_count: 0,
    affected_slices: [{ slice_id: '1', title: 'Old', cell_keys: [null] }],
  })
  assert.ok(!lines.some((line) => /will lose frames/.test(line)))
  assert.ok(lines.some((line) => /cannot be restored by undo/.test(line)))
})

test('no arrows means no arrow sentence', () => {
  const lines = describeImpact('step', {
    label: 'Step 1',
    cell_count: 1,
    dependency_count: 0,
    affected_slices: [],
  })
  assert.equal(lines.length, 1)
  assert.match(lines[0], /removes 1 cell\./)
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
