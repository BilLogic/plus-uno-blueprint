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
 *   3. the TEMPLATE's ownership table PARSES to the rows below — not "the file
 *      mentions these words somewhere", which `slices` and `evidence` would
 *      satisfy from a dozen other paragraphs, but the three rows themselves
 *
 * The SUBJECT of rule 2 is the tool NAME, and that limit is deliberate: a tool
 * called `refresh_board` that happened to write `slices` would pass. The name
 * is what a reader of the roster has, what a table actually writes is
 * `check:write-surface`'s subject, and reimplementing that scan here would be
 * a second reader to drift from the first.
 *
 * THE TABLE IS NOT THIS REPOSITORY'S TO STATE (#566). It is the shared model,
 * defined once in the template's `CONTEXT.md`; this deployment's own glossary
 * points at it rather than keeping a second copy, so rule 3 reads the pinned
 * template's copy and this test holds OUR write roster against THEIR
 * definition. A pin bump that changes the table fails here, which is the same
 * failure this rule always had and now catches it at its source.
 *
 * `evidence` belongs to **the cell**. It read "nobody" for as long as the panel
 * was its only writer, and that was a fact about the roster rather than a
 * position: the moment `create_evidence` and `update_evidence` landed, rule 2
 * demanded a real owner, and the cell is the claim the source grounds. "Nobody"
 * is still a sayable owner — what-if writes no record of its own — it is simply
 * not evidence's answer any more.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { appSource } from '../app-source.mjs'
import { declaredTools } from '../check-write-surface.mjs'
import { PACKAGE } from '../template-pin.mjs'

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
  // The cell is the claim the source grounds — see the template's CONTEXT.md,
  // where this row read "nobody" while the panel was evidence's only writer.
  {
    records: ['evidence'],
    tools: ['create_evidence', 'update_evidence'],
    owner: 'the cell',
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

/**
 * The ownership table as the glossary draws it, parsed back into rows.
 *
 * Parsed rather than searched for. `slices`, `evidence` and the tool names
 * appear in many other paragraphs of that file, so "the document mentions the
 * word" is satisfied by a table that has been mangled — which is exactly the
 * drift this rule is for. The rows are the claim, so the rows are what is read.
 */
export function ownershipTable(markdown) {
  const lines = markdown.split('\n')
  const head = lines.findIndex((line) => line.startsWith('| record | written by | belongs to |'))
  if (head < 0) throw new Error('no ownership table found in the glossary')

  const rows = []
  for (const line of lines.slice(head + 2)) {
    if (!line.startsWith('|')) break
    const cells = line.split('|').slice(1, -1)
    if (cells.length !== 3) throw new Error(`ownership row is not three columns: ${line}`)
    const [records, tools, owner] = cells
    rows.push({
      records: [...records.matchAll(/`([a-z_]+)`/g)].map(([, name]) => name),
      tools: [...tools.matchAll(/`([a-z_]+)`/g)].map(([, name]) => name),
      owner: owner.replaceAll('*', '').trim(),
    })
  }
  return rows
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

test('ownershipTable reads the rows, not the words around them', () => {
  // The bug it catches: these are common words in that file, so a rule that
  // only asked "does CONTEXT.md mention them" stayed green while the table
  // itself said something else.
  const table = [
    '| record | written by | belongs to |',
    '| --- | --- | --- |',
    '| `slices`, `slides` | `create_slice` | the slice |',
    '| `evidence` | `create_evidence` | **nobody** |',
    '',
    'Prose after it mentioning `audit_findings`, which is not a row.',
  ].join('\n')
  assert.deepEqual(ownershipTable(table), [
    { records: ['slices', 'slides'], tools: ['create_slice'], owner: 'the slice' },
    { records: ['evidence'], tools: ['create_evidence'], owner: 'nobody' },
  ])
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

// The roster is the APPLICATION's, and the application is the installed
// package rather than a directory here — the same package whose CONTEXT.md
// rule 3 reads the table out of. So both halves of this check now come from
// upstream and the thing being held is this deployment's own enforcement of
// them. `appSource` names a missing specs.ts rather than letting an
// unreadable roster read as a roster with no write tools in it, which would
// make rules 1 and 2 pass on nothing.
const ROSTER = declaredTools(appSource('lib/agent/tools/specs.ts'), 'WRITE_TOOL_NAMES')

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

test('the template’s table parses to exactly the rows this file enforces', () => {
  // The definition lives upstream (#566), so this reads the pinned template's
  // copy. A pin bump that moves the table fails here rather than leaving this
  // deployment's roster held against a table nobody is looking at.
  assert.deepEqual(ownershipTable(read(`${PACKAGE}/CONTEXT.md`)), RECORD_OWNERS)
})
