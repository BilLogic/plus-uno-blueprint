import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { appSource } from '../app-source.mjs'

/**
 * The eval harness must run against the app's tool surface.
 *
 * HOW THE SURFACE IS DECLARED NOW. Every tool is one definition module under
 * `lib/agent/tools/definitions/` — its name, its surface ('read' | 'interface'
 * | 'write'), its zod `args`, where it may run, and its `run`. `specs.ts` is a
 * single line projecting that list (`TOOL_DEFINITIONS.map(toolSpec)`), the
 * session roster derives from it, and `registry.ts` is a lookup rather than a
 * switch. There is no literal spec array to parse and no `WRITE_TOOL_NAMES` set
 * to read the names out of, so this file DERIVES both — the roster and each
 * tool's surface — from the definition list it imports, the way the
 * application derives them itself.
 *
 * What that leaves for a test. Inside the application, a schema and its handler
 * are one object with one typed `run`, so the compiler now holds them together
 * and the argument-parity checks this file used to make over `registry.ts`'s
 * switch have no subject. What no compiler sees is THIS repository's harness:
 * `scripts/agent-harness/run.mjs` runs its own tool implementations (the app's
 * cannot load from Node), reads the argument bag by hand, and can go on
 * answering a tool the application has retired. That is what is checked here,
 * and it is why this deployment's copy of this file is not the template's.
 *
 * `cases.mjs` keeps its own WRITES set (it cannot import from run.mjs
 * without a cycle), and that list is the dangerous one: a name missing
 * from it makes a "no writes happened" trace check PASS, so drift there
 * hides itself instead of failing loudly. Hence a test rather than a
 * comment asking humans to remember.
 */
// The runner copies test files into a temp dir, so paths resolve from the
// working directory (npm test runs at the repo root), not from import.meta.
const REPO_ROOT = process.cwd()

function read(path) {
  return readFileSync(resolve(REPO_ROOT, path), 'utf8')
}

/** The string members of a `new Set([...])` assigned to `name`. */
function setMembers(source, name) {
  const at = source.indexOf(`${name} = new Set([`)
  assert.ok(at !== -1, `${name} not found`)
  const body = source.slice(at, source.indexOf('])', at))
  return new Set([...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))
}

/**
 * The declarations are IMPORTED, not parsed. The definition list is the one
 * statement of what a tool is, and `specs.ts` loads in Node once vitest has
 * resolved the `@/…` alias and Vite's `?raw` imports for it — so the roster,
 * each tool's surface and each tool's argument names are read from the objects
 * the app hands its providers rather than from a regex over their source.
 *
 * The two files are still read as TEXT as well, and only for the questions
 * that are about their SHAPE: that the spec table declares no tool of its own
 * and the dispatcher switches on no name. Those are the old layout, and the
 * check that it stays gone cannot be made against the value.
 *
 * The two sides now live in different repositories: the tool surface belongs
 * to the APPLICATION, which this deployment imports out of the installed
 * package, while the harness that has to match it is this deployment's own
 * script. That is what this check was always about; it is only now literally
 * true. `appSource` refuses a missing package file by name, because an
 * unreadable specs.ts would otherwise parse as a tool surface with nothing in
 * it.
 */
const TOOL_DEFINITIONS = (await import('@/lib/agent/tools/definitions')).TOOL_DEFINITIONS
const TOOL_SPECS = (await import('@/lib/agent/tools/specs')).TOOL_SPECS
const specs = appSource('lib/agent/tools/specs.ts')
const registry = appSource('lib/agent/tools/registry.ts')
const harness = read('scripts/agent-harness/run.mjs')
const surfaceEntry = read('scripts/agent-harness/app-surface.entry.ts')
const cases = read('scripts/agent-harness/cases.mjs')

/** The write roster, derived from the definitions the way the app derives it. */
const WRITE_TOOL_NAMES = new Set(
  TOOL_DEFINITIONS.filter((tool) => tool.surface === 'write').map((tool) => tool.name),
)
/** Every tool's argument names, as its zod schema declares them. */
const ARGS_OFFERED = new Map(
  TOOL_DEFINITIONS.map((tool) => [tool.name, new Set(Object.keys(tool.args.shape))]),
)

