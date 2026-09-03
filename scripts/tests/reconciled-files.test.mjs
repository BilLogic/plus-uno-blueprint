#!/usr/bin/env node
/**
 * The reconciled-set drift gate's contract (#319): an empty allowlist passes,
 * an enrolled file byte-identical to asb passes, an enrolled file that differs
 * fails.
 *
 * `auditReconciled` is exercised against in-memory readers rather than a real
 * asb checkout, so the outcomes are pinned to byte-equality alone and not to
 * whatever the pinned package happens to ship. The one test that does touch
 * the shipped list asserts it is still empty — the state #319 lands in.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { auditReconciled } from '../check-reconciled-files.mjs'
import { RECONCILED_FILES } from '../reconciled-files.mjs'

const bytes = (text) => Buffer.from(text, 'utf8')
const refuse = () => {
  throw new Error('an empty allowlist must not read any file')
}

test('an empty allowlist has nothing to fail on, and reads nothing', () => {
  assert.deepEqual(auditReconciled({ files: [], readInstance: refuse, readAsb: refuse }), [])
})

test('the shipped allowlist is empty, so the gate lands green', () => {
  // #319 ships the gate EMPTY. This trips the day the first path is enrolled,
  // which is the reminder that enrolment belongs in a reconciliation ticket.
  assert.deepEqual(RECONCILED_FILES, [])
})

test('an enrolled file byte-identical to asb passes', () => {
  const problems = auditReconciled({
    files: ['src/lib/shared.ts'],
    readInstance: () => bytes('export const x = 1\n'),
    readAsb: () => bytes('export const x = 1\n'),
  })
  assert.deepEqual(problems, [])
})

test('an enrolled file that differs from asb fails', () => {
  const problems = auditReconciled({
    files: ['src/lib/shared.ts'],
    readInstance: () => bytes('export const x = 1\n'),
    readAsb: () => bytes('export const x = 2\n'),
  })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /drifted/)
})

test('a difference as small as a trailing newline fails — this is byte-identity', () => {
  const problems = auditReconciled({
    files: ['src/lib/shared.ts'],
    readInstance: () => bytes('export const x = 1\n'),
    readAsb: () => bytes('export const x = 1'),
  })
  assert.equal(problems.length, 1)
})

test('an enrolled path asb does not ship fails rather than passing blind', () => {
  const problems = auditReconciled({
    files: ['src/lib/instance-only.ts'],
    readInstance: () => bytes('export const x = 1\n'),
    readAsb: () => null,
  })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /no copy/)
})

test('an enrolled path this repo has deleted fails rather than passing blind', () => {
  const problems = auditReconciled({
    files: ['src/lib/gone.ts'],
    readInstance: () => null,
    readAsb: () => bytes('export const x = 1\n'),
  })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /does not exist in this repo/)
})
