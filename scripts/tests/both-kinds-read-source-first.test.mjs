#!/usr/bin/env node
/**
 * Which end of an `enables` edge is the precondition — asserted, not assumed.
 *
 * `20260820110000` chose `enables` over `depends_on` for exactly one reason,
 * and stated it in the migration header: the problem was never the word, it
 * was DIRECTION.
 *
 *     A sets_off   B  →  A comes first, A causes B
 *     A depends_on B  →  B comes first, B is required by A
 *
 * Two kinds pointing opposite ways means an edge's direction cannot be read
 * without first checking its kind. `enables` puts both kinds source-first:
 * "Roster has loaded" enables "Greets the student". CONTEXT.md says the same
 * ("both read source-first"), and the panel groups are symmetric because of it.
 *
 * The agent surface said the opposite. `create_cell_dependency` described
 * `enables` as "the target must already be true for the source to work", and
 * `canvas-adapter.md` repeated it — so an agent following either wrote every
 * precondition edge backwards, into a column whose CHECK constraint is happy
 * to store it that way. Nothing failed; the graph was just wrong, and the
 * what-if trace that walks it inherited the error.
 *
 * A prose contradiction between three files is not something a type can catch,
 * so this is the mechanism. It is deliberately about DIRECTION rather than
 * wording: any of the three may be rewritten, and none may say that the target
 * comes first.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = process.cwd()
const read = (path) => readFileSync(resolve(REPO_ROOT, path), 'utf8')

/** Every place that TEACHES the kinds, as opposed to storing them. */
const TEACHING_SURFACES = [
  'CONTEXT.md',
  'src/lib/agent/canvas-adapter.md',
  'src/lib/agent/tools/specs.ts',
]

/**
 * Sentences that put the TARGET first — the inversion, in the shapes it has
 * actually taken. Each is a claim that the far end of the edge is the
 * prerequisite, which is `depends_on` semantics wearing the word `enables`.
 */
const TARGET_FIRST = [
  /the target must already be true/i,
  /target\s+must\s+exist\s+(?:first|before)/i,
  /enables[^.]{0,40}\btarget\s+enables\s+(?:the\s+)?source/i,
]

/** The retired pair for the same distinction (`20260820110000`). */
const RETIRED_DISTINCTION = /\b(?:temporal|functional)\b/i

/** Lines of `source` matching `pattern`, as `file:line — text`. */
export function offendingLines(path, source, pattern) {
  return source
    .split('\n')
    .map((text, index) => ({ text, line: index + 1 }))
    .filter(({ text }) => pattern.test(text))
    .map(({ text, line }) => `${path}:${line} — ${text.trim().slice(0, 100)}`)
}

test('no surface that teaches the kinds puts the target first', () => {
  const offenders = TEACHING_SURFACES.flatMap((path) => {
    const source = read(path)
    return TARGET_FIRST.flatMap((pattern) =>
      offendingLines(path, source, pattern),
    )
  })

  assert.deepEqual(
    offenders,
    [],
    'An `enables` edge runs source → target: the SOURCE is the precondition. ' +
      'A surface saying otherwise teaches an agent to record the graph ' +
      `backwards:\n${offenders.join('\n')}`,
  )
})

test('all three surfaces say source-first out loud', () => {
  // Not merely the absence of the wrong sentence: a file that says nothing
  // about direction passes the rule above while leaving a reader to guess,
  // and guessing is what produced the inversion.
  for (const path of TEACHING_SURFACES) {
    assert.match(
      read(path),
      /source-first/i,
      `${path} teaches the two kinds without saying which end comes first`,
    )
  }
})

test('the retired distinction stays retired', () => {
  // `20260820110000`: "The words temporal and functional are retired from
  // every doc. They named the distinction without making it usable."
  const offenders = TEACHING_SURFACES.flatMap((path) =>
    offendingLines(path, read(path), RETIRED_DISTINCTION),
  )
  assert.deepEqual(offenders, [], offenders.join('\n'))
})

test('the matcher catches the sentence that shipped, and clears the fix', () => {
  // The exact wording that was live in both files, and its replacement.
  const shipped =
    '"enables" = the target must already be true for the source to work'
  const fixed =
    '"enables" = the source makes the target possible without causing it'

  assert.equal(offendingLines('x', shipped, TARGET_FIRST[0]).length, 1)
  assert.equal(offendingLines('x', fixed, TARGET_FIRST[0]).length, 0)

  // And it is not a sweep for the word "target": the correct sentence uses it.
  assert.equal(
    offendingLines('x', 'the source makes the target possible', TARGET_FIRST[0])
      .length,
    0,
  )
})
