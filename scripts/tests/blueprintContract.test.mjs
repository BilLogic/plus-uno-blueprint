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

/**
 * Every migration, concatenated.
 *
 * The first version of these tests read "the newest migration whose filename
 * mentions search_blueprint". That broke the moment a rename happened
 * PROGRAMMATICALLY — layers→lanes rewrote the signature inside a DO block via
 * regexp_replace, so no file contains the new signature literally, and the
 * newest matching FILENAME was three migrations stale.
 *
 * What is actually checkable offline is weaker but honest: a name the contract
 * declares must have been INTRODUCED by some migration. That catches the real
 * failure — a contract naming something the database never had — without
 * pretending to reconstruct the live schema from text.
 */
function allMigrations() {
  const dir = 'supabase/migrations'
  return readdirSync(resolve(REPO_ROOT, dir))
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ file: f, sql: read(`${dir}/${f}`) }))
}

const MIGRATIONS = allMigrations()
const ALL_SQL = MIGRATIONS.map((m) => m.sql).join('\n')

/** True when `name` appears anywhere in the migration history as a whole word. */
function introducedByAMigration(name) {
  return new RegExp(`\\b${name}\\b`).test(ALL_SQL)
}

test('every declared search_blueprint parameter was introduced by a migration', () => {
  for (const param of contractValues('searchBlueprintParams')) {
    assert.ok(
      introducedByAMigration(param),
      `contract declares parameter "${param}" but no migration ever names it. ` +
        `PostgREST binds by name, so uno-bot would send it and Postgres would ignore it — ` +
        `a filter that silently does nothing. Update both, in one window.`,
    )
  }
})

test('no migration renames a declared parameter out from under the contract', () => {
  // A programmatic rename looks like regexp_replace(d, '\\mold\\M', 'new').
  // If `new` is declared but `old` still is too, the contract kept a name the
  // database has moved off.
  const renames = [...ALL_SQL.matchAll(/regexp_replace\([^,]+,\s*'\\\\m(\w+)\\\\M',\s*'(\w+)'/g)]
    .map((m) => ({ from: m[1], to: m[2] }))
  const declared = new Set(contractValues('searchBlueprintParams'))
  for (const { from, to } of renames) {
    if (!declared.has(to)) continue
    assert.ok(
      !declared.has(from),
      `the contract declares both "${from}" and "${to}", but a migration renamed one to the other`,
    )
  }
})

test('every declared search_blueprint output column was introduced by a migration', () => {
  for (const column of contractValues('searchBlueprintColumns')) {
    assert.ok(
      introducedByAMigration(column),
      `contract declares output column "${column}" but no migration ever names it. ` +
        `uno-bot reads this key off the row and would get undefined.`,
    )
  }
})

test('every declared include value is accepted by the function', () => {
  // The guard clause that rejects unknown values is the authoritative list.
  const sql = MIGRATIONS.map((m) => m.sql).find((t) => t.includes("where g not in ('edges'"))
  assert.ok(sql, 'include validation clause not found in any migration')
  const at = sql.indexOf("where g not in ('edges'")
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

test('each embed-hint constraint is a name some migration actually produced', () => {
  // Not "the newest rename migration" — several migrations rename constraints
  // now, and the newest is not necessarily the one that produced THESE. Each
  // name is checked independently against every `rename constraint ... to X`
  // and every `constraint X` across the whole history.
  const produced = new Set([
    ...[...ALL_SQL.matchAll(/rename\s+constraint\s+\S+\s+to\s+(\w+)/gi)].map((m) => m[1]),
    ...[...ALL_SQL.matchAll(/\bconstraint\s+(\w+)/gi)].map((m) => m[1]),
  ])

  for (const name of contractValues('fkConstraints')) {
    assert.ok(
      produced.has(name),
      `contract declares FK constraint "${name}" but no migration produces that name. ` +
        `uno-bot hard-codes it as a PostgREST embed hint, where nothing type-checks it — ` +
        `a mismatch 400s and fetchEdges returns [], which reads in Slack as "no dependencies".`,
    )
  }
})
