#!/usr/bin/env node
/**
 * Storyboard upload checks (phase 8).
 *
 * The ordering test is the one that matters. A 6 MB JPEG breaks both rules,
 * and the useful message is the size one — telling someone the format is wrong
 * sends them off to convert a file that would still be rejected.
 *
 * Run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_STORYBOARD_BYTES,
  checkStoryboardFile,
  storyboardPath,
} from '../../src/lib/storyboardUpload.ts'

const MB = 1024 * 1024

test('a normal PNG passes', () => {
  assert.deepEqual(
    checkStoryboardFile({ size: 2 * MB, type: 'image/png' }),
    { ok: true },
  )
})

test('an oversized file fails on size, not on format', () => {
  const result = checkStoryboardFile({ size: 6 * MB, type: 'image/jpeg' })
  assert.equal(result.ok, false)
  assert.match(result.problem, /6\.0 MB, over the 5\.0 MB limit/)
  assert.doesNotMatch(result.problem, /PNG, JPEG or WebP/)
})

test('exactly at the limit is allowed', () => {
  assert.equal(
    checkStoryboardFile({ size: MAX_STORYBOARD_BYTES, type: 'image/png' }).ok,
    true,
  )
})

test('an empty file is refused', () => {
  const result = checkStoryboardFile({ size: 0, type: 'image/png' })
  assert.equal(result.ok, false)
  assert.match(result.problem, /empty/)
})

test('a disallowed format is named', () => {
  const result = checkStoryboardFile({ size: 1024, type: 'image/gif' })
  assert.equal(result.ok, false)
  assert.match(result.problem, /GIF files cannot be used/)
})

test('a missing type is still refused, without an odd sentence', () => {
  const result = checkStoryboardFile({ size: 1024, type: '' })
  assert.equal(result.ok, false)
  assert.match(result.problem, /^That file cannot be used/)
})

test('the path is derived, so a replace overwrites', () => {
  const first = storyboardPath('slice-1', 'item-1', 'image/png')
  const second = storyboardPath('slice-1', 'item-1', 'image/png')
  assert.equal(first, second)
  assert.equal(first, 'slice-1/item-1.png')
})

test('each format gets its own extension', () => {
  assert.equal(storyboardPath('s', 'i', 'image/jpeg'), 's/i.jpg')
  assert.equal(storyboardPath('s', 'i', 'image/webp'), 's/i.webp')
  // Unknown types never reach here, but a path is still better than a crash.
  assert.equal(storyboardPath('s', 'i', 'image/gif'), 's/i.png')
})

test('different screens never share a path', () => {
  assert.notEqual(
    storyboardPath('slice-1', 'item-1', 'image/png'),
    storyboardPath('slice-1', 'item-2', 'image/png'),
  )
})
