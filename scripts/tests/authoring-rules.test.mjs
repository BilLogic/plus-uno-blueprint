#!/usr/bin/env node
/**
 * Dependency and version rules (phases 5 and 6).
 *
 * These are the checks that stop a blueprint from describing something that
 * cannot happen: a cell that depends on itself, a copy whose arrows point
 * back at the original, two versions nobody can tell apart.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
// The subjects are the APPLICATION's validators, and the application is no
// longer a directory in this repository — it is the installed package. `@/…` is
// the alias that names it, in the test exactly as in the app code, so these
// keep exercising the very modules the deployment runs rather than copies of
// them.
import { validateDraftDependency } from '@/lib/dependencyValidation.ts'
import {
  validateDraftVersion,
  describeVersionOutcome,
} from '@/lib/versionValidation.ts'

const source = { cellId: 'a', label: 'Greet student' }
// Both targets are cells of the source's service: one on its path, one on
// another path. A link may reach either.
const inPathCell = { cellId: 'b', label: 'Share screen' }
const crossPathCell = { cellId: 'c', label: 'Escalate' }

const draft = (patch) => ({
  sourceCellId: 'a',
  targetCellId: 'b',
  kind: 'leads_to',
  label: '',
  note: '',
  ...patch,
})

test('a valid handoff has no problems', () => {
  assert.deepEqual(
    validateDraftDependency(draft(), inPathCell, []),
    [],
  )
})

test('a cell cannot depend on itself', () => {
  const problems = validateDraftDependency(
    draft({ targetCellId: 'a' }),
    source,
    [],
  )
  assert.ok(problems.some((p) => /cannot depend on itself/.test(p)))
})

test('a link may cross paths within one service', () => {
  // The one wall left is another service, and that is the database's to
  // refuse; the panel only offers cells of the service it has open.
  const problems = validateDraftDependency(
    draft({ targetCellId: 'c' }),
    crossPathCell,
    [],
  )
  assert.deepEqual(problems, [])
})

test('no target is reported before anything else', () => {
  const problems = validateDraftDependency(
    draft({ targetCellId: null }),
    null,
    [],
  )
  assert.deepEqual(problems, ['Pick the cell this one connects to.'])
})

test('the same connection is not added twice', () => {
  const problems = validateDraftDependency(draft(), inPathCell, [
    { targetCellId: 'b', kind: 'leads_to' },
  ])
  assert.ok(problems.some((p) => /already exists/.test(p)))
})

test('the same pair may hold both a leads_to and an enables', () => {
  const problems = validateDraftDependency(
    draft({ kind: 'enables' }),
    inPathCell,
    [{ targetCellId: 'b', kind: 'leads_to' }],
  )
  assert.deepEqual(problems, [])
})

// --- versions ---------------------------------------------------------------

const version = (patch) => ({
  mode: 'blank',
  name: 'Escalation',
  pathType: 'alternative',
  sourcePathId: null,
  copyCells: true,
  copyDependencies: true,
  ...patch,
})

test('a version needs a name', () => {
  assert.ok(
    validateDraftVersion(version({ name: '  ' }), []).some((p) =>
      /needs a name/.test(p),
    ),
  )
})

test('sibling names must differ, ignoring case', () => {
  const problems = validateDraftVersion(version({ name: 'happy path' }), [
    'Happy Path',
  ])
  assert.ok(problems.some((p) => /already has a path/.test(p)))
})

test('duplicating requires a source', () => {
  const problems = validateDraftVersion(
    version({ mode: 'duplicate', sourcePathId: null }),
    [],
  )
  assert.ok(problems.some((p) => /Pick the path to copy/.test(p)))
})

test('arrows cannot be copied without their cells', () => {
  const problems = validateDraftVersion(
    version({
      mode: 'duplicate',
      sourcePathId: 'p1',
      copyCells: false,
      copyDependencies: true,
    }),
    [],
  )
  assert.ok(problems.some((p) => /without the cells/.test(p)))
})

test('the outcome sentence names the arrow behaviour', () => {
  assert.match(
    describeVersionOutcome(version({ mode: 'duplicate', sourcePathId: 'p1' })),
    /repointed onto the copies/,
  )
  assert.match(
    describeVersionOutcome(
      version({ mode: 'duplicate', sourcePathId: 'p1', copyDependencies: false }),
    ),
    /no arrows/,
  )
})
