#!/usr/bin/env node
/**
 * #60 / #136 — the RLS posture of `public`, asked of the database.
 *
 * Two tables spent three weeks outside the service-account tier. `agent_sessions`
 * and `agent_messages` each carried one policy — `for all to authenticated using
 * (true) with check (true)` — while the other seventeen carried 27 RESTRICTIVE
 * companions gating on `is_service_account()`. Nothing compared them. The gap
 * was written down twice (`20260805150000_service_account_tier.sql` calls it a
 * KNOWN GAP; `docs/plans/2026-08-19-004-…-plan.md` calls it "a pre-existing gap
 * … it deserves its own fix regardless") and survived both notices, because a
 * comment is not a control. It stopped being theoretical on 2026-08-07, when an
 * account with `raw_app_meta_data->>'role'` NULL appeared in `auth.users` and
 * could read all 33 sessions and 340 messages.
 *
 * Alongside it, `anon` held INSERT/UPDATE/DELETE on twelve tables and TRUNCATE
 * on nine. None of it was reachable — no permissive write policy names `anon`
 * anywhere — which is precisely the shape that survives review: two gates, one
 * open, and the closed one carrying the whole weight silently.
 *
 * #183 added the second half. RLS answers WHO may write and is silent on
 * WHICH COLUMNS, so thirteen tables handing `authenticated` a table-level
 * UPDATE handed it every foreign key too, and a service account could
 * reparent a path with a plain update while the authoring log recorded
 * nothing. Not a public exposure — `anon` holds no write grant and RLS is on
 * everywhere — an integrity boundary between the app's own two write paths.
 * `20260830290000` narrowed the grants; assertions 5 to 7 are what keep them
 * narrow, because a hand-maintained grant list decays and widening one breaks
 * nothing.
 *
 * WHAT IT ASSERTS, all seven against the live catalog:
 *
 *   1. every base table in `public` has RLS enabled
 *   2. no PERMISSIVE policy for a write command names `anon` or `public`
 *   3. `anon` holds no INSERT/UPDATE/DELETE/TRUNCATE grant in `public`
 *   4. every (table, write command) an authenticated caller can actually reach
 *      — permissive policy AND the matching grant, both — is gated on
 *      `is_service_account()`, either by a RESTRICTIVE companion or by every
 *      permissive policy for that command carrying the call itself
 *      (the companion-less shape is not a finding), OR is named in
 *      `RLS_POSTURE_EXEMPTIONS` below
 *   5. no table in `public` grants `authenticated` a TABLE-level UPDATE — the
 *      grant that covers every column at once, and the shape the platform
 *      keeps producing on every newly created relation
 *   6. every column `authenticated` may UPDATE is named in `PANEL_COLUMNS`,
 *      and every column named there is actually granted
 *   7. no primary or foreign key column is UPDATE-able by `authenticated`,
 *      bar the entries in `IDENTITY_GRANTS`, which prove themselves the same
 *      way the RLS exemptions do
 *
 * THE EXEMPTIONS ARE ASSERTED, NOT GRANTED. The two agent tables are gated per
 * user rather than per tier, because a viewer's own chat is the viewer tier's
 * whole surface — a service gate there would close a confidentiality hole by
 * deleting the feature. An entry in that list therefore does not switch the
 * check off for its table: the table must still prove an OWNER predicate in
 * every permissive write policy, and an entry whose table no longer takes
 * authenticated writes at all fails until someone deletes it. An exemption that
 * cannot go stale is how the last gap lasted three weeks.
 *
 * WHAT IT DELIBERATELY DOES NOT ASSERT, each because the honest version is a
 * different change and a check that half-covers a thing is worse than one that
 * says it does not:
 *
 *   - TRUNCATE granted to `authenticated`, which nine tables still carry
 *     including both agent tables. TRUNCATE bypasses RLS outright, so there the
 *     grant is the only gate — but PostgREST cannot issue it, the grant set is
 *     pre-existing and wide, and revoking it is its own migration. Named here
 *     so it stays visible rather than forgotten.
 *   - VIEWS. `public.evidence_counts` is one, and a view created without
 *     `security_invoker` reads its base tables as the view's owner, bypassing
 *     their RLS entirely. This check has no model of what a view exposes, so it
 *     scopes every assertion to base tables and says so rather than implying
 *     coverage it does not have.
 *   - `anon`'s REFERENCES and TRIGGER grants, which are not DML.
 *   - INSERT column grants. Assertions 5–7 are about UPDATE only, and that is
 *     a decision rather than an omission: a row names its parent when it is
 *     created, so an INSERT into `paths` must reach `scenario_id`. Identity is
 *     chosen once and never changed afterwards, which makes UPDATE the
 *     privilege that reparents and the only one worth modelling. The gate on
 *     inserting is RLS and the RPC tier guard.
 *   - SECURITY DEFINER function ACLs. `check:identifiers` already fails on a
 *     definer function reachable by PUBLIC or anon; two checks owning one
 *     invariant is how they drift apart.
 *   - Whether a predicate is CORRECT. It reads policy TEXT, so
 *     `is_service_account()` and `not is_service_account()` look identical to
 *     it. It proves a gate is present, never that the gate is right.
 *   - Schemas other than `public`. `semantic_search` is RLS-sealed and reached
 *     only through definer functions; `check:contract:live` covers that surface.
 *
 * LIVE ONLY, AND THAT IS NOT A GAP IT MEANS TO CLOSE. There is no static half
 * because there is nothing honest to run one against: per #148 the files in
 * `supabase/migrations/` are not the apply path — the schema goes in over MCP
 * `apply_migration` — so a replay would describe a posture production may never
 * have had. `check:identifiers` states the same disclaimer from the other side.
 * PostgREST does not expose `pg_catalog` to any role either, so this needs a
 * direct connection, and this repository's standing rule is that a privileged
 * database credential never belongs in its CI. It is a manual / staging check,
 * like `check:contract:live` and `check:identifiers:live`, and NOT part of
 * `gates.yml`.
 *
 * It never passes without seeing the database: no credential, no psql, an
 * unreachable host or a catalog that returns no tables each exit non-zero. A
 * guard that exits clean when it cannot see its subject is the failure mode
 * this whole family exists to end.
 *
 * Run: SUPABASE_DB_URL=postgres://… node scripts/check-rls-posture.mjs
 *      (also: npm run check:rls-posture:live)
 */
