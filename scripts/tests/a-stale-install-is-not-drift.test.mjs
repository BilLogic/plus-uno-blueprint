#!/usr/bin/env node
/**
 * The pin/install comparison the four template-reading scripts share (#510).
 *
 * The mismatch is PLANTED here rather than waited for. It happened twice in
 * one day and was diagnosed twice from scratch, and the only way it could
 * reach a test before was to arrive in the tree — which is to say, on `main`,
 * which is production.
 *
 * Nothing here writes to `node_modules`. Two versions and a spec are the whole
 * subject of `staleInstallProblem`, and `templatePinState` is driven against a
 * scratch directory of two package.json files, so the reading half is proved
 * without the installed tree — shared with other worktrees — being touched at
 * all. That is the seam: a test that had to install a different version to
 * exercise this would be testing npm.
 *
 * The assertions are about the two versions DISAGREEING, not about any
 * particular pair of numbers. A test pinned to `1.12.8` against `1.12.9`
 * would go stale on the next bump and would prove nothing that the general
 * case does not.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  PACKAGE,
  TEMPLATE_PACKAGE,
  pinnedSpec,
  staleInstallProblem,
  templatePinState,
  versionInSpec,
} from '../template-pin.mjs'

const spec = (version) => `github:BilLogic/${TEMPLATE_PACKAGE}#v${version}`

/**
 * A throwaway repo holding only the two files the comparison reads: its own
 * package.json, and the installed package's. `installed` of null leaves the
 * package out of `node_modules` entirely.
 */
function repo({ pin, installed }) {
  const root = mkdtempSync(join(tmpdir(), 'template-pin-'))
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ dependencies: { [TEMPLATE_PACKAGE]: pin } }),
  )
  if (installed !== null) {
    const dir = join(root, PACKAGE)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: installed }))
  }
  return { root, done: () => rmSync(root, { recursive: true, force: true }) }
}

test('versions that agree are nothing to say', () => {
  assert.equal(
    staleInstallProblem({ pinned: '2.0.0', installed: '2.0.0', spec: spec('2.0.0') }),
    null,
  )
})

test('versions that disagree fail, and the message names both and the fix', () => {
  // The invariant is the disagreement. These two numbers are arbitrary, and
  // the assertions read them back out of the arguments rather than quoting
  // literals, so the test says "both versions appear" and not "1.4.0 appears".
  const pinned = '3.1.0'
  const installed = '3.0.9'
  const problem = staleInstallProblem({ pinned, installed, spec: spec(pinned) })

  assert.notEqual(problem, null)
  assert.ok(problem.includes(installed), 'the message names the version that is installed')
  assert.ok(problem.includes(pinned), 'the message names the version that is pinned')
  assert.ok(problem.includes(`npm install "${spec(pinned)}"`), 'and the command that fixes it')
})

test('the message says this is not drift, because that is the wrong answer it replaces', () => {
  const problem = staleInstallProblem({ pinned: '9.9.9', installed: '1.0.0', spec: spec('9.9.9') })
  assert.match(problem, /stale install, not drift/)
})

test('a lower pin than the install disagrees too — this is equality, not ordering', () => {
  // Rolling the pin BACK without reinstalling leaves node_modules ahead, and
  // the comparison is just as untrustworthy in that direction. A check that
  // asked "is the install older" would pass on it.
  const problem = staleInstallProblem({ pinned: '1.0.0', installed: '2.0.0', spec: spec('1.0.0') })
  assert.notEqual(problem, null)
})

test('an unknown version on either side abstains rather than guessing', () => {
  // A missing install is the caller's own failure to report, in the terms of
  // whatever it was about to check; a spec that names no version is not a pin.
  assert.equal(staleInstallProblem({ pinned: null, installed: '1.0.0', spec: 'x' }), null)
  assert.equal(staleInstallProblem({ pinned: '1.0.0', installed: null, spec: 'x' }), null)
})

test('a tag names the version it carries, with or without the v', () => {
  assert.equal(versionInSpec(`github:BilLogic/${TEMPLATE_PACKAGE}#v1.12.9`), '1.12.9')
  assert.equal(versionInSpec(`github:BilLogic/${TEMPLATE_PACKAGE}#1.12.9`), '1.12.9')
  assert.equal(versionInSpec(`github:BilLogic/${TEMPLATE_PACKAGE}#v2.0.0-rc.1`), '2.0.0-rc.1')
})

test('a branch, a file link and a bare range are not pins', () => {
  // Pointing the dependency at a working copy or a moving branch is a
  // deliberate act, and refusing on it would break the one workflow where a
  // person genuinely wants the installed tree to be something else.
  assert.equal(versionInSpec(`github:BilLogic/${TEMPLATE_PACKAGE}#main`), null)
  assert.equal(versionInSpec('file:../agentic-service-blueprinting'), null)
  assert.equal(versionInSpec('^1.12.9'), null)
  assert.equal(versionInSpec(undefined), null)
})

test('the pin is read out of dependencies, and is null when there is no dependency', () => {
  assert.equal(
    pinnedSpec(JSON.stringify({ dependencies: { [TEMPLATE_PACKAGE]: spec('1.0.0') } })),
    spec('1.0.0'),
  )
  assert.equal(pinnedSpec(JSON.stringify({ dependencies: { react: '^19.0.0' } })), null)
})

test('a planted mismatch on disk is read as a mismatch', () => {
  const { root, done } = repo({ pin: spec('4.2.0'), installed: '4.1.0' })
  try {
    const state = templatePinState(root)
    assert.equal(state.pinned, '4.2.0')
    assert.equal(state.installed, '4.1.0')
    assert.notEqual(staleInstallProblem(state), null)
  } finally {
    done()
  }
})

test('a matching install on disk is read as matching', () => {
  const { root, done } = repo({ pin: spec('4.2.0'), installed: '4.2.0' })
  try {
    assert.equal(staleInstallProblem(templatePinState(root)), null)
  } finally {
    done()
  }
})

test('an absent package reads as unknown, so the caller keeps its own message', () => {
  const { root, done } = repo({ pin: spec('4.2.0'), installed: null })
  try {
    const state = templatePinState(root)
    assert.equal(state.installed, null)
    assert.equal(staleInstallProblem(state), null)
  } finally {
    done()
  }
})
