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
    // #271: every resource knows its cell, and a placement's resources are
    // that cell's too. `resources_one_owner` (a cell XOR a placement) is
    // replaced by a composite key: the placement column pairs with the cell
    // column and both point at ONE placement row, so a resource cannot name
    // a placement that sits in a different cell. Agreement in the client is
    // not enforcement, so the pair has to be a constraint.
    if (schema.constraints.has('resources.resources_one_owner')) {
      findings.push(
        'resources still has the one-owner constraint: a placement\u2019s resource must belong to the placement\u2019s cell, not to one or the other',
      )
    }
    if (!schema.constraints.has('resources.resources_placement_in_cell_fkey')) {
      findings.push(
        'resources has no composite key onto (cell_touchpoint_id, cell_id): a resource could name a placement in another cell',
      )
    }
    if (!schema.constraints.has('cell_touchpoints.cell_touchpoints_id_cell_id_key')) {
      findings.push(
        'cell_touchpoints has no (id, cell_id) key for the composite reference to land on',
      )
    }
    if (!resources.columns.has('featured')) {
      findings.push('resources has no featured column')
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

/** #271: the cell owns every resource; a placement's pair to one placement row. */
const THE_CELL_OWNS_THEM = `
alter table public.resources add column featured boolean not null default false;
alter table public.resources alter column cell_id set not null;
alter table public.cell_touchpoints
  add constraint cell_touchpoints_id_cell_id_key unique (id, cell_id);
alter table public.resources
  add constraint resources_placement_in_cell_fkey
  foreign key (cell_touchpoint_id, cell_id)
  references public.cell_touchpoints (id, cell_id);
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
  assert.equal(findings.length, 5, `expected five findings, got ${findings.join(' / ')}`)
  assert.match(findings[0], /still has a links column/)
  assert.match(findings[2], /no composite key/)
})

test('and RED on a resources table missing the columns a reader needs', () => {
  const findings = dissolvedColumnFindings(
    seriesOf(
      THE_OLD_WORLD,
      `create table public.resources (
         id uuid primary key default gen_random_uuid(),
         cell_id uuid not null references public.cells (id),
         cell_touchpoint_id uuid,
         name text not null,
         position int not null,
         origin text not null,
         featured boolean not null default false,
         constraint resources_placement_in_cell_fkey
           foreign key (cell_touchpoint_id, cell_id)
           references public.cell_touchpoints (id, cell_id)
       );
       alter table public.cell_touchpoints
         add constraint cell_touchpoints_id_cell_id_key unique (id, cell_id);`,
      THE_REST_OF_IT,
    ),
  )
  assert.equal(findings.length, 1, `expected one finding, got ${findings.join(' / ')}`)
  assert.match(findings[0], /missing kind, url/)
})

test('and RED when the one-owner rule outlives the composite key', () => {
  // The #270 world: a resource is a cell's XOR a placement's. Every reader
  // that asks by cell misses the placement's rows, which is the defect #271
  // exists to end.
  const findings = dissolvedColumnFindings(
    seriesOf(
      THE_OLD_WORLD,
      THE_TABLE_WITHOUT_ITS_CONSTRAINT,
      `alter table public.resources add constraint resources_one_owner
         check (num_nonnulls(cell_id, cell_touchpoint_id) = 1);`,
      THE_REST_OF_IT,
      THE_CELL_OWNS_THEM,
    ),
  )
  assert.equal(findings.length, 1, `expected one finding, got ${findings.join(' / ')}`)
  assert.match(findings[0], /still has the one-owner constraint/)
})

test('and RED when only the composite key is missing', () => {
  const findings = dissolvedColumnFindings(
    seriesOf(
      THE_OLD_WORLD,
      THE_TABLE_WITHOUT_ITS_CONSTRAINT,
      THE_REST_OF_IT,
      `alter table public.resources add column featured boolean not null default false;
       alter table public.cell_touchpoints
         add constraint cell_touchpoints_id_cell_id_key unique (id, cell_id);`,
    ),
  )
  assert.equal(findings.length, 1, `expected one finding, got ${findings.join(' / ')}`)
  assert.match(findings[0], /no composite key/)
})

test('and GREEN once the same series finishes the job', () => {
  assert.deepEqual(
    dissolvedColumnFindings(
      seriesOf(
        THE_OLD_WORLD,
        THE_TABLE_WITHOUT_ITS_CONSTRAINT,
        THE_REST_OF_IT,
        THE_CELL_OWNS_THEM,
      ),
    ),
    [],
  )
})
