#!/usr/bin/env node
/**
 * Annotation capture (phase 7).
 *
 * Marks stay ephemeral by design, so the thing worth testing is not storage
 * but the one path *out* of the scratch layer: what a mark covers, and whether
 * the sentence shown before it is handed over is honest about it.
 *
 * Run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  captureMarks,
  describeMarks,
  markBounds,
  overlaps,
} from '../../src/lib/annotationCapture.ts'

const cell = (cellId, left, top, right, bottom) => ({
  cellId,
  bounds: { left, top, right, bottom },
})

test('a pen stroke is bounded by its furthest points', () => {
  assert.deepEqual(
    markBounds({
      id: '1',
      type: 'pen',
      color: '#000',
      strokeWidth: 2,
      points: [
        { x: 10, y: 40 },
        { x: 30, y: 5 },
        { x: 20, y: 25 },
      ],
    }),
    { left: 10, top: 5, right: 30, bottom: 40 },
  )
})

test('a stroke with no points has no bounds', () => {
  assert.equal(
    markBounds({ id: '1', type: 'pen', color: '#000', strokeWidth: 2, points: [] }),
    null,
  )
})

test('a shape is bounded by its own box', () => {
  assert.deepEqual(
    markBounds({
      id: '2',
      type: 'rect',
      x: 5,
      y: 10,
      width: 20,
      height: 30,
      strokeWidth: 1,
      color: '#000',
      fillColor: null,
      text: '',
    }),
    { left: 5, top: 10, right: 25, bottom: 40 },
  )
})

test('text falls back to its line height, since it has no measured box', () => {
  assert.deepEqual(
    markBounds({
      id: '3',
      type: 'text',
      color: '#000',
      x: 8,
      y: 12,
      text: 'late?',
      fontSize: 14,
    }),
    { left: 8, top: 12, right: 8, bottom: 26 },
  )
})

test('overlap is intersect, not contain — a partial mark counts', () => {
  const mark = { left: 0, top: 0, right: 10, bottom: 10 }
  assert.equal(overlaps(mark, { left: 9, top: 9, right: 50, bottom: 50 }), true)
  assert.equal(overlaps(mark, { left: 11, top: 0, right: 20, bottom: 10 }), false)
})

test('a mark reports every cell it touches', () => {
  const marks = captureMarks(
    [
      {
        id: 'm1',
        type: 'ellipse',
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        strokeWidth: 1,
        color: '#000',
        fillColor: null,
        text: '',
      },
    ],
    [
      cell('a', 10, 5, 40, 15),
      cell('b', 50, 5, 90, 15),
      cell('c', 200, 200, 240, 220),
    ],
  )
  assert.equal(marks.length, 1)
  assert.deepEqual(marks[0].overlaps, ['a', 'b'])
})

test('a mark over blank canvas says so rather than guessing', () => {
  const marks = captureMarks(
    [
      {
        id: 'm1',
        type: 'rect',
        x: 500,
        y: 500,
        width: 10,
        height: 10,
        strokeWidth: 1,
        color: '#000',
        fillColor: null,
        text: '',
      },
    ],
    [cell('a', 0, 0, 20, 20)],
  )
  assert.deepEqual(marks[0].overlaps, [])
  assert.match(describeMarks(marks)[0], /over blank canvas/)
})

test('the description names what is being handed over', () => {
  const marks = captureMarks(
    [
      {
        id: 'm1',
        type: 'sticky',
        color: '#ff0',
        x: 0,
        y: 0,
        width: 30,
        height: 30,
        text: 'late?',
        fontSize: 12,
      },
    ],
    [cell('a', 5, 5, 25, 25)],
  )
  assert.equal(describeMarks(marks)[0], 'A sticky reading “late?”, over 1 cell')
})
