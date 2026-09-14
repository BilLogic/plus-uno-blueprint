#!/usr/bin/env node
/**
 * The other direction of the drift gate, and the ways it could measure nothing.
 *
 * `check:reconciled` asks whether a file we DECLARED identical has drifted.
 * `check:shared-scripts` asks whether the template has started publishing a
 * shared script we do not hold — a failure that moves no byte on this side and
 * turns no other gate red, which is how this repository came to be running a
 * generation of router checks the template had already replaced.
 *
 * Every case below is one way the check could pass while looking at nothing,
 * because that is the only interesting failure mode a two-list comparison has:
 * an empty list agrees with every tree. The manifest — the real repository
 * against the real installed package — is graded at the end, so this suite
 * fails the same way `npm run check:shared-scripts` does rather than only
 * proving the parser works.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { GUARD, declaredPaths, faults } from '../check-shared-scripts.mjs'
import { RECONCILED_FILES } from '../reconciled-files.mjs'
import { PACKAGE } from '../template-pin.mjs'

// The runner copies test files into a temp dir, so paths resolve from the
// working directory (npm test runs at the repo root), not from import.meta.
const REPO_ROOT = process.cwd()

const GUARD_SOURCE = [
  'export const SHARED_SCRIPTS = new Map([',
  "  ['scripts/sweep.mjs', 'one module answers where every subject is'],",
  '  [',
  "    'scripts/seed-list.mjs',",
  "    'where a deployment’s seed is and which files it is',",
  '  ],',
  '])',
  '',
  'export const REPO_LOCAL_IMPORTS = new Map([',
  "  ['scripts/repo-config.mjs', 'the seam itself — every field is a fact about this repository'],",
  '])',
].join('\n')

/** A reader over a plain `{ path: text }` map, absent paths reading as null. */
const reader = (tree) => (path) => (path in tree ? tree[path] : null)

// ---------------------------------------------------------------------------
// Reading the template's own list
// ---------------------------------------------------------------------------

test('both declarations are read, entries on one line and on several alike', () => {
  assert.deepEqual(declaredPaths(GUARD_SOURCE, 'SHARED_SCRIPTS'), [
    'scripts/sweep.mjs',
    'scripts/seed-list.mjs',
  ])
  assert.deepEqual(declaredPaths(GUARD_SOURCE, 'REPO_LOCAL_IMPORTS'), [
    'scripts/repo-config.mjs',
  ])
})

test('the shared list stops at its own closing bracket', () => {
  // The bug a greedy match would cause: `SHARED_SCRIPTS` swallowing the
  // repo-local declaration after it, so `repo-config.mjs` would be demanded
  // byte-identical — the one file that must never be.
  assert.ok(!declaredPaths(GUARD_SOURCE, 'SHARED_SCRIPTS').includes('scripts/repo-config.mjs'))
})

test('a renamed declaration refuses the run rather than comparing nothing', () => {
  // THE failure this suite is mostly about. An empty list agrees with every
  // tree, so a reader that quietly finds nothing reports success forever.
  assert.throws(
    () => declaredPaths('export const PUBLISHED = new Map([])', 'SHARED_SCRIPTS'),
    /no longer declares SHARED_SCRIPTS as a Map/,
  )
})

test('a declaration with no scripts path in it refuses too', () => {
  // The subtler shape of the same thing: the Map is found, the entries are
  // spelled some way this reader does not see, and the list comes back empty.
  assert.throws(
    () => declaredPaths('export const SHARED_SCRIPTS = new Map([\n])', 'SHARED_SCRIPTS'),
    /with no scripts\/ path in it/,
  )
})

// ---------------------------------------------------------------------------
// The four faults
// ---------------------------------------------------------------------------

const SHARED = ['scripts/sweep.mjs']
const REPO_LOCAL = ['scripts/repo-config.mjs']
const IDENTICAL = { 'scripts/sweep.mjs': 'one\n', 'scripts/repo-config.mjs': 'ours\n' }

const check = ({ ours = IDENTICAL, theirs = IDENTICAL, enrolled = SHARED }) =>
  faults({
    shared: SHARED,
    repoLocal: REPO_LOCAL,
    read: reader(ours),
    readPackage: reader(theirs),
    enrolled,
  }).map(({ path, problem }) => `${path}: ${problem}`)

test('a correctly enrolled tree reports nothing', () => {
  assert.deepEqual(check({}), [])
})

test('a published script this tree does not hold is the missing enrolment', () => {
  // The event: a release adds a file to its own shared list. Nothing here
  // changes, so this is the only check that can say so.
  const problems = check({ ours: { 'scripts/repo-config.mjs': 'ours\n' }, enrolled: [] })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /publishes it for a deployment to hold byte-identical/)
})

test('drift on a published script is a fault even where the path is enrolled', () => {
  const problems = check({ theirs: { ...IDENTICAL, 'scripts/sweep.mjs': 'two\n' } })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /has drifted from the installed package's copy/)
})

test('byte-identical and unenrolled is a fault, because bytes are not the promise', () => {
  // The gap between the two gates. The file agrees today and nothing fails the
  // next edit on either side, which is the whole point of enrolling it.
  const problems = check({ enrolled: [] })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /byte-identical and not enrolled/)
})

test('the seam enrolled as shared is a fault in the opposite direction', () => {
  // A budget set against a different router passes while measuring nothing, so
  // `repo-config.mjs` being held identical to the template's is the defect.
  const problems = check({ enrolled: [...SHARED, 'scripts/repo-config.mjs'] })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /never shared/)
})

test('a seam this tree does not have is named as the load failure it is', () => {
  const problems = check({ ours: { 'scripts/sweep.mjs': 'one\n' } })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /fails at load/)
})

test('a path the template lists and does not ship is named as upstream’s', () => {
  // Read standing in this tree, the next line would otherwise be read as this
  // repository's problem. The template's own guard fails on it too.
  const problems = check({ theirs: { 'scripts/repo-config.mjs': 'ours\n' } })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /lists it as published and ships no file at that path/)
})

// ---------------------------------------------------------------------------
// The manifest — the real repository against the real installed package
// ---------------------------------------------------------------------------

test('this repository holds every script the pinned release publishes', () => {
  const packageRoot = resolve(REPO_ROOT, PACKAGE)
  const readIn = (root) => (path) => {
    const full = join(root, path)
    return existsSync(full) ? readFileSync(full, 'utf8') : null
  }
  const guard = readIn(packageRoot)(GUARD)
  assert.ok(guard, `${PACKAGE}/${GUARD} is not installed — run npm ci`)
  const shared = declaredPaths(guard, 'SHARED_SCRIPTS')
  // Non-vacuity: the release publishes eleven, and a list that shrank to one
  // would pass every assertion below while holding almost nothing.
  assert.ok(shared.length >= 10, `only ${shared.length} published scripts parsed`)
  assert.deepEqual(
    faults({
      shared,
      repoLocal: declaredPaths(guard, 'REPO_LOCAL_IMPORTS'),
      read: readIn(REPO_ROOT),
      readPackage: readIn(packageRoot),
      enrolled: RECONCILED_FILES,
    }),
    [],
  )
})
