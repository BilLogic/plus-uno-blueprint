import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

/**
 * The cross-repo contract is a promise about names that live in SQL, and
 * nothing type-checks that promise on either side.
 *
 * PostgREST binds RPC arguments BY NAME and takes embed hints as STRINGS
 * (`source:cells!cell_triggers_source_cell_id_fkey(content)`). So a migration
 * can rename a parameter or a constraint, both repos still compile, and the
 * only symptom is a 400 the bot swallows into an empty array — which reads in
 * Slack as "this cell has no dependencies" rather than as an error. The bot's
 * own source documents that failure happening twice already.
 *
 * These tests pin `blueprintContract.ts` to the migrations it describes. They
 * are deliberately text-parsed against SQL rather than run against a database:
 * the point is to fail in CI, at the moment the rename is written, not on the
 * first Slack question after deploy.
 */
const REPO_ROOT = process.cwd()

function read(path) {
  return readFileSync(resolve(REPO_ROOT, path), 'utf8')
}

const contract = read('src/lib/blueprintContract.ts')

/** Values of a `key: 'value',` object literal nested under `name: {`. */
function contractValues(name) {
  const at = contract.indexOf(`${name}: {`)
  assert.ok(at !== -1, `${name} not found in blueprintContract.ts`)
  const body = contract.slice(at, contract.indexOf('\n  }', at))
  return [...body.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1])
}

/** The newest migration whose filename contains `needle`. */
function latestMigration(needle) {
  const dir = 'supabase/migrations'
  const hit = readdirSync(resolve(REPO_ROOT, dir))
    .filter((f) => f.includes(needle) && f.endsWith('.sql'))
    .sort()
    .pop()
  assert.ok(hit, `no migration matching "${needle}"`)
  return read(`${dir}/${hit}`)
}

test('every declared search_blueprint parameter exists in the function signature', () => {
  const sql = latestMigration('search_blueprint')
  const at = sql.indexOf('create or replace function public.search_blueprint(')
  assert.ok(at !== -1, 'search_blueprint definition not found')
  const signature = sql.slice(at, sql.indexOf(')\nreturns table', at))

  for (const param of contractValues('searchBlueprintParams')) {
    assert.ok(
      new RegExp(`^\\s*${param}\\s`, 'm').test(signature),
      `contract declares parameter "${param}" but the migration's signature has no such argument. ` +
        `PostgREST binds by name, so uno-bot would send it and Postgres would ignore it — ` +
        `a filter that silently does nothing. Update both, in one window.`,
    )
  }
})

test('every declared search_blueprint output column exists in the returns table', () => {
  const sql = latestMigration('search_blueprint')
  const at = sql.indexOf('returns table (')
  assert.ok(at !== -1, 'returns table not found')
  const returns = sql.slice(at, sql.indexOf(')\n', at))

  for (const column of contractValues('searchBlueprintColumns')) {
    assert.ok(
      new RegExp(`^\\s*${column}\\s`, 'm').test(returns),
      `contract declares output column "${column}" but the RPC does not return it. ` +
        `uno-bot reads this key off the row and would get undefined.`,
    )
  }
})

test('every declared include value is accepted by the function', () => {
  const sql = latestMigration('search_blueprint')
  // The guard clause that rejects unknown values is the authoritative list.
  const at = sql.indexOf("where g not in ('edges'")
  assert.ok(at !== -1, "include validation clause not found")
  const clause = sql.slice(at, sql.indexOf('\n', at))

  for (const value of Object.keys({ edges: 1, findings: 1, slices: 1 })) {
    assert.ok(
      clause.includes(`'${value}'`),
      `contract declares include value "${value}" but the RPC's guard would raise on it`,
    )
  }
})

/**
 * The embed-hint constraints are Postgres DEFAULT names — `<table>_<column>_fkey`,
 * generated implicitly by `references public.cells(id)`. No migration has ever
 * written them down, which is precisely why they are easy to break: rename the
 * table and Postgres renames the constraints with it, silently, and the
 * hard-coded hint string in uno-bot stops matching.
 *
 * Verified against production on 2026-08-20 (`pg_constraint` on
 * `public.cell_triggers`): both names present, both `on delete cascade`.
 *
 * So the rule this test enforces is not "the name appears somewhere" — it is
 * "no migration renames the table without renaming the constraints too."
 */
test('a migration that renames cell_triggers also renames both FK constraints', () => {
  const dir = 'supabase/migrations'
  const files = readdirSync(resolve(REPO_ROOT, dir)).filter((f) => f.endsWith('.sql'))

  for (const file of files) {
    const sql = read(`${dir}/${file}`)
    if (!/alter\s+table\s+(public\.)?cell_triggers\s+rename\s+to/i.test(sql)) continue

    for (const name of contractValues('fkConstraints')) {
      assert.ok(
        new RegExp(`rename\\s+constraint\\s+${name}`, 'i').test(sql),
        `${file} renames cell_triggers but does not rename "${name}". ` +
          `PostgREST embed hints are strings, so uno-bot's fetchEdges would 400 and ` +
          `return [] — Slack then reports "no dependencies" for cells that have them. ` +
          `Rename the constraint in the same migration, and update blueprintContract.ts.`,
      )
    }
  }
})

test('the contract names both cell_triggers embed-hint constraints', () => {
  const names = contractValues('fkConstraints')
  assert.deepEqual(
    [...names].sort(),
    ['cell_triggers_source_cell_id_fkey', 'cell_triggers_target_cell_id_fkey'],
    'uno-bot hard-codes exactly these two hints in fetchEdges; the contract must mirror them',
  )
})
