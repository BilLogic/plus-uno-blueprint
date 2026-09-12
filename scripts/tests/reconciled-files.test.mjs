#!/usr/bin/env node
/**
 * The reconciled-set drift gate's contract (#319): an empty allowlist passes,
 * an enrolled file byte-identical to asb passes, an enrolled file that differs
 * fails.
 *
 * `auditReconciled` is exercised against in-memory readers rather than a real
 * asb checkout, so the outcomes are pinned to byte-equality alone and not to
 * whatever the pinned package happens to ship. Two tests do read the shipped
 * list: one asserts the enrolled set — first populated by #351, the shared
 * arrow-routing engine, and grown by every reconciliation ticket and pin bump
 * since — and one asserts that no path on it is enrolled twice (#407).
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { auditReconciled } from '../check-reconciled-files.mjs'
import { RECONCILED_FILES } from '../reconciled-files.mjs'

const bytes = (text) => Buffer.from(text, 'utf8')
const refuse = () => {
  throw new Error('an empty allowlist must not read any file')
}

test('an empty allowlist has nothing to fail on, and reads nothing', () => {
  assert.deepEqual(auditReconciled({ files: [], readInstance: refuse, readAsb: refuse }), [])
})

test('the shipped allowlist is exactly the twenty-one files still shared after the import flip', () => {
  // The list is mirrored here in full, in order, so that changing it is a
  // two-file change somebody has to mean. That mattered most when it was five
  // hundred paths long and growing one ticket at a time; it matters differently
  // now, because the list can only shrink by a file leaving this repository and
  // can only grow by this repository gaining a shared one.
  //
  // `deepEqual` and not set-equality, for the reason it always was: comparing
  // sets discards cardinality, so it passes on a list that enrols the same path
  // twice — which was a real defect once. The duplicate check below closes that
  // hole BESIDE this assertion rather than in place of it.
  assert.deepEqual(RECONCILED_FILES, [
    'tsconfig.json',
    'tsconfig.app.json',
    'components.json',
    'eslint.config.js',
    'tsconfig.node.json',
    'vite.config.ts',
    'scripts/erd-value-sets.mjs',
    'scripts/always-loaded.mjs',
    'scripts/authoring-archivers.mjs',
    'scripts/check-pointers.mjs',
    'scripts/check-router-budget.mjs',
    'scripts/tests/one-badge-one-size.test.mjs',
    'scripts/tests/authoring-log.test.mjs',
    'scripts/check-glossary-only.mjs',
    'scripts/check-negation-ratchet.mjs',
    'scripts/check-target-schema.mjs',
    'scripts/generate-agent-account.mjs',
    'scripts/swept-docs.mjs',
    'scripts/tests/the-router-is-a-router.test.mjs',
    'public/step-visual-placeholder.svg',
    'docs/agents/triage-labels.md',
  ])
})

test('every enrolled path is a file this repository actually has', () => {
  // THE ASSERTION THIS FILE WAS MISSING, and the flip is what made its absence
  // expensive.
  //
  // Every other test here feeds `auditReconciled` readers injected in memory,
  // which is right — they are testing the comparison, and a comparison should
  // be testable without a filesystem. The consequence was that this suite
  // asserted nothing about the filesystem at all: when `src/` was deleted, all
  // 507 enrolled paths under it stopped existing and these eight tests stayed
  // green. `check:reconciled` caught it, loudly, 507 times over — but that is a
  // gate, and a gate catching what a suite cannot see is the wrong way round.
  //
  // A path enrolled here and absent from disk is not a small bookkeeping error.
  // It is a promise about a file nobody is keeping, and it reads exactly like a
  // promise being kept.
  for (const path of RECONCILED_FILES) {
    assert.ok(
      existsSync(new URL(`../../${path}`, import.meta.url)),
      `${path} is enrolled as reconciled but is not in this repository. Either ` +
        `restore it, or remove the entry — an enrolment over a missing file ` +
        `holds nothing.`,
    )
  }
})

test('every enrolled path is a file the package ships too', () => {
  // The other half of the same point. `auditReconciled` already fails on a path
  // the package does not have, and that is the gate; this is the suite saying
  // the shipped list satisfies it today. A release that drops a file this
  // deployment enrolled is a real event — it is how `src/` ended, from the
  // other direction — and it should be visible here rather than only at the
  // gate.
  for (const path of RECONCILED_FILES) {
    assert.ok(
      existsSync(
        new URL(`../../node_modules/agentic-service-blueprinting/${path}`, import.meta.url),
      ),
      `${path} is enrolled as reconciled but the pinned release does not ship ` +
        `it. Run npm ci; if the release really dropped it, the entry goes.`,
    )
  }
})

test('no path is enrolled twice, so removing one entry really un-enrols a file', () => {
  // #407. Three paths were listed twice, each because a later ticket re-listed
  // a path an earlier one had already enrolled, inside its own commented
  // block — the natural mistake, since the blocks are grouped by ticket and a
  // file that two tickets touched reads as belonging in two places.
  //
  // Nothing was ever measured wrongly: the checker compared each of them to
  // asb twice and reached the same verdict both times. What a duplicate breaks
  // is REMOVAL, and removal is the operation this list most needs to keep
  // honest. Delete one occurrence of a doubly-listed path and the file stays
  // enrolled from the other block, silently — so a deliberate un-enrolment
  // reads as done and has not happened. It also inflates the count in the
  // checker's own summary line, which is the number quoted in PR bodies.
  //
  // This is derived from RECONCILED_FILES and from nothing else, on purpose.
  // The `deepEqual` above is duplicate-sensitive and so does notice a new
  // duplicate — but it notices it as a mismatch between two long arrays, and
  // the obvious way to make that mismatch go away is to paste the new line
  // into the expectation as well. That is how all three of the originals
  // arrived. A check that reads only the shipped list cannot be quieted that
  // way.
  const seen = new Set()
  const duplicated = []
  for (const path of RECONCILED_FILES) {
    if (seen.has(path) && !duplicated.includes(path)) duplicated.push(path)
    seen.add(path)
  }
  assert.deepEqual(duplicated, [])
  assert.equal(RECONCILED_FILES.length, seen.size)
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
