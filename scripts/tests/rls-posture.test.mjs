/**
 * The machinery behind `scripts/check-rls-posture.mjs`, exercised directly.
 *
 * The check is GREEN against production, which means its headline result
 * cannot be the evidence that it works: a check that examined nothing would
 * print exactly the same line. What is asserted here is that it goes RED on
 * each shape it exists for — and, first among them, on the shape it is
 * simultaneously exempting.
 *
 * That first test is the one worth reading. `agent_sessions` is in
 * `RLS_POSTURE_EXEMPTIONS`, so a naive exemption would make the check blind to
 * the very policy the exemption was written next to. It does not: the entry
 * swaps the service-gate assertion for an owner-gate assertion rather than
 * removing it, and `for all to authenticated using (true)` fails the second
 * one. An exemption that cannot fail is a comment, and #60 is what a comment
 * is worth.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RENAME_MAP } from '../retired-vocabulary.mjs'
import {
  CATALOG_SQL,
  IDENTITY_GRANTS,
  PANEL_COLUMNS,
  RLS_POSTURE_EXEMPTIONS,
  anonWriteGrants,
  anonWritePolicies,
  authenticatedCanReach,
  columnPostureFindings,
  findings,
  identityGrantFailures,
  keyColumnUpdateGrants,
  ownerGateFailures,
  panelDeclarationFailures,
  rlsDisabled,
  serviceGated,
  unpanelledUpdateGrants,
  wideUpdateGrants,
} from '../check-rls-posture.mjs'

/** A policy row in the shape `pg_policies` returns. */
const policy = (table, name, over) => ({
  table,
  name,
  permissive: 'PERMISSIVE',
  cmd: 'ALL',
  roles: ['authenticated'],
  qual: 'true',
  with_check: 'true',
  ...over,
})

/** Every DML grant a role could hold on a table. */
const dml = (grantee, table) =>
  ['INSERT', 'UPDATE', 'DELETE'].map((privilege) => ({ grantee, table, privilege }))

const table = (name, rls = true) => ({ name, rls_enabled: rls })

/** The four owner policies one agent table carries in production. */
const ownerPolicies = (name, owner) =>
  ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].map((cmd) =>
    policy(name, `${name}_${cmd.toLowerCase()}_own`, {
      cmd,
      qual: cmd === 'INSERT' ? '' : owner,
      with_check: cmd === 'SELECT' || cmd === 'DELETE' ? '' : owner,
    }),
  )

/** Every column `PANEL_COLUMNS` declares for a table, granted to `authenticated`. */
const panelGrants = (name) =>
  (PANEL_COLUMNS[name] ?? []).map((column) => ({ grantee: 'authenticated', table: name, column }))

/**
 * The key columns behind the three `IDENTITY_GRANTS` entries.
 *
 * Read from the catalog in production; hard-coded here, because the point of
 * the exemption tests is what happens when the catalog and the list disagree.
 */
const KEY_COLUMNS = [
  { table: 'agent_sessions', column: 'id', kind: 'primary' },
  { table: 'agent_messages', column: 'session_id', kind: 'foreign' },
  { table: 'lanes', column: 'stakeholder_id', kind: 'foreign' },
]

/** The service-gated pair every blueprint table carries. */
const gatedPolicies = (name) => [
  policy(name, `${name}_write_auth`, { cmd: 'ALL' }),
  policy(name, `${name}_service_only`, {
    permissive: 'RESTRICTIVE',
    cmd: 'ALL',
    qual: 'is_service_account()',
    with_check: 'is_service_account()',
  }),
]

/**
 * Both exempted tables plus `lanes`, healthy.
 *
 * Every fixture starts from this rather than from an empty catalog, because
 * the staleness rules are not optional: an exemption naming a table the
 * catalog does not contain is itself a finding, so a one-table fixture
 * reports the OTHER agent table every time. That is the rule working, and it
 * would drown each of these assertions in noise about the table it is not
 * testing.
 *
 * `lanes` is here for the same reason on the #183 side. It carries the third
 * `IDENTITY_GRANTS` entry — `stakeholder_id`, an association rather than a
 * parent — and that entry has to keep proving itself too, so a catalog
 * without it reports a stale exemption on every assertion below.
 */
