import { test } from 'vitest'
import assert from 'node:assert/strict'
import { installMismatch, pinMismatch, pinnedVersion } from '../template-pin.mjs'

/**
 * #510 — the gate knows what it is comparing against.
 *
 * Four scripts resolve the template through `node_modules`, and none of them
 * asked whether that copy is the version `package.json` pins. A bump landed
 * without a matching install therefore read as DRIFT: the gate listed files
 * nobody had touched and told the reader to reconcile them or drop the
 * enrolment, and both were wrong. It happened twice in one day.
 *
 * The mismatch is PLANTED here rather than waited for. A check whose failing
 * branch has only ever been seen in the wild is a check nobody has read.
 */

test('a git-tag spec pins the version written in it', () => {
  assert.equal(
    pinnedVersion('github:BilLogic/agentic-service-blueprinting#v1.12.9'),
    '1.12.9',
  )
})

test('a spec that names no version pins nothing', () => {
  // A branch, a bare commit and a local link are all deliberate states, not
  // mismatches — guessing a version for them would invent a failure.
  for (const spec of [
    'github:BilLogic/agentic-service-blueprinting#main',
    'github:BilLogic/agentic-service-blueprinting#a1b2c3d',
    'file:../agentic-service-blueprinting',
    undefined,
  ]) {
    assert.equal(pinnedVersion(spec), null)
    assert.equal(pinMismatch({ spec, installedVersion: '1.12.8' }), null)
  }
})

test('agreement is silence', () => {
  assert.equal(
    pinMismatch({ spec: 'github:o/r#v1.12.9', installedVersion: '1.12.9' }),
    null,
  )
})

test('a stale install names both versions, the fix, and that nothing drifted', () => {
  const message = pinMismatch({
    spec: 'github:o/r#v1.12.9',
    installedVersion: '1.12.8',
  })
  assert.match(message, /pinned at 1\.12\.9/)
  assert.match(message, /installed copy is 1\.12\.8/)
  // The sentence a reader most needs: do not go looking at the files.
  assert.match(message, /Nothing has drifted/)
  assert.match(message, /npm install "github:o\/r#v1\.12\.9" --prefer-online/)
})

test('an install AHEAD of the pin is a mismatch too', () => {
  // Someone bumped node_modules by hand. Same wrong tree, opposite direction.
  assert.match(
    pinMismatch({ spec: 'github:o/r#v1.12.9', installedVersion: '1.12.10' }),
    /pinned at 1\.12\.9 and the installed copy is 1\.12\.10/,
  )
})

test('an installed package with no version is a mismatch, not a pass', () => {
  assert.match(
    pinMismatch({ spec: 'github:o/r#v1.12.9', installedVersion: null }),
    /declares no version/,
  )
})

test('installMismatch reads both package.json files', () => {
  const files = {
    '/repo/package.json': {
      dependencies: { 'agentic-service-blueprinting': 'github:o/r#v1.12.9' },
    },
    '/repo/node_modules/agentic-service-blueprinting/package.json': {
      version: '1.12.8',
    },
  }
  assert.match(
    installMismatch('/repo', '/repo/node_modules/agentic-service-blueprinting', (p) => files[p]),
    /pinned at 1\.12\.9 and the installed copy is 1\.12\.8/,
  )
})

test('an unreadable installed package.json reads as no version', () => {
  const read = (path) => {
    if (path.includes('node_modules')) throw new Error('ENOENT')
    return { dependencies: { 'agentic-service-blueprinting': 'github:o/r#v1.12.9' } }
  }
  assert.match(installMismatch('/repo', '/repo/nm', read), /declares no version/)
})

test('the shipped tree agrees with its own pin', () => {
  // The live case, asserted last and as one case among several — the same
  // shape as reconciled-files.test.mjs, and for the same reason.
  const root = new URL('../..', import.meta.url).pathname
  assert.equal(
    installMismatch(root, `${root}node_modules/agentic-service-blueprinting`),
    null,
  )
})
