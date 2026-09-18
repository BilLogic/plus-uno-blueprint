#!/usr/bin/env node
/**
 * The canvas adapter this app SERVES, against the surfaces the app HAS.
 *
 * Adapted from `scripts/check-write-surface.mjs` in
 * agentic-service-blueprinting (v0.5.0), which compares one row. This
 * instance overrides the adapter rather than sharing it (#115), so there
 * are four subjects instead of one, and the first is the one the upstream
 * script has no reason to own.
 *
 *   1. THE WIRING — and this is the assertion that matters most.
 *      `src/lib/agent/loop.ts` splices the adapter's FULL text — read from
 *      the loader's record, not imported again — into every system prompt on
 *      every turn, and `deployment/deployment.ts` supplies it on
 *      `agent.references['canvas-adapter']`, which the application's
 *      reference loader lays over the template's per name. Both must resolve
 *      `deployment/agent/canvas-adapter.md` and NOT
 *      `agentic-service-blueprinting/references/canvas-adapter.md`.
 *      Without this check the others still pass while the app serves
 *      the package's rulebook again: `npm update`, a pin bump, a merge
 *      that reverts one import line — the document below would be audited,
 *      correct, and unread.
 *
 *   2. THE TWO SURFACE ROWS ARE RENDERED, NOT WRITTEN OUT. This used to be
 *      two subjects and a list comparison: the override named the write tools
 *      and then said "That is the FULL write surface; nothing else writes",
 *      the read row did the same, and this check held both against
 *      `WRITE_TOOL_NAMES` / `READ_TOOL_NAMES` in the application's `specs.ts`.
 *      The agent reads those sentences as permission — a tool missing from
 *      the list is one it believes it cannot call — so the lists had to agree
 *      with the rosters, and two prose statements of one fact is what made
 *      that a check rather than a convention.
 *
 *      The application withdrew the second statement. A served adapter's
 *      surface rows are now PLACEHOLDERS, filled from the roster of the
 *      session it is served to, so the rows cannot disagree with what that
 *      session can call — and a deployment that narrows its roster narrows
 *      its adapter with it, which no hand-written list could do. What is left
 *      to check is that this override still carries the placeholders and has
 *      not grown a list of its own back: a hand-written tool name inside
 *      either row is the old defect returning, and a placeholder the
 *      application has renamed is a row that reaches the model with `{{`
 *      still in it. Both are read out of the application's own
 *      `tools/references.ts`, so the names cannot drift apart.
 *
 *   3. THE DEPENDENCY VOCABULARY. `cell_dependencies.kind` accepts
 *      `leads_to` and `enables` here. The override must state the enforced
 *      pair, and must not carry a retired spelling — `trigger` / `needs` is
 *      an enum this database refuses. An INSTALLED reference that teaches one
 *      cannot be edited from this repository, so the override names it; this
 *      holds that list to what the installed package actually says, in both
 *      directions — the empty list included, which is where the pinned
 *      package now is. See SUPERSESSION below. "What the installed package
 *      says" is only a fact while the installed package is the pinned one, so
 *      the run refuses first on an install behind the pin.
 *
 * Deliberately text-parsed, like upstream and like
 * `scripts/tests/toolParity.test.mjs`: the application's modules are
 * TypeScript behind a path alias, `loop.ts` imports supabase-js and
 * `deployment.ts` imports Vite `?raw` markdown, and a check that needs a
 * build step is a check that gets skipped.
 *
 * Static, needs no database, runs in `gates`.
 *
 *   node scripts/check-write-surface.mjs   (also: npm run check:write-surface)
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PACKAGE, refuseOnStaleInstall } from './template-pin.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/**
 * The two sides this check spans, since the application moved into the package.
 *
 * `ADAPTER` and `REGISTRATION` are THIS DEPLOYMENT's: the adapter is its
 * override of the template's, and the registration is the module `main.tsx`
 * imports before the application so the document is registered while the
 * agent's vocabulary is still being built. Both moved into `deployment/` with
 * the rest of this repository's own code.
 *
 * `LOOP`, `REFERENCES`, `DOCS` and `VENDORED` are the APPLICATION's, and are
 * read out of the package. The check is more useful for the split, not less:
 * it now asserts that this deployment's override actually reaches the prompt
 * of an application it does not control, which is the wiring most likely to
 * come apart at a pin bump and the least likely to be noticed when it does — a
 * loop that stopped splicing the loader's record would serve the template's
 * rulebook with nothing on screen to say so.
 */