test('harness imports the app tool specs instead of forking them', () => {
  // The wiring: rolldown bundles app-surface.entry.ts, the harness's own
  // neighbour, and the runner destructures the declarations from the bundle.
  // The entry exists because the four names the harness needs are no longer
  // four exports of one module — it re-exports what the app states and derives
  // what the app derives.
  assert.ok(
    harness.includes("'app-surface.entry.ts'"),
    'run.mjs no longer bundles app-surface.entry.ts, its neighbour',
  )
  assert.match(
    surfaceEntry,
    /export\s*\{\s*TOOL_SPECS\s*\}\s*from\s*'@\/lib\/agent\/tools\/specs'/,
    'app-surface.entry.ts no longer re-exports TOOL_SPECS from the application’s specs.ts',
  )
  // The two rosters the harness gates on are DERIVED from the definitions —
  // the surface and the availability each definition states — not listed.
  assert.match(
    surfaceEntry,
    /WRITE_TOOL_NAMES = new Set\(\s*TOOL_DEFINITIONS\.filter\(\(tool\) => tool\.surface === 'write'\)/,
    'app-surface.entry.ts no longer derives WRITE_TOOL_NAMES from the definitions',
  )
  assert.match(
    surfaceEntry,
    /MOBILE_READ_TOOL_NAMES = new Set\(\s*TOOL_DEFINITIONS\.filter\(\(tool\) => tool\.availability\.mobile\)/,
    'app-surface.entry.ts no longer derives MOBILE_READ_TOOL_NAMES from the definitions',
  )
  // The reference list too, so the harness offers exactly the list the app
  // offers.
  assert.match(
    surfaceEntry,
    /export\s*\{\s*REFERENCE_NAMES\s*\}\s*from\s*'@\/lib\/agent\/tools\/referenceNames'/,
    'app-surface.entry.ts no longer re-exports REFERENCE_NAMES from referenceNames.ts',
  )
  assert.match(
    harness,
    /\{\s*TOOL_SPECS,\s*WRITE_TOOL_NAMES,\s*MOBILE_READ_TOOL_NAMES,\s*REFERENCE_NAMES\s*\}/,
    'run.mjs no longer imports TOOL_SPECS/WRITE_TOOL_NAMES/MOBILE_READ_TOOL_NAMES/REFERENCE_NAMES from the bundled surface',
  )
  // And no fork crept back: a local spec array would re-declare tool
  // objects (`name: '...'` entries) and a local write set would shadow the
  // derived roster.
  for (const [file, source] of [
    ['run.mjs', harness],
    ['app-surface.entry.ts', surfaceEntry],
  ]) {
    assert.ok(
      !/TOOL_SPECS\s*(?::[^=]*)?=\s*\[/.test(source),
      `${file} declares a local TOOL_SPECS array — the fork is back`,
    )
    assert.ok(
      !/^\s*\{\s*name: '[a-z_]+', description:/m.test(source),
      `${file} contains inline tool-spec declarations — the fork is back`,
    )
  }
  assert.ok(
    !harness.includes('WRITE_TOOLS = new Set'),
    'run.mjs declares a local WRITE_TOOLS set — the fork is back',
  )
  // The entry DERIVES its write set from the definitions (asserted above); a
  // `new Set` of NAMES in the runner would be a fork of it.
  assert.ok(
    !/WRITE_TOOL_NAMES\s*=\s*new Set\(\[/.test(harness),
    'run.mjs lists the write roster by name — the fork is back',
  )
})

test('cases.mjs WRITES agrees with the app write roster', () => {
  const rubric = setMembers(cases, 'WRITES')
  // It must MATCH — more or less both break: a missing name makes
  // "zero writes" checks pass vacuously; an extra one fails them falsely.
  assert.deepEqual(
    [...rubric].sort(),
    [...WRITE_TOOL_NAMES].sort(),
    'cases.mjs WRITES drifted from the write surface the definitions declare',
  )
})

/**
 * The layout the checks above read, held in place.
 *
 * A tool is one definition, so the spec table declares nothing and the
 * dispatcher switches on nothing. Either shape coming back would not fail the
 * checks here — it would make them read half a surface — so the absence is
 * asserted rather than assumed.
 */
test('the spec table declares nothing and the dispatcher switches on nothing', () => {
  assert.ok(
    !/^\s*\{\s*name: '[a-z_]+'/m.test(specs),
    'specs.ts holds an inline tool-spec literal again — a tool is one definition',
  )
  assert.ok(
    !/\bcase '[a-z_]+':/.test(registry),
    'registry.ts dispatches by switch case again — a tool is run from its definition',
  )
  assert.match(
    specs,
    /TOOL_SPECS: ToolSpec\[\] = TOOL_DEFINITIONS\.map\(toolSpec\)/,
    'TOOL_SPECS is no longer a projection of the definition list',
  )
})

test('the spec table is the definition list, projected', () => {
  assert.deepEqual(
    TOOL_SPECS.map((spec) => spec.name),
    TOOL_DEFINITIONS.map((tool) => tool.name),
  )
  for (const spec of TOOL_SPECS) {
    assert.equal(spec.parameters.type, 'object', `${spec.name} has no object schema`)
  }
})

/**
 * The harness runs its OWN tool implementations (the app's dispatch cannot
 * load from Node), and nothing checked that it covers the roster it imports. It
 * bit: renaming list_scenarios to list_blueprint rewrote the harness's case
 * LABEL and left it calling the old phases query, so the harness answered
 * list_blueprint with the pre-granularity shape and silently rehearsed a
 * different agent than the app runs. Writes are exempt — they short-circuit
 * to a generic dry-run response before this switch.
 */
test('every read tool has a harness implementation', () => {
  for (const tool of TOOL_DEFINITIONS) {
    if (WRITE_TOOL_NAMES.has(tool.name)) continue
    assert.ok(
      harness.includes(`case '${tool.name}':`),
      `${tool.name} is a read tool with no case in scripts/agent-harness/run.mjs — the harness would throw on it`,
    )
  }
})

/**
 * The other direction: a harness case for a tool no definition declares is a
 * rehearsal nobody can reach — the residue a retirement leaves when the
 * application moves on and the harness keeps the old arm. `list_scenarios` was
 * exactly that after `list_blueprint` took its place with a granularity
 * argument, and an arm that answers a name the model is never offered looks
 * like coverage while covering nothing.
 */
test('every harness case is a tool the app still declares', () => {
  const declared = new Set(TOOL_DEFINITIONS.map((tool) => tool.name))
  const answered = [...harness.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1])
  const orphans = answered.filter((name) => !declared.has(name))
  assert.deepEqual(
    orphans,
    [],
    `run.mjs answers tools no definition declares: ${orphans.join(', ')}`,
  )
})

/**
 * ACCEPTED ALIASES — a name a caller may still send that the schema no longer
 * advertises.
 *
 * A rename on this wire cannot be a swap. Anything pinned to an older
 * description of these tools keeps sending the old word, and a handler that
 * stopped reading it turns a working call into a refusal. So the schema moves
 * first and the alias is accepted for a release.
 *
 * This file used to carry the alias list itself, as hand-written carve-outs
 * exempting `create_slice.description` and `update_slice.description` from the
 * argument checks below, because nothing in the application said an alias
 * existed — the handler read the old key beside the new one and only a test
 * could record why. A definition states its own `aliases` now, so the list is
 * read from the tools instead of kept here, and the carve-outs are gone: there
 * is nothing left to exempt and nothing to go stale.
 *
 * What is worth holding is that an alias still MEANS something: it must name
 * an argument the schema offers, or it resolves to a key no handler reads, and
 * it must not itself be advertised, or the schema is teaching the old word it
 * was written to retire.
 */
test('every accepted alias names an argument the schema offers', () => {
  const broken = []
  for (const tool of TOOL_DEFINITIONS) {
    const offered = ARGS_OFFERED.get(tool.name)
    for (const [alias, name] of Object.entries(tool.aliases ?? {})) {
      if (!offered.has(name)) broken.push(`${tool.name}.${alias} → ${name} (no such argument)`)
      if (offered.has(alias)) broken.push(`${tool.name}.${alias} is advertised and aliased at once`)
    }
  }
  assert.deepEqual(broken.sort(), [], `an alias points at nothing: ${broken.join(', ')}`)
})

/**
 * THE NAMES ON THE WIRE, on the harness's side.
 *
 * A tool spec is a contract with a model. The model can only send the
 * properties the schema declares, and a handler can only read the keys it asks
 * for by name — nothing connects the two, and nothing fails when they
 * disagree. A handler reading a key the schema never offers gets `undefined`
 * on every call and reports success; both are silent, and both look exactly
 * like working software from the outside.
 *
 * Inside the application that is now a type error: `run` receives the type its
 * own zod schema infers. The harness gets no such help — it reads `args.kind`
 * out of a plain object — and it is the harness that rehearses the agent this
 * deployment ships, so a filter it reads under the wrong name comes back null
 * on every call and the rehearsed read is quietly wider than the real one.
 * That had happened: `list_blueprint` advertises `kind` and the harness read
 * `args.path_type`, so every path-kind filter in the suite was a no-op.
 *
 * Only the ONE direction is checked. The harness deliberately reads less than
 * the schema offers — it has no services, so it ignores `service` on every
 * scoped read — and it answers writes with a single dry-run sentence before
 * the switch, so the argument bag of a write is not read here at all.
 */
function argKeysRead(body) {
  return [...body.matchAll(/args\.([a-z_]+)|args\['([a-z_]+)'\]/g)].map((m) => m[1] ?? m[2])
}

/**
 * Helpers that read the argument bag on a case's behalf, as `name -> keys`.
 *
 * A case does not have to read `args` in its own body: the harness pulls the
 * portal reads out into `realListBlueprint` / `realSearchBlueprint`, which take
 * the bag whole. A reader that looked only inside the `case` arms would miss
 * every key they read — which is where the `path_type` drift above had been
 * sitting. Matched on the parameter list rather than on a list of helper
 * names, so a third helper written tomorrow is followed tomorrow.
 */
function argKeysByHelper(source) {
  const helpers = new Map()
  for (const mark of source.matchAll(
    /^(?:export )?(?:async )?function ([A-Za-z0-9_]+)\(([^)]*)\)/gm,
  )) {
    if (!/\bargs\b/.test(mark[2])) continue
    const start = mark.index
    const end = source.indexOf('\n}', start)
    const body = source.slice(start, end === -1 ? source.length : end)
    // A function holding `case '…':` arms is the DISPATCHER, not a helper.
    // Reading it as one would credit whichever case called it with every key
    // the whole switch reads.
    if (/case '[a-z_]+':/.test(body)) continue
    helpers.set(mark[1], new Set(argKeysRead(body)))
  }
  return helpers
}

/** The argument keys read for each tool name, over its arm and its helpers. */
function argKeysByCase(source) {
  const helpers = argKeysByHelper(source)
  const marks = [...source.matchAll(/case '([a-z_]+)':/g)]
  const byName = new Map()
  marks.forEach((mark, index) => {
    const start = mark.index + mark[0].length
    // The LAST case ends where its function does — at the first closing brace
    // in the first column. Running it to the end of the file instead swallows
    // whatever is declared below the dispatcher, and credits the last tool in
    // the switch with every argument that code reads.
    const tail = source.slice(start)
    const rest = tail.search(/\n\}/)
    const end =
      index + 1 < marks.length
        ? marks[index + 1].index
        : start + (rest === -1 ? tail.length : rest)
    const body = source.slice(start, end)
    const keys = byName.get(mark[1]) ?? new Set()
    for (const key of argKeysRead(body)) keys.add(key)
    for (const [name, delegated] of helpers) {
      // The helper has to be handed the bag — a call that passes something
      // else is not this case reading these keys.
      if (!new RegExp(`\\b${name}\\([^)]*\\bargs\\b`).test(body)) continue
      for (const key of delegated) keys.add(key)
    }
    byName.set(mark[1], keys)
  })
  return byName
}

test('every argument the harness reads is one the schema offers', () => {
  const undeclared = []
  for (const [name, keys] of argKeysByCase(harness)) {
    const offered = ARGS_OFFERED.get(name)
    // A case with no definition is the previous test's failure, not this one's.
    if (!offered) continue
    for (const key of keys) {
      if (!offered.has(key)) undeclared.push(`${name}.${key}`)
    }
  }
  assert.deepEqual(
    undeclared.sort(),
    [],
    `scripts/agent-harness/run.mjs reads arguments no model can send, so they are always undefined: ${undeclared.join(', ')}`,
  )
})
