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
 *      `src/lib/agent/loop.ts` splices the adapter's FULL text into every
 *      system prompt on every turn, and `src/lib/agent/tools/read.ts`
 *      serves it under the bare name `canvas-adapter`. Both must resolve
 *      `src/lib/agent/canvas-adapter.md` and NOT
 *      `agentic-service-blueprinting/references/canvas-adapter.md`.
 *      Without this check the other three still pass while the app serves
 *      the package's rulebook again: `npm update`, a pin bump, a merge
 *      that reverts one import line — the rows below would be audited,
 *      correct, and unread.
 *
 *   2. THE WRITE ROW. The override names the write tools and then says
 *      "That is the FULL write surface; nothing else writes". The agent
 *      reads that sentence as permission: a tool missing from the list is
 *      a tool it believes it cannot call. `WRITE_TOOL_NAMES` in
 *      `src/lib/agent/tools/specs.ts` is the source of truth — the loop
 *      gates batch etiquette and the viewer refusal on it.
 *
 *   3. THE READ ROW, the same way, against `READ_TOOL_NAMES`. Note that
 *      the read surface is NOT the complement of the write surface: the
 *      complement sweeps in `focus_cell`, `set_sidebar` and the rest of
 *      `INTERFACE_TOOL_NAMES`, which the read row's own sentence excludes
 *      ("none of them move the user's canvas"). specs.ts carries the
 *      classification and its reasoning.
 *
 *   4. THE DEPENDENCY VOCABULARY. `cell_dependencies.kind` accepts
 *      `leads_to` and `enables` here; the pinned package still teaches
 *      `trigger` / `needs`, an enum this database refuses. The override
 *      must state the enforced pair, and must not carry a retired
 *      spelling. An INSTALLED reference that does cannot be edited from
 *      this repository, so the override names it; this holds that list to
 *      what the installed package actually says, in both directions —
 *      the empty list included, once the package agrees (asb v1.0.0 did).
 *      See SUPERSESSION below.
 *
 * Deliberately text-parsed, like upstream and like
 * `scripts/tests/toolParity.test.mjs`: specs.ts is TypeScript behind a
 * path alias, loop.ts and read.ts import supabase-js and Vite `?raw`
 * markdown, and a check that needs a build step is a check that gets
 * skipped.
 *
 * Static, needs no database, runs in `gates`.
 *
 *   node scripts/check-write-surface.mjs   (also: npm run check:write-surface)
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

const ADAPTER = 'src/lib/agent/canvas-adapter.md'
const SPECS = 'src/lib/agent/tools/specs.ts'
const LOOP = 'src/lib/agent/loop.ts'
const READ = 'src/lib/agent/tools/read.ts'
const HARNESS = 'scripts/agent-harness/run.mjs'
const SCHEMA = 'supabase/schema.reference.sql'
const MIGRATIONS = 'supabase/migrations'
const PACKAGE = 'node_modules/agentic-service-blueprinting'

/** The package specifier the override exists to displace. */
const PACKAGE_ADAPTER = 'agentic-service-blueprinting/references/canvas-adapter.md'

/** The alias specifier the app must import instead. */
const OVERRIDE_SPECIFIER = '@/lib/agent/canvas-adapter.md'

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
 */
