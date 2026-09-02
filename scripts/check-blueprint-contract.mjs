#!/usr/bin/env node
/**
 * `BLUEPRINT_CONTRACT` against the LIVE database.
 *
 * Three guards touched this contract and none of them covered this edge. The
 * bot's `sync-blueprint-contract.mjs --check` compares the bot's vendored copy
 * to this repo's; `bot-contract-probe.yml` asks the bot whether its reads
 * still work; `scripts/tests/blueprintContract.test.mjs` holds the contract to
 * the migrations in this repo. Nothing asked the database.
 *
 * The gap is not theoretical. `Phase` was added to
 * `semantic_search.blueprint_chunks_src` on 2026-08-17 with no migration — the
 * canonical contract described a four-segment breadcrumb while the database
 * emitted five, and a human found it two days later by running
 * `pg_get_viewdef` by hand. A change that never becomes a migration is
 * invisible to every static check by construction. Only asking the database
 * finds it.
 *
 * WHAT IT ASSERTS, all of it derived from the contract rather than restated:
 *
 *   - every `publicReadTables` entry is selectable by the anon role
 *   - every `fkConstraints` name resolves as a PostgREST embed hint — the
 *     sharpest edge in the contract, because an embed hint is a string inside
 *     a `select=` and nothing type-checks it on either side
 *   - `search_blueprint` accepts every declared parameter BY NAME, and a
 *     rejected call is re-probed one parameter at a time so the message names
 *     the offender rather than the call
 *   - `search_blueprint` accepts every declared granularity VALUE, bisected the
 *     same way when one is rejected. A name binding is not the same
 *     promise as a value being accepted, and only the name was ever checked —
 *     which is how the RPC came to reject `'lane'`, the word every table,
 *     column and doc uses, for six days (plus-uno-blueprint#144)
 *   - the returned columns of `search_blueprint` cover every declared column
 *   - every row `kind` the RPC emits is one the contract accounts for, at the
 *     cell granularity and at every structural rung
 *   - the breadcrumb the database actually emits parses into the declared
 *     labels, in order, on the declared separator
 *   - every VALUE SET a swept document states — "`kind` is `happy`,
 *     `variant`, `exception`" — equals the CHECK or domain that defines it,
 *     read off the catalog through `value_sets()` (#259). Identifiers were
 *     the first half of the 2026-09-01 audit; this is the second: a doc that
 *     taught three layouts the CHECK never had was not naming anything
 *   - the ERD's `%% Enums` block and attribute enums equal the catalog's
 *     sets — the file is regenerated from the live schema by hand, and its
 *     own header records the six days it asserted tables that had been
 *     renamed
 *   - every table and column COMMENT is swept as the prose it is — retired
 *     spellings, qualified names, value lists — because #260 renders the
 *     agent-facing schema section from `pg_description`, so a stale comment
 *     ships exactly as a stale doc does
 *
 * WHAT IT CANNOT REACH, and why:
 *
 *   - `semantic_search.blueprint_chunks_src` itself. The view is granted to
 *     `service_role` only and the `semantic_search` schema is not exposed
 *     through PostgREST, so the anon role cannot read the titles that are
 *     actually embedded. `search_blueprint.title` is the anon-reachable
 *     witness for the breadcrumb and it is built by the same migration, but it
 *     is a witness, not the subject. Pass `--service-role` with
 *     SUPABASE_SERVICE_ROLE_KEY to check the view itself; that key belongs on
 *     a developer machine or a staging runner, never in this repo's CI.
 *   - `semantic_search.match_corpus_chunks`, for the same reason. The bot
 *     calls it over its own service-role connection. Covered statically only.
 *
 * IT NEVER PASSES WITHOUT SEEING THE DATABASE. No credentials, an unreachable
 * host, an empty result set that would hide the shape — each exits non-zero.
 * A guard that exits clean when it cannot see its subject is the failure mode
 * this exists to end.
 *
 * Run: SUPABASE_URL=… SUPABASE_ANON_KEY=… node scripts/check-blueprint-contract.mjs
 *      (also: npm run check:contract:live — it reads .env.local too)
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BLUEPRINT_CONTRACT } from './blueprintContract.mjs'
import { RETIRED_IDENTIFIER_EXEMPTIONS } from './check-retired-identifiers.mjs'
import { replayMigrations } from './migration-replay.mjs'
import { erdFindings, erdValueSets } from './erd-value-sets.mjs'
import { retiredSpans, staleSpans } from './stale-prose.mjs'
import { sweptDocs } from './swept-docs.mjs'
import {
  catalogValueSets,
  isCorrection,
  renameTableState,
  sentencesOf,
  valueSetFindings,
} from './value-set-claims.mjs'

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname)
const TIMEOUT_MS = 30_000

/* ---------------------------------------------------------------- pure core */

