/**
 * A stakeholder's definition lives in `summary`, and nothing still calls it a
 * note.
 *
 * THIS IS THE ONE RENAME THE VOCABULARY CHECKS CANNOT CATCH, which is why it
 * gets a file of its own. `scripts/check-retired-identifiers.mjs` matches
 * retired words as SUBSTRINGS of identifiers, and the retired word here is
 * `note` — a word three live columns still carry legitimately (`paths.note`,
 * `cell_dependencies.note`, `findings.note`, each a genuine author's aside).
 * Adding `note` to `RETIRED_IDENTIFIER_FRAGMENTS` would fail the series on all
 * three, and narrowing the fragment to `stakeholders.note` would match nothing
 * at all: that check reads a bare column name, never a qualified one. Either
 * way the guard would be a comment. So the rename is recorded in the map for
 * the person reading it, and enforced here, against the one table it concerns.
 *
 * AND IT IS ASSERTED TO GO RED. A check that examined nothing would print the
 * same clean line as this one does — the standing argument in
 * `scripts/tests/rls-posture.test.mjs` — so every assertion below is paired
 * with a replay of a two-file series that still says `note`, and the guard has
 * to fail on it.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { replayMigrations } from '../migration-replay.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)

/**
 * What is wrong with a replayed series' `stakeholders` table, as sentences.
 *
 * A function rather than three inline assertions, because the RED cases below
 * have to run the SAME code the real series runs. A guard proved on a
 * paraphrase of itself is not proved.
 */
export function definitionColumnFindings(schema) {
  const table = schema.tables.get('stakeholders')
  if (!table) return ['the series never leaves a public.stakeholders table']
  const columns = [...table.columns.keys()]
  const findings = []
  if (!columns.includes('summary')) {
    findings.push(
      'stakeholders has no summary column: the 18 definitions it holds have nowhere named for them',
    )
  }
  if (columns.includes('note')) {
    findings.push(
      'stakeholders still has a note column: `note` is an author\'s aside and every row in this one is a definition',
    )
  }
  return findings
}

/** A throwaway migration series on disk, so the replay is the real replay. */
function seriesOf(...files) {
  const dir = mkdtempSync(join(tmpdir(), 'stakeholder-summary-'))
  files.forEach((sql, index) => {
    writeFileSync(join(dir, `2026083016${index}000_probe.sql`), sql)
  })
  return replayMigrations(dir)
}

const CREATES_NOTE = `
create table public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null,
  name text not null,
  kind text not null,
  note text,
  aliases text[] not null default '{}'
);
`

test('the migration series leaves the definition on stakeholders.summary', () => {
  const schema = replayMigrations(resolve(ROOT, 'supabase/migrations'))
  assert.deepEqual(
    definitionColumnFindings(schema),
    [],
    'stakeholders.summary is what the app now selects and renders; the series must produce it',
  )
})

test('and the check goes RED on a series that never renames the column', () => {
  const findings = definitionColumnFindings(seriesOf(CREATES_NOTE))
  assert.deepEqual(findings.length, 2, `expected both findings, got ${findings.join(' / ')}`)
  assert.match(findings[0], /no summary column/)
  assert.match(findings[1], /still has a note column/)
})

test('and RED on a series that ADDS summary while keeping note', () => {
  // The half-done state is the dangerous one: a reader picks whichever column
  // they find first and the two disagree from the next write onward.
  const findings = definitionColumnFindings(
    seriesOf(CREATES_NOTE, 'alter table public.stakeholders add column summary text;'),
  )
  assert.deepEqual(findings.length, 1, `expected one finding, got ${findings.join(' / ')}`)
  assert.match(findings[0], /still has a note column/)
})

test('and GREEN once the same series renames it, which is what the real one does', () => {
  assert.deepEqual(
    definitionColumnFindings(
      seriesOf(CREATES_NOTE, 'alter table public.stakeholders rename column note to summary;'),
    ),
    [],
  )
})