const APP = 'node_modules/agentic-service-blueprinting/src'
const ADAPTER = 'deployment/agent/canvas-adapter.md'
const LOOP = `${APP}/lib/agent/loop.ts`
const DOCS = `${APP}/lib/agent/tools/referenceDocs.ts`
/** The loader that lays a deployment's documents over the template's. */
const REFERENCES = `${APP}/lib/agent/tools/references.ts`
/** One module per group of tool definitions — where a write declares itself. */
const DEFINITIONS = `${APP}/lib/agent/tools/definitions`
/**
 * Where this deployment supplies its reference documents, adapter included.
 *
 * It used to be `deployment/bootstrap.ts`, and the move is the release's, not
 * a tidy-up: the application built its reference vocabulary at module scope,
 * so a document handed over any later than the pre-import bootstrap would have
 * been served by a tool that never mentioned it. It reads its references when
 * a document is SERVED now, so the ordering rule is gone and the documents are
 * ordinary configuration.
 */
const REGISTRATION = 'deployment/deployment.ts'
/** The template's vendored skill references, which its loader imports. */
const VENDORED = `${APP}/lib/agent/skill`
const HARNESS = 'scripts/agent-harness/run.mjs'
const SCHEMA = 'supabase/schema.reference.sql'
const MIGRATIONS = 'supabase/migrations'

/** The package specifier the override exists to displace. */
const PACKAGE_ADAPTER = 'agentic-service-blueprinting/references/canvas-adapter.md'

/**
 * The specifier this deployment's registration must import the override under.
 *
 * `~/…`, not `@/…`. Two roots, two prefixes: `@/…` is the application's and now
 * resolves into the package, so an override written that way would ask the
 * package for a file only this repository has. The alias says at a glance which
 * side of the seam an import is on, and this is the one import in the wiring
 * that has to be on the deployment's side.
 */
const OVERRIDE_SPECIFIER = '~/agent/canvas-adapter.md'

/**
 * The heading whose list names the installed references that still teach the
 * retired vocabulary — see SUPERSESSION below.
 */
const SUPERSESSION_HEADING = '## Superseded package references'

// ---------------------------------------------------------------------------
// 1. The wiring
// ---------------------------------------------------------------------------

/**
 * Which canvas-adapter a module resolves, and under which binding.
 *
 * Matching the import alone would pass a file that imports the override and
 * then splices something else, so the caller also checks the binding is used
 * where the text is consumed. `expect` is the specifier that must be there.
 */
export function adapterImport(source, { specifier }) {
  const pattern = new RegExp(
    `import\\s+(\\w+)\\s+from\\s+'${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?raw'`,
  )
  const found = pattern.exec(source)
  return found ? found[1] : null
}

/**
 * `{ problem }` for each way a module could stop serving the override.
 *
 * The app modules import by alias; the harness runs under Node and reads the
 * repo-relative path with `readFileSync`, so it is matched as a path string.
 * `config` is this deployment's `DeploymentConfig` module, `references` the
 * application's loader.
 */