/**
 * The declared breadcrumb labels, in order, or a message saying how `title`
 * disagrees with them.
 *
 * `breadcrumb.aliases` is keyed by the CANONICAL field name, not by the label
 * in use: `{ lane: ['layer'] }` said the lane field could be labelled either
 * way, for the window in which stored chunk titles still carried the old label
 * inside their embedded text. It is empty now that #144's re-embed has landed,
 * and the matching stays because the next rename of an embedded label needs it
 * again. So a segment is matched against its declared label plus every alias
 * group that label belongs to, and the ORDER of the segments is what is really
 * being asserted.
 */
export function breadcrumbFailure(title, breadcrumb) {
  if (typeof title !== 'string' || title.trim() === '') {
    return 'the database returned no breadcrumb title to parse'
  }

  const groups = Object.entries(breadcrumb.aliases ?? {}).map(([field, alternates]) =>
    [field, ...alternates].map((name) => name.toLowerCase()),
  )
  const segments = title.split(breadcrumb.separator)
  const accepted = breadcrumb.labels.map((label) => {
    const lower = label.toLowerCase()
    const group = groups.find((names) => names.includes(lower)) ?? []
    return [...new Set([lower, ...group])]
  })

  if (segments.length !== breadcrumb.labels.length) {
    return (
      `the database emits ${segments.length} breadcrumb segments, the contract ` +
      `declares ${breadcrumb.labels.length} (${breadcrumb.labels.join(', ')}). ` +
      `Live title: ${JSON.stringify(title)}`
    )
  }

  for (const [index, segment] of segments.entries()) {
    const label = segment.slice(0, segment.indexOf(':')).trim().toLowerCase()
    if (!accepted[index].includes(label)) {
      return (
        `breadcrumb segment ${index + 1} is labelled "${segment.slice(0, segment.indexOf(':'))}", ` +
        `the contract accepts ${accepted[index].map((n) => `"${n}"`).join(' or ')}. ` +
        `Live title: ${JSON.stringify(title)}`
      )
    }
  }

  return null
}

/** Declared column names the live row does not carry. */
export function missingColumns(row, declared) {
  const present = new Set(Object.keys(row ?? {}))
  return Object.values(declared).filter((column) => !present.has(column))
}

/**
 * Row kinds the contract does not account for.
 *
 * The accounted set used to be written out here, one rung at a time, beside a
 * contract that declared none of them. It said `lane` while the RPC emitted
 * `layer`, and neither side was wrong about the other because nothing ever put
 * them in the same room: the only granularity this file requested was `cell`,
 * so no structural row ever reached the comparison. Both halves are declared
 * now — `searchBlueprintKinds` for the rungs, `searchBlueprintInclude` for the
 * context rows — and both are passed in.
 */
export function undeclaredKinds(rows, kinds, include) {
  const accounted = new Set([...kinds, ...Object.values(include)])
  return [...new Set(rows.map((row) => row.kind))].filter((kind) => !accounted.has(kind))
}

/* -------------------------------------------------------------- environment */

/** `.env.local` then `.env`, without adding a dotenv dependency to a guard. */
function loadEnvFiles() {
  for (const name of ['.env.local', '.env']) {
    const path = resolve(REPO_ROOT, name)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line)
      if (!match) continue
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      if (!(match[1] in process.env)) process.env[match[1]] = value
    }
  }
}