const agentBaseline = () => ({
  tables: [table('agent_sessions'), table('agent_messages'), table('lanes')],
  policies: [
    ...ownerPolicies('agent_sessions', 'owns_agent_session(user_id)'),
    ...ownerPolicies('agent_messages', 'owns_agent_session(s.user_id)'),
    ...gatedPolicies('lanes'),
  ],
  grants: [
    ...dml('authenticated', 'agent_sessions'),
    ...dml('authenticated', 'agent_messages'),
    ...dml('authenticated', 'lanes'),
  ],
  tableGrants: [],
  columnUpdateGrants: [
    ...panelGrants('agent_sessions'),
    ...panelGrants('agent_messages'),
    ...panelGrants('lanes'),
  ],
  keyColumns: KEY_COLUMNS,
})

test('the exemption does not hide the policy it was written beside', () => {
  // Verbatim 20260804210000: one policy, for all, to authenticated, using
  // true. This is what shipped, and `agent_sessions` is exempt from the
  // SERVICE gate — so a suppressing exemption reports nothing here.
  const catalog = agentBaseline()
  catalog.policies = [
    ...catalog.policies.filter((one) => one.table !== 'agent_sessions'),
    policy('agent_sessions', 'authenticated manage agent sessions'),
  ]
  const problems = findings(catalog)
  assert.ok(
    problems.length > 0,
    'the pre-#60 blanket policy produced no finding — the exemption is suppressing rather than substituting',
  )
  assert.ok(
    problems.every((p) => /names no owner/.test(p.message)),
    `expected owner-gate failures, got: ${problems.map((p) => p.message).join(' | ')}`,
  )
  // Three commands, the one blanket policy consulted for each of them.
  assert.equal(problems.length, 3)
})

test('the shipped owner policies satisfy the exemption', () => {
  const catalog = agentBaseline()
  assert.deepEqual(findings(catalog), [])
})

test('an exemption whose table stopped taking writes fails until it is deleted', () => {
  // No grants on agent_sessions, so nothing is being suppressed there and the
  // entry is dead weight. This is the rule that stops a list accumulating
  // permissions nobody can evaluate any more.
  const catalog = agentBaseline()
  catalog.grants = catalog.grants.filter((grant) => grant.table !== 'agent_sessions')
  const stale = ownerGateFailures(catalog.tables, catalog.policies, catalog.grants)
  assert.equal(stale.length, 1)
  assert.equal(stale[0].identifier, 'public.agent_sessions')
  assert.match(stale[0].message, /suppresses nothing/)

  const gone = ownerGateFailures([], [], [])
  assert.equal(gone.length, RLS_POSTURE_EXEMPTIONS.length)
  assert.ok(gone.every((finding) => /no such base table/.test(finding.message)))
})

test('RLS off is a finding on its own, however good the policies look', () => {
  const problems = rlsDisabled([table('cells', false), table('lanes', true)])
  assert.deepEqual(problems.map((p) => p.identifier), ['public.cells'])
})

test('a write policy to public or anon is a finding; a read policy to public is not', () => {
  const problems = anonWritePolicies([
    policy('cells', 'cells_select', { cmd: 'SELECT', roles: ['public'] }),
    policy('cells', 'cells_update_public', { cmd: 'UPDATE', roles: ['public'] }),
    policy('cells', 'cells_all_anon', { cmd: 'ALL', roles: ['anon'] }),
    policy('cells', 'cells_update_service', {
      permissive: 'RESTRICTIVE',
      cmd: 'UPDATE',
      roles: ['public'],
    }),
  ])
  assert.deepEqual(problems.map((p) => p.identifier), [
    'public.cells.cells_update_public',
    'public.cells.cells_all_anon',
  ])
})

test('anon write grants are a finding even with no policy anywhere', () => {
  // This is the whole point of assertion 3. Nothing was exploitable when the
  // grants were found, and "not exploitable yet" is the state a check has to
  // fail on if it is to be worth anything before the second gate opens.
  const problems = anonWriteGrants([
    { grantee: 'anon', table: 'cells', privilege: 'SELECT' },
    { grantee: 'anon', table: 'cells', privilege: 'DELETE' },
    { grantee: 'anon', table: 'cells', privilege: 'TRUNCATE' },
    { grantee: 'authenticated', table: 'cells', privilege: 'DELETE' },
  ])
  assert.deepEqual(problems.map((p) => p.identifier), [
    'grant DELETE on public.cells to anon',
    'grant TRUNCATE on public.cells to anon',
  ])
})

