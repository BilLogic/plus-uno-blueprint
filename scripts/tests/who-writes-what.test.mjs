#!/usr/bin/env node
/**
 * Who owns each record about the board — checked against the write surface.
 *
 * `evidence`, `audit_findings`, `slices` and `slides` have had two collective
 * nouns and lost both, because no one word was true of all four. What replaced
 * the noun is an OWNER per record, and that claim is not a preference: a
 * table's owner is whoever may CHANGE it, and the set of things that may
 * change it is `WRITE_TOOL_NAMES` — the same roster `check:write-surface`
 * already holds the served adapter against, read here through that guard's own
 * `declaredTools` rather than a second parser of the same file.
 *
 * Three rules:
 *
 *   1. every tool the table names is on the write roster — a renamed or
 *      deleted tool fails here rather than leaving CONTEXT.md quietly wrong
 *   2. every write tool that NAMES one of these records is assigned an owner —
 *      a `delete_slice` nobody added to the table fails here
 *   3. CONTEXT.md states the same tools and records, so the documented copy
 *      and the enforced copy cannot drift apart
 *
 * The SUBJECT of rule 2 is the tool NAME, and that limit is deliberate: a tool
 * called `refresh_board` that happened to write `slices` would pass. The name
 * is what a reader of the roster has, what a table actually writes is
 * `check:write-surface`'s subject, and reimplementing that scan here would be
 * a second reader to drift from the first.
 *
 * `evidence` sits in the table with the owner **nobody**. That is not an
 * unclaimed row: it is research provenance, written at import, cited by a
 * slice, weighed by an audit, read by a what-if. An owner column that could
 * not say "nobody" would have forced it onto whichever reader was loudest —
 * which is how *derived layer* and *analysis tier* both went wrong.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { declaredTools } from '../check-write-surface.mjs'

// The runner copies test files into a temp dir, so paths resolve from the
// working directory (npm test runs at the repo root), not from import.meta.
const REPO_ROOT = process.cwd()
const read = (path) => readFileSync(resolve(REPO_ROOT, path), 'utf8')

/**
 * The ownership table, as CONTEXT.md states it.
 *
 * `owner` is prose on purpose — it is the phrase a person should write in a
 * sentence, and "nobody" has to be sayable for the evidence row to be honest.
 */
export const RECORD_OWNERS = [
  {
    records: ['slices', 'slides'],
    tools: ['create_slice', 'update_slice', 'replace_slides'],
    owner: 'the slice',
  },
  {
    records: ['audit_findings'],
    tools: ['create_finding', 'update_finding'],
    owner: 'the audit',
  },
  {
    records: ['evidence'],
    tools: ['create_evidence', 'update_evidence'],
    owner: 'nobody',
  },
]

/** The record words a tool name may carry, and so the rows that claim them. */
const RECORD_WORDS = ['slice', 'slide', 'finding', 'evidence']

/** Tools the table credits that the write roster does not have. */
export function creditedButUnreal(rows, roster) {
  const real = new Set(roster)
  return rows.flatMap((row) => row.tools.filter((tool) => !real.has(tool)))
}

/** Write tools naming one of these records that no row claims. */
export function writesWithNoOwner(rows, roster) {
  const claimed = new Set(rows.flatMap((row) => row.tools))
  return roster
    .filter((tool) => RECORD_WORDS.some((word) => tool.includes(word)))
    .filter((tool) => !claimed.has(tool))
    .sort()
}

// ---------------------------------------------------------------------------
// The matchers
// ---------------------------------------------------------------------------

test('creditedButUnreal names a tool the table invented', () => {
  // The bug: a rename lands in specs.ts, CONTEXT.md keeps the old word, and a
  // reader looking up who owns slices is told to call a tool nobody has.
  const roster = ['create_slice', 'update_slice']
  const rows = [{ records: ['slices'], tools: ['create_slice', 'rename_slice'], owner: 'the slice' }]
  assert.deepEqual(creditedButUnreal(rows, roster), ['rename_slice'])
})

test('writesWithNoOwner names a write nobody claimed', () => {
  // The bug: a new write tool arrives and the table is not extended, so the
  // ownership answer silently stops covering the whole surface — the same way
  // a collective noun stops covering its set.
  const roster = ['create_slice', 'delete_slice', 'update_finding']
  const rows = [{ records: ['slices'], tools: ['create_slice'], owner: 'the slice' }]
  assert.deepEqual(writesWithNoOwner(rows, roster), ['delete_slice', 'update_finding'])
})

test('a write tool that names no record is not this file’s business', () => {
  // The subject, stated by exercising it: four records, not the write surface
  // at large. `upsert_cell` changes a square of the board itself, and the
  // board is owned by the blueprint, which is what all four are about.
  const roster = ['upsert_cell', 'create_phase', 'duplicate_path', 'create_stakeholder']
  assert.deepEqual(writesWithNoOwner(RECORD_OWNERS, roster), [])
})

// ---------------------------------------------------------------------------
// The repository
// ---------------------------------------------------------------------------

const ROSTER = declaredTools(read('src/lib/agent/tools/specs.ts'), 'WRITE_TOOL_NAMES')

test('every tool the ownership table credits is one the agent has', () => {
  const unreal = creditedButUnreal(RECORD_OWNERS, ROSTER)
  assert.deepEqual(
    unreal,
    [],
    'CONTEXT.md credits a write tool that is not on the roster: ' + unreal.join(', '),
  )
})

test('every write tool that names one of these records has an owner', () => {
  const orphans = writesWithNoOwner(RECORD_OWNERS, ROSTER)
  assert.deepEqual(
    orphans,
    [],
    'a write tool touches one of these records and no row says whose it is: ' +
      orphans.join(', '),
  )
})

test('CONTEXT.md states the same table this file enforces', () => {
  const context = read('CONTEXT.md')
  for (const row of RECORD_OWNERS) {
    for (const name of [...row.tools, ...row.records]) {
      assert.ok(
        context.includes(`\`${name}\``),
        `CONTEXT.md's ownership table does not name ${name}`,
      )
    }
    assert.ok(
      context.includes(row.owner),
      `CONTEXT.md does not say the owner "${row.owner}"`,
    )
  }
})
