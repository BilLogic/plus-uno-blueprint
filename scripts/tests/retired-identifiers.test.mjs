/**
 * The two mechanisms the identifier checks rest on, exercised directly.
 *
 * Both checks are red against `main` today, so their headline assertions
 * cannot be the proof that they work — a check that reported nothing would
 * look identical to a schema that is clean, and a check that reported
 * everything would look identical to a schema that is broken. What is asserted
 * here is the machinery: that a rename leaves the index name behind, that a
 * word-boundary sweep cannot see a word buried in an identifier, that a
 * dropped function comes back open, and that an embed hint three literals into
 * a concatenation is still found.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  definerFunctionsReachableByAnon,
  postgresRegex,
  replayMigrations,
  retiredIdentifiers,
  statements,
} from '../migration-replay.mjs'
import { databaseNames, namedObjects, withoutComments } from '../check-database-names.mjs'

/** A throwaway migration directory, applied in filename order. */
function replay(files) {
  const dir = mkdtempSync(join(tmpdir(), 'replay-'))
  for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql)
  return replayMigrations(dir)
}

test('a table rename leaves every dependent name behind', () => {
  const schema = replay({
    '001_create.sql': `
      create table public.layers (id uuid primary key, path_id uuid references public.paths(id));
      create index layers_path_id_idx on public.layers (path_id);
      create policy "layers_select" on public.layers for select using (true);
      create trigger set_layers_updated_at before update on public.layers execute function f();
      comment on table public.layers is 'One lane of the board';
    `,
    '002_rename.sql': 'alter table public.layers rename to lanes;',
  })
  assert.deepEqual([...schema.tables.keys()], ['lanes'])
  // The table moved. Nothing else did.
  assert.ok(schema.constraints.has('lanes.layers_pkey'))
  assert.ok(schema.constraints.has('lanes.layers_path_id_fkey'))
  assert.equal(schema.indexes.get('layers_path_id_idx').table, 'lanes')
  assert.ok(schema.policies.has('lanes.layers_select'))
  assert.ok(schema.triggers.has('lanes.set_layers_updated_at'))
  // The comment's address follows the table; its text does not change.
  assert.equal(schema.comments.get('table:lanes').text, 'One lane of the board')
})

test('the sweep repaired what it selected, and selected the wrong set', () => {
  // The #143 mechanism, reproduced. `_` is a word constituent in Postgres regex
  // and in JavaScript alike, so `\mservice_scenarios?\M` finds no boundary
  // between `service_scenario` and `_id`. The REPLACEMENT two lines below the
  // selection was written correctly for a case the selection never delivered:
  // seven bodies rewritten, seven expected, migration green.
  assert.equal(postgresRegex('\\mservice_scenarios?\\M', '').test('service_scenario_id'), false)
  assert.equal(postgresRegex('\\mservice_scenarios?\\M', '').test('public.service_scenarios'), true)

  const sweep = `
    do $do$
    declare r record; d text;
    begin
      for r in
        select p.oid from pg_proc p
        where pg_get_functiondef(p.oid) ~ '\\mservice_scenarios?\\M'
      loop
        d := pg_get_functiondef(r.oid);
        d := regexp_replace(d, '\\mservice_scenario_id\\M', 'scenario_id', 'g');
        d := regexp_replace(d, '\\mservice_scenarios\\M',   'scenarios',   'g');
        execute d;
      end loop;
    end
    $do$;
  `
  const schema = replay({
    '001_fn.sql': `
      create function public.names_the_table() returns void language plpgsql as $fn$
      begin
        select p.service_scenario_id from public.service_scenarios p;
      end
      $fn$;
      create function public.names_only_the_column() returns void language plpgsql as $fn$
      begin
        insert into public.steps (service_scenario_id, name) values (1, 'x');
      end
      $fn$;
    `,
    '002_sweep.sql': sweep,
  })

  const selected = schema.functions.get('public.names_the_table').definition
  assert.ok(selected.includes('public.scenarios'), 'the selected body had its table rewritten')
  assert.ok(!selected.includes('service_scenario_id'), 'and its column with it')

  const missed = schema.functions.get('public.names_only_the_column').definition
  assert.ok(
    missed.includes('service_scenario_id'),
    'a body naming only the buried form was never selected, so nothing reached it',
  )
})

test('a dropped function comes back executable by PUBLIC', () => {
  const schema = replay({
    '001_fn.sql': `
      create function public.write_it() returns void security definer language sql as $fn$ select 1 $fn$;
      revoke execute on function public.write_it() from public, anon;
      grant execute on function public.write_it() to authenticated;
    `,
    '002_replace.sql':
      'create or replace function public.write_it() returns void security definer language sql as $fn$ select 2 $fn$;',
  })
  // `create or replace` preserves privileges, so nothing is open yet.
  assert.deepEqual(definerFunctionsReachableByAnon(schema), [])

  const reopened = replay({
    '001_fn.sql': `
      create function public.write_it() returns void security definer language sql as $fn$ select 1 $fn$;
      revoke execute on function public.write_it() from public, anon;
      grant execute on function public.write_it() to authenticated;
    `,
    '002_recreate.sql': `
      drop function public.write_it();
      create function public.write_it() returns void security definer language sql as $fn$ select 2 $fn$;
      grant execute on function public.write_it() to authenticated;
    `,
  })
  // The drop took the revoke with it and the grant restored only half. #147.
  assert.deepEqual(
    definerFunctionsReachableByAnon(reopened).map((one) => one.name),
    ['public.write_it'],
  )
})

test('the graveyard holds names that existed, not words that appear', () => {
  const schema = replay({
    '001.sql': 'create table public.layers (id uuid primary key, layer_role text);',
    '002.sql': `
      alter table public.layers rename to lanes;
      alter table public.lanes rename column layer_role to lane_role;
    `,
  })
  const dead = retiredIdentifiers(schema)
  assert.ok(dead.has('layers'))
  assert.ok(dead.has('layer_role'))
  assert.ok(!dead.has('lane_role'), 'a live name is not in the graveyard')
  assert.ok(!dead.has('layer_map'), 'a local variable was never an identifier here')
})

test('statements survive dollar quoting, comments and quoted semicolons', () => {
  const parsed = statements(`
    -- a comment with a ; in it
    create table t (a text default 'x;y');
    do $do$ begin raise notice 'one; two'; end $do$;
  `)
  assert.equal(parsed.length, 2)
  assert.ok(parsed[0].startsWith('create table'))
  assert.ok(parsed[1].startsWith('do $do$'))
})

test('an embed hint is found however the query string was assembled', () => {
  assert.deepEqual(databaseNames('cells?select=id,phase:phases(name)', 'url'), ['phases', 'cells'])
  // Nested, and with the outer parenthesis already consumed by the previous
  // match — the case `scripts/backfill_cell_keys.mjs:94` is made of.
  assert.deepEqual(databaseNames('phase:phases(lifecycle:service_lifecycles(name))', 'select'), [
    'phases',
    'service_lifecycles',
  ])
  assert.deepEqual(databaseNames('lanes!cells_lane_id_fkey(name)', 'select'), [
    'lanes',
    'cells_lane_id_fkey',
  ])
})

test('a relation named in a comment is not a use of it', () => {
  const code = ["// supabase.from('service_lifecycles')", "supabase.from('services')"].join('\n')
  assert.deepEqual(
    namedObjects(code).map((one) => one.name),
    ['services'],
  )
  assert.ok(withoutComments(code).includes('services'))
})
