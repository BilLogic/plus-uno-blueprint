/**
 * One column held three unrelated things, and the series has to end with it
 * gone and the three of them housed.
 *
 * `cells.links` carried 475 resources, 117 touchpoint details and 64
 * provenance citations. The details left in 20260830140000 and 20260830260000;
 * the resources and the citations leave in 20260830280000, and then the column
 * does. This asserts the END STATE of the series, statically, the way
 * `stakeholder-summary.test.mjs` asserts its rename: the replay in
 * `scripts/migration-replay.mjs` is a model of the files, needs no database,
 * and is the only instrument this repository has that can answer "what does
 * the series leave behind".
 *
 * AND EVERY FINDING IS ASSERTED TO GO RED. A check that examined nothing
 * would print the same clean line as this one does — the standing argument in
 * `scripts/tests/rls-posture.test.mjs` — so each assertion below is paired
 * with a replay of a small series that gets it wrong, and the guard has to
 * fail on that series.
 *
 * What this cannot see, and where it is checked instead: whether the CHECK
 * constraints actually fire. A name in a catalogue is not a rule that works.
 * `20260830280000` attempts both halves of `num_nonnulls(cell_id,
 * cell_touchpoint_id) = 1` against the live constraint and fails if either
 * insert is accepted.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { replayMigrations } from '../migration-replay.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)

/** Columns a resource needs before anything can render or edit one. */
const REQUIRED_COLUMNS = [
  'cell_id',
  'cell_touchpoint_id',
  'kind',
  'name',
  'url',
  'position',
  'origin',
]

/**
 * What is wrong with a replayed series' handling of the dissolved column, as
 * sentences.
 *
 * A function rather than inline assertions, because the RED cases below have
 * to run the SAME code the real series runs. A guard proved on a paraphrase
 * of itself is not proved.
 */
export function dissolvedColumnFindings(schema) {
  const findings = []

  const cells = schema.tables.get('cells')
  if (cells?.columns.has('links')) {
    findings.push(
      'cells still has a links column: one column holding resources, touchpoint detail and provenance is the defect this work exists to end',
    )
  }
  if (schema.constraints.has('cells.cells_links_is_array')) {
    findings.push(
      'cells_links_is_array is still declared: the check outlived the column it typed',
    )
  }

  const resources = schema.tables.get('resources')
  if (!resources) {
    findings.push('the series never leaves a public.resources table')
  } else {
    const missing = REQUIRED_COLUMNS.filter((name) => !resources.columns.has(name))
    if (missing.length > 0) {
      findings.push(`resources is missing ${missing.join(', ')}`)
    }
    if (!schema.constraints.has('resources.resources_one_owner')) {
      findings.push(
        'resources has no one-owner constraint: a resource attaching to both a cell and a placement is what the ticket is firm about, and agreement in the client is not enforcement',
      )
    }
  }

  // `evidence.note` is deliberately NOT asserted here. This ticket asked for
  // it, 20260830190000 dropped it first, and
  // `scripts/tests/one-spelling-each.test.mjs` holds it. Two owners for one
  // fact is the shape this batch of work keeps removing.

  return findings
}

/** A throwaway migration series on disk, so the replay is the real replay. */
function seriesOf(...files) {
  const dir = mkdtempSync(join(tmpdir(), 'cell-resources-'))
  files.forEach((sql, index) => {
    writeFileSync(join(dir, `2026083021${index}000_probe.sql`), sql)
  })
  return replayMigrations(dir)
}

const THE_OLD_WORLD = `
create table public.cells (
  id uuid primary key default gen_random_uuid(),
  content text not null default '',
  links jsonb not null default '[]'::jsonb
);
alter table public.cells
  add constraint cells_links_is_array check (jsonb_typeof(links) = 'array');
create table public.cell_touchpoints (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.cells (id)
);
create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text
);
`

const THE_TABLE_WITHOUT_ITS_CONSTRAINT = `
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid references public.cells (id),
  cell_touchpoint_id uuid references public.cell_touchpoints (id),
  kind text not null default 'link',
  name text not null,
  url text,
  position int not null,
  origin text not null
);
`

const THE_REST_OF_IT = `
alter table public.cells drop constraint cells_links_is_array;
alter table public.cells drop column links;
`

test('the migration series dissolves the column into tables that own its contents', () => {
  const schema = replayMigrations(resolve(ROOT, 'supabase/migrations'))
  assert.deepEqual(
    dissolvedColumnFindings(schema),
    [],
    'the series must end with resources housed, citations in evidence, and the column gone',
  )
})

test('and the check goes RED on a series that never dissolves anything', () => {
  const findings = dissolvedColumnFindings(seriesOf(THE_OLD_WORLD))
  assert.equal(findings.length, 3, `expected three findings, got ${findings.join(' / ')}`)
  assert.match(findings[0], /still has a links column/)
  assert.match(findings[1], /cells_links_is_array is still declared/)
  assert.match(findings[2], /never leaves a public.resources table/)
})

test('and RED on the half-done state, where the table exists beside the column', () => {
  // The dangerous one: two homes for the same resource, and a reader picks
  // whichever it finds first. This is what "move the reads and the writes
  // together" means — a state where both exist is a state where a save can
  // land in the one nothing renders.
  const findings = dissolvedColumnFindings(
    seriesOf(THE_OLD_WORLD, THE_TABLE_WITHOUT_ITS_CONSTRAINT),
  )
  assert.equal(findings.length, 3, `expected three findings, got ${findings.join(' / ')}`)
  assert.match(findings[0], /still has a links column/)
  assert.match(findings[2], /no one-owner constraint/)
})

test('and RED on a resources table missing the columns a reader needs', () => {
  const findings = dissolvedColumnFindings(
    seriesOf(
      THE_OLD_WORLD,
      `create table public.resources (
         id uuid primary key default gen_random_uuid(),
         cell_id uuid references public.cells (id),
         name text not null,
         position int not null,
         origin text not null,
         constraint resources_one_owner check (cell_id is not null)
       );`,
      THE_REST_OF_IT,
    ),
  )
  assert.equal(findings.length, 1, `expected one finding, got ${findings.join(' / ')}`)
  assert.match(findings[0], /missing cell_touchpoint_id, kind, url/)
})

test('and RED when only the one-owner constraint is missing', () => {
  const findings = dissolvedColumnFindings(
    seriesOf(THE_OLD_WORLD, THE_TABLE_WITHOUT_ITS_CONSTRAINT, THE_REST_OF_IT),
  )
  assert.equal(findings.length, 1, `expected one finding, got ${findings.join(' / ')}`)
  assert.match(findings[0], /no one-owner constraint/)
})

test('and GREEN once the same series finishes the job', () => {
  assert.deepEqual(
    dissolvedColumnFindings(
      seriesOf(
        THE_OLD_WORLD,
        THE_TABLE_WITHOUT_ITS_CONSTRAINT,
        `alter table public.resources add constraint resources_one_owner
           check (num_nonnulls(cell_id, cell_touchpoint_id) = 1);`,
        THE_REST_OF_IT,
      ),
    ),
    [],
  )
})