export function credentials({ serviceRole }) {
  loadEnvFiles()
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = serviceRole
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : (process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY)

  const missing = []
  if (!url) missing.push('SUPABASE_URL (or VITE_SUPABASE_URL)')
  if (!key) missing.push(serviceRole ? 'SUPABASE_SERVICE_ROLE_KEY' : 'SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY)')

  if (missing.length > 0) {
    throw new Error(
      `no database to check against: ${missing.join(' and ')} unset. This check ` +
        `refuses to pass without reaching the database — that is the whole point ` +
        `of it. Set them in .env.local for a local run, or as repository ` +
        `variables to turn the CI job on (docs/connectors/plus-uno.md).`,
    )
  }
  return { url: url.replace(/\/$/, ''), key }
}

/* ---------------------------------------------------------------- transport */

export async function rest(url, key, path, init = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  const text = await response.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: response.status, ok: response.ok, body }
}

export const postgrest = (body) =>
  body && typeof body === 'object' && body.message
    ? `${body.code ?? 'error'}: ${body.message}${body.details ? ` — ${body.details}` : ''}`
    : JSON.stringify(body).slice(0, 300)

/* ------------------------------------------------------- prose schema claims */

/**
 * Docs whose SCHEMA CLAIMS are verified against the live database.
 *
 * Prose does not 400. A doc that tells an agent to read a column renamed a
 * fortnight ago produces a fruitless read and a confident wrong answer, and
 * nothing anywhere fails. On 2026-09-01 uno-bot's harness was found naming
 * `path_type`, `picture`, `links`, `order_position`, `slice_items`, `findings`
 * and `column_position` — none of which had existed since August — and the
 * instruction that cost the most told the bot to search for a path-name
 * convention removed eleven days earlier.
 *
 * Checking them HERE rather than in the bot's repo is the same choice the
 * contract makes: the side that owns the schema owns the claim about it.
 */
const SWEPT_DOCS = [
  'docs/connectors/plus-uno.md',
  'docs/engineering/access-and-security.md',
  'docs/agents/blueprint.md',
  'docs/agents/blueprint-direct-access.md',
]

/**
 * A schema claim is written QUALIFIED — `cells.summary`, never a bare
 * `summary`.
 *
 * This is a rule about the prose, and it is what makes the check possible
 * rather than merely desirable. Measured over the two files above: 27
 * qualified tokens and 111 bare ones. The bare set is roles, policies,
 * function names, RPC parameters, column VALUES and ordinary English — `open`,
 * `content`, `live`, `main` — so probing bare tokens would need ~90
 * exceptions, which is a blocklist wearing an allowlist's clothes.
 * Qualification costs one word and buys a check with no false positives and
 * nothing to maintain.
 */
const CLAIM = /`([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)`/g

/** Qualified pairs that are not table.column, and why each is not. */
const NOT_A_CLAIM = new Set([
  'app_metadata.role', // a JWT claim, not a relation
  'breadcrumb.aliases', // a key of BLUEPRINT_CONTRACT, covered by its own test
  'search_blueprint.title', // an OUT column of the RPC; the rpc checks cover it
  'auth.uid', // a function of the auth schema, named in column comments
])

/** A trailing file extension is a filename, not a column. */
const FILE_EXTENSION = /^(ts|tsx|js|mjs|json|md|sql|py|yml|yaml|sh|toml|css|svg|mmd)$/

/** Schemas this check cannot reach as anon, documented as out of reach above. */
const UNREACHABLE_SCHEMA = new Set(['semantic_search'])

const SENTENCE = /(?<=[.!?])\s+/

/**
 * The sentence a claim sits in, reassembled across markdown's line wrapping and
 * located by OFFSET.
 *
 * Two mistakes are designed out here. Scoping to a LINE reported a correction
 * as the defect, because "It replaced" ends one line and the token begins the
 * next. Then picking the first sentence that merely CONTAINS the name excused
 * a second occurrence with the first one's reasoning — "`cells.links` was
 * dropped in `2026…`. Always read `cells.links` first." is a correction
 * followed by an instruction, and the instruction is the defect.
 */
function sentenceAround(lines, index, offset) {
  const before = lines[index - 1] ?? ''
  const window = [before, lines[index], lines[index + 1] ?? ''].join(' ')
  const at = before.length + 1 + offset
  let cursor = 0
  for (const sentence of window.split(SENTENCE)) {
    const start = window.indexOf(sentence, cursor)
    const end = start + sentence.length
    if (at >= start && at < end) return sentence
    cursor = end
  }
  return window
}

