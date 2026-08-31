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
 * aimed at the wrong role, a revoke that arrives before the table exists.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  ANON_WRITE_PRIVILEGES,
  RULE_BEGINS_AT,
  findings,
  migrationFiles,
  tablesCreated,
  tablesRevoked,
} from '../check-new-table-grants.mjs'

const CREATES = `create table public.touchpoints (id uuid primary key);
create table if not exists public.cell_touchpoints (id uuid primary key);`

const REVOKES = `revoke insert, update, delete, truncate on public.touchpoints from anon;
revoke insert, update, delete, truncate on public.cell_touchpoints from anon;`

test('the file that caused the regression is caught', () => {
  const found = findings([{ name: '20260830140000_touchpoints.sql', sql: CREATES }])
  assert.deepEqual(
    found.map((f) => f.table).sort(),
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
  // a table somebody adds long afterwards.
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
  assert.deepEqual(tablesCreated(CREATES).sort(), ['cell_touchpoints', 'touchpoints'])
  assert.deepEqual([...tablesRevoked(REVOKES)].sort(), ['cell_touchpoints', 'touchpoints'])
  // Quoted and unqualified spellings are the same table.
  assert.deepEqual(tablesCreated('create table "public"."foo" (id uuid);'), ['foo'])
  assert.equal(ANON_WRITE_PRIVILEGES.length, 4)
})

test('the real series is green, and every table it creates since the cutoff is named', () => {
  // Against the files themselves, so this fails if someone drops the revoke.
  const files = migrationFiles('supabase/migrations')
  assert.deepEqual(findings(files), [])

  const since = files.filter((f) => f.name.slice(0, RULE_BEGINS_AT.length) >= RULE_BEGINS_AT)
  const created = since.flatMap((f) => tablesCreated(f.sql))
  // Not a census of production — a statement about this series, and the place
  // a new table's author meets the rule. `authoring_changes` (#176) is the
  // first one to arrive after it and revokes on its own line, which is the
  // whole intent: the check failed on its way in, and the fix was a revoke
  // rather than an exemption.
  assert.deepEqual(created.sort(), ['authoring_changes', 'cell_touchpoints', 'touchpoints'])
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

  assert.deepEqual(tablesCreated(prose), ['real_one'])
  // And the commented-out revoke does not count as one either, which is the
  // same rule pointed the other way.
  assert.deepEqual([...tablesRevoked(prose)], ['real_one'])
  assert.deepEqual(findings([{ name: '20260830140000_x.sql', sql: prose }]), [])
})
