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
import { test } from 'vitest'
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

const SLICE = 'a0000000-0000-4000-8000-000000000001'
const ITEM = 'b0000000-0000-4000-8000-000000000002'

test('the path is derived, so a replace overwrites', () => {
  const first = storyboardPath(SLICE, ITEM, 'image/png')
  const second = storyboardPath(SLICE, ITEM, 'image/png')
  assert.equal(first, second)
  assert.equal(first, `slices/${SLICE}/${ITEM}.png`)
})

test('each format gets its own extension', () => {
  assert.equal(storyboardPath(SLICE, ITEM, 'image/jpeg'), `slices/${SLICE}/${ITEM}.jpg`)
  assert.equal(storyboardPath(SLICE, ITEM, 'image/webp'), `slices/${SLICE}/${ITEM}.webp`)
  // Unknown types never reach here, but a path is still better than a crash.
  assert.equal(storyboardPath(SLICE, ITEM, 'image/gif'), `slices/${SLICE}/${ITEM}.png`)
})

test('different screens never share a path', () => {
  assert.notEqual(
    storyboardPath(SLICE, ITEM, 'image/png'),
    storyboardPath(SLICE, 'b0000000-0000-4000-8000-000000000003', 'image/png'),
  )
})

/**
 * The bucket's insert policy matches on the object name, so a path the app
 * builds and a path the policy accepts are two different facts that have to
 * agree. They did not: the original policy hard-coded `frame-<position>.png`,
 * which no `storyboardPath` output can ever match — every upload would have
 * been refused, and the mime widening beside it would have been dead. Kept in
 * step here rather than discovered at upload time.
 */
const POLICY_PATTERN =
  /^slices\/[0-9a-f-]{36}\/([0-9a-f-]{36}|frame-[0-9]+|character-ref)\.(png|jpg|webp)$/

test('every path the app builds is one the bucket policy accepts', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    const path = storyboardPath(SLICE, ITEM, type)
    assert.match(path, POLICY_PATTERN, `${type} produced ${path}`)
  }
})

test('the policy still accepts what was uploaded under the old naming', () => {
  assert.match(`slices/${SLICE}/frame-3.png`, POLICY_PATTERN)
  assert.match(`slices/${SLICE}/character-ref.png`, POLICY_PATTERN)
})

test('a path outside a slice folder is refused', () => {
  assert.doesNotMatch(`${SLICE}/${ITEM}.png`, POLICY_PATTERN)
  assert.doesNotMatch(`slices/${ITEM}.png`, POLICY_PATTERN)
})
