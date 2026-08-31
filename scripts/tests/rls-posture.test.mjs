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
import {
  CATALOG_SQL,
  RLS_POSTURE_EXEMPTIONS,
  anonWriteGrants,
  anonWritePolicies,
  authenticatedCanReach,
  findings,
  ownerGateFailures,
  rlsDisabled,
  serviceGated,
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

/**
 * Both exempted tables, healthy.
 *
 * Every fixture starts from this rather than from an empty catalog, because
 * the staleness rule is not optional: an exemption naming a table the catalog
 * does not contain is itself a finding, so a one-table fixture reports the
 * OTHER agent table every time. That is the rule working, and it would drown
 * each of these assertions in noise about the table it is not testing.
 */
const agentBaseline = () => ({
  tables: [table('agent_sessions'), table('agent_messages')],
  policies: [
    ...ownerPolicies('agent_sessions', 'owns_agent_session(user_id)'),
    ...ownerPolicies('agent_messages', 'owns_agent_session(s.user_id)'),
  ],
  grants: [...dml('authenticated', 'agent_sessions'), ...dml('authenticated', 'agent_messages')],
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