export function wiringFaults({ loop, read, harness }) {
  const faults = []

  const loopBinding = adapterImport(loop, { specifier: OVERRIDE_SPECIFIER })
  if (!loopBinding) {
    faults.push({
      problem: `${LOOP} does not import '${OVERRIDE_SPECIFIER}?raw'`,
    })
  } else if (!new RegExp(`buildSystem[\\s\\S]*?\\b${loopBinding}\\b`).test(loop)) {
    faults.push({
      problem: `${LOOP} imports the override as ${loopBinding} but buildSystem does not splice it`,
    })
  }
  if (adapterImport(loop, { specifier: PACKAGE_ADAPTER })) {
    faults.push({ problem: `${LOOP} still imports '${PACKAGE_ADAPTER}?raw'` })
  }

  const readBinding = adapterImport(read, { specifier: OVERRIDE_SPECIFIER })
  if (!readBinding) {
    faults.push({ problem: `${READ} does not import '${OVERRIDE_SPECIFIER}?raw'` })
  } else if (!new RegExp(`'canvas-adapter':\\s*${readBinding}\\b`).test(read)) {
    faults.push({
      problem: `${READ}'s REFERENCES maps 'canvas-adapter' to something other than ${readBinding}`,
    })
  }
  if (adapterImport(read, { specifier: PACKAGE_ADAPTER })) {
    faults.push({ problem: `${READ} still imports '${PACKAGE_ADAPTER}?raw'` })
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
// 2 & 3. The two surface rows
// ---------------------------------------------------------------------------

/**
 * The tool names in a `new Set([...])` declared in specs.ts.
 *
 * Read textually rather than imported, for the reason upstream gives: specs.ts
 * is TypeScript behind a path alias, and every consumer that wants the real
 * value already pays for a rollup bundle (`scripts/agent-harness/run.mjs`).
 */
export function declaredTools(source, setName) {
  const block = new RegExp(`export const ${setName} = new Set\\(\\[([\\s\\S]*?)^\\]\\)`, 'm').exec(
    source,
  )
  if (!block) throw new Error(`no ${setName} set found in ${SPECS}`)
  return [...block[1].matchAll(/'([a-z_]+)'/g)].map(([, name]) => name)
}

/**
 * The tool names one surface row lists.
 *
 * The row ends its list at an em dash — after it come `ui_command`'s
 * data-changing commands on the write row, and the "none of them move the
 * user's canvas" promise on the read row, so the dash is where the comparable
 * list stops on both.
 */
export function documentedTools(markdown, claim) {
  const row = markdown.split('\n').find((line) => line.includes(claim))
  if (!row) throw new Error(`no "${claim}" row found in ${ADAPTER}`)
  const list = row.split('—')[0]
  return [...list.matchAll(/`([a-z_]+)`/g)].map(([, name]) => name)
}

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

// ---------------------------------------------------------------------------
// 4. The dependency vocabulary
// ---------------------------------------------------------------------------

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
 * Why here and not in `scripts/check-template-quarantine.mjs`: that guard
 * inspects MERGE COMMITS, asking whether a template merge touched a file this
 * instance owns. It has no notion of installed package content and would never
 * run on the event that matters — a lockfile pin bump, which is not a merge
 * from the template at all.
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
  const specs = read(SPECS)

  const kinds = enforcedKinds(read(SCHEMA))
  const migrated = latestMigratedKinds(migrations)
  const documented = documentedKinds(adapter)

  return {
    wiring: wiringFaults({ loop: read(LOOP), read: read(READ), harness: read(HARNESS) }),
    write: differences(
      documentedTools(adapter, 'That is the FULL write surface'),
      declaredTools(specs, 'WRITE_TOOL_NAMES'),
    ),
    read: differences(
      documentedTools(adapter, 'That is the FULL read surface'),
      declaredTools(specs, 'READ_TOOL_NAMES'),
    ),
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
 * Derived from `read.ts`'s own `?raw` imports rather than by walking the
 * package: the package ships IDE-only references this app never serves, and a
 * check that demanded the override name those would be demanding a warning
 * about a document the agent cannot open.
 */
function servedReferenceDocs(root) {
  const source = readFileSync(join(root, READ), 'utf8')
  return [...source.matchAll(/from 'agentic-service-blueprinting\/([^']+\.md)\?raw'/g)].map(
    ([, name]) => ({ name, text: readFileSync(join(root, PACKAGE, name), 'utf8') }),
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
  for (const [surface, diff] of [['write', result.write], ['read', result.read]]) {
    const roster = surface === 'write' ? 'WRITE_TOOL_NAMES' : 'READ_TOOL_NAMES'
    for (const name of diff.undocumented) {
      problems.push(`${name} is a ${surface} tool that ${ADAPTER} does not list`)
    }
    for (const name of diff.unknown) {
      problems.push(`${ADAPTER}'s ${surface} row lists ${name}, which is not in ${roster}`)
    }
    for (const name of diff.duplicated) {
      problems.push(`${ADAPTER}'s ${surface} row lists ${name} more than once`)
    }
  }
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
      `${ADAPTER} is what loop.ts and read.ts serve; its surface rows are ` +
        'exactly WRITE_TOOL_NAMES and READ_TOOL_NAMES; its dependency kinds are ' +
        'the ones the constraint enforces',
    )
    return
  }

  for (const problem of problems) console.error(problem)
  console.error(
    `\nThe agent treats ${ADAPTER} as the rulebook and its surface rows as ` +
      `permission. Fix the document, or the rosters in ${SPECS}, so the two agree.`,
  )
  process.exit(1)
}

// Same shape as upstream: comparing against a hand-built `file://` URL
// silently no-ops whenever the path needs escaping.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) main()