/** Every qualified schema claim in a doc, with the line it sits on. */
export function schemaClaims(markdown, source) {
  const body = markdown.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '))
  const lines = body.split('\n')
  const claims = []
  let inRenameTable = false
  lines.forEach((line, i) => {
    const state = renameTableState(line, inRenameTable)
    inRenameTable = state.inside
    if (state.skip) return
    for (const m of line.matchAll(CLAIM)) {
      const [, left, right] = m
      const token = `${left}.${right}`
      if (NOT_A_CLAIM.has(token)) continue
      if (left.length === 1) continue // `c.lane_id` — a SQL alias in an example
      if (FILE_EXTENSION.test(right)) continue
      if (UNREACHABLE_SCHEMA.has(left)) continue
      if (isCorrection(sentenceAround(lines, i, m.index))) continue
      // `public.lanes` names a RELATION, not a column of a table called public.
      if (left === 'public') claims.push({ source, line: i + 1, table: right, column: null, token })
      else claims.push({ source, line: i + 1, table: left, column: right, token })
    }
  })
  return claims
}

/**
 * The same claims, read off a catalog comment. A comment has no backticks, so
 * a qualified name is any `table.column` word; `public.x` may name a function
 * as easily as a table, and the caller resolves it against what PostgREST
 * lists rather than by a select.
 */
