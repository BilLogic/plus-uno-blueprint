/**
 * #174 — the three integrity guards, read from the files that declare them.
 *
 * The migration these read (`20260830180000`) proves its own rules by
 * performing them: it builds a fixture, attempts each bad write, and raises if
 * one succeeds. That is the strongest evidence there is, and it runs exactly
 * once per database. Nothing in `npm test` re-runs it, and nothing in a pull
 * request can, because this repository has no local Postgres and CI holds no
 * database credential.
 *
 * So this is the other half: the declarations themselves, compared against
 * each other and against the app. It cannot tell you the guard is enforced —
 * only the migration can — and it can tell you the guard is still DECLARED,
 * over the right columns, admitting the right vocabulary, which is what a
 * later edit is going to get wrong.
 *
 * Every reader throws rather than returning an empty set. A reader that
 * quietly finds nothing turns each comparison built on it into a test that
 * examines nothing and passes, which is the failure
 * `scripts/tests/rls-posture.test.mjs` exists to name.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname)

export const MIGRATIONS_DIR = 'supabase/migrations'
export const STATUS_PATH = 'src/lib/entityStatus.ts'

/** The migration that adds the composite key and the policy pair. */
export const GUARD_MIGRATION =
  '20260830180000_the_two_gaps_that_were_actually_open.sql'

/**
 * The migration that created the `entity_status` domain.
 *
 * #174 believed `cells.status` and `paths.status` were unconstrained. They
 * were not, and had not been for nine days — the constraint hangs off the
 * DOMAIN, so it is invisible to any sweep that enumerates a table's CHECK
 * constraints, and `\d public.cells` does not show it either. Naming the file
 * here is what stops that conclusion being reached a third time.
 */
export const STATUS_DOMAIN_MIGRATION = '20260821240000_status_not_maturity.sql'

const read = (root, dir, file) => readFileSync(resolve(root, dir, file), 'utf8')

/* --------------------------------------------------------------- statuses */

/**
 * The statuses the `entity_status` domain admits.
 *
 * Read from the migration rather than from the live domain for the same
 * reason `scripts/lane-roles.mjs` reads its constraint from a file: this has
 * to be able to fail a pull request, and CI has no credentials.
 */
export function statusesInDomain(root = REPO_ROOT) {
  const source = read(root, MIGRATIONS_DIR, STATUS_DOMAIN_MIGRATION)
  const block = /create domain public\.entity_status[\s\S]*?check \(value in \(([^)]*)\)\)/i.exec(
    source,
  )
  if (!block) {
    throw new Error(
      `${STATUS_DOMAIN_MIGRATION} no longer creates public.entity_status with ` +
        `a \`check (value in (...))\` list. If a later migration redefined the ` +
        `domain, point STATUS_DOMAIN_MIGRATION at that file — do not delete ` +
        `the comparison, which is the only thing holding the schema's ` +
        `vocabulary to the app's.`,
    )
  }
  return [...block[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1])
}

/** The statuses `ENTITY_STATUS` offers, which is what the panel renders. */
export function statusesInCode(root = REPO_ROOT) {
  const source = readFileSync(resolve(root, STATUS_PATH), 'utf8')
  const block = /export const ENTITY_STATUS = \[([^\]]*)\]/.exec(source)
  if (!block) {
    throw new Error(
      `${STATUS_PATH} no longer declares ENTITY_STATUS as an array literal. ` +
        `See scripts/integrity-guards.mjs.`,
    )
  }
  return [...block[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1])
}

/**
 * The `<table>.status` columns the domain migration puts on the domain.
 *
 * Two spellings, because the migration uses both: `cells.status` already
 * existed and was retyped, and `paths.status` was added. A column that stops
 * being on the domain keeps its name, its type (`text`, underneath) and every
 * row it held, and silently accepts anything — which is precisely the state
 * #174 described and the schema did not have.
 */
export function columnsOnStatusDomain(root = REPO_ROOT) {
  const source = read(root, MIGRATIONS_DIR, STATUS_DOMAIN_MIGRATION)
  const found = new Set()

  for (const match of source.matchAll(
    /alter table public\.(\w+)\s+alter column (\w+) type public\.entity_status/gi,
  )) {
    found.add(`${match[1]}.${match[2]}`)
  }
  for (const match of source.matchAll(
    /alter table public\.(\w+)\s+add column (\w+) public\.entity_status/gi,
  )) {
    found.add(`${match[1]}.${match[2]}`)
  }

  if (found.size === 0) {
    throw new Error(
      `${STATUS_DOMAIN_MIGRATION} puts no column on public.entity_status. ` +
        `See scripts/integrity-guards.mjs.`,
    )
  }
  return [...found].sort()
}

/* ------------------------------------------------------- the composite key */

/**
 * The composite foreign key that makes a cell's path its lane's path.
 *
 * Column ORDER is carried, not just membership: `(path_id, lane_id)`
 * referencing `(path_id, id)` is a different rule that happens to hold over
 * the same rows, and it would keep holding while the rule this file is about
 * quietly stopped.
 */
export function pathMatchesLaneKey(root = REPO_ROOT) {
  const source = read(root, MIGRATIONS_DIR, GUARD_MIGRATION)
  const block =
    /add constraint cells_path_matches_lane_fkey\s+foreign key \(([^)]*)\) references public\.(\w+) \(([^)]*)\)([^;]*);/i.exec(
      source,
    )
  if (!block) {
    throw new Error(
      `${GUARD_MIGRATION} no longer adds cells_path_matches_lane_fkey as a ` +
        `composite foreign key. Without it a lane can be moved to another ` +
        `path and leave every one of its cells behind, which is what it was ` +
        `written for. See scripts/integrity-guards.mjs.`,
    )
  }
  const columns = (list) => list.split(',').map((name) => name.trim())
  const tail = block[4]
  return {
    referencing: columns(block[1]),
    referencedTable: block[2],
    referenced: columns(block[3]),
    onDelete: /on delete (\w+)/i.exec(tail)?.[1].toLowerCase() ?? null,
    onUpdate: /on update (\w+)/i.exec(tail)?.[1].toLowerCase() ?? null,
  }
}

