#!/usr/bin/env node
/**
 * #145 Check A — retired vocabulary in database identifiers.
 *
 * `alter table … rename` moves the table and the column. It does not move the
 * index, the constraint, the policy, the trigger, the comment, or anything
 * inside a plpgsql body. `20260820120000_layers_to_lanes_structure.sql` says
 * "THE TRAP, again" in a comment and renames its indexes and policies by hand.
 * `20260821340000_retire_lifecycle.sql`, one day later, does not. Knowing the
 * trap is not a control; a check that fails is.
 *
 * SCOPE IS IDENTIFIERS ONLY, DELIBERATELY. A check that greps prose needs an
 * exemption for the migration filename `20260729120000_derived_layer.sql`, for
 * "the URL layer", for every sentence in `schema.reference.sql` — dozens of
 * entries, each one a place to hide something real. `src/lib/tokenDiscipline.test.ts`
 * makes the converse argument and it holds both ways: a pattern narrowed to
 * dodge a real case reads as a rule that never covered it, and a pattern
 * widened past its subject manufactures exceptions that then have to be
 * trusted. The one prose surface included is `pg_description`, because a
 * comment on a column IS part of the schema and travels with it.
 *
 * WHAT IT ASSERTS
 *
 *   - no table, column, view, sequence or type name carries a retired word
 *   - no constraint, index, policy or trigger name carries one
 *   - no comment TEXT carries one
 *   - no function name or argument name carries one
 *   - no function BODY names an identifier this series retired — matched
 *     against the graveyard rather than against the words, so a local variable
 *     called `layer_map` is not a finding and `service_scenario_id` is
 *   - no SECURITY DEFINER function in `public` is executable by PUBLIC or anon,
 *     `search_blueprint` excepted
 *
 * TWO HALVES, AND THE CI HALF IS THE WEAKER ONE
 *
 * The static half replays `supabase/migrations` and sweeps the schema those
 * statements DESCRIBE. It needs no credentials, so it runs on every pull
 * request. IT IS A CHECK ON THE REPOSITORY, NOT ON THE DATABASE.
 *
 * #148 is the reason to state that in capitals: 818 of this repository's 822
 * migration versions do not appear in production's
 * `supabase_migrations.schema_migrations` (four do — see migration-replay.mjs,
 * and note this line previously claimed none did, out of 816). The schema was
 * applied over MCP `apply_migration` and the files were written separately
 * afterwards, so until `check:migration-syntax` landed no Postgres had read
 * them, and three did not parse. Anything applied that way — which is everything — is invisible to this
 * half. That is how #143's nine broken bodies and #147's ACL regression got in,
 * and it is the hole `check:contract:live` was built for.
 *
 * The static half reproduces #142's twenty-two identifiers, #143's nine bodies
 * and #147's `create_phase` ACL exactly, which is good evidence the files and
 * the applied text agree on those points. It is not proof and must not be read
 * as one.
 *
 * The live half sweeps `pg_catalog` itself and is MANUAL ONLY. PostgREST does
 * not expose `pg_catalog`, so it needs a direct connection — and this repo's
 * standing rule is that a privileged database credential never belongs in its
 * CI. Run it on a developer machine or a staging runner:
 *
 *   SUPABASE_DB_URL=postgres://… node scripts/check-retired-identifiers.mjs --service-role
 *
 * Run: node scripts/check-retired-identifiers.mjs   (also: npm run check:identifiers)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  RETIRED_IDENTIFIER_FRAGMENTS,
  replacementFor,
  retiredFragmentsIn,
} from './retired-vocabulary.mjs'
import {
  definerFunctionsReachableByAnon,
  replayMigrations,
  retiredIdentifiers,
} from './migration-replay.mjs'

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname)
const MIGRATIONS = resolve(REPO_ROOT, 'supabase/migrations')

/**
 * Identifiers allowed to keep a retired word, each with a reason and usually
 * an expiry. See `scripts/tests/retired-vocabulary.test.mjs` for the two rules
 * that keep the list honest: a permanent entry must be defined in CONTEXT.md,
 * and an entry whose subject no longer exists fails until someone deletes it.
 *
 * @type {ReadonlyArray<import('./retired-vocabulary.mjs').Exemption>}
 */
export const RETIRED_IDENTIFIER_EXEMPTIONS = [
  {
    identifier: 'column evidence.proposition_question_key',
    because:
      'the three validation questions ARE propositions — the rename moved the container (propositions → business_model), not the concept',
  },
  {
    identifier: 'comment on table evidence',
    because:
      'names the proposition questions the column above records; the same concept, and it survives the table rename for the same reason',
  },
  {
    identifier: 'comment on table services',
    because:
      'a deliberate historical record — it says the table was renamed FROM service_lifecycles, which is the sentence that stops the next person re-asking',
  },
  {
    // The table was pluralised on 2026-08-30 (#177) and the comment went with
    // it, so the exemption follows the address rather than the text. That is
    // the whole point of the staleness rule below it: this entry failed the
    // moment the rename landed, which is how the move got noticed.
    identifier: 'comment on table business_models',
    because:
      'the same deliberate record, for the propositions → business_model rename, and it explains the collision with a cell value proposition',
  },
]