export function wiringFaults({ loop, config, references, harness }) {
  const faults = []

  // The prompt reads the LOADER's record rather than importing a copy of its
  // own, and reads it through the same call `get_reference` makes, against the
  // same roster — so the two cannot disagree about what the adapter says OR
  // about which tools its surface rows name. A second `?raw` import here is
  // how they came apart before: the tool served the replacement while the
  // prompt carried the template's.
  //
  // The name is `buildStableSystem` from template v1.44.27 on, where the
  // prompt was split into a stable half and a volatile one so it is built
  // once per call instead of twice. The splice belongs to the STABLE half and
  // this assertion follows it there — an adapter rendered per call would
  // defeat the caching the split exists for. The function name is matched on
  // purpose: when the template moves this again, that is a thing to look at,
  // not to paper over with a looser pattern.
  if (!/buildStableSystem[\s\S]*?readReference\('canvas-adapter',\s*roster\)/.test(loop)) {
    faults.push({
      problem: `${LOOP}'s buildStableSystem does not splice readReference('canvas-adapter', roster) — the prompt must carry the document the loader serves, rendered against the same roster, not a second copy`,
    })
  }
  if (adapterImport(loop, { specifier: OVERRIDE_SPECIFIER })) {
    faults.push({
      problem: `${LOOP} imports the override directly. It is registered in ${REGISTRATION} and read through the loader; a second copy can drift from the one get_reference serves`,
    })
  }
  if (adapterImport(loop, { specifier: PACKAGE_ADAPTER })) {
    faults.push({ problem: `${LOOP} still imports '${PACKAGE_ADAPTER}?raw'` })
  }

  const configBinding = adapterImport(config, { specifier: OVERRIDE_SPECIFIER })
  if (!configBinding) {
    faults.push({ problem: `${REGISTRATION} does not import '${OVERRIDE_SPECIFIER}?raw'` })
  } else if (!new RegExp(`'canvas-adapter':\\s*${configBinding}\\b`).test(config)) {
    faults.push({
      problem: `${REGISTRATION} supplies 'canvas-adapter' as something other than ${configBinding}`,
    })
  } else if (!/\breferences:\s*\{/.test(config)) {
    faults.push({
      problem: `${REGISTRATION} names the document but not on \`agent.references\` — a key outside that block is read by nothing`,
    })
  }
  if (adapterImport(config, { specifier: PACKAGE_ADAPTER })) {
    faults.push({ problem: `${REGISTRATION} still imports '${PACKAGE_ADAPTER}?raw'` })
  }
  // And the loader still lays a deployment's document OVER the template's per
  // name. The config field is only a place to put bytes; this is the line that
  // makes supplying `canvas-adapter` mean replacing the template's.
  if (!/Object\.hasOwn\(deployment, name\)/.test(references)) {
    faults.push({
      problem: `${REFERENCES} no longer prefers a deployment's document over the template's for a name both have — the override would be supplied and not served`,
    })
  }

  // The eval harness assembles the same prompt under Node. A harness reading
  // the package's adapter while the app reads the override is a suite that
  // grades the agent against a rulebook the agent never saw.
  if (!harness.includes(ADAPTER)) {
    faults.push({ problem: `${HARNESS} does not read ${ADAPTER}` })
  }

  return faults
}

// ---------------------------------------------------------------------------
// 2. The two surface rows, rendered rather than written out
// ---------------------------------------------------------------------------

/**
 * The two placeholder tokens, read out of the application's reference loader.
 *
 * Not spelled here. The loader substitutes these exact strings when it serves
 * the adapter, so a rename upstream has to fail this check rather than leave
 * this override reaching a model with `{{` still in it — and a check that
 * spelled its own copy of the token would pass a document nothing fills.
 *
 * Read textually for the reason the rest of this file is: the loader is
 * TypeScript behind a path alias and imports the application's own modules.
 */
export function placeholderTokens(source) {
  const tokens = {}
  for (const [key, constant] of [['read', 'READ_TOOLS_PLACEHOLDER'], ['write', 'WRITE_TOOLS_PLACEHOLDER']]) {
    const found = new RegExp(`export const ${constant} = '([^']+)'`).exec(source)
    if (!found) {
      throw new Error(
        `${REFERENCES} no longer exports ${constant}. The reader here can no longer see the ` +
          'token the loader substitutes, so nothing is being compared. Fix the reader.',
      )
    }
    tokens[key] = found[1]
  }
  return tokens
}

/**
 * `{ problem }` for each way a surface row could stop being rendered.
 *
 * Two failures, and the first is the one this replaced a list comparison with.
 * A row that carries its placeholder says what the session can call, whatever
 * that is; a row that names tools is a second statement of the roster, which
 * drifts from the first — the defect that had this override listing a retiring
 * alias for a release. So a tool-shaped code span BEFORE the em dash is a
 * fault, and the dash is where the comparable part of the row stops on both:
 * after it come `ui_command`'s data-changing commands on the write row and the
 * "none of them move the user's canvas" promise on the read row.
 *
 * The second is the token itself. A renamed placeholder is a row that reaches
 * the model unfilled, and `placeholderTokens` above is what makes the two
 * names one fact.
 */
export function surfaceRowFaults(markdown, tokens) {
  const faults = []
  for (const [surface, claim] of [
    ['write', 'That is the FULL write surface'],
    ['read', 'That is the FULL read surface'],
  ]) {
    const row = markdown.split('\n').find((line) => line.includes(claim))
    if (!row) {
      faults.push({ problem: `${ADAPTER} has no "${claim}" row at all` })
      continue
    }
    const token = tokens[surface]
    if (!row.includes(token)) {
      faults.push({
        problem: `${ADAPTER}'s ${surface} row does not carry ${token}, so the ${surface} tools it claims to state are whatever somebody last typed there`,
      })
    }
    const named = [...row.split('—')[0].matchAll(/`([a-z][a-z_]*_[a-z_]+)`/g)].map(([, name]) => name)
    for (const name of [...new Set(named)]) {
      faults.push({
        problem: `${ADAPTER}'s ${surface} row names ${name} by hand. The row is rendered from the session's roster; a name written here is a second statement of it that can only drift`,
      })
    }
  }
  return faults
}

/**
 * The names of the tools that WRITE, read out of the application's definition
 * modules.
 *
 * `WRITE_TOOL_NAMES` used to be a literal set in `specs.ts` and this read it
 * from there. The set is gone: a write is now declared with
 * `defineWriteTool`, which fixes the surface, the availability and the session
 * attribution by construction, so the roster is not a list anybody maintains —
 * it is which constructor a tool was declared with. That is a better subject
 * than the list was, because a tool cannot be a write and be absent from it.
 *
 * Nothing in the four subjects above needs this any more, and it lives here
 * anyway: `scripts/tests/who-writes-what.test.mjs` holds this deployment's
 * record-ownership rows to the write surface, and a second parser of the
 * application's tool modules is a second reader to drift from this one.
 *
 * @param sources The definition modules' text, in any order.
 */
export function writeToolNames(sources) {
  const names = sources.flatMap((source) => [
    ...source.matchAll(/defineWriteTool\(\{\s*\n\s*name: '([a-z_]+)'/g),
  ].map(([, name]) => name))
  if (names.length === 0) {
    throw new Error(
      `no defineWriteTool declarations found under ${DEFINITIONS}. The reader here can no ` +
        'longer see which tools write, so a check over the write surface is running over ' +
        'nothing. Fix the reader.',
    )
  }
  return [...new Set(names)].sort()
}

// ---------------------------------------------------------------------------
// 3. The dependency vocabulary
// ---------------------------------------------------------------------------

/** Names on one side and not the other, plus any the doc lists twice. */
export function differences(documented, declared) {
  const listed = new Set(documented)
  const real = new Set(declared)
  return {
    undocumented: declared.filter((name) => !listed.has(name)),
    unknown: documented.filter((name) => !real.has(name)),
    duplicated: [...new Set(documented.filter((name, i) => documented.indexOf(name) !== i))],
  }
}

/**
 * Retired spellings of `cell_dependencies.kind`, and what this database calls
 * them instead.
 *
 * NOT upstream's table, which is the same two rows INVERTED: upstream retired
 * `leads_to` in favour of `trigger`, this instance did the opposite, and
 * vendoring it unchanged would fail on correct code — `specs.ts`'s
 * `create_cell_dependency` declares `enum: ['leads_to', 'enables']`.
 *
 * `trigger` and `needs` are ordinary English AND, in `trigger`'s case, a
 * Postgres object kind ("the integrity trigger"), so only their code-span
 * form counts. `sets_off` was the intermediate spelling (migration
 * 20260820110000, replaced by 20260820180000) and is not English, so it
 * counts anywhere. `trigger-vs-needs` is spelled out because it is the exact
 * phrase the pinned package's adapter uses in bare prose, and bare prose is
 * what a code-span matcher misses — that one line reached every system prompt
 * this app sent.
 */
export const RETIRED_KINDS = [
  [/`trigger`/, '`trigger`', 'leads_to'],
  [/`needs`/, '`needs`', 'enables'],
  [/\bsets_off\b/, 'sets_off', 'leads_to'],
  [/\btrigger-vs-needs\b/, 'trigger-vs-needs', 'leads_to-vs-enables'],
]

/**
 * The values `cell_dependencies.kind` accepts, from the live-schema snapshot.
 *
 * `supabase/schema.reference.sql` rather than a migration replay, for the
 * reason upstream gives about its generated schema: reading the constraint out
 * of the series means ordering 20-odd files and tracking drop/re-add across a
 * table rename, and a check that reimplements migration replay is a check with
 * its own bugs. The parse insists on exactly one definition, so a future
 * migration that redefines the constraint fails here loudly rather than being
 * read stale.
 *
 * The snapshot is written by hand from the live database, so `enforcedKinds`
 * alone would pass on a stale file — `latestMigratedKinds` below closes that.
 */
export function enforcedKinds(sql) {
  const pattern = /kind text not null[^,]*check \(kind in \(([^)]*)\)\)/g
  const found = [...sql.matchAll(pattern)].filter(([match]) => /leads_to|trigger|sets_off/.test(match))
  if (found.length !== 1) {
    throw new Error(
      `expected exactly one cell-dependency kind constraint in ${SCHEMA}, found ${found.length}`,
    )
  }
  return [...found[0][1].matchAll(/'([a-z_]+)'/g)].map(([, value]) => value)
}

/**
 * The values the LAST migration to define the constraint states.
 *
 * The bug this catches: a migration changes the enum and nobody rewrites the
 * snapshot. `enforcedKinds` would then read a file describing a database that
 * no longer exists — which is the exact failure `supabase/schema.reference.sql`
 * documents in its own header, six days of describing dropped tables — and
 * this check would grade the adapter against it and pass.
 *
 * The constraint kept its original name across the table rename (the rename
 * migration says so on purpose), so both spellings are matched.
 */
export function latestMigratedKinds(files) {
  const pattern = /constraint (?:cell_triggers|cell_dependencies)_kind_check\s+check \(kind in \(([^)]*)\)\)/
  const defining = files
    .filter(({ sql }) => pattern.test(sql))
    .sort((a, b) => a.name.localeCompare(b.name))
  if (defining.length === 0) throw new Error(`no cell-dependency kind constraint in ${MIGRATIONS}`)
  const last = defining.at(-1)
  return {
    file: last.name,
    kinds: [...pattern.exec(last.sql)[1].matchAll(/'([a-z_]+)'/g)].map(([, value]) => value),
  }
}

/** The values the override's enum bullet states. */
export function documentedKinds(markdown) {
  const row = markdown.split('\n').find((line) => line.trimStart().startsWith('- `cell_dependencies.kind`:'))
  if (!row) throw new Error(`no cell_dependencies.kind enum bullet found in ${ADAPTER}`)
  const list = row.slice(row.indexOf(':', row.indexOf('kind`')) + 1).split('.')[0]
  return [...list.matchAll(/`([a-z_]+)`/g)].map(([, value]) => value)
}

/**
 * The override, minus the one section allowed to name the retired spellings.
 *
 * The supersession block's whole job is to say which installed documents still
 * teach `trigger` / `needs`, and it cannot say that without saying it. Every
 * other line of the override is subject.
 */
export function scannableAdapter(markdown) {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => line.trim() === SUPERSESSION_HEADING)
  if (start === -1) throw new Error(`no "${SUPERSESSION_HEADING}" section in ${ADAPTER}`)
  const end = lines.findIndex((line, i) => i > start && line.startsWith('## '))
  return lines.filter((_, i) => i < start || (end !== -1 && i >= end))
}