import { execFileSync } from 'node:child_process'

/** The three DML commands a policy can gate. TRUNCATE is not one — see above. */
export const WRITE_COMMANDS = Object.freeze(['INSERT', 'UPDATE', 'DELETE'])

/** Grants that let a role change rows, for the anon assertion. */
const ANON_WRITE_PRIVILEGES = Object.freeze(['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'])

/**
 * Tables allowed to take authenticated writes without a service gate.
 *
 * Same shape and the same two rules as every other exemption list in this
 * repository — see `scripts/retired-vocabulary.mjs` for the typedef and
 * `scripts/tests/rls-posture.test.mjs` for what keeps this one honest. The
 * difference is that these entries do not merely suppress: `ownerGateFailures`
 * makes each one prove the substitute gate it claims, so the exemption is a
 * DIFFERENT assertion rather than the absence of one.
 *
 * @type {ReadonlyArray<import('./retired-vocabulary.mjs').Exemption>}
 */
export const RLS_POSTURE_EXEMPTIONS = [
  {
    identifier: 'public.agent_sessions',
    because:
      'gated per user, not per tier: canAgent in SupabaseProvider.tsx admits every authenticated session, so a viewer owning their own conversations IS the design — the substitute gate is owns_agent_session(user_id), asserted below',
  },
  {
    identifier: 'public.agent_messages',
    because:
      'the same rule reached through session_id — a message is owned by its session, and a second owner column would be a second thing to keep true',
  },
]