test('reachability needs BOTH the grant and a permissive policy', () => {
  const policies = [policy('cells', 'cells_update_auth', { cmd: 'UPDATE' })]
  // The real `paths` shape: grants aplenty, no permissive INSERT policy.
  assert.equal(authenticatedCanReach('cells', 'INSERT', policies, dml('authenticated', 'cells')), false)
  // The real pre-union `cells` shape: a permissive UPDATE policy and no
  // table-level UPDATE grant. Column grants are unioned in by CATALOG_SQL —
  // without them this reads as closed and the gate is never inspected.
  assert.equal(authenticatedCanReach('cells', 'UPDATE', policies, []), false)
  assert.equal(
    authenticatedCanReach('cells', 'UPDATE', policies, dml('authenticated', 'cells')),
    true,
  )
})

test('the catalog query reads column grants, not only table grants', () => {
  assert.match(CATALOG_SQL, /role_column_grants/)
  assert.match(CATALOG_SQL, /role_table_grants/)
})

test('both gate shapes count, and neither is invented', () => {
  // Shape one, the common one: a RESTRICTIVE companion beside `using (true)`.
  const restrictive = [
    policy('cells', 'cells_update_auth', { cmd: 'UPDATE' }),
    policy('cells', 'cells_update_service_only', {
      permissive: 'RESTRICTIVE',
      cmd: 'UPDATE',
      qual: 'is_service_account()',
      with_check: 'is_service_account()',
    }),
  ]
  assert.equal(serviceGated('cells', 'UPDATE', restrictive), true)

  // Shape two: no companion, the call lives inside the permissive policy.
  // Equally closed — and three false findings if the check only knew shape
  // one. `stakeholders` was the table that used it until #174 moved it onto
  // the pair, and the fixture keeps its name because that is the schema this
  // branch was written against.
  const permissiveOnly = [
    policy('stakeholders', 'stakeholders_update_service_only', {
      cmd: 'UPDATE',
      qual: 'is_service_account()',
      with_check: 'is_service_account()',
    }),
  ]
  assert.equal(serviceGated('stakeholders', 'UPDATE', permissiveOnly), true)

  // Two permissive policies where only one carries the gate is NOT gated:
  // permissive policies OR, so the ungated one decides.
  assert.equal(
    serviceGated('stakeholders', 'UPDATE', [
      ...permissiveOnly,
      policy('stakeholders', 'stakeholders_update_anyone', { cmd: 'UPDATE' }),
    ]),
    false,
  )

  // And a restrictive policy that gates on something else does not count.
  assert.equal(
    serviceGated('cells', 'UPDATE', [
      policy('cells', 'cells_update_auth', { cmd: 'UPDATE' }),
      policy('cells', 'cells_update_weekday', {
        permissive: 'RESTRICTIVE',
        cmd: 'UPDATE',
        qual: 'extract(dow from now()) < 6',
        with_check: 'extract(dow from now()) < 6',
      }),
    ]),
    false,
  )
})

test('an ungated write on an unexempted table is a finding', () => {
  const catalog = agentBaseline()
  catalog.tables.push(table('slices'))
  catalog.policies.push(policy('slices', 'slices_update_auth', { cmd: 'UPDATE' }))
  catalog.grants.push(...dml('authenticated', 'slices'))
  // Its panel columns too, or the #183 half reports five undeclared-grant
  // findings about the table this test is not asking about.
  catalog.columnUpdateGrants.push(...panelGrants('slices'))
  assert.deepEqual(findings(catalog).map((p) => p.identifier), ['public.slices UPDATE'])
})

test('every exemption states a reason and names a public table', () => {
  for (const entry of RLS_POSTURE_EXEMPTIONS) {
    assert.match(
      entry.identifier,
      /^public\.[a-z_][a-z0-9_]*$/,
      `${entry.identifier} is not a public.<table> identifier, and that is what the check matches on`,
    )
    assert.ok(
      typeof entry.because === 'string' && entry.because.length > 40,
      `${entry.identifier} has no reason a stranger could evaluate`,
    )
  }
  assert.equal(
    new Set(RLS_POSTURE_EXEMPTIONS.map((entry) => entry.identifier)).size,
    RLS_POSTURE_EXEMPTIONS.length,
    'a duplicated exemption is two claims about one table and only one of them is read',
  )
})