export function commentClaims(comment, source) {
  const claims = []
  for (const sentence of sentencesOf(comment)) {
    if (isCorrection(sentence.text)) continue
    for (const m of sentence.text.matchAll(/(?<![\w.])([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)(?![\w.])/g)) {
      const [, left, right] = m
      const token = `${left}.${right}`
      if (NOT_A_CLAIM.has(token)) continue
      if (left.length === 1) continue // `e.g.`
      if (FILE_EXTENSION.test(right)) continue
      if (UNREACHABLE_SCHEMA.has(left)) continue
      if (left === 'public') claims.push({ source, line: sentence.line, table: right, column: null, token })
      else claims.push({ source, line: sentence.line, table: left, column: right, token })
    }
  }
  return claims
}

/** What a comment's spans are: backticked text, and any word spelled like an identifier. */
export function commentSpans(line) {
  const spans = [...line.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim())
  for (const word of line.replace(/`[^`\n]+`/g, ' ').match(/[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)?/g) ?? []) {
    if (word.includes('_') || word.includes('.')) spans.push(word.toLowerCase())
  }
  return spans
}

/* ------------------------------------------------------------------- checks */

async function run({ serviceRole }) {
  const contract = BLUEPRINT_CONTRACT
  const { url, key } = credentials({ serviceRole })
  const failures = []
  const ran = []

  const check = (name, problems) => {
    ran.push(name)
    for (const problem of problems.filter(Boolean)) failures.push(`${name}: ${problem}`)
  }

  console.log(`checking ${contract.appUrl}'s contract against ${url} as ${serviceRole ? 'service_role' : 'anon'}`)

  // Reachability first, so "the host is wrong" is not reported eleven times as
  // "this table is missing".
  const reachable = await rest(url, key, `${contract.botReadTables[0]}?select=*&limit=0`).catch((error) => ({
    status: 0,
    ok: false,
    body: error.message,
  }))
  if (reachable.status === 0) {
    throw new Error(`could not reach ${url}: ${reachable.body}`)
  }
  if (!reachable.ok) {
    throw new Error(
      `${url} answered HTTP ${reachable.status} for a bare select on ` +
        `"${contract.botReadTables[0]}" — ${postgrest(reachable.body)}. Wrong project, ` +
        `wrong key, or the read surface is gone; either way nothing below could be trusted.`,
    )
  }

  // 1. The public read surface.
  const surface = []
  for (const table of contract.publicReadTables) {
    const result = await rest(url, key, `${table}?select=*&limit=0`)
    if (!result.ok) {
      surface.push(
        `"${table}" is declared public-read but answers HTTP ${result.status} — ` +
          `${postgrest(result.body)}. Renamed, dropped, or its anon policy was tightened.`,
      )
    }
  }
  check('public read surface', surface)

  // 2. botReadTables must be a subset — the bot cannot read what the app does
  //    not publish, and a table listed only here would never be probed.
  const declared = new Set(contract.publicReadTables)
  check(
    'bot read surface',
    contract.botReadTables.map((table) =>
      declared.has(table) ? null : `"${table}" is a bot read but is not in publicReadTables`,
    ),
  )

  // 3. Embed hints. A wrong constraint name 400s with PGRST200, the bot's
  //    fetchEdges logs a warning and returns [], and Slack says "no
  //    dependencies" for cells that have them.
  const hints = []
  for (const [field, constraint] of Object.entries(contract.fkConstraints)) {
    const result = await rest(url, key, `cell_dependencies?select=cells!${constraint}(id)&limit=1`)
    if (!result.ok) {
      hints.push(
        `fkConstraints.${field} = "${constraint}" does not resolve as an embed hint — ` +
          `${postgrest(result.body)}. uno-bot hard-codes this string; a mismatch reads ` +
          `in Slack as "no dependencies" rather than as an error.`,
      )
    }
  }
  check('embed hints', hints)

  // 3b. Direct-read columns, one select per table, every declared column at
  //     once. PostgREST 400s the whole select when ANY column is unknown and
  //     names the offender, so a table's columns are re-probed one at a time
  //     when the batch fails — the same bisect the RPC parameters get, for the
  //     same reason: "cells is broken" is not an actionable message and
  //     "cells has no column `links`" is.
  //
  //     This is the guard that did not exist on 2026-09-01, when six of the
  //     bot's direct reads were found naming columns renamed between
  //     2026-08-20 and 2026-08-30. Every one of them failed silently: 400 in,
  //     empty array out, "the blueprint has nothing on that" in Slack.
  const columns = []
  for (const [table, declaredColumns] of Object.entries(contract.botDirectReadColumns ?? {})) {
    const batch = await rest(url, key, `${table}?select=${declaredColumns.join(',')}&limit=0`)
    if (batch.ok) continue
    let named = 0
    for (const column of declaredColumns) {
      const one = await rest(url, key, `${table}?select=${column}&limit=0`)
      if (one.ok) continue
      named++
      columns.push(
        `botDirectReadColumns.${table} names "${column}", which the database ` +
          `refuses — ${postgrest(one.body)}. uno-bot puts this string in a ` +
          `select=; a rename reads in Slack as an empty result, never as an error.`,
      )
    }
    if (named === 0) {
      columns.push(
        `botDirectReadColumns.${table}: the full select failed (HTTP ${batch.status} — ` +
          `${postgrest(batch.body)}) but every column passed alone. Something about ` +
          `the combination is refused; read the message rather than trusting the bisect.`,
      )
    }
  }
  check('direct read columns', columns)

  // 3c. Schema claims in the agent-facing docs. Same probe as 3b, different
  //     subject: 3b checks what the bot SELECTS, this checks what the docs
  //     TELL it to select. Both fail identically in production — a warning in
  //     a log, an empty result in Slack — and only one of them was checked.
  const prose = []
  const claimed = new Map()
  for (const relative of SWEPT_DOCS) {
    const file = resolve(REPO_ROOT, relative)
    if (!existsSync(file)) {
      prose.push(`${relative} is swept for schema claims but does not exist`)
      continue
    }
    for (const claim of schemaClaims(readFileSync(file, 'utf8'), relative)) {
      // One probe per distinct name, first site reported. A name repeated
      // eleven times is one defect, not eleven.
      if (!claimed.has(claim.token)) claimed.set(claim.token, claim)
    }
  }
  for (const claim of claimed.values()) {
    const query = claim.column
      ? `${claim.table}?select=${claim.column}&limit=0`
      : `${claim.table}?select=*&limit=0`
    const result = await rest(url, key, query)
    if (result.ok) continue
    prose.push(
      `${claim.source}:${claim.line} names \`${claim.token}\`, which the database ` +
        `refuses — ${postgrest(result.body)}. This doc is where an agent is told what ` +
        `to read; a name it gets wrong reads as an empty blueprint, never as an error.`,
    )
  }
  check('doc schema claims', prose)

  // 3d. Documented VALUE SETS, held to the constraints that define them.
  //     3c asks whether a name exists; this asks whether the values a doc
  //     lists for it are the values the CHECK accepts — the other half of the
  //     2026-09-01 audit, where `scenarios.layout` was taught as three values
  //     the constraint never had. `value_sets()` is how the catalog is
  //     reached: PostgREST exposes pg_catalog to no role, under any key.
  const sets = await rest(url, key, 'rpc/value_sets', { method: 'POST', body: '{}' })
  const catalog = sets.ok && Array.isArray(sets.body) ? catalogValueSets(sets.body) : null
  if (!catalog || catalog.columns.size === 0) {
    check('documented value sets', [
      sets.ok
        ? 'value_sets() returned no value list at all. Not a pass — a schema with no CHECK is not this schema.'
        : `could not read the catalog's value lists — ${postgrest(sets.body)}. ` +
          `public.value_sets() (20260902200000) is the one route to pg_catalog through PostgREST; ` +
          `apply it, or grant anon execute on it.`,
    ])
    check('erd value sets', ['not observed: the value lists above could not be read'])
    check('catalog comments', ['not observed: the value lists above could not be read'])
  } else {
    const values = []
    for (const relative of sweptDocs(REPO_ROOT)) {
      const file = resolve(REPO_ROOT, relative)
      if (!existsSync(file)) continue
      values.push(
        ...valueSetFindings({ text: readFileSync(file, 'utf8'), source: relative, medium: 'markdown' }, catalog),
      )
    }
    check('documented value sets', values)

    // 3d′. The ERD, the same way. docs/reference/erd.mmd is regenerated from
    //      the live schema by hand and says so in its own header — the
    //      previous copy spent six days asserting tables the database had
    //      renamed. Its `%% Enums` block and its attribute lines are held to
    //      the catalog, set for set.
    const erd = resolve(REPO_ROOT, 'docs/reference/erd.mmd')
    check(
      'erd value sets',
      existsSync(erd)
        ? erdFindings(erdValueSets(readFileSync(erd, 'utf8'), 'docs/reference/erd.mmd'), catalog)
        : ['docs/reference/erd.mmd does not exist'],
    )

    // 3e. The catalog's own comments, swept as the prose they are. #260
    //     renders the agent-facing schema section from pg_description, so a
    //     table comment still listing "happy, unhappy, exception, alternative"
    //     ships to every agent exactly as a stale doc does. Three sweeps, the
    //     same three markdown gets: retired spellings with no replacement
    //     beside them, qualified names that no longer resolve, value lists
    //     the constraint refutes.
    const comments = await rest(url, key, 'rpc/schema_comments', { method: 'POST', body: '{}' })
    if (!comments.ok || !Array.isArray(comments.body) || comments.body.length === 0) {
      check('catalog comments', [
        comments.ok
          ? 'schema_comments() returned no comment at all. Not a pass — this schema describes itself.'
          : `could not read the catalog's comments — ${postgrest(comments.body)}. ` +
            `public.schema_comments() (20260902200000) is the route; apply it, or grant anon execute on it.`,
      ])
    } else {
      // A comment's `public.x` may name a view (`public.trash`) or a function
      // (`public.search_blueprint`), and a select cannot tell the two apart —
      // nor can `rpc/x`: PostgREST answers PGRST202 both for a function that
      // does not exist and for one called without its arguments. Supabase
      // refuses the OpenAPI root to the anon key. So a name that is not a
      // relation is resolved against the functions the migration series
      // defines, which the contract test already holds the live ones to.
      const defined = replayMigrations(resolve(REPO_ROOT, 'supabase/migrations')).functions
      const problems = []
      const excused = retiredSpans()
      const named = new Map()
      for (const row of comments.body) {
        const host = { relation: row.relation, column: row.column_name }
        const source = row.column_name
          ? `comment on column ${row.relation}.${row.column_name}`
          : `comment on table ${row.relation}`
        if (!RETIRED_IDENTIFIER_EXEMPTIONS.some((entry) => entry.identifier === source)) {
          const context = [row.relation, row.column_name].filter(Boolean)
          for (const stale of staleSpans(row.comment, excused, { spansOf: commentSpans, context })) {
            problems.push(
              `${source} names \`${stale.span}\`, a retired spelling, with no replacement beside it — ` +
                `it is what an agent reads as the schema (#260)`,
            )
          }
        }
        problems.push(...valueSetFindings({ text: row.comment, source, medium: 'comment', host }, catalog))
        for (const claim of commentClaims(row.comment, source)) {
          if (!named.has(claim.token)) named.set(claim.token, claim)
        }
      }
      for (const claim of named.values()) {
        if (claim.column === null) {
          const relation = await rest(url, key, `${claim.table}?select=*&limit=0`)
          if (relation.ok || defined.has(`public.${claim.table}`)) continue
          problems.push(
            `${claim.source} names \`${claim.token}\`, which is neither a relation anon can select ` +
              `(${postgrest(relation.body)}) nor a function the migration series defines`,
          )
          continue
        }
        const result = await rest(url, key, `${claim.table}?select=${claim.column}&limit=0`)
        if (result.ok) continue
        problems.push(
          `${claim.source} names \`${claim.token}\`, which the database does not have — ${postgrest(result.body)}`,
        )
      }
      check('catalog comments', problems)
    }
  }

  // 4-7. The search RPC: parameters, columns, kinds, breadcrumb.
  const params = Object.fromEntries(
    Object.values(contract.searchBlueprintParams).map((name) => [name, null]),
  )
  const call = { ...params, match_count: 25, granularity: ['cell'], include: Object.keys(contract.searchBlueprintInclude) }
  const rpc = contract.rpcs.searchBlueprint
  const result = await rest(url, key, `rpc/${rpc}`, { method: 'POST', body: JSON.stringify(call) })

  if (!result.ok) {
    // PostgREST names the whole argument list, not the offender. Bisect by
    // sending each declared name alone: whichever ones 404 are the drifted ones.
    const offenders = []
    for (const name of Object.values(contract.searchBlueprintParams)) {
      const probe = await rest(url, key, `rpc/${rpc}`, {
        method: 'POST',
        body: JSON.stringify({ [name]: null }),
      })
      if (probe.status === 404) offenders.push(name)
    }
    check(`rpc ${rpc} parameters`, [
      offenders.length > 0
        ? `the function does not accept ${offenders.map((n) => `"${n}"`).join(', ')}. ` +
          `PostgREST binds RPC arguments BY NAME, so uno-bot sends a name Postgres ` +
          `ignores — a filter that silently does nothing.`
        : `the call failed for a reason other than a parameter name — ${postgrest(result.body)}`,
    ])
    check(`rpc ${rpc} returned columns`, ['not observed: the call above failed'])
    check('breadcrumb', ['not observed: the call above failed'])
  } else {
    check(`rpc ${rpc} parameters`, [])

    const rows = Array.isArray(result.body) ? result.body : []
    if (rows.length === 0) {
      const blind = 'the RPC returned no rows, so its shape could not be observed. ' +
        'Not a pass — point this at a populated database.'
      check(`rpc ${rpc} returned columns`, [blind])
      check('breadcrumb', [blind])
    } else {
      const missing = missingColumns(rows[0], contract.searchBlueprintColumns)
      check(`rpc ${rpc} returned columns`, [
        missing.length > 0
          ? `the live row does not carry ${missing.map((c) => `"${c}"`).join(', ')} — ` +
            `uno-bot reads these keys off the row and would get undefined.`
          : null,
      ])

      const strays = undeclaredKinds(rows, contract.searchBlueprintKinds, contract.searchBlueprintInclude)
      check(`rpc ${rpc} row kinds`, [
        strays.length > 0
          ? `the RPC emits kind ${strays.map((k) => `"${k}"`).join(', ')}, which neither ` +
            `searchBlueprintKinds nor searchBlueprintInclude accounts for`
          : null,
      ])

      const cell = rows.find((row) => row.kind === 'cell')
      check('breadcrumb', [
        cell
          ? breadcrumbFailure(cell.title, contract.breadcrumb)
          : 'no cell row came back, so the breadcrumb could not be observed',
      ])
    }
  }

  // 8-9. Granularity VALUES, and the kinds the structural rungs emit.
  //
  //    The call above sends `granularity: ['cell']`, which is what uno-bot
  //    sends and therefore all this file ever exercised. Every other rung —
  //    and the guard clause that decides which words name one — went unchecked
  //    for as long as the contract declared no values to check.
  //
  //    `cell` is deliberately left out of this call. With no query text and no
  //    embedding, cell rows sort ahead of structural ones and there are eight
  //    hundred of them, so asking for both returns `match_count` cells and no
  //    rung at all. The kinds observed here are the structural ones; the cell
  //    kind is covered by the call above.
  const gran = contract.searchBlueprintGranularity.accepted.filter(
    (value) => value !== 'cell',
  )

  const rungs = await rest(url, key, `rpc/${rpc}`, {
    method: 'POST',
    body: JSON.stringify({ match_count: 200, granularity: gran }),
  })

  if (!rungs.ok) {
    // Same bisect as the parameters: the RPC raises on the whole array and
    // names only the first offending value, so ask one at a time.
    const offenders = []
    for (const value of gran) {
      const probe = await rest(url, key, `rpc/${rpc}`, {
        method: 'POST',
        body: JSON.stringify({ match_count: 1, granularity: [value] }),
      })
      if (!probe.ok) offenders.push(value)
    }
    check(`rpc ${rpc} granularity values`, [
      offenders.length > 0
        ? `the function rejects granularity ${offenders.map((g) => `"${g}"`).join(', ')}. ` +
          `A caller that names a rung the contract declares gets an exception, not rows — ` +
          `and a deprecated spelling still on this list is one uno-bot may still be sending.`
        : `the call failed for a reason other than a granularity value — ${postgrest(rungs.body)}`,
    ])
    check(`rpc ${rpc} structural row kinds`, ['not observed: the call above failed'])
  } else {
    check(`rpc ${rpc} granularity values`, [])

    const rungRows = Array.isArray(rungs.body) ? rungs.body : []
    const strays = undeclaredKinds(rungRows, contract.searchBlueprintKinds, contract.searchBlueprintInclude)
    check(`rpc ${rpc} structural row kinds`, [
      rungRows.length === 0
        ? 'no structural rows came back, so their kinds could not be observed. ' +
          'Not a pass — point this at a populated database.'
        : null,
      strays.length > 0
        ? `the RPC tags a rung ${strays.map((k) => `"${k}"`).join(', ')}, which ` +
          `searchBlueprintKinds does not declare. uno-bot reads kind off the row.`
        : null,
    ])
  }

  // 10. The view itself — service-role only, so this is where the CI-reachable
  //    surface ends and a local or staging run begins.
  if (serviceRole) {
    const view = await rest(url, key, 'blueprint_chunks_src?select=title&limit=1', {
      headers: { 'Accept-Profile': 'semantic_search' },
    })
    check('semantic_search.blueprint_chunks_src breadcrumb', [
      view.ok && Array.isArray(view.body) && view.body[0]
        ? breadcrumbFailure(view.body[0].title, contract.breadcrumb)
        : `could not read the view — ${postgrest(view.body)}. Expose the ` +
          `semantic_search schema to PostgREST, or run this against psql.`,
    ])
  }

  return { failures, ran, serviceRole }
}

async function main() {
  const serviceRole = process.argv.includes('--service-role')
  let outcome
  try {
    outcome = await run({ serviceRole })
  } catch (error) {
    console.error(`::error::blueprint contract vs live database: ${error.message}`)
    process.exitCode = 1
    return
  }

  for (const failure of outcome.failures) {
    console.error(`::error::blueprint contract vs live database — ${failure}`)
  }

  console.log(`\nchecked: ${outcome.ran.join(', ')}`)
  if (!outcome.serviceRole) {
    console.log(
      'not reached as anon: semantic_search.blueprint_chunks_src and ' +
        'semantic_search.match_corpus_chunks are service_role-only. Re-run with ' +
        '--service-role and SUPABASE_SERVICE_ROLE_KEY to include them.',
    )
  }

  if (outcome.failures.length > 0) {
    console.error(
      `\n${outcome.failures.length} disagreement(s) between src/lib/blueprintContract.ts ` +
        `and the live database. Fix whichever side is wrong, in one window — the ` +
        `bot vendors this file. docs/connectors/plus-uno.md`,
    )
    process.exitCode = 1
  } else {
    console.log(`ok — the contract agrees with the live database`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
