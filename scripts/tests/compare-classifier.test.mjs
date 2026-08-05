#!/usr/bin/env node
/**
 * The comparison view's one primitive: "this cell in path A and that cell in
 * path B are the same thing." Position-and-lane matching, per the ideation
 * doc — same (lane, step) slot; same trimmed text ⇒ shared; different text
 * ⇒ divergent; occupied by one path only ⇒ only.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { classifyCompareCells } from '../../src/lib/mergeIntegratedBlueprint.ts'

const A = 'path-a'
const B = 'path-b'

let nextId = 0
function cell(pathId, layerId, stepId, content) {
  nextId += 1
  return {
    id: `cell-${nextId}`,
    layer_id: layerId,
    step_id: stepId,
    path_id: pathId,
    path_type: pathId === A ? 'happy' : 'unhappy',
    content,
    picture: null,
    description: null,
    links: [],
    opacity: 1,
  }
}

test('identical text at the same slot collapses to one shared cell', () => {
  const a = cell(A, 'lane', 'step', 'Greet students')
  const b = cell(B, 'lane', 'step', 'Greet students')
  const { cells, remap } = classifyCompareCells([a, b], [A, B], A)

  assert.equal(cells.length, 1)
  assert.equal(cells[0].compare, 'shared')
  assert.equal(cells[0].path_id, A, 'the primary path keeps the copy')
  assert.equal(remap.get(b.id), a.id, 'the dropped copy remaps to the keeper')
})

test('whitespace differences still count as the same text', () => {
  const a = cell(A, 'lane', 'step', '  Greet students ')
  const b = cell(B, 'lane', 'step', 'Greet students')
  const { cells } = classifyCompareCells([a, b], [A, B], A)
  assert.equal(cells.length, 1)
  assert.equal(cells[0].compare, 'shared')
})

test('different text at the same slot keeps both cells as divergent', () => {
  const a = cell(A, 'lane', 'step', 'Waits for students')
  const b = cell(B, 'lane', 'step', 'Escalates to lead')
  const { cells, remap } = classifyCompareCells([a, b], [A, B], A)

  assert.equal(cells.length, 2)
  assert.ok(cells.every((entry) => entry.compare === 'divergent'))
  assert.equal(remap.size, 0)
})

test('a slot occupied by one path only is marked only', () => {
  const a = cell(A, 'lane', 'step', 'Escalate')
  const { cells } = classifyCompareCells([a], [A, B], A)
  assert.equal(cells.length, 1)
  assert.equal(cells[0].compare, 'only')
})

test('partial presence (2 of 3 paths) is divergent, not shared', () => {
  const C = 'path-c'
  const a = cell(A, 'lane', 'step', 'Same text')
  const b = cell(B, 'lane', 'step', 'Same text')
  const { cells } = classifyCompareCells([a, b], [A, B, C], A)
  assert.ok(cells.every((entry) => entry.compare === 'divergent'))
})

test('tech slots compare the whole set of touchpoints', () => {
  const a1 = cell(A, 'tech', 'step', 'Slack')
  const a2 = cell(A, 'tech', 'step', 'Zoom')
  const b1 = cell(B, 'tech', 'step', 'Zoom')
  const b2 = cell(B, 'tech', 'step', 'Slack')

  const same = classifyCompareCells([a1, a2, b1, b2], [A, B], A)
  assert.equal(same.cells.length, 2, 'shared slot keeps one path of pills')
  assert.ok(same.cells.every((entry) => entry.compare === 'shared'))
  // Arrow re-pointing matches pill to pill by text, not by order.
  assert.equal(same.remap.get(b1.id), a2.id, 'Zoom maps to Zoom')
  assert.equal(same.remap.get(b2.id), a1.id, 'Slack maps to Slack')

  const b3 = cell(B, 'tech', 'step2', 'Email')
  const a3 = cell(A, 'tech', 'step2', 'Slack')
  const diff = classifyCompareCells([a3, b3], [A, B], A)
  assert.ok(diff.cells.every((entry) => entry.compare === 'divergent'))
})

test('cells from unselected paths are dropped entirely', () => {
  const a = cell(A, 'lane', 'step', 'Text')
  const other = cell('path-x', 'lane', 'step', 'Text')
  const { cells } = classifyCompareCells([a, other], [A, B], A)
  assert.equal(cells.length, 1)
  assert.equal(cells[0].path_id, A)
})