/* ------------------------------------------------------------------- #183 */

/**
 * The column half, held to the same burden of proof as everything above it.
 *
 * The check is meant to be green against a narrowed database, so its headline
 * result cannot be the evidence that it works. Each shape it exists for is
 * shown going RED, and the two the ticket names — a column outside its
 * panel's set, and a foreign key — get a test each.
 */

test('a table-level UPDATE is a finding on its own, however narrow the column list', () => {
  // The shape 20260830290000 swept: `grant update (summary, note, status) on
  // public.paths` sitting beside a table-level UPDATE nobody revoked. Every
  // declared column is granted, so the panel map alone reports nothing — and
  // `authenticated` can still write `scenario_id`.
  const problems = wideUpdateGrants([
    { grantee: 'authenticated', table: 'paths', privilege: 'UPDATE' },
    { grantee: 'authenticated', table: 'paths', privilege: 'INSERT' },
    { grantee: 'anon', table: 'paths', privilege: 'UPDATE' },
  ])
  assert.deepEqual(problems.map((p) => p.identifier), ['public.paths'])
  assert.match(problems[0].message, /covers every column/)
})

test('a granted column outside the panel set is a finding', () => {
  // `paths` writes summary, note and status. `origin` records which side
  // authored the row and is nobody's to edit. This is what a hand-maintained
  // grant list decays into, and nothing else would report it.
  const problems = unpanelledUpdateGrants([
    { grantee: 'authenticated', table: 'paths', column: 'summary' },
    { grantee: 'authenticated', table: 'paths', column: 'origin' },
  ])
  assert.deepEqual(problems.map((p) => p.identifier), ['public.paths.origin'])
  assert.match(problems[0].message, /outside this table's panel/)
})

test('a granted column on a table no panel declares is a finding', () => {
  const problems = unpanelledUpdateGrants([
    { grantee: 'authenticated', table: 'a_table_nobody_declared', column: 'anything' },
  ])
  assert.equal(problems.length, 1)
  assert.match(problems[0].message, /no panel declares the table at all/)
})

test('a granted foreign key is a finding, and an exempted one is not', () => {
  const keys = [
    { table: 'paths', column: 'scenario_id', kind: 'foreign' },
    { table: 'paths', column: 'id', kind: 'primary' },
    { table: 'lanes', column: 'stakeholder_id', kind: 'foreign' },
  ]
  const problems = keyColumnUpdateGrants(
    [
      // The defect #183 describes: reparent a path with a plain update.
      { grantee: 'authenticated', table: 'paths', column: 'scenario_id' },
      { grantee: 'authenticated', table: 'paths', column: 'id' },
      // Content, not identity — and not reported.
      { grantee: 'authenticated', table: 'paths', column: 'summary' },
      // Exempt: an association, asserted in IDENTITY_GRANTS.
      { grantee: 'authenticated', table: 'lanes', column: 'stakeholder_id' },
    ],
    keys,
  )
  assert.deepEqual(problems.map((p) => p.identifier), [
    'public.paths.scenario_id',
    'public.paths.id',
  ])
  assert.match(problems[0].message, /foreign key column/)
  assert.match(problems[1].message, /primary key column/)
})

test('a table-level UPDATE suppresses the per-column noise it would otherwise cause', () => {
  // `role_column_grants` EXPANDS a table grant into one row per column, so a
  // wide table would report one finding per column from both checks above.
  // One grant has one fix, and `wideUpdateGrants` is where it gets named.
  const tableGrants = [{ grantee: 'authenticated', table: 'paths', privilege: 'UPDATE' }]
  const columns = [
    { grantee: 'authenticated', table: 'paths', column: 'origin' },
    { grantee: 'authenticated', table: 'paths', column: 'scenario_id' },
  ]
  const keys = [{ table: 'paths', column: 'scenario_id', kind: 'foreign' }]
  assert.deepEqual(unpanelledUpdateGrants(columns, tableGrants), [])
  assert.deepEqual(keyColumnUpdateGrants(columns, keys, tableGrants), [])
  // Without the wide grant both fire, so the suppression is conditional
  // rather than a hole. Two undeclared columns and one key among them.
  assert.deepEqual(unpanelledUpdateGrants(columns, []).map((p) => p.identifier), [
    'public.paths.origin',
    'public.paths.scenario_id',
  ])
  assert.deepEqual(keyColumnUpdateGrants(columns, keys, []).map((p) => p.identifier), [
    'public.paths.scenario_id',
  ])
})

test('a declared column nobody granted is a finding, on a table that is present', () => {
  const present = [table('scenarios')]
  assert.deepEqual(panelDeclarationFailures([], present).map((p) => p.identifier), [
    'public.scenarios.summary',
  ])
  assert.deepEqual(panelDeclarationFailures(panelGrants('scenarios'), present), [])
  // A table this database has not been migrated up to is NOT a finding: the
  // map is written against the settled schema and the check can be pointed at
  // a database mid-series.
  assert.deepEqual(panelDeclarationFailures([], []), [])
})

test('an identity exemption that stops being granted, or stops being a key, fails', () => {
  const granted = [
    { grantee: 'authenticated', table: 'agent_sessions', column: 'id' },
    { grantee: 'authenticated', table: 'agent_messages', column: 'session_id' },
    { grantee: 'authenticated', table: 'lanes', column: 'stakeholder_id' },
  ]
  assert.deepEqual(identityGrantFailures(granted, KEY_COLUMNS), [])

  // Grant withdrawn: the entry now excuses nothing.
  const withoutLanes = granted.filter((grant) => grant.table !== 'lanes')
  const stale = identityGrantFailures(withoutLanes, KEY_COLUMNS)
  assert.deepEqual(stale.map((p) => p.identifier), ['public.lanes.stakeholder_id'])
  assert.match(stale[0].message, /excuses nothing/)

  // Column stopped being a key: the rule it was written against no longer
  // applies to it, so the entry goes rather than quietly widening.
  const notAKey = identityGrantFailures(
    granted,
    KEY_COLUMNS.filter((key) => key.table !== 'lanes'),
  )
  assert.deepEqual(notAKey.map((p) => p.identifier), ['public.lanes.stakeholder_id'])
  assert.match(notAKey[0].message, /not a primary or foreign key any more/)

  // An empty catalog fails every entry, which is what stops the list
  // surviving a schema it no longer describes.
  assert.equal(identityGrantFailures([], []).length, IDENTITY_GRANTS.length)
})

test('the healthy baseline is clean, and one widened grant takes it red', () => {
  // The composition end to end: `findings` now includes the column half, so
  // this is the check as it actually runs.
  assert.deepEqual(findings(agentBaseline()), [])

  const widened = agentBaseline()
  widened.tableGrants.push({ grantee: 'authenticated', table: 'lanes', privilege: 'UPDATE' })
  assert.deepEqual(findings(widened).map((p) => p.identifier), ['public.lanes'])

  const strayColumn = agentBaseline()
  strayColumn.columnUpdateGrants.push({
    grantee: 'authenticated',
    table: 'lanes',
    column: 'path_id',
  })
  strayColumn.keyColumns = [...KEY_COLUMNS, { table: 'lanes', column: 'path_id', kind: 'foreign' }]
  // Both halves fire, and they are two different statements about one grant:
  // the column is outside the panel's set, AND it is where the lane sits.
  assert.deepEqual(findings(strayColumn).map((p) => p.identifier), [
    'public.lanes.path_id',
    'public.lanes.path_id',
  ])
})

test('columnPostureFindings passes vacuously on nothing, and that is why it is composed', () => {
  // Stated rather than assumed. Every assertion in this half is about what is
  // GRANTED, so an empty catalog reports only the stale exemptions — which is
  // exactly what the last line proves, and why `readCatalog` refuses a
  // catalog with no base tables in it before any of this runs.
  assert.deepEqual(
    columnPostureFindings({}).map((p) => p.identifier),
    IDENTITY_GRANTS.map((entry) => entry.identifier),
  )
})

test('the catalog query reads table grants, column grants and key columns apart', () => {
  assert.match(CATALOG_SQL, /'tableGrants'/)
  assert.match(CATALOG_SQL, /'columnUpdateGrants'/)
  assert.match(CATALOG_SQL, /'keyColumns'/)
  assert.match(CATALOG_SQL, /pg_constraint/)
})

test('every panel declaration and identity exemption is well formed', () => {
  for (const [name, columns] of Object.entries(PANEL_COLUMNS)) {
    assert.match(name, /^[a-z_][a-z0-9_]*$/, `${name} is not a bare table name`)
    assert.ok(Array.isArray(columns), `${name} declares no column list`)
    assert.equal(
      new Set(columns).size,
      columns.length,
      `${name} names a column twice, and only one of them is read`,
    )
    for (const column of columns) {
      assert.match(column, /^[a-z_][a-z0-9_]*$/, `${name}.${column} is not a bare column name`)
    }
  }
  for (const entry of IDENTITY_GRANTS) {
    assert.match(
      entry.identifier,
      /^public\.[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/,
      `${entry.identifier} is not a public.<table>.<column> identifier, and that is what the check matches on`,
    )
    assert.ok(
      typeof entry.because === 'string' && entry.because.length > 40,
      `${entry.identifier} has no reason a stranger could evaluate`,
    )
    // An exemption for a column no panel declares would excuse a grant that
    // assertion 6 rejects anyway — two checks disagreeing about one column,
    // and the reader left to work out which one is the rule.
    const [, name, column] = entry.identifier.split('.')
    assert.ok(
      (PANEL_COLUMNS[name] ?? []).includes(column),
      `${entry.identifier} is exempt from the key-column rule and not declared as a panel column`,
    )
  }
  assert.equal(
    new Set(IDENTITY_GRANTS.map((entry) => entry.identifier)).size,
    IDENTITY_GRANTS.length,
    'a duplicated exemption is two claims about one column and only one of them is read',
  )
})

/** The version of the migration whose VALUES list the map mirrors. */
const GRANT_MIGRATION = '20260830290000'

/**
 * A column the grant migration named under a spelling a LATER migration
 * retired. Postgres moves a column's grants with the column, so the grant
 * still stands under the new name — and the file is frozen text that must not
 * be edited to say so. Read it through the rename map instead: a `was` of the
 * form `table.column` in a row whose migration post-dates the grant becomes
 * its `is`. A `was` whose `is` sits on ANOTHER table is a column that left —
 * Postgres drops a column's grants with it — and comes back as null.
 * Anything else is returned as written.
 */
function renamedSince(entry) {
  for (const row of RENAME_MAP) {
    if (!row.migrations.some((version) => version > GRANT_MIGRATION)) continue
    const at = row.was.indexOf(entry)
    if (at < 0 || !row.is[at]) continue
    return row.is[at].split('.')[0] === entry.split('.')[0] ? row.is[at] : null
  }
  return entry
}

test('the migration and the map agree about every column', () => {
  // Two sources of truth for one fact, and the drift would be silent: the
  // migration fixes the database once, this map is what holds it there, and a
  // column added to one and not the other leaves the check describing a
  // schema nobody applied. `check:rls-posture:live` reads the DATABASE, which
  // is the arbiter — this only catches the two drifting before anyone runs it.
  const sql = readFileSync(
    resolve(
      import.meta.dirname,
      `../../supabase/migrations/${GRANT_MIGRATION}_a_panel_writes_its_own_columns.sql`,
    ),
    'utf8',
  )
  const inMigration = new Set()
  for (const match of sql.matchAll(/^\s*\('([a-z_]+)', '([a-z_]+)'\),?$/gm)) {
    const entry = renamedSince(`${match[1]}.${match[2]}`)
    if (entry !== null) inMigration.add(entry)
  }
  assert.ok(
    inMigration.size > 40,
    'the migration’s VALUES list did not parse, so this comparison is vacuous',
  )

  const inMap = new Set(
    Object.entries(PANEL_COLUMNS).flatMap(([name, columns]) =>
      columns.map((column) => `${name}.${column}`),
    ),
  )
  assert.deepEqual(
    [...inMigration].sort().filter((entry) => !inMap.has(entry)),
    [],
    'the migration grants a column PANEL_COLUMNS does not declare',
  )
  assert.deepEqual(
    [...inMap].sort().filter((entry) => !inMigration.has(entry)),
    [],
    'PANEL_COLUMNS declares a column the migration never grants',
  )
})