/** `{ line, found, instead }` for every retired spelling in `lines`. */
export function retiredMentions(lines) {
  const hits = []
  lines.forEach((text, index) => {
    for (const [pattern, found, instead] of RETIRED_KINDS) {
      if (pattern.test(text)) hits.push({ line: index + 1, found, instead })
    }
  })
  return hits
}

// ---------------------------------------------------------------------------
// SUPERSESSION — the installed documents this repo cannot fix
// ---------------------------------------------------------------------------

/**
 * `SUPERSESSION_HEADING` (declared above) heads the list of installed
 * references that teach the retired vocabulary — empty once the package
 * agrees, as asb v1.0.0 does.
 *
 * They live in `node_modules/` and this repository cannot edit them, so the
 * only honest remedy is for the served rulebook to say so where the agent
 * reads it. That makes the list PROMPT TEXT, and prompt text that has drifted
 * is a lie in the file the agent trusts — so it is held to the installed
 * package in both directions: a sixth document that starts teaching the wrong
 * enum fails here, and so does an entry left behind after a pin bump fixes one.
 *
 * Why here and not alongside the byte-identity gate in
 * `scripts/check-reconciled-files.mjs`: that gate asks whether two copies of
 * ONE path still agree. This list is not a copy of anything — it names
 * documents inside the package from a document outside it, and the event that
 * breaks it is a pin bump changing what those documents say, which leaves
 * every byte on both sides of the gate exactly where it was.
 */

