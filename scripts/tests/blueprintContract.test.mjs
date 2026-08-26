import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { BLUEPRINT_CONTRACT, CONTRACT_PATH } from '../blueprintContract.mjs'
import { expectedProbeKeys, probeFailures } from '../check-bot-contract-probe.mjs'
import {
  breadcrumbFailure,
  missingColumns,
  undeclaredKinds,
} from '../check-blueprint-contract.mjs'

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

/**
 * Values under a contract key.
 *
 * This used to re-parse the TypeScript with a regexp per call site. A regexp
 * that stops matching returns an empty array, and every loop below would then
 * pass while checking nothing — the exact failure the estate has been pulling
 * out of its guards all week. `scripts/blueprintContract.mjs` evaluates the
 * real literal and throws if it cannot find it.
 */
function contractValues(name) {
  const value = BLUEPRINT_CONTRACT[name]
  assert.ok(value, `${name} not found in ${CONTRACT_PATH}`)
  const values = Array.isArray(value) ? value : Object.values(value)
  assert.ok(values.length > 0, `${name} is empty in ${CONTRACT_PATH}`)
  return values
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

/**
 * The read surface, which nothing checked at all.
 *
 * `publicReadTables` and `botReadTables` arrived with the audit and were pure
 * prose from the day they landed: eleven table names in a TypeScript file, no
 * test, no probe key derived from them, nothing that would notice a rename.
 * The first two coordination bugs in this relationship were both renames.
 */
test('every table on the declared read surface was introduced by a migration', () => {
  for (const table of contractValues('publicReadTables')) {
    assert.ok(
      introducedByAMigration(table),
      `contract declares "${table}" as public-read but no migration ever names it. ` +
        `uno-bot would select from a table that does not exist and get a 404 it ` +
        `logs and swallows.`,
    )
  }
})

test('every bot read is on the public read surface', () => {
  const published = new Set(contractValues('publicReadTables'))
  for (const table of contractValues('botReadTables')) {
    assert.ok(
      published.has(table),
      `"${table}" is declared a bot read but is not in publicReadTables. The bot ` +
        `cannot read what the app does not publish to the anon role, and a table ` +
        `listed only there is invisible to the public-read checks.`,
    )
  }
})

test('every declared RPC name was introduced by a migration', () => {
  for (const rpc of contractValues('rpcs')) {
    // `semantic_search.match_corpus_chunks` is schema-qualified in the
    // contract and bare in its DDL.
    const bare = rpc.split('.').pop()
    assert.ok(
      introducedByAMigration(bare),
      `contract declares RPC "${rpc}" but no migration ever names it`,
    )
  }
})

/**
 * The breadcrumb, in the one place a migration can be held to it.
 *
 * `search_blueprint` builds the cell breadcrumb itself, in SQL, in this repo —
 * so the label sequence a migration produces is checkable offline. The VIEW
 * that feeds the embeddings (`semantic_search.blueprint_chunks_src`) is not:
 * its live definition has diverged from the migration that last wrote it, the
 * `Phase` segment among the differences, because the 2026-08-17 change never
 * became a migration. That is the whole reason
 * `scripts/check-blueprint-contract.mjs` asks the database instead of the SQL.
 */
test('the breadcrumb a migration builds carries the declared labels, in order', () => {
  const withPhase = MIGRATIONS.filter((m) =>
    m.sql.includes(`'${BLUEPRINT_CONTRACT.breadcrumb.labels[0]}: '`),
  )
  assert.ok(
    withPhase.length > 0,
    `no migration builds a breadcrumb starting "${BLUEPRINT_CONTRACT.breadcrumb.labels[0]}: ". ` +
      `Either the label moved or this test stopped finding its subject; both need a look.`,
  )

  const { sql, file } = withPhase.at(-1)
  const start = sql.indexOf(
    `concat_ws('${BLUEPRINT_CONTRACT.breadcrumb.separator}',`,
    sql.indexOf("'cell'::text as knd"),
  )
  assert.ok(
    start !== -1,
    `${file} does not join the cell breadcrumb on ` +
      `${JSON.stringify(BLUEPRINT_CONTRACT.breadcrumb.separator)} — the separator the ` +
      `bot splits on. A different separator makes every citation parse as one segment.`,
  )

  const block = sql.slice(start, sql.indexOf(') as ttl', start))
  const labels = [...block.matchAll(/'([A-Za-z][A-Za-z ]*): '/g)].map((m) => m[1])
  assert.deepEqual(
    labels,
    BLUEPRINT_CONTRACT.breadcrumb.labels,
    `${file} builds breadcrumb labels ${JSON.stringify(labels)}, the contract declares ` +
      `${JSON.stringify(BLUEPRINT_CONTRACT.breadcrumb.labels)}. uno-bot's parseChunkTitle ` +
      `reads segments by label; a renamed one silently drops that field from every citation.`,
  )
})

/**
 * Nothing in the contract is unchecked, and it stays that way.
 *
 * The audit grew `blueprintContract.ts` from 76 lines to 161 and every addition
 * was a constant nobody was holding to anything. The mechanism against a repeat
 * is not a promise to remember: a new top-level key fails here until it names
 * the check that covers it, and the named check has to mention the key.
 */
const COVERAGE = {
  urlParams: {
    by: 'src/lib/urlViewState.ts',
    how: 'the URL layer reads these names directly, so a rename breaks the app’s own tests',
  },
  appUrl: {
    by: 'scripts/check-blueprint-contract.mjs',
    how: 'printed as the subject of every live run, so a wrong origin is visible in the log',
  },
  breadcrumb: {
    by: 'scripts/check-blueprint-contract.mjs',
    how: 'parsed out of the title the live database emits; the migration side is checked above',
  },
  publicReadTables: {
    by: 'scripts/check-blueprint-contract.mjs',
    how: 'one anon select per table against the live database; introduced-by-a-migration above',
  },
  botReadTables: {
    by: 'scripts/check-bot-contract-probe.mjs',
    how: 'each becomes a required table_* probe key on /health/blueprint',
  },
  fkConstraints: {
    by: 'scripts/check-blueprint-contract.mjs',
    how: 'each is sent as a live PostgREST embed hint, which 400s if it does not resolve',
  },
  rpcs: {
    by: 'scripts/check-bot-contract-probe.mjs',
    how: 'searchBlueprint becomes a required rpc_* probe key; both are checked against migrations above',
  },
  searchBlueprintParams: {
    by: 'scripts/check-blueprint-contract.mjs',
    how: 'every name is sent to the live RPC, and a rejected call is bisected to name the offender',
  },
  searchBlueprintColumns: {
    by: 'scripts/check-blueprint-contract.mjs',
    how: 'compared against the keys of a row the live RPC actually returned',
  },
  searchBlueprintInclude: {
    by: 'scripts/check-blueprint-contract.mjs',
    how: 'every include value is requested live, and an unaccounted row kind fails',
  },
}

test('every contract key names the check that covers it, and that check mentions it', () => {
  const keys = Object.keys(BLUEPRINT_CONTRACT)
  assert.deepEqual(
    keys.filter((key) => !(key in COVERAGE)),
    [],
    `these ${CONTRACT_PATH} keys are covered by nothing. Add a check, then claim it ` +
      `here — a constant both repos rely on and neither verifies is how the Phase ` +
      `breadcrumb drifted for two days and the findings column for weeks.`,
  )
  assert.deepEqual(
    Object.keys(COVERAGE).filter((key) => !keys.includes(key)),
    [],
    `COVERAGE claims contract keys that no longer exist`,
  )

  for (const [key, { by }] of Object.entries(COVERAGE)) {
    assert.ok(
      read(by).includes(key),
      `COVERAGE says ${by} covers "${key}", but that file never mentions it. The ` +
        `claim outlived the check.`,
    )
  }
})

/* -------------------------------------------------------------------------
 * The checks' own failure paths, exercised on every run.
 *
 * A guard is only worth its green tick if its red one works. These feed the
 * pure cores of both new checkers the drift they exist to catch, so the day
 * the messages stop firing is a test failure rather than a quiet one.
 * ------------------------------------------------------------------------- */

const HEALTHY_PROBE = {
  ok: true,
  build: 'r73-2026-08-22',
  probes: Object.fromEntries([
    ...expectedProbeKeys().required.map((key) => [key, true]),
    ['select_cells_spec', true],
  ]),
}

test('a healthy /health/blueprint body produces no failures', () => {
  assert.deepEqual(probeFailures(HEALTHY_PROBE), [])
})

test('the probe check fails when the bot stops probing a declared bot read', () => {
  const probes = { ...HEALTHY_PROBE.probes }
  delete probes.table_slices
  const failures = probeFailures({ ...HEALTHY_PROBE, probes })
  assert.ok(
    failures.some((f) => f.includes('table_slices')),
    `a shrinking probe set must fail and name the missing key, got ${JSON.stringify(failures)}`,
  )
})

test('the probe check fails on a false probe, and again when ok:true covers for it', () => {
  const failures = probeFailures({
    ...HEALTHY_PROBE,
    probes: { ...HEALTHY_PROBE.probes, table_findings: false },
  })
  assert.ok(failures.some((f) => f.includes('table_findings')))
  assert.ok(
    failures.some((f) => f.includes('ok:true')),
    `the endpoint reporting ok:true over a failed probe must be its own failure`,
  )
})

test('the probe check fails on a probe the contract does not declare', () => {
  const failures = probeFailures({
    ...HEALTHY_PROBE,
    probes: { ...HEALTHY_PROBE.probes, table_slice_items: true },
  })
  assert.ok(failures.some((f) => f.includes('table_slice_items')))
})

test('the probe check fails on a body that is not a probe response', () => {
  assert.ok(probeFailures('ok').length > 0)
  assert.ok(probeFailures({ ok: true }).some((f) => f.includes('probes')))
})

test('the probe check fails on a breadcrumb echo that disagrees with the contract', () => {
  const failures = probeFailures({
    ...HEALTHY_PROBE,
    breadcrumb: { separator: ' · ', labels: ['Scenario', 'Path', 'Step', 'Layer'] },
  })
  assert.ok(
    failures.some((f) => f.includes('breadcrumb labels')),
    `the cross-repo half of the breadcrumb check must fire once the bot echoes it`,
  )
})

test('the live breadcrumb parser accepts what the database emits today', () => {
  const live =
    'Phase: Application · Scenario: Discovery · Path: Standard (happy) · ' +
    'Step: Discovers PLUS · Layer: Storyboard'
  assert.equal(breadcrumbFailure(live, BLUEPRINT_CONTRACT.breadcrumb), null)
})

test('the live breadcrumb parser catches the 2026-08-17 drift in both directions', () => {
  const fourSegment =
    'Scenario: Discovery · Path: Standard (happy) · Step: Discovers PLUS · Layer: Storyboard'
  assert.match(
    breadcrumbFailure(fourSegment, BLUEPRINT_CONTRACT.breadcrumb),
    /4 breadcrumb segments/,
    'a database that dropped the Phase segment must fail',
  )

  const renamed =
    'Phase: Application · Stage: Discovery · Path: Standard (happy) · ' +
    'Step: Discovers PLUS · Layer: Storyboard'
  assert.match(
    breadcrumbFailure(renamed, BLUEPRINT_CONTRACT.breadcrumb),
    /segment 2 is labelled "Stage"/,
    'a renamed segment must fail and name the position',
  )
})

test('the live breadcrumb parser accepts the Layer alias and nothing else', () => {
  const { breadcrumb } = BLUEPRINT_CONTRACT
  const base = 'Phase: A · Scenario: B · Path: C · Step: D · '
  assert.equal(breadcrumbFailure(`${base}Layer: E`, breadcrumb), null)
  assert.equal(breadcrumbFailure(`${base}Lane: E`, breadcrumb), null)
  assert.match(breadcrumbFailure(`${base}Row: E`, breadcrumb), /segment 5/)
})

test('an empty breadcrumb is a failure, not an absence of evidence', () => {
  assert.match(breadcrumbFailure('', BLUEPRINT_CONTRACT.breadcrumb), /no breadcrumb/)
  assert.match(breadcrumbFailure(undefined, BLUEPRINT_CONTRACT.breadcrumb), /no breadcrumb/)
})

test('the live column check names the columns a row does not carry', () => {
  const declared = BLUEPRINT_CONTRACT.searchBlueprintColumns
  const complete = Object.fromEntries(Object.values(declared).map((c) => [c, null]))
  assert.deepEqual(missingColumns(complete, declared), [])

  delete complete[declared.matchedBy]
  assert.deepEqual(missingColumns(complete, declared), [declared.matchedBy])
  assert.deepEqual(missingColumns(null, declared), Object.values(declared))
})

test('the live kind check accepts declared kinds and fails on a new one', () => {
  const { searchBlueprintInclude: include } = BLUEPRINT_CONTRACT
  const declared = [{ kind: 'cell' }, ...Object.values(include).map((kind) => ({ kind }))]
  assert.deepEqual(undeclaredKinds(declared, include), [])
  assert.deepEqual(undeclaredKinds([...declared, { kind: 'annotation' }], include), ['annotation'])
})