/** Text that counts as the service gate, in a stored policy expression. */
const SERVICE_GATE = /is_service_account\s*\(/
/** Text that counts as an owner gate, for an exempted table. */
const OWNER_GATE = /auth\.uid\s*\(|uid\s*\(\)|owns_agent_session\s*\(/

/* ------------------------------------------------------------------- pure */

/** A policy's `cmd` covers `command` — `ALL` covers every one of them. */
export const covers = (policy, command) => policy.cmd === 'ALL' || policy.cmd === command

/**
 * A policy applies to `role`.
 *
 * `{public}` is not a role in the list, it is every role there is — including
 * `anon`. A membership test that missed that would read `to public` as "nobody
 * in particular", which is the opposite of what it means.
 */
export const appliesTo = (policy, role) =>
  policy.roles.includes('public') || policy.roles.includes(role)

const permissive = (policy) => policy.permissive === 'PERMISSIVE'
const expression = (policy) => `${policy.qual ?? ''} ${policy.with_check ?? ''}`

/** Base tables in `public` running without RLS. */
export function rlsDisabled(tables) {
  return tables
    .filter((table) => !table.rls_enabled)
    .map((table) => ({
      identifier: `public.${table.name}`,
      message:
        `RLS is not enabled, so every policy on it is dead text and every grant ` +
        `is the whole story. alter table public.${table.name} enable row level security;`,
    }))
}

/** Permissive write policies reachable by `anon` or by `public`. */
export function anonWritePolicies(policies) {
  const out = []
  for (const policy of policies) {
    if (!permissive(policy)) continue
    if (!WRITE_COMMANDS.some((command) => covers(policy, command))) continue
    const who = policy.roles.includes('public')
      ? 'public (which is every role, anon included)'
      : policy.roles.includes('anon')
        ? 'anon'
        : null
    if (!who) continue
    out.push({
      identifier: `public.${policy.table}.${policy.name}`,
      message:
        `a PERMISSIVE ${policy.cmd} policy grants to ${who}. The blueprint is ` +
        `anon-READABLE on purpose; nothing is anon-writable, and permissive ` +
        `policies OR, so one of these re-opens the table on its own.`,
    })
  }
  return out
}

/** Write grants `anon` should no longer hold anywhere in `public`. */
export function anonWriteGrants(grants) {
  return grants
    .filter(
      (grant) =>
        (grant.grantee === 'anon' || grant.grantee === 'PUBLIC') &&
        ANON_WRITE_PRIVILEGES.includes(grant.privilege),
    )
    .map((grant) => ({
      identifier: `grant ${grant.privilege} on public.${grant.table} to ${grant.grantee}`,
      message:
        `anon holds a write grant. It is unreachable only for as long as no ` +
        `permissive policy names anon or public — a grant and a policy are two ` +
        `gates, and this is the one that stays open silently ` +
        `(20260828121000_anon_keeps_the_read_and_loses_the_write.sql).`,
    }))
}

/**
 * Whether an authenticated caller can reach `command` on `table` at all.
 *
 * BOTH halves, because either alone is a false positive. A table with a
 * permissive UPDATE policy and no UPDATE grant is closed — `cells` is exactly
 * that for INSERT — and a table with the grant and no permissive policy is
 * closed too, which is how `paths` blocks INSERT while carrying only a
 * restrictive policy for it.
 */
export function authenticatedCanReach(table, command, policies, grants) {
  const granted = grants.some(
    (grant) =>
      grant.table === table &&
      (grant.grantee === 'authenticated' || grant.grantee === 'PUBLIC') &&
      grant.privilege === command,
  )
  if (!granted) return false
  return policies.some(
    (policy) =>
      policy.table === table &&
      permissive(policy) &&
      covers(policy, command) &&
      appliesTo(policy, 'authenticated'),
  )
}

/**
 * Whether `is_service_account()` gates `command` on `table`.
 *
 * Two shapes count, because the schema has used two. The common one is a
 * RESTRICTIVE companion, which ANDs. The other has no companion at all: every
 * PERMISSIVE policy for the command carries the call itself — equally closed,
 * since permissive policies OR and every one of them is gated. A check that
 * only knew the first shape would report three findings on a table that is
 * correctly locked.
 *
 * `stakeholders` was the example of the second shape until #174 moved it onto
 * the pair; `20260830180000` says why, which is that "closed until somebody
 * adds one more permissive policy" is not a posture a schema should rely on.
 * The branch stays because the shape is still valid and still reachable — a
 * table created with three inline-gated policies is a normal thing to write —
 * and deleting it would turn the next one into three false findings.
 */
export function serviceGated(table, command, policies) {
  const forCommand = policies.filter(
    (policy) => policy.table === table && covers(policy, command),
  )
  const restrictive = forCommand.filter((policy) => !permissive(policy))
  if (restrictive.some((policy) => SERVICE_GATE.test(expression(policy)))) return true

  const permissives = forCommand.filter(
    (policy) => permissive(policy) && appliesTo(policy, 'authenticated'),
  )
  return (
    permissives.length > 0 &&
    permissives.every((policy) => SERVICE_GATE.test(expression(policy)))
  )
}

/** The identifier an exemption uses for a table. */
const exemptionFor = (table) =>
  RLS_POSTURE_EXEMPTIONS.find((entry) => entry.identifier === `public.${table}`)

/** Reachable, ungated, unexempted (table, command) pairs. */
export function ungatedWrites(tables, policies, grants) {
  const out = []
  for (const table of tables) {
    for (const command of WRITE_COMMANDS) {
      if (!authenticatedCanReach(table.name, command, policies, grants)) continue
      if (serviceGated(table.name, command, policies)) continue
      if (exemptionFor(table.name)) continue
      out.push({
        identifier: `public.${table.name} ${command}`,
        message:
          `an authenticated caller holds the ${command} grant AND a permissive ` +
          `policy, and nothing gates on is_service_account(). Every other write ` +
          `surface in this schema does. Add the restrictive companion, or add an ` +
          `entry to RLS_POSTURE_EXEMPTIONS naming the gate that replaces it.`,
      })
    }
  }
  return out
}

/**
 * Exemptions that no longer hold, in both directions.
 *
 * An exempted table has to keep PROVING the substitute gate — an owner
 * predicate in every permissive write policy — and it has to still be a table
 * that takes authenticated writes. The second half is the staleness rule: an
 * entry whose subject is gone stops suppressing anything and starts failing, so
 * a list cannot quietly accumulate dead permissions.
 */
export function ownerGateFailures(tables, policies, grants) {
  const out = []
  for (const entry of RLS_POSTURE_EXEMPTIONS) {
    const name = entry.identifier.replace(/^public\./, '')
    if (!tables.some((table) => table.name === name)) {
      out.push({
        identifier: entry.identifier,
        message: `exempted, but no such base table exists in public any more. Delete the entry.`,
      })
      continue
    }
    const reachable = WRITE_COMMANDS.filter((command) =>
      authenticatedCanReach(name, command, policies, grants),
    )
    if (reachable.length === 0) {
      out.push({
        identifier: entry.identifier,
        message:
          `exempted, but an authenticated caller can no longer write to it at all, ` +
          `so the exemption suppresses nothing. Delete the entry.`,
      })
      continue
    }
    for (const command of reachable) {
      const permissives = policies.filter(
        (policy) =>
          policy.table === name &&
          permissive(policy) &&
          covers(policy, command) &&
          appliesTo(policy, 'authenticated'),
      )
      const ungated = permissives.filter((policy) => !OWNER_GATE.test(expression(policy)))
      for (const policy of ungated) {
        out.push({
          identifier: `public.${name}.${policy.name}`,
          message:
            `${entry.identifier} is exempt from the service gate because it gates per ` +
            `USER instead — but this permissive ${policy.cmd} policy names no owner. ` +
            `The exemption's own claim is what failed here, not the rule it replaced.`,
        })
      }
    }
  }
  return out
}

/* ------------------------------------------------- which columns, not who */

/**
 * The columns each table's panel writes — the whole of its UPDATE surface.
 *
 * #183. RLS decides WHO may write and never WHICH COLUMNS, so a table-level
 * UPDATE grant hands `authenticated` every column there is, foreign keys
 * included, and a service account can reparent a path with a plain update
 * while `authoring_changes` records nothing. Thirteen tables were in that
 * state; `20260830290000_a_panel_writes_its_own_columns.sql` narrowed them.
 *
 * This map is what keeps them narrow. The migration fixed the database once;
 * a hand-maintained grant list decays, and the decay is silent because
 * widening a grant breaks nothing.
 *
 * A row here means: a panel writes this column DIRECTLY, or a SECURITY
 * INVOKER function a panel calls SETs it. A SECURITY DEFINER RPC bypasses
 * grants entirely and belongs nowhere in this map — that is the whole point
 * of the boundary.
 *
 * Only UPDATE. A row names its parent when it is created, so INSERT has to
 * reach the foreign keys; identity is chosen once and never changed, which is
 * why UPDATE is the privilege that reparents and the only one modelled here.
 *
 * @type {Readonly<Record<string, ReadonlyArray<string>>>}
 */
export const PANEL_COLUMNS = Object.freeze({
  cells: ['content', 'summary', 'status', 'owner', 'perceived_owner', 'function', 'form', 'value_props'],
  lanes: ['owner_team', 'kpis', 'tools', 'stakeholder_id'],
  phases: ['summary', 'business_impact', 'operational_requirements'],
  scenarios: ['summary'],
  paths: ['summary', 'note', 'status'],
  steps: ['summary'],
  // `entity_examples` granted by 20260902220000, a new column since the sweep
  // (#312) — the panel authors the six per-kind examples in place.
  services: ['summary', 'entity_examples'],
  business_models: ['funding', 'pricing', 'delivery_cost', 'revenue_model', 'partners'],
  stakeholders: ['name', 'kind', 'summary', 'aliases'],
  evidence: ['kind', 'title', 'ref', 'excerpt'],
  audit_findings: ['status', 'severity', 'summary', 'run_id', 'cell_ids', 'cell_keys', 'source'],
  slices: ['title', 'summary', 'kind', 'actor', 'authorship'],
  touchpoints: ['name', 'updated_at'],
  // `screenshot` and `url` left for `resources` in 20260902160000 (#276).
  // `touchpoint_id` and `name` are never a panel's to write: naming a
  // placement's touchpoint is a SECURITY DEFINER RPC (20260902190000).
  cell_touchpoints: ['summary', 'role', 'position', 'updated_at'],
  agent_sessions: ['id', 'title', 'created_at', 'updated_at'],
  agent_messages: ['session_id', 'seq', 'kind', 'payload'],
  // Written only through SECURITY DEFINER RPCs, or only inserted and deleted.
  // Declared with an empty set rather than omitted, because omission would
  // read as "nobody has looked at this table yet" and these have been looked
  // at: `sync_cell_resources` is SECURITY DEFINER behind
  // `is_service_account()` since 20260902130000 (it updates rows in place and
  // the table has no UPDATE surface), and `path_steps`, `cell_dependencies`,
  // `slides` and `authoring_changes` are RPC-only.
  path_steps: [],
  cell_dependencies: [],
  slides: [],
  resources: [],
  authoring_changes: [],
})

/**
 * Key columns a panel may nonetheless UPDATE, each with the reason it is not
 * a reparent.
 *
 * Same doctrine as `RLS_POSTURE_EXEMPTIONS`: asserted, not granted. An entry
 * has to keep being a key column AND keep being granted, so a list cannot
 * accumulate permissions nobody can evaluate any more.
 *
 * @type {ReadonlyArray<import('./retired-vocabulary.mjs').Exemption>}
 */
export const IDENTITY_GRANTS = [
  {
    identifier: 'public.lanes.stakeholder_id',
    because:
      'an association, not a parent — it names who OWNS the lane, and changing it moves no lane anywhere. The lane panel writes it in the same statement as owner_team (laneSpecMutations.ts)',
  },
  {
    identifier: 'public.agent_sessions.id',
    because:
      "PostgREST names every payload column in an upsert's ON CONFLICT DO UPDATE set list, and agent/persistence.ts upserts a session by its own id — the statement sets the column to the value it already holds, and without the grant the chat stops saving",
  },
  {
    identifier: 'public.agent_messages.session_id',
    because:
      'the conflict target of the same upsert, reached through (session_id, seq). A message is owned by its session and never moves between sessions; this grant is what lets the row be written at all',
  },
]

/** Tables `authenticated` holds a TABLE-level UPDATE on — every column at once. */
export function wideUpdateGrants(tableGrants) {
  return tableGrants
    .filter((grant) => grant.grantee === 'authenticated' && grant.privilege === 'UPDATE')
    .map((grant) => ({
      identifier: `public.${grant.table}`,
      message:
        `authenticated holds a TABLE-level UPDATE, which covers every column ` +
        `including the foreign keys that say where a row sits. A column list ` +
        `granted beside it is decoration — a column grant widens an empty ` +
        `privilege, it does not narrow a held one. ` +
        `revoke update on public.${grant.table} from authenticated; then grant ` +
        `back the panel's columns (20260830290000).`,
    }))
}

/** Tables reported wide, whose per-column findings would all say the same thing. */
const wideTables = (tableGrants) =>
  new Set(
    tableGrants
      .filter((grant) => grant.grantee === 'authenticated' && grant.privilege === 'UPDATE')
      .map((grant) => grant.table),
  )

/**
 * Granted UPDATE columns that no panel declares.
 *
 * Tables carrying a table-level UPDATE are skipped, because every column of
 * one is granted and reporting each in turn would bury the single finding
 * that names the cause. The undeclared-column shape this is really for is the
 * quiet one: somebody adds a column to a narrow grant list and nothing else
 * changes.
 */
export function unpanelledUpdateGrants(columnUpdateGrants, tableGrants = []) {
  const wide = wideTables(tableGrants)
  const out = []
  for (const grant of columnUpdateGrants) {
    if (grant.grantee !== 'authenticated') continue
    if (wide.has(grant.table)) continue
    const declared = PANEL_COLUMNS[grant.table]
    out.push(
      declared === undefined
        ? {
            identifier: `public.${grant.table}.${grant.column}`,
            message:
              `authenticated may UPDATE this column and no panel declares the ` +
              `table at all. Add public.${grant.table} to PANEL_COLUMNS naming ` +
              `what its panel writes, or revoke the grant.`,
          }
        : declared.includes(grant.column)
          ? null
          : {
              identifier: `public.${grant.table}.${grant.column}`,
              message:
                `authenticated may UPDATE a column outside this table's panel ` +
                `set (${declared.join(', ') || 'nothing — it is RPC-only'}). ` +
                `Either the panel grew and this map did not, or the grant is ` +
                `wider than the panel.`,
            },
    )
  }
  return out.filter(Boolean)
}

/** The identifier `IDENTITY_GRANTS` uses for a column. */
const identityGrantFor = (table, column) =>
  IDENTITY_GRANTS.find((entry) => entry.identifier === `public.${table}.${column}`)

/**
 * Granted UPDATE columns that are a primary or foreign key.
 *
 * The finding this whole section exists for. A key column is WHERE A ROW
 * SITS, so an update of one is a reparent — the operation the authoring log
 * was built to record and the one a direct table write never reaches.
 */
export function keyColumnUpdateGrants(columnUpdateGrants, keyColumns, tableGrants = []) {
  const wide = wideTables(tableGrants)
  const keys = new Map()
  for (const key of keyColumns) keys.set(`${key.table}.${key.column}`, key.kind)

  const out = []
  for (const grant of columnUpdateGrants) {
    if (grant.grantee !== 'authenticated') continue
    if (wide.has(grant.table)) continue
    const kind = keys.get(`${grant.table}.${grant.column}`)
    if (!kind) continue
    if (identityGrantFor(grant.table, grant.column)) continue
    out.push({
      identifier: `public.${grant.table}.${grant.column}`,
      message:
        `authenticated may UPDATE a ${kind} key column. That is a reparent, ` +
        `and a reparent belongs to the functions that record it — a direct ` +
        `update leaves nothing in authoring_changes. Revoke it, or add an ` +
        `IDENTITY_GRANTS entry saying why moving this column moves nothing.`,
    })
  }
  return out
}

/**
 * Declared columns the database does not actually grant.
 *
 * The staleness half, and the reason this map cannot quietly become a
 * wish-list: an entry nobody granted describes a panel that cannot write.
 * Scoped to tables PRESENT in the catalog, so a declaration for a table this
 * database has not been migrated up to yet is not a finding — the map is
 * written against the settled schema and the database it is asked of may be
 * mid-series.
 */
export function panelDeclarationFailures(columnUpdateGrants, tables) {
  const present = new Set(tables.map((table) => table.name))
  const granted = new Set(
    columnUpdateGrants
      .filter((grant) => grant.grantee === 'authenticated')
      .map((grant) => `${grant.table}.${grant.column}`),
  )
  const out = []
  for (const [table, columns] of Object.entries(PANEL_COLUMNS)) {
    if (!present.has(table)) continue
    for (const column of columns) {
      if (granted.has(`${table}.${column}`)) continue
      out.push({
        identifier: `public.${table}.${column}`,
        message:
          `declared as a panel column and not granted. Either the grant was ` +
          `dropped and the panel is broken, or the column is gone and the ` +
          `entry should be too. A declaration nobody granted describes nothing.`,
      })
    }
  }
  return out
}

/**
 * Identity exemptions that no longer hold, in both directions.
 *
 * An entry must still name a key column and must still be granted. The first
 * half stops the list excusing a column that stopped being identifying; the
 * second stops it excusing a grant nobody holds. An exemption that cannot go
 * stale is a comment.
 */
export function identityGrantFailures(columnUpdateGrants, keyColumns) {
  const keys = new Set(keyColumns.map((key) => `${key.table}.${key.column}`))
  const granted = new Set(
    columnUpdateGrants
      .filter((grant) => grant.grantee === 'authenticated')
      .map((grant) => `${grant.table}.${grant.column}`),
  )
  const out = []
  for (const entry of IDENTITY_GRANTS) {
    const subject = entry.identifier.replace(/^public\./, '')
    if (!granted.has(subject)) {
      out.push({
        identifier: entry.identifier,
        message:
          `exempted, but authenticated no longer holds an UPDATE grant on it, ` +
          `so the exemption excuses nothing. Delete the entry.`,
      })
      continue
    }
    if (!keys.has(subject)) {
      out.push({
        identifier: entry.identifier,
        message:
          `exempted as a key column that is not a reparent, but it is not a ` +
          `primary or foreign key any more — the rule it was written against ` +
          `no longer applies to it. Delete the entry.`,
      })
    }
  }
  return out
}

/**
 * The five column-shape findings, in reporting order.
 *
 * `authenticated` only. A column grant to `anon` or `PUBLIC` is assertion 3's
 * subject and is reported there whatever column it names — the union in
 * `CATALOG_SQL` is what makes a column grant as visible to it as a table one.
 * Two checks owning one invariant is how they drift apart.
 */
export function columnPostureFindings({
  tables = [],
  tableGrants = [],
  columnUpdateGrants = [],
  keyColumns = [],
}) {
  return [
    ...wideUpdateGrants(tableGrants),
    ...unpanelledUpdateGrants(columnUpdateGrants, tableGrants),
    ...keyColumnUpdateGrants(columnUpdateGrants, keyColumns, tableGrants),
    ...panelDeclarationFailures(columnUpdateGrants, tables),
    ...identityGrantFailures(columnUpdateGrants, keyColumns),
  ]
}

/** Every finding, in reporting order. */
export function findings(catalog) {
  const { tables, policies, grants } = catalog
  return [
    ...rlsDisabled(tables),
    ...anonWritePolicies(policies),
    ...anonWriteGrants(grants),
    ...ungatedWrites(tables, policies, grants),
    ...ownerGateFailures(tables, policies, grants),
    ...columnPostureFindings(catalog),
  ]
}

/* ------------------------------------------------------------------- live */

/**
 * The catalog, as one JSON document.
 *
 * One round-trip and one JSON value rather than three delimited streams,
 * because a policy expression is arbitrary SQL text and every delimiter worth
 * splitting on can appear inside one.
 */
export const CATALOG_SQL = `
  select json_build_object(
    'tables', coalesce((
      select json_agg(json_build_object('name', c.relname, 'rls_enabled', c.relrowsecurity)
                      order by c.relname)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p')
    ), '[]'::json),
    'policies', coalesce((
      select json_agg(json_build_object(
               'table', p.tablename, 'name', p.policyname,
               'permissive', p.permissive, 'cmd', p.cmd,
               'roles', p.roles, 'qual', coalesce(p.qual, ''),
               'with_check', coalesce(p.with_check, ''))
             order by p.tablename, p.policyname)
      from pg_policies p where p.schemaname = 'public'
    ), '[]'::json),
    'grants', coalesce((
      select json_agg(json_build_object(
               'grantee', g.grantee, 'table', g.table_name, 'privilege', g.privilege)
             order by g.grantee, g.table_name, g.privilege)
      from (
        -- COLUMN grants are unioned in, not skipped, because this schema uses
        -- them: \`cells\` and \`lanes\` hold no table-level UPDATE for
        -- \`authenticated\` at all — the app updates cell text through
        -- column-level grants (docs/engineering/access-and-security.md). A
        -- reachability model built on role_table_grants alone would read those
        -- tables as closed for UPDATE and never look at their gate.
        select grantee, table_name, privilege_type as privilege
        from information_schema.role_table_grants where table_schema = 'public'
        union
        select grantee, table_name, privilege_type
        from information_schema.role_column_grants where table_schema = 'public'
      ) g
      join pg_class c on c.relname = g.table_name
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      where g.grantee in ('anon', 'authenticated', 'PUBLIC')
        and c.relkind in ('r', 'p')
    ), '[]'::json),
    -- TABLE-level grants on their own, which the union above deliberately
    -- flattens away. The union is right for reachability — a column grant is
    -- as reachable as a table one — and wrong for #183, where the whole
    -- question is which of the two a table holds.
    'tableGrants', coalesce((
      select json_agg(json_build_object(
               'grantee', g.grantee, 'table', g.table_name, 'privilege', g.privilege_type)
             order by g.grantee, g.table_name, g.privilege_type)
      from information_schema.role_table_grants g
      join pg_class c on c.relname = g.table_name
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      where g.table_schema = 'public'
        and g.grantee in ('anon', 'authenticated', 'PUBLIC')
        and c.relkind in ('r', 'p')
    ), '[]'::json),
    -- UPDATE only, and named for it. \`role_column_grants\` EXPANDS a table
    -- grant into one row per column, so a wide table appears here in full —
    -- which is why the checks that read this skip tables reported wide rather
    -- than reporting every column of one.
    'columnUpdateGrants', coalesce((
      select json_agg(json_build_object(
               'grantee', g.grantee, 'table', g.table_name, 'column', g.column_name)
             order by g.grantee, g.table_name, g.column_name)
      from information_schema.role_column_grants g
      join pg_class c on c.relname = g.table_name
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      where g.table_schema = 'public'
        and g.privilege_type = 'UPDATE'
        and g.grantee in ('anon', 'authenticated', 'PUBLIC')
        and c.relkind in ('r', 'p')
    ), '[]'::json),
    -- Where a row SITS: primary and foreign key columns. Asked of
    -- \`pg_constraint\` rather than declared in JavaScript, so the check
    -- cannot be satisfied by forgetting a key.
    'keyColumns', coalesce((
      select json_agg(json_build_object('table', keys.rel, 'column', keys.col, 'kind', keys.kind)
                      order by keys.rel, keys.col)
      from (
        select c.relname as rel,
               a.attname as col,
               -- A column can be both, and "primary" is the stronger word for
               -- it: a primary key is identity outright, where a foreign key
               -- is identity borrowed from a parent.
               case when bool_or(k.contype = 'p') then 'primary' else 'foreign' end as kind
        from pg_constraint k
        join pg_class c on c.oid = k.conrelid and c.relkind in ('r', 'p')
        join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
        join lateral unnest(k.conkey) as u(attnum) on true
        join pg_attribute a on a.attrelid = c.oid and a.attnum = u.attnum
        where k.contype in ('p', 'f')
        group by c.relname, a.attname
      ) keys
    ), '[]'::json)
  )
`

/** The catalog over a direct connection. Throws rather than returning empty. */
export function readCatalog(url = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL) {
  if (!url) {
    throw new Error(
      'this check needs SUPABASE_DB_URL (a direct postgres:// connection). PostgREST ' +
        'does not expose pg_catalog or information_schema.role_table_grants to any role, ' +
        'so there is no anon or service-role route to the posture.',
    )
  }
  let raw
  try {
    raw = execFileSync('psql', [url, '-At', '-c', CATALOG_SQL], { encoding: 'utf8' })
  } catch (error) {
    // ENOENT here means psql is not installed, which reads as a bare
    // `spawnSync psql ENOENT` and sends the reader looking for a bug in this
    // file. `check:identifiers:live` needs the same binary for the same
    // reason and this repository has no local Postgres.
    throw new Error(
      error.code === 'ENOENT'
        ? 'psql is not on PATH. It is how this repository reaches pg_catalog at all — ' +
          'install the Postgres client, or run this from a machine that has one.'
        : `psql: ${error.stderr?.toString().trim() || error.message}`,
    )
  }
  const catalog = JSON.parse(raw)
  // An empty catalog is the shape a wrong database, a wrong schema or a
  // silently-failed query all produce, and every assertion above passes
  // vacuously on it.
  if (!Array.isArray(catalog.tables) || catalog.tables.length === 0) {
    throw new Error(
      'the catalog came back with no base tables in `public`. That is not a clean ' +
        'posture, it is a connection pointed somewhere else.',
    )
  }
  return catalog
}

/* ------------------------------------------------------------------- main */

function main() {
  let catalog
  try {
    catalog = readCatalog()
  } catch (error) {
    console.error(`::error::RLS posture: ${error.message}`)
    process.exit(1)
  }

  const problems = findings(catalog)
  for (const problem of problems) {
    console.error(`::error::RLS posture — ${problem.identifier}: ${problem.message}`)
  }

  console.log(
    `swept ${catalog.tables.length} base tables, ${catalog.policies.length} policies, ` +
      `${catalog.grants.length} grants, ` +
      `${(catalog.columnUpdateGrants ?? []).length} UPDATE column grants against ` +
      `${Object.keys(PANEL_COLUMNS).length} declared panels in public`,
  )
  console.log(
    'the DATABASE, not the files — per #148 supabase/migrations is not the apply path. ' +
      'Base tables only: views, TRUNCATE-to-authenticated and definer-function ACLs are ' +
      'out of subject and named in this file\'s header.',
  )

  if (problems.length > 0) {
    console.error(`\n${problems.length} RLS posture finding(s).`)
    process.exit(1)
  }
  console.log(
    'ok — RLS on everywhere, no anon write reachable, every authenticated write gated, ' +
      'and every UPDATE-able column is one a panel writes',
  )
}

if (import.meta.url === `file://${process.argv[1]}`) main()
