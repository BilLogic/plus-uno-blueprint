/**
 * The machinery behind `scripts/check-new-table-grants.mjs`, exercised directly.
 *
 * The check is GREEN against the series, so its headline line proves nothing
 * on its own — a check that parsed no `create table` at all would print the
 * same thing. What is asserted here is that it goes RED on the exact file that
 * caused the regression, and on each shape of near-miss that would otherwise
 * read as compliance.
 *
 * The near-misses are the point. Every one of them is something a reviewer
 * would nod at: a revoke that names three privileges instead of four, a revoke
 * aimed at the wrong role, a revoke that arrives before the relation exists,
 * and — the one that actually happened — a relation the parser could not see
 * because it was spelled `create or replace view`.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  ANON_WRITE_PRIVILEGES,
  RULE_BEGINS_AT,
  findings,
  migrationFiles,
  relationsCreated,
  relationsRevoked,
} from '../check-new-table-grants.mjs'

const CREATES = `create table public.touchpoints (id uuid primary key);
create table if not exists public.cell_touchpoints (id uuid primary key);`

const REVOKES = `revoke insert, update, delete, truncate on public.touchpoints from anon;
revoke insert, update, delete, truncate on public.cell_touchpoints from anon;`

test('the file that caused the regression is caught', () => {
  const found = findings([{ name: '20260830140000_touchpoints.sql', sql: CREATES }])
  assert.deepEqual(
    found.map((f) => f.relation).sort(),
    ['cell_touchpoints', 'touchpoints'],
  )
})

test('a later migration in the series covers it', () => {
  // The design decision, asserted: the invariant is that no table reaches the
  // end of the series still granted, not that each file apologises in its own
  // text. Otherwise the fix would be editing an applied migration.
  const found = findings([
    { name: '20260830140000_touchpoints.sql', sql: CREATES },
    { name: '20260830240000_revoke.sql', sql: REVOKES },
  ])
  assert.deepEqual(found, [])
})

test('a revoke that lands before the table does not count', () => {
  // Postgres would refuse it anyway. Accepting it would let one file "cover"
  // a relation somebody adds long afterwards.
  const found = findings([
    { name: '20260828130000_revoke.sql', sql: REVOKES },
    { name: '20260830140000_touchpoints.sql', sql: CREATES },
  ])
  assert.equal(found.length, 2)
})

test('three of the four privileges is not a revoke', () => {
  // The shape that reads as done and is not — and the dropped one is usually
  // TRUNCATE, the only privilege where the grant is the sole gate, because it
  // bypasses RLS entirely.
  const partial = `create table public.touchpoints (id uuid primary key);
revoke insert, update, delete on public.touchpoints from anon;`
  assert.equal(findings([{ name: '20260830140000_x.sql', sql: partial }]).length, 1)
})

test('revoking from the wrong role is not a revoke', () => {
  const wrongRole = `create table public.touchpoints (id uuid primary key);
revoke insert, update, delete, truncate on public.touchpoints from authenticated;`
  assert.equal(findings([{ name: '20260830140000_x.sql', sql: wrongRole }]).length, 1)
})

test('revoke all counts, and so does revoking from a list containing anon', () => {
  const sweeping = `create table public.touchpoints (id uuid primary key);
revoke all on table public.touchpoints from anon, authenticated;`
  assert.deepEqual(findings([{ name: '20260830140000_x.sql', sql: sweeping }]), [])
})

test('migrations written before the rule are not held to it', () => {
  // Thirty files predate the sweep that established this. Failing them for
  // not obeying a decision that had not been made yet would say nothing.
  const old = { name: '20260101000000_early.sql', sql: 'create table public.cells (id uuid);' }
  assert.deepEqual(findings([old]), [])
  assert.ok('20260101000000' < RULE_BEGINS_AT)
})

test('the parsers read what they claim to read', () => {
  assert.deepEqual(relationsCreated(CREATES).sort(), ['cell_touchpoints', 'touchpoints'])
  assert.deepEqual([...relationsRevoked(REVOKES)].sort(), ['cell_touchpoints', 'touchpoints'])
  // Quoted and unqualified spellings are the same relation.
  assert.deepEqual(relationsCreated('create table "public"."foo" (id uuid);'), ['foo'])
  assert.equal(ANON_WRITE_PRIVILEGES.length, 4)
})

test('a view is a relation, and this one is the reason the rule says so', () => {
  // `20260830200000` created `public.trash` with `create or replace view` and
  // revoked nothing. A `create table` parser reads that line and finds no
  // relation at all, so this check stayed green while the platform handed anon
  // four write grants — and `20260830240000` refused to apply to production
  // with `anon still holds 4 write grants in public`.
  const view = `create or replace view public.trash as select 1;`
  assert.deepEqual(relationsCreated(view), ['trash'])
  assert.equal(findings([{ name: '20260830200000_x.sql', sql: view }]).length, 1)

  const covered = [
    { name: '20260830200000_x.sql', sql: view },
    { name: '20260830210000_y.sql', sql: 'revoke insert, update, delete, truncate on public.trash from anon;' },
  ]
  assert.deepEqual(findings(covered), [])
})

test('a materialized view is a relation too', () => {
  const matview = 'create materialized view public.rollup as select 1;'
  assert.deepEqual(relationsCreated(matview), ['rollup'])
})

test('a temporary table is not a relation in public', () => {
  // `20260828121000` — the file that established this rule — opens with
  // `create temporary table anon_select_before`, and a temp relation lives in
  // `pg_temp` and dies with the session. Counting it would make the rule fail
  // on the file that wrote it.
  assert.deepEqual(relationsCreated('create temporary table snapshot as select 1;'), [])
  assert.deepEqual(relationsCreated('create temp table snapshot (id uuid);'), [])
})

test('a revoke naming several relations credits all of them', () => {
  // The spelling a sweep naturally takes. Crediting only the first would fail
  // a file that had done the work.
  const sweep = `revoke insert, update, delete, truncate on
  public.agent_messages,
  public.cells,
  "public"."lanes"
from anon;`
  assert.deepEqual([...relationsRevoked(sweep)].sort(), ['agent_messages', 'cells', 'lanes'])
})

test('the real series is green, and every table it creates since the cutoff is named', () => {
  // Against the files themselves, so this fails if someone drops the revoke.
  const files = migrationFiles('supabase/migrations')
  assert.deepEqual(findings(files), [])

  const since = files.filter((f) => f.name.slice(0, RULE_BEGINS_AT.length) >= RULE_BEGINS_AT)
  const created = since.flatMap((f) => relationsCreated(f.sql))
  // Not a census of production — a statement about this series, and the place
  // a new table's author meets the rule. `authoring_changes` (#176) is the
  // first one to arrive after it and revokes on its own line, which is the
  // whole intent: the check failed on its way in, and the fix was a revoke
  // rather than an exemption.
  assert.deepEqual(created.sort(), [
    'authoring_changes',
    'cell_touchpoints',
    'resources',
    'touchpoints',
    // A VIEW, and the reason this list grew a sixth entry. The rule used to
    // read `create table` and nothing else, so `trash` — the view
    // `20260830200000` creates over `authoring_changes` — was invisible to
    // the check that exists to catch exactly it. The platform grants the API
    // roles on relations, and a view is one.
    'trash',
    'unplaced_touchpoint_details',
  ])
})

test('prose about creating tables does not create a table', () => {
  // This is not hypothetical. `20260830140000`'s header explains that "a
  // failed CREATE TABLE rolls back", and the first version of this check
  // reported a table called `rolls`. A rule that reads comments fires on how
  // carefully someone explained themselves.
  const prose = `-- A failed CREATE TABLE rolls back, so create table public.decoys
-- would be undone with it.
/* revoke insert, update, delete, truncate on public.decoys from anon; */
create table public.real_one (id uuid primary key);
revoke insert, update, delete, truncate on public.real_one from anon;`

  assert.deepEqual(relationsCreated(prose), ['real_one'])
  // And the commented-out revoke does not count as one either, which is the
  // same rule pointed the other way.
  assert.deepEqual([...relationsRevoked(prose)], ['real_one'])
  assert.deepEqual(findings([{ name: '20260830140000_x.sql', sql: prose }]), [])
})
