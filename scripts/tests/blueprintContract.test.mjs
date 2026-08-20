import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

/**
 * The cross-repo contract is a promise about names that live in SQL, and
 * nothing type-checks that promise on either side.
 *
 * PostgREST binds RPC arguments BY NAME and takes embed hints as STRINGS
 * (`source:cells!cell_dependencies_source_cell_id_fkey(content)`). So a migration
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
 * The embed-hint constraints started life as Postgres DEFAULT names —
 * `<table>_<column>_fkey`, generated implicitly by `references
 * public.cells(id)` and written down in no migration at all. That is precisely
 * why they were easy to break: nothing named them, so nothing noticed them.
 *
 * The `cell_dependencies` → `cell_dependencies` rename made them explicit. The rule
 * enforced here is not "the name appears somewhere" — it is "a migration that
 * renames this table also renames both constraints, and the contract agrees
 * with whatever that migration produced."
 */
test('a migration that renames cell_dependencies also renames both FK constraints', () => {
  const dir = 'supabase/migrations'
  const files = readdirSync(resolve(REPO_ROOT, dir)).filter((f) => f.endsWith('.sql'))

  for (const file of files) {
    const sql = read(`${dir}/${file}`)
    if (!/alter\s+table\s+(public\.)?cell_dependencies\s+rename\s+to/i.test(sql)) continue

    for (const name of contractValues('fkConstraints')) {
      assert.ok(
        new RegExp(`rename\\s+constraint\\s+${name}`, 'i').test(sql),
        `${file} renames cell_dependencies but does not rename "${name}". ` +
          `PostgREST embed hints are strings, so uno-bot's fetchEdges would 400 and ` +
          `return [] — Slack then reports "no dependencies" for cells that have them. ` +
          `Rename the constraint in the same migration, and update blueprintContract.ts.`,
      )
    }
  }
})

test('the contract agrees with the newest rename migration, not with itself', () => {
  // The first version of this test compared the contract to a hard-coded list,
  // which is the contract compared to a copy of itself: it passed while the
  // database had already moved on. The migrations are the only outside witness
  // available offline, so the expectation is derived from them.
  const dir = 'supabase/migrations'
  const renames = readdirSync(resolve(REPO_ROOT, dir))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => read(`${dir}/${f}`))
    .filter((sql) => /rename\s+constraint\s+\S*cell\S*_fkey/i.test(sql))

  assert.ok(renames.length > 0, 'no migration renames a cell-edge FK constraint')
  const newest = renames[renames.length - 1]
  const produced = [...newest.matchAll(/rename\s+constraint\s+\S+\s+to\s+(\S+_fkey)/gi)]
    .map((m) => m[1])
    .sort()

  assert.deepEqual(
    [...contractValues('fkConstraints')].sort(),
    produced,
    'uno-bot hard-codes these two hints in fetchEdges; the contract must name what the migration actually produced',
  )
})