/**
 * The columns of the unique key on `lanes` that the foreign key references.
 *
 * A foreign key must reference a declared unique or primary key. `id` alone is
 * the primary key and therefore makes `(id, path_id)` unique on its own, but
 * Postgres matches the referenced column list against a declared constraint
 * and will not infer that — so without this key the statement above is not
 * merely unenforced, it does not apply at all.
 */
export function laneIdentityKey(root = REPO_ROOT) {
  const source = read(root, MIGRATIONS_DIR, GUARD_MIGRATION)
  const block = /add constraint lanes_id_path_unique unique \(([^)]*)\)/i.exec(source)
  if (!block) {
    throw new Error(
      `${GUARD_MIGRATION} no longer declares lanes_id_path_unique. The ` +
        `composite foreign key on cells has nothing to reference without it. ` +
        `See scripts/integrity-guards.mjs.`,
    )
  }
  return block[1].split(',').map((name) => name.trim())
}

/* ---------------------------------------------------- stakeholder policies */

/** The three commands a stakeholder write policy can cover. */
export const WRITE_COMMANDS = Object.freeze(['insert', 'update', 'delete'])

/**
 * Every `create policy … on public.stakeholders` the guard migration issues.
 *
 * The statements are assembled from string fragments inside a `do` block —
 * `public.stakeholders` does not survive an empty replay, and `create policy`
 * has no `if exists` — so this reads the fragments as one line rather than
 * expecting a top-level statement. `scripts/migration-replay.mjs` models the
 * series statically and treats dollar-quoted bodies as opaque, so it cannot
 * see these; this reader is the only thing that can.
 */
export function stakeholderPolicies(root = REPO_ROOT) {
  const source = read(root, MIGRATIONS_DIR, GUARD_MIGRATION)

  // Only the `$policies$` block. The same migration creates one more policy
  // further down — `stakeholders_update_anyone`, inside the fixture that
  // proves a second permissive policy no longer opens the table — and it is
  // dropped again three statements later. Reading the whole file would count
  // the thing being disproved as part of the schema.
  const block = /do \$policies\$([\s\S]*?)\$policies\$;/.exec(source)
  if (!block) {
    throw new Error(
      `${GUARD_MIGRATION} no longer carries a \`do $policies$ … $policies$\` ` +
        `block. That is where the stakeholders policy pair is declared, and it ` +
        `is inside a do block because public.stakeholders does not survive an ` +
        `empty replay. See scripts/integrity-guards.mjs.`,
    )
  }

  // Fold the `'…' || ' …'` concatenations into single lines, so one regular
  // expression can read a statement that is written over four.
  const flattened = block[1].replace(/'\s*\n\s*\|\|\s*'/g, ' ')

  const policies = []
  for (const match of flattened.matchAll(
    /create policy (\w+) on public\.stakeholders\s+(as restrictive\s+)?for (\w+) to (\w+)([^']*)'/gi,
  )) {
    policies.push({
      name: match[1],
      restrictive: Boolean(match[2]),
      command: match[3].toLowerCase(),
      role: match[4],
      predicate: match[5].replace(/\s+/g, ' ').trim(),
    })
  }

  if (policies.length === 0) {
    throw new Error(
      `${GUARD_MIGRATION} creates no policies on public.stakeholders. That ` +
        `table used a single permissive policy per write command with the ` +
        `service call inline, so one more permissive policy added later ` +
        `re-opened it while every other table stayed shut. See ` +
        `scripts/integrity-guards.mjs.`,
    )
  }
  return policies
}

/**
 * Write commands on `stakeholders` that do not carry both halves of the pair.
 *
 * Pure, and separate from the reader, so the test suite can hand it the two
 * shapes this rule exists to refuse and watch it go red on each. A rule that
 * has only ever been shown agreeing with a correct schema is indistinguishable
 * from a rule that returns the empty list.
 */
export function policyPairGaps(policies) {
  const out = []
  const gated = (policy) => /is_service_account/.test(policy.predicate)

  for (const command of WRITE_COMMANDS) {
    const forCommand = policies.filter((policy) => policy.command === command)
    const permissive = forCommand.filter((policy) => !policy.restrictive)
    const restrictive = forCommand.filter((policy) => policy.restrictive && gated(policy))

    if (permissive.length !== 1) {
      out.push(
        `stakeholders declares ${permissive.length} permissive ${command} ` +
          `policies, expected 1: with none the write is unreachable even for a ` +
          `service account, and two of them is the shape #174 exists to prevent.`,
      )
    }
    if (restrictive.length !== 1) {
      out.push(
        `stakeholders declares ${restrictive.length} restrictive ` +
          `is_service_account() companions for ${command}, expected 1. ` +
          `Restrictive policies AND, which is what makes the gate survive a ` +
          `permissive policy somebody adds later.`,
      )
    }
    for (const policy of permissive.filter(gated)) {
      out.push(
        `${policy.name} is the old shape: a permissive policy carrying the ` +
          `service call inline. Permissive policies OR, so the next one added ` +
          `beside it opens the table.`,
      )
    }
  }
  return out
}

/** Migration filenames, so a stale pinned filename above is visible. */
export function migrationFilenames(root = REPO_ROOT) {
  return readdirSync(resolve(root, MIGRATIONS_DIR)).filter((name) =>
    name.endsWith('.sql'),
  )
}
