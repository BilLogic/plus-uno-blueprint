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
  // A programmatic rename looks like: regexp_replace(d, '\mold\M', 'new').
  //
  // Two bugs lived here and both made this test assert nothing. It spelled the
  // word boundary with TWO literal backslashes against SQL that writes one, so
  // it matched 0 of the 17 renames the migrations contain. And it skipped any
  // rename whose new name the contract does not declare — which is precisely
  // the drift it exists to catch: a contract still naming `old` after the
  // database moved to `new` does not declare `new`, so the check walked past
  // the one case that matters.
  //
  // The rule is simpler than the old shape: once a migration renames `from` to
  // `to`, the contract must not name `from`, whatever else it names.
  const renames = [...ALL_SQL.matchAll(/regexp_replace\([^,]+,\s*'\\m(\w+)\\M',\s*'(\w+)'/g)]
    .map((m) => ({ from: m[1], to: m[2] }))
  assert.ok(renames.length > 0, 'no renames parsed — the detector has stopped matching the SQL again')

  const declared = new Set(contractValues('searchBlueprintParams'))
  for (const { from, to } of renames) {
    assert.ok(
      !declared.has(from),
      `the contract declares "${from}", but a migration renamed it to "${to}"`,
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
 * The granularity VALUES, which are a different promise from the parameter
 * NAME and were unmade until 2026-08-26.
 *
 * `searchBlueprintParams` has declared `granularity` since the day the
 * parameter shipped, and `check:contract:live` asserted that the name binds.
 * Neither says anything about the words the guard clause inside the body will
 * accept — so the layers→lanes rename could move every table, column, doc and
 * surface to `lane` while the RPC went on raising on `granularity => 'lane'`
 * and accepting `'layer'`, for six days, with three guards green
 * (plus-uno-blueprint#144).
 */
test('every declared granularity value is accepted by the function', () => {
  // The guard clause that rejects unknown values is the authoritative list, and
  // the NEWEST migration to write one is the one the database ends up running.
  //
  // Matched on the rung list rather than on `where g not in`, because a guard
  // is edited by `replace(d, old, new)` against the live definition and only
  // the list itself appears on both sides of that call. Within a migration the
  // replacement always follows its target, so the LAST occurrence is the one
  // the database is left running.
  const needle = "'phase','scenario','path','step'"
  const { sql, file } = lastMigrationContaining(needle, 'the granularity guard')
  const at = sql.lastIndexOf(needle)
  const clause = sql.slice(at, sql.indexOf('\n', at))

  const { accepted } = BLUEPRINT_CONTRACT.searchBlueprintGranularity
  for (const value of accepted) {
    assert.ok(
      clause.includes(`'${value}'`),
      `${file} builds a granularity guard that would raise on "${value}", which the ` +
        `contract declares as accepted. A caller naming a declared rung gets an ` +
        `exception rather than rows.`,
    )
  }

  // The other direction, which only became checkable once the deprecated list
  // was empty: the guard accepts NOTHING the contract does not declare. While
  // `'layer'` was accepted-but-undeclared-as-current this could not be written,
  // and that asymmetry is what let the retired spelling sit in the guard.
  for (const value of clause.match(/'([a-z_]+)'/g).map((one) => one.slice(1, -1))) {
    assert.ok(
      accepted.includes(value),
      `${file} builds a granularity guard that accepts "${value}", which the contract ` +
        `does not declare. Either the contract is behind the database, or a retired ` +
        `spelling is still being taken.`,
    )
  }
})

/**
 * This test used to hold the two halves of a deprecation apart: a spelling
 * could be accepted-on-input OR an emitted kind, never both, and never both
 * accepted and deprecated at once. 20260827100000 removed the deprecated list,
 * so it has no subject — and a loop over an empty list would keep reporting
 * green while checking nothing.
 *
 * What survives is the rule it was protecting, stated directly: an accepted
 * INPUT value and an emitted KIND are separate vocabularies that happen to
 * overlap. Nothing may be declared as a kind that the guard would refuse on
 * input, because a caller cannot ask for rows it can be handed.
 */
test('every emitted kind is a granularity the RPC would accept, or an include', () => {
  const { accepted } = BLUEPRINT_CONTRACT.searchBlueprintGranularity
  const includes = BLUEPRINT_CONTRACT.searchBlueprintInclude

  for (const kind of BLUEPRINT_CONTRACT.searchBlueprintKinds) {
    assert.ok(
      accepted.includes(kind) || includes.some((one) => one.startsWith(kind)),
      `the contract declares "${kind}" as an emitted kind, but it is neither an ` +
        `accepted granularity nor an include. A caller has no way to ask for it.`,
    )
  }
})

test('every rung the function accepts comes back tagged with its own name', () => {
  // The rung names and the row kinds are the same list by construction: ask for
  // `path` and the row says `kind: 'path'`. Declaring them separately is what
  // makes a drift between the two visible, so the two declarations are held to
  // each other here rather than one being derived from the other.
  assert.deepEqual(
    [...BLUEPRINT_CONTRACT.searchBlueprintKinds].sort(),
    [...BLUEPRINT_CONTRACT.searchBlueprintGranularity.accepted].sort(),
    `the granularities the RPC accepts and the kinds it emits have diverged. uno-bot ` +
      `asks for a rung by one name and reads the answer by the other; a rung that is ` +
      `requestable but comes back under a different tag is invisible to it.`,
  )
})

test('the newest migration to touch the lane rung leaves it emitting a declared kind', () => {
  // Body-only changes to search_blueprint are written as `replace(d, old, new)`
  // against the live definition, so within one migration the replacement always
  // FOLLOWS the fragment it replaces. The last kind literal in the newest
  // migration that names this fragment is therefore the one the database runs.
  const needle = 'l.name, l.lane_role, l.updated_at'
  const { sql, file } = lastMigrationContaining(needle, 'the lane rung kind')
  const emitted = [...sql.matchAll(/select '(\w+)', l\.id, l\.name, l\.lane_role/g)].map((m) => m[1])
  assert.ok(emitted.length > 0, `${file} names the lane rung but tags it with nothing`)

  const last = emitted.at(-1)
  assert.ok(
    BLUEPRINT_CONTRACT.searchBlueprintKinds.includes(last),
    `${file} leaves the lane rung emitting kind "${last}", which the contract does not ` +
      `declare. This is the inversion #144 exists for: rows tagged "layer" beside an ` +
      `output column called "lane".`,
  )
  // There was a second assertion here, that `last` is not a DEPRECATED
  // spelling. It went with the deprecated list in 20260827100000: `'layer'` is
  // no longer accepted on input either, so "not a declared kind" — the
  // assertion above — now covers it exactly.
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
 * The breadcrumb, in both places a migration builds one.
 *
 * There are two, and until 20260826000000 only one of them was checkable here.
 * `search_blueprint` has always built the cell breadcrumb in SQL in this repo.
 * The VIEW that feeds the embeddings, `semantic_search.blueprint_chunks_src`,
 * had not: the 2026-08-17 change that added the `Phase` segment went straight
 * to the database and never became a migration, so the SQL in this repo and
 * the SQL the database ran were different documents and only the database
 * could be asked (plus-uno-blueprint#130). That migration puts the live shape
 * into the series, which is what makes the second test below possible.
 *
 * Both are still text-parsed rather than run: the point is to fail in CI at the
 * moment the rename is written, not on the first Slack question after deploy.
 * `scripts/check-blueprint-contract.mjs` remains the check that asks the live
 * database, because a migration file cannot prove what is actually deployed.
 */

/**
 * Pull the label sequence out of one `concat_ws(sep, 'Label: ' || ..., ...)`
 * expression, given where it starts and the text that closes it.
 *
 * Scoping to a single expression is the whole point. The view repeats the
 * breadcrumb inside its chunk body and then appends seven more labelled fields
 * (Function, Form, Value, Owner, ...), none of which are breadcrumb segments —
 * a scan of the whole file reads all seventeen and reports drift that is not
 * there.
 */
function breadcrumbLabels(sql, file, from, closer, subject) {
  const start = sql.indexOf(`concat_ws('${BLUEPRINT_CONTRACT.breadcrumb.separator}',`, from)
  assert.ok(
    start !== -1 && start < sql.indexOf(closer, from),
    `${file} does not join the ${subject} breadcrumb on ` +
      `${JSON.stringify(BLUEPRINT_CONTRACT.breadcrumb.separator)} — the separator the ` +
      `bot splits on. A different separator makes every citation parse as one segment.`,
  )
  const stop = sql.indexOf(closer, start)
  assert.ok(stop !== -1, `${file} has no ${JSON.stringify(closer)} closing the ${subject} breadcrumb`)
  return [...sql.slice(start, stop).matchAll(/'([A-Za-z][A-Za-z ]*): '/g)].map((m) => m[1])
}

function lastMigrationContaining(needle, what) {
  const matches = MIGRATIONS.filter((m) => m.sql.includes(needle))
  assert.ok(
    matches.length > 0,
    `no migration contains ${JSON.stringify(needle)}, so ${what} has no subject to check. ` +
      `Either it moved or this test stopped finding it; both need a look.`,
  )
  return matches.at(-1)
}

test('the breadcrumb search_blueprint builds carries the declared labels, in order', () => {
  // `'cell'::text as knd` opens the cell branch of the function, which is the
  // only breadcrumb in it that the bot parses.
  const { sql, file } = lastMigrationContaining("'cell'::text as knd", 'the search_blueprint breadcrumb')
  const labels = breadcrumbLabels(sql, file, sql.indexOf("'cell'::text as knd"), ') as ttl', 'cell')
  assert.deepEqual(
    labels,
    BLUEPRINT_CONTRACT.breadcrumb.labels,
    `${file} builds breadcrumb labels ${JSON.stringify(labels)}, the contract declares ` +
      `${JSON.stringify(BLUEPRINT_CONTRACT.breadcrumb.labels)}. uno-bot's parseChunkTitle ` +
      `reads segments by label; a renamed one silently drops that field from every citation.`,
  )
})

test('the breadcrumb the embedding view builds carries the declared labels, in order', () => {
  const needle = 'view semantic_search.blueprint_chunks_src'
  const { sql, file } = lastMigrationContaining(needle, 'the embedding view breadcrumb')
  const labels = breadcrumbLabels(sql, file, sql.lastIndexOf(needle), ') as title', 'embedding view')
  assert.deepEqual(
    labels,
    BLUEPRINT_CONTRACT.breadcrumb.labels,
    `${file} builds the embedding view's title as ${JSON.stringify(labels)}, the contract ` +
      `declares ${JSON.stringify(BLUEPRINT_CONTRACT.breadcrumb.labels)}. This title is what ` +
      `gets embedded and what comes back as a citation, so a changed label is wrong in the ` +
      `index until the next full re-embed.`,
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
  searchBlueprintGranularity: {
    by: 'scripts/check-blueprint-contract.mjs',
    how: 'every accepted value is sent to the live RPC and a rejected one is bisected by name',
  },
  searchBlueprintColumns: {
    by: 'scripts/check-blueprint-contract.mjs',
    how: 'compared against the keys of a row the live RPC actually returned',
  },
  searchBlueprintKinds: {
    by: 'scripts/check-blueprint-contract.mjs',
    how: 'compared against the kinds the live RPC emits when asked for every structural rung',
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
    'Step: Discovers PLUS · Lane: Storyboard'
  assert.equal(breadcrumbFailure(live, BLUEPRINT_CONTRACT.breadcrumb), null)
})

test('the live breadcrumb parser catches the 2026-08-17 drift in both directions', () => {
  const fourSegment =
    'Scenario: Discovery · Path: Standard (happy) · Step: Discovers PLUS · Lane: Storyboard'
  assert.match(
    breadcrumbFailure(fourSegment, BLUEPRINT_CONTRACT.breadcrumb),
    /4 breadcrumb segments/,
    'a database that dropped the Phase segment must fail',
  )

  const renamed =
    'Phase: Application · Stage: Discovery · Path: Standard (happy) · ' +
    'Step: Discovers PLUS · Lane: Storyboard'
  assert.match(
    breadcrumbFailure(renamed, BLUEPRINT_CONTRACT.breadcrumb),
    /segment 2 is labelled "Stage"/,
    'a renamed segment must fail and name the position',
  )
})

/**
 * The alias list is empty, and both halves of that matter.
 *
 * It held `{ lane: ['layer'] }` across #144's crossing, because for the window
 * between the view emitting `Lane: ` and the corpus being re-embedded with it,
 * stored titles and fresh ones disagreed and both had to parse. The re-embed
 * closed the window and the entry went — so `Layer` is now a failure, which is
 * the only way a stale label ever gets reported.
 *
 * The mechanism stays, exercised here against a synthetic contract rather than
 * the live one. An unused code path is how the next rename discovers that its
 * bridge rotted while nobody was crossing it.
 */
test('the retired breadcrumb label is a failure now, and the alias mechanism still works', () => {
  const { breadcrumb } = BLUEPRINT_CONTRACT
  const base = 'Phase: A · Scenario: B · Path: C · Step: D · '

  assert.deepEqual(breadcrumb.aliases, {}, 'no crossing is open, so no alias is owed one')
  assert.equal(breadcrumbFailure(`${base}Lane: E`, breadcrumb), null)
  assert.match(breadcrumbFailure(`${base}Layer: E`, breadcrumb), /segment 5/)
  assert.match(breadcrumbFailure(`${base}Row: E`, breadcrumb), /segment 5/)

  const crossing = { ...breadcrumb, aliases: { lane: ['layer'] } }
  assert.equal(breadcrumbFailure(`${base}Layer: E`, crossing), null)
  assert.equal(breadcrumbFailure(`${base}Lane: E`, crossing), null)
  assert.match(breadcrumbFailure(`${base}Row: E`, crossing), /segment 5/)
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
  const { searchBlueprintInclude: include, searchBlueprintKinds: kinds } = BLUEPRINT_CONTRACT
  const declared = [...kinds, ...Object.values(include)].map((kind) => ({ kind }))
  assert.deepEqual(undeclaredKinds(declared, kinds, include), [])
  assert.deepEqual(
    undeclaredKinds([...declared, { kind: 'annotation' }], kinds, include),
    ['annotation'],
  )
})

test('the live kind check treats a retired input spelling as a stray', () => {
  // The one it could not catch before: the accounted set was written out inside
  // the checker and already said `lane`, while the RPC emitted `layer` — and the
  // two never met, because the only granularity the checker requested was
  // `cell`, which produces no structural rows at all.
  const { searchBlueprintInclude: include, searchBlueprintKinds: kinds } = BLUEPRINT_CONTRACT
  // `'layer'` as a literal, not read from the contract. It used to be read from
  // `searchBlueprintGranularity.deprecated`, which 20260827100000 emptied and
  // then removed — and a loop over an empty list asserts nothing while still
  // reporting green, which is the failure this whole file exists to refuse.
  // The word is the historical case; writing it down keeps the test about it.
  assert.deepEqual(undeclaredKinds([{ kind: 'layer' }], kinds, include), ['layer'])
})