/** The package-relative reference paths the supersession block lists. */
export function supersededPaths(markdown) {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => line.trim() === SUPERSESSION_HEADING)
  if (start === -1) throw new Error(`no "${SUPERSESSION_HEADING}" section in ${ADAPTER}`)
  const end = lines.findIndex((line, i) => i > start && line.startsWith('## '))
  const body = lines.slice(start, end === -1 ? undefined : end)
  return body
    .filter((line) => line.startsWith('- `'))
    .map((line) => /`([^`]+)`/.exec(line)[1])
}

/** Names in one list and not the other. */
export function listDifferences(claimed, actual) {
  const said = new Set(claimed)
  const real = new Set(actual)
  return {
    unnamed: actual.filter((path) => !said.has(path)),
    stale: claimed.filter((path) => !real.has(path)),
  }
}

// ---------------------------------------------------------------------------

export function compare({ read, referenceDocs, migrations }) {
  const adapter = read(ADAPTER)
  const references = read(REFERENCES)

  const kinds = enforcedKinds(read(SCHEMA))
  const migrated = latestMigratedKinds(migrations)
  const documented = documentedKinds(adapter)

  return {
    wiring: wiringFaults({
      loop: read(LOOP),
      config: read(REGISTRATION),
      references,
      harness: read(HARNESS),
    }),
    rows: surfaceRowFaults(adapter, placeholderTokens(references)),
    snapshotDrift:
      [...kinds].sort().join(',') === [...migrated.kinds].sort().join(',')
        ? null
        : { file: migrated.file, migrated: migrated.kinds, snapshot: kinds },
    kinds: differences(documented, kinds),
    retired: retiredMentions(scannableAdapter(adapter)),
    superseded: listDifferences(
      supersededPaths(adapter),
      referenceDocs
        .filter(({ text }) => RETIRED_KINDS.some(([pattern]) => pattern.test(text)))
        .map(({ name }) => name),
    ),
  }
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

/**
 * The installed references this app SERVES, by package-relative path.
 *
 * Derived from the template loader's own `?raw` imports rather than by
 * walking the package: the package ships IDE-only references this app never
 * serves, and a check that demanded the override name those would be
 * demanding a warning about a document the agent cannot open. The loader
 * imports the template's vendored copies under `src/lib/agent/skill/`, which
 * this repository holds byte-identical to the pinned template.
 */
function servedReferenceDocs(root) {
  const source = readFileSync(join(root, DOCS), 'utf8')
  return [...source.matchAll(/from '@\/lib\/agent\/skill\/([^']+\.md)\?raw'/g)].map(
    ([, name]) => ({ name, text: readFileSync(join(root, VENDORED, name), 'utf8') }),
  )
}

function migrationDocs(root) {
  const dir = join(root, MIGRATIONS)
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }))
}

function main() {
  const root = REPO_ROOT

  // Subject 4 reads the INSTALLED references, so an install behind the pin
  // makes it audit the previous version's documents: the adapter would be
  // accused of failing to warn about a reference that no longer teaches a
  // retired kind, or of warning about one that has only just started to.
  // Subjects 1-3 never open the package and would still be sound — but this
  // refuses the whole run anyway, because the four subjects print as one
  // verdict and a person reading "these are the problems" is owed a list that
  // is entirely true. The wiring assertion is not lost, only deferred by the
  // one command the message names (#510).
  refuseOnStaleInstall(root)

  const result = compare({
    read: (path) => readFileSync(join(root, path), 'utf8'),
    referenceDocs: servedReferenceDocs(root),
    migrations: migrationDocs(root),
  })

  const problems = []

  for (const { problem } of result.wiring) {
    problems.push(
      `${problem}. The adapter is spliced into EVERY system prompt, so this is ` +
        'the pinned package\'s rulebook reaching the agent again.',
    )
  }
  for (const { problem } of result.rows) problems.push(problem)
  if (result.snapshotDrift) {
    const { file, migrated, snapshot } = result.snapshotDrift
    problems.push(
      `${MIGRATIONS}/${file} defines kind as (${migrated.join(', ')}) but ${SCHEMA} ` +
        `says (${snapshot.join(', ')}). The snapshot is hand-written; regenerate it.`,
    )
  }
  for (const value of result.kinds.undocumented) {
    problems.push(`the constraint accepts kind '${value}', which ${ADAPTER} does not state`)
  }
  for (const value of result.kinds.unknown) {
    problems.push(`${ADAPTER} states kind '${value}', which the constraint refuses`)
  }
  for (const { line, found, instead } of result.retired) {
    problems.push(`${ADAPTER}:${line} says ${found}; this database calls it ${instead}`)
  }
  for (const name of result.superseded.unnamed) {
    problems.push(
      `${PACKAGE}/${name} teaches a retired dependency kind and ${ADAPTER}'s ` +
        'supersession list does not name it — the agent reads it unwarned',
    )
  }
  for (const name of result.superseded.stale) {
    problems.push(
      `${ADAPTER} supersedes ${name}, which no longer teaches a retired kind — ` +
        'drop the entry rather than warning about a document that is now correct',
    )
  }

  if (problems.length === 0) {
    console.log(
      `${ADAPTER} is the document loop.ts splices and get_reference serves; both of its ` +
        "surface rows are rendered from the session's roster rather than written out; its " +
        'dependency kinds are the ones the constraint enforces',
    )
    return
  }

  for (const problem of problems) console.error(problem)
  console.error(
    `\nThe agent treats ${ADAPTER} as the rulebook and its surface rows as ` +
      'permission. Fix the document, or the wiring that carries it, so what the agent ' +
      'reads is what the session can do.',
  )
  process.exit(1)
}

// Same shape as upstream: comparing against a hand-built `file://` URL
// silently no-ops whenever the path needs escaping.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) main()
