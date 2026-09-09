/**
 * The two mechanisms the identifier checks rest on, exercised directly.
 *
 * Both checks are red against `main` today, so their headline assertions
 * cannot be the proof that they work — a check that reported nothing would
 * look identical to a schema that is clean, and a check that reported
 * everything would look identical to a schema that is broken. What is asserted
 * here is the machinery: that a rename leaves the index name behind, that a
 * word-boundary sweep cannot see a word buried in an identifier, that a
 * dropped function comes back open, that `revoke … from public` leaves the
 * platform's grant to `anon` standing beside it, and that an embed hint three
 * literals into a concatenation is still found.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  authoringSurfaceReachableByAnon,
  postgresRegex,
  replayMigrations,
  retiredIdentifiers,
  statements,
} from '../migration-replay.mjs'
import { databaseNames, namedObjects, withoutComments } from '../check-database-names.mjs'
import { liveFunctionFindings } from '../check-retired-identifiers.mjs'

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
  assert.deepEqual(authoringSurfaceReachableByAnon(schema), [])

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
    authoringSurfaceReachableByAnon(reopened).map((one) => one.name),
    ['public.write_it'],
  )
})

test('revoking PUBLIC leaves the platform grant to anon standing', () => {
  // #572, and the reason the check above passed for three weeks while four
  // functions in production carried `anon`. The revoke is the one every one of
  // those migrations wrote, and it is not the revoke it looks like: on this
  // platform a function created in `public` arrives granted to `anon` too, and
  // `from public` does not reach that.
  const schema = replay({
    '001_fn.sql': `
      create function public.write_it() returns void security definer language sql as $fn$ select 1 $fn$;
      revoke all on function public.write_it() from public;
      grant execute on function public.write_it() to authenticated, service_role;
    `,
  })
  assert.deepEqual(
    authoringSurfaceReachableByAnon(schema).map((one) => [one.name, one.open]),
    [['public.write_it', ['anon']]],
    'PUBLIC is gone and anon is not, which is the whole defect',
  )

  const paired = replay({
    '001_fn.sql': `
      create function public.write_it() returns void security definer language sql as $fn$ select 1 $fn$;
      revoke all on function public.write_it() from public;
      revoke execute on function public.write_it() from anon;
      grant execute on function public.write_it() to authenticated, service_role;
    `,
  })
  assert.deepEqual(authoringSurfaceReachableByAnon(paired), [], 'the paired revoke closes it')
})

test('the platform grant is a fact about `public` and not about every schema', () => {
  // `semantic_search` carries no `pg_default_acl` entry, so a function created
  // there arrives with stock Postgres's EXECUTE TO PUBLIC and nothing else. A
  // model that handed every schema the API roles would invent findings there.
  const schema = replay({
    '001_fn.sql': `
      create schema semantic_search;
      create function semantic_search.chunk() returns void security definer language sql as $fn$ select 1 $fn$;
      revoke all on function semantic_search.chunk() from public;
      grant execute on function semantic_search.chunk() to authenticated;
    `,
  })
  const fn = schema.functions.get('semantic_search.chunk')
  assert.deepEqual([...fn.acl].sort(), ['authenticated'])
})

test('a SECURITY INVOKER function that writes rows is on the surface too', () => {
  // The clause `rename_touchpoint` needed. It escalates nothing — it runs as
  // its caller — but it is an authoring RPC that changes rows, and under a
  // definer-only reading it was not a finding while it held PUBLIC and anon.
  const schema = replay({
    '001_fn.sql': `
      create function public.rename_it(p_id uuid, p_name text) returns void
        security invoker language plpgsql as $fn$
        begin
          update public.touchpoints set name = p_name where id = p_id;
        end
        $fn$;
      create function public.describe_it(p_name text) returns text
        security invoker language sql as $fn$ select upper(p_name) $fn$;
      create function public.stamp_it() returns trigger
        security invoker language plpgsql as $fn$
        begin
          new.updated_at = now();
          return new;
        end
        $fn$;
    `,
  })
  assert.deepEqual(
    authoringSurfaceReachableByAnon(schema).map((one) => [one.name, one.why]),
    [['public.rename_it', 'writes rows as its caller']],
    'the pure function and the trigger stamp write nothing and are not findings',
  )
})

test('a locked row is not a write', () => {
  // `for update` appears in nearly every one of these bodies, on the row the
  // function is about to read. A predicate that took it for a write would call
  // the whole read surface an authoring surface.
  const schema = replay({
    '001_fn.sql': `
      create function public.read_it(p_id uuid) returns text
        security invoker language plpgsql as $fn$
        declare v text;
        begin
          select name into v from public.touchpoints where id = p_id for update;
          return v;
        end
        $fn$;
    `,
  })
  assert.deepEqual(authoringSurfaceReachableByAnon(schema), [])
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

/**
 * The live half's body sweep, which the catalog cannot do for itself.
 *
 * `prosrc ~ 'layer'` is the only thing a `pg_proc` query can ask, and it
 * reported two functions for sentences of English — `sync_cell_resources` for
 * `-- for one layer down.` and `deletion_impact` for a stale comment. Both are
 * prose. The decision moved into JavaScript so that the same `identifierText`
 * governs both halves of the check.
 */
test('a retired word in a function COMMENT is not residue', () => {
  const rows = [
    {
      name: 'sync_cell_resources',
      body: [
        'CREATE OR REPLACE FUNCTION public.sync_cell_resources() RETURNS void AS $function$',
        'begin',
        '  -- for one layer down.',
        '  update public.cells set content = content;',
        'end',
        '$function$',
      ].join('\n'),
    },
  ]
  assert.deepEqual(liveFunctionFindings(rows), [])
})

test('a retired word in a function VARIABLE is residue, addressed like the static half', () => {
  const rows = [
    {
      name: 'duplicate_path',
      body: [
        'CREATE OR REPLACE FUNCTION public.duplicate_path() RETURNS void AS $function$',
        'declare layer_map jsonb;',
        'begin',
        "  layer_map := '{}'::jsonb;",
        'end',
        '$function$',
      ].join('\n'),
    },
  ]
  // The static half's spelling, so an exemption can name it and so the two
  // halves cannot disagree about what one finding is called.
  assert.deepEqual(liveFunctionFindings(rows), ['function duplicate_path body names layer_map'])
})

test('a retired word in a string LITERAL is #144, not this check', () => {
  const rows = [
    {
      name: 'search_blueprint',
      body: [
        'CREATE OR REPLACE FUNCTION public.search_blueprint() RETURNS void AS $function$',
        "begin raise notice 'layer'; end",
        '$function$',
      ].join('\n'),
    },
  ]
  assert.deepEqual(liveFunctionFindings(rows), [])
})
