#!/usr/bin/env node
/**
 * `supabase/schema.reference.sql` describes the CURRENT schema, or it lies.
 *
 * That file's own header is the argument for this test, and it is worth
 * quoting because it turned out to be about the file itself, twice:
 *
 *   "A snapshot regenerated one day before a rename is a snapshot that lies
 *    with a generation stamp on it, which is worse than one that admits it is
 *    old."
 *
 * It was written after the 2026-08-20 snapshot spent six days describing
 * `service_lifecycles` and `propositions` at a database that had neither. The
 * replacement was regenerated on 2026-08-26 — and `20260830190000`,
 * `…170000`, `…270000` and `…280000` landed four days later. Ten names in the
 * DDL went stale the same week the warning about going stale was written.
 *
 * Nothing noticed, and the reason nothing noticed is the interesting part:
 * this file is not dead documentation. `check-write-surface.mjs` READS it to
 * learn which dependency kinds the constraint enforces. A stale snapshot is an
 * input to a live guard.
 *
 * THE SUBJECT IS THE DDL, NOT THE PROSE. Every `--` comment in that file is
 * history — "called the derived layer until 2026-08-26", "renamed FROM
 * service_lifecycles" — and history keeps the spelling it was written with,
 * which is the same rule the migrations follow. So each line is cut at its
 * comment marker and only what precedes it is swept. That is what makes this
 * rule survivable: it can never be satisfied by deleting an explanation.
 *
 * Exemptions come from `check-retired-identifiers.mjs`, deliberately, rather
 * than a second list here. `evidence.proposition_question_key` is a live
 * column whose name contains a retired word, and one guard already argues that
 * case in a sentence a stranger can evaluate. Two lists would drift.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RETIRED_IDENTIFIER_FRAGMENTS } from '../retired-vocabulary.mjs'
import { RETIRED_IDENTIFIER_EXEMPTIONS } from '../check-retired-identifiers.mjs'

const REPO_ROOT = process.cwd()
const SNAPSHOT = 'supabase/schema.reference.sql'

/** Words a snapshot line may carry because a live identifier contains one. */
const ALLOWED_SUBSTRINGS = RETIRED_IDENTIFIER_EXEMPTIONS.map((entry) =>
  // `column evidence.proposition_question_key` → `proposition_question_key`
  entry.identifier.split(/[\s.]/).at(-1),
)

/**
 * Retired identifiers in the DDL of `source`, as `line: text`.
 *
 * `code` is the line up to its comment marker. A `--` comment is history and
 * keeps its spelling; the statement beside it does not.
 */
export function staleDdlLines(source) {
  const findings = []
  source.split('\n').forEach((line, index) => {
    const code = line.split('--')[0].toLowerCase()
    if (!code.trim()) return
    if (ALLOWED_SUBSTRINGS.some((allowed) => code.includes(allowed))) return
    const fragment = RETIRED_IDENTIFIER_FRAGMENTS.find((word) =>
      code.includes(word),
    )
    if (fragment) {
      findings.push(`${index + 1}: ${line.trim().slice(0, 90)}  [${fragment}]`)
    }
  })
  return findings
}

test('the schema snapshot names no identifier the schema has retired', () => {
  const stale = staleDdlLines(
    readFileSync(resolve(REPO_ROOT, SNAPSHOT), 'utf8'),
  )
  assert.deepEqual(
    stale,
    [],
    `${SNAPSHOT} describes columns this database no longer has. It is read by ` +
      `check-write-surface.mjs, so this is a stale INPUT, not just a stale ` +
      `document:\n${stale.join('\n')}`,
  )
})

test('a comment keeps its spelling and the statement beside it does not', () => {
  // The two halves of one line, which is the case that decides whether this
  // rule is survivable: the file has to be able to say what a column USED to
  // be called on the same line that declares what it is called now.
  const source = [
    '-- Called the derived layer until 2026-08-26; picture became frame.',
    '  frame text,  -- was `picture` before 20260830270000',
    '  picture text,',
  ].join('\n')

  assert.deepEqual(staleDdlLines(source), [
    '3: picture text,  [picture]',
  ])
})

test('an exempted live column is not a finding', () => {
  // `evidence.proposition_question_key` contains `proposition`, and the three
  // validation questions genuinely ARE propositions. One guard already makes
  // that argument; this one reuses it rather than restating it.
  assert.deepEqual(
    staleDdlLines("  proposition_question_key text check (proposition_question_key in ('understand')),"),
    [],
  )
  // …and the exemption is a substring rule, not a blanket pardon for the word.
  assert.equal(staleDdlLines('  propositions text,').length, 1)
})

test('the sweep reads every retired fragment, not a hardcoded few', () => {
  // The bug this shape avoids: a guard with its own copy of the word list,
  // which passes forever after the next rename lands somewhere else.
  assert.ok(RETIRED_IDENTIFIER_FRAGMENTS.length >= 15)
  for (const fragment of ['slice_item', 'check_name', 'path_type', 'view_type']) {
    assert.ok(
      RETIRED_IDENTIFIER_FRAGMENTS.includes(fragment),
      `${fragment} left the shared list; this test would stop covering it`,
    )
    assert.equal(staleDdlLines(`  ${fragment} text,`).length, 1)
  }
})