const exempt = (identifier) =>
  RETIRED_IDENTIFIER_EXEMPTIONS.some((entry) => entry.identifier === identifier)

/* ---------------------------------------------------------- static sweep */

/** Argument and OUT-column names declared in a function's signature. */
export function argumentNames(definition) {
  const head = definition.slice(0, dollarBodyStart(definition))
  return [
    ...new Set(
      [...head.matchAll(/(?:^|[(,])\s*([a-z_][a-z0-9_]*)\s+(?:in\s+|out\s+|inout\s+)?[a-z]/gi)].map(
        (match) => match[1].toLowerCase(),
      ),
    ),
  ]
}

const dollarBodyStart = (definition) => {
  const open = /\$([A-Za-z_]\w*)?\$/.exec(definition)
  return open ? open.index : definition.length
}

/**
 * A function body with comments and string literals removed.
 *
 * String literals are out of scope on purpose: `'sets_off'` inside
 * `search_blueprint` is a VALUE on the wire, not an identifier, and values are
 * #144's subject with a different fix and a different exemption list. Mixing
 * them here would make this check's failures unactionable by its own owner.
 */
export function identifierText(definition) {
  return definition
    .slice(dollarBodyStart(definition))
    .replace(/--.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, " '' ")
}

/**
 * Every finding the migration series produces, in reporting order.
 *
 * `applyExemptions: false` returns the unfiltered set, which is what the
 * staleness test reads: an exemption whose subject has been fixed is a dead
 * entry, and a dead entry is how the last one aged into permanence.
 */
export function staticFindings(schema, { applyExemptions = true } = {}) {
  const findings = []
  const say = (identifier, detail) => {
    if (applyExemptions && exempt(identifier)) return
    const words = retiredFragmentsIn(detail ?? identifier)
    findings.push({
      identifier,
      words,
      replacement: replacementFor(words[0]) ?? '',
    })
  }

  for (const table of [...schema.tables.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    if (retiredFragmentsIn(table.name).length) say(`table ${table.name}`)
    for (const column of [...table.columns.keys()].sort()) {
      if (retiredFragmentsIn(column).length) say(`column ${table.name}.${column}`, column)
    }
  }
  for (const [label, collection] of [
    ['view', schema.views],
    ['type', schema.types],
    ['sequence', schema.sequences],
  ]) {
    for (const name of [...collection.keys()].sort()) {
      if (retiredFragmentsIn(name).length) say(`${label} ${name}`)
    }
  }
  for (const [label, collection] of [
    ['constraint', schema.constraints],
    ['index', schema.indexes],
    ['policy', schema.policies],
    ['trigger', schema.triggers],
  ]) {
    const rows = [...collection.values()].sort((a, b) =>
      `${a.table}.${a.name}`.localeCompare(`${b.table}.${b.name}`),
    )
    for (const row of rows) {
      if (retiredFragmentsIn(row.name).length) say(`${label} ${row.name} on ${row.table}`, row.name)
    }
  }
  for (const comment of [...schema.comments.values()].sort((a, b) =>
    `${a.kind}:${a.target}`.localeCompare(`${b.kind}:${b.target}`),
  )) {
    if (retiredFragmentsIn(comment.text).length) {
      say(`comment on ${comment.kind} ${comment.target}`, comment.text)
    }
  }

  const graveyard = retiredIdentifiers(schema)
  for (const fn of [...schema.functions.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const short = fn.name.split('.').pop()
    if (retiredFragmentsIn(short).length) say(`function ${fn.name}`, short)
    for (const argument of argumentNames(fn.definition)) {
      if (retiredFragmentsIn(argument).length) {
        say(`function ${fn.name} argument ${argument}`, argument)
      }
    }
    const named = [
      ...new Set(
        (identifierText(fn.definition).match(/[a-z_][a-z0-9_]*/gi) ?? [])
          .map((token) => token.toLowerCase())
          .filter((token) => graveyard.has(token) && retiredFragmentsIn(token).length),
      ),
    ].sort()
    for (const token of named) {
      say(`function ${fn.name} body names ${token}`, token)
    }
  }
  return findings
}

/* ------------------------------------------------------------- live sweep */

/**
 * The same sweep against `pg_catalog`, over a direct connection.
 *
 * PostgREST does not expose `pg_catalog` to any role, so there is no anon or
 * service-role path to this — it needs a connection string and `psql`. Kept
 * out of CI for the reason `check:contract:live` is: a privileged database
 * credential does not belong in this repository's workflows.
 */
function liveFindings() {
  const url = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'the live half needs SUPABASE_DB_URL (a direct postgres:// connection). ' +
        'PostgREST does not expose pg_catalog, so there is no anon or service-role route to it.',
    )
  }
  const pattern = RETIRED_IDENTIFIER_FRAGMENTS.join('|')
  const sql = `
    select 'constraint ' || c.conname || ' on ' || rel.relname
      from pg_constraint c join pg_class rel on rel.oid = c.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public' and c.conname ~ '${pattern}'
    union all
    select 'index ' || indexname || ' on ' || tablename
      from pg_indexes where schemaname = 'public' and indexname ~ '${pattern}'
    union all
    select 'policy ' || policyname || ' on ' || tablename
      from pg_policies where schemaname = 'public' and policyname ~ '${pattern}'
    union all
    select 'trigger ' || t.tgname || ' on ' || rel.relname
      from pg_trigger t join pg_class rel on rel.oid = t.tgrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public' and not t.tgisinternal and t.tgname ~ '${pattern}'
    union all
    select 'column ' || table_name || '.' || column_name
      from information_schema.columns
      where table_schema = 'public' and column_name ~ '${pattern}'
    union all
    select 'table ' || table_name from information_schema.tables
      where table_schema = 'public' and table_name ~ '${pattern}'
    union all
    select 'comment on ' || obj_description(c.oid) from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and obj_description(c.oid) ~ '${pattern}'
    union all
    select 'function ' || p.proname || ' body' from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public','semantic_search') and p.prosrc ~ '${pattern}'
    order by 1
  `
  const out = execFileSync('psql', [url, '-At', '-c', sql], { encoding: 'utf8' })
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((identifier) => !exempt(identifier))
}

/* ------------------------------------------------------------------- main */

function main() {
  const serviceRole = process.argv.includes('--service-role')
  if (!existsSync(MIGRATIONS)) {
    console.error('::error::supabase/migrations is missing — there is nothing to replay')
    process.exit(1)
  }

  const schema = replayMigrations(MIGRATIONS)
  const findings = staticFindings(schema)
  const open = definerFunctionsReachableByAnon(schema)

  for (const finding of findings) {
    console.error(
      `::error::retired vocabulary in a database identifier — ${finding.identifier} ` +
        `(${finding.words.join(', ')} → ${finding.replacement})`,
    )
  }
  for (const fn of open) {
    console.error(
      `::error::SECURITY DEFINER function reachable by PUBLIC or anon — ${fn.name} ` +
        `[${fn.acl}], defined by ${fn.source}. A drop takes the grants with it and the ` +
        'recreate lands on EXECUTE TO PUBLIC; re-issue the paired revoke.',
    )
  }

  let live = null
  if (serviceRole) {
    try {
      live = liveFindings()
    } catch (error) {
      console.error(`::error::live sweep of pg_catalog: ${error.message}`)
      process.exit(1)
    }
    for (const identifier of live) {
      console.error(`::error::retired vocabulary in the LIVE database — ${identifier}`)
    }
  }

  console.log(
    `replayed ${schema.tables.size} tables, ${schema.constraints.size} constraints, ` +
      `${schema.indexes.size} indexes, ${schema.policies.size} policies, ` +
      `${schema.triggers.size} triggers, ${schema.functions.size} functions, ` +
      `${schema.comments.size} comments`,
  )
  if (schema.unhandled.length > 0) {
    console.log(`${schema.unhandled.length} statement(s) the replay did not recognise:`)
    for (const one of schema.unhandled.slice(0, 10)) {
      console.log(`  ${one.file}: ${one.statement.replace(/\s+/g, ' ').slice(0, 120)}`)
    }
  }
  if (!serviceRole) {
    console.log(
      'static half only — this checked the FILES, not the database. Per #148 none of ' +
        'this series is recorded as applied, so anything applied over MCP is invisible ' +
        'here. Pass --service-role with SUPABASE_DB_URL to sweep pg_catalog itself.',
    )
  }

  const total = findings.length + open.length + (live?.length ?? 0)
  if (total > 0) {
    console.error(
      `\n${findings.length} retired identifier(s), ${open.length} over-granted ` +
        `SECURITY DEFINER function(s)${live ? `, ${live.length} live finding(s)` : ''}.`,
    )
    process.exit(1)
  }
  console.log('ok — no retired vocabulary in any database identifier')
}

if (import.meta.url === `file://${process.argv[1]}`) main()
