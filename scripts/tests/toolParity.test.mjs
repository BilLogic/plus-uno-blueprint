import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { appSource } from '../app-source.mjs'

/**
 * The eval harness must run against the app's tool surface. The spec
 * DECLARATIONS are now one-sourced — run.mjs bundles specs.ts with rolldown
 * at startup and imports TOOL_SPECS / WRITE_TOOL_NAMES /
 * MOBILE_READ_TOOL_NAMES — so the old "did the hand-copied fork drift"
 * check is replaced by a check that the import wiring still exists and no
 * fork has crept back in.
 *
 * `cases.mjs` keeps its own WRITES set (it cannot import from run.mjs
 * without a cycle), and that list is the dangerous one: a name missing
 * from it makes a "no writes happened" trace check PASS, so drift there
 * hides itself instead of failing loudly. Hence a test rather than a
 * comment asking humans to remember.
 *
 * Deliberately text-parsed: `registry.ts` imports supabase-js and Vite
 * `?raw` markdown, so it cannot be loaded from Node without a bundler.
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

// Specs and rosters live in specs.ts (pure data); dispatch stays in
// registry.ts. The parity checks read each from where it lives — and the two
// sides now live in different repositories: the tool surface belongs to the
// APPLICATION, which this deployment imports out of the installed package,
// while the harness that has to match it is this deployment's own script.
// That is what the check was always about; it is only now literally true.
// `appSource` refuses a missing package file by name, because an unreadable
// specs.ts would otherwise parse as a tool surface with nothing in it.
const specs = appSource('lib/agent/tools/specs.ts')
const registry = appSource('lib/agent/tools/registry.ts')
const harness = read('scripts/agent-harness/run.mjs')
const cases = read('scripts/agent-harness/cases.mjs')

test('harness imports the app tool specs instead of forking them', () => {
  // The wiring: rolldown bundles specs.ts and the harness destructures the
  // rosters from the bundle — including REFERENCE_NAMES, so the harness
  // offers exactly the reference list the app offers.
  assert.ok(
    harness.includes("resolve(APP_SOURCE, 'lib/agent/tools/specs.ts')"),
    'run.mjs no longer bundles the application’s lib/agent/tools/specs.ts out ' +
      'of the installed package',
  )
  assert.match(
    harness,
    /\{\s*TOOL_SPECS,\s*WRITE_TOOL_NAMES,\s*MOBILE_READ_TOOL_NAMES,\s*REFERENCE_NAMES\s*\}/,
    'run.mjs no longer imports TOOL_SPECS/WRITE_TOOL_NAMES/MOBILE_READ_TOOL_NAMES/REFERENCE_NAMES from the specs bundle',
  )
  // And no fork crept back: a local spec array would re-declare tool
  // objects (`name: '...'` entries) and a local write set would shadow the
  // imported roster.
  assert.ok(
    !/TOOL_SPECS\s*=\s*\[/.test(harness),
    'run.mjs declares a local TOOL_SPECS array — the fork is back',
  )
  assert.ok(
    !harness.includes('WRITE_TOOLS = new Set'),
    'run.mjs declares a local WRITE_TOOLS set — the fork is back',
  )
  assert.ok(
    !/^\s*\{\s*name: '[a-z_]+', description:/m.test(harness),
    'run.mjs contains inline tool-spec declarations — the fork is back',
  )
})

test('cases.mjs WRITES agrees with the app write roster', () => {
  const app = setMembers(specs, 'WRITE_TOOL_NAMES')
  const rubric = setMembers(cases, 'WRITES')
  // It must MATCH — more or less both break: a missing name makes
  // "zero writes" checks pass vacuously; an extra one fails them falsely.
  assert.deepEqual(
    [...rubric].sort(),
    [...app].sort(),
    'cases.mjs WRITES drifted from specs.ts WRITE_TOOL_NAMES',
  )
})

test('every write tool is dispatchable', () => {
  const app = setMembers(specs, 'WRITE_TOOL_NAMES')
  for (const name of app) {
    assert.ok(
      registry.includes(`case '${name}':`),
      `${name} is listed as a write tool but has no dispatch case`,
    )
  }
})

/** Every `name:` at the top level of the TOOL_SPECS array literal. */
function specNames(source) {
  const at = source.indexOf('TOOL_SPECS: ToolSpec[] = [')
  assert.ok(at !== -1, 'TOOL_SPECS array not found')
  const names = [
    ...source.slice(at).matchAll(/^ {2}\{\n {4}name: '([a-z_]+)'/gm),
  ].map((m) => m[1])
  assert.ok(names.length > 0, 'no tool names parsed out of TOOL_SPECS')
  return names
}

/**
 * The write roster had this check; the read half did not, so a renamed or
 * newly added READ tool could sit in specs.ts with no dispatch case and
 * fail only at runtime, in front of a user. Covering every spec — not just
 * the write roster — closes that and subsumes the check above.
 */
test('every tool spec is dispatchable', () => {
  for (const name of specNames(specs)) {
    assert.ok(
      registry.includes(`case '${name}':`),
      `${name} is declared in TOOL_SPECS but has no dispatch case in registry.ts`,
    )
  }
})

/**
 * The harness runs its OWN tool implementations (registry.ts cannot load
 * from Node), and nothing checked that it covers the roster it imports. It
 * bit: renaming list_scenarios to list_blueprint rewrote the harness's case
 * LABEL and left it calling the old phases query, so the harness answered
 * list_blueprint with the pre-granularity shape and silently rehearsed a
 * different agent than the app runs. Writes are exempt — they short-circuit
 * to a generic dry-run response before this switch.
 */
test('every read tool has a harness implementation', () => {
  const writes = setMembers(specs, 'WRITE_TOOL_NAMES')
  for (const name of specNames(specs)) {
    if (writes.has(name)) continue
    assert.ok(
      harness.includes(`case '${name}':`),
      `${name} is a read tool with no case in scripts/agent-harness/run.mjs — the harness would throw on it`,
    )
  }
})

/**
 * The other direction: a dispatch case with no spec is dead code the model
 * can never reach — the residue a rename leaves when specs.ts moves on and
 * registry.ts keeps the old arm.
 */
test('every dispatch case has a tool spec', () => {
  const declared = new Set(specNames(specs))
  const dispatched = [...registry.matchAll(/case '([a-z_]+)':/g)].map(
    (m) => m[1],
  )
  const orphans = dispatched.filter((name) => !declared.has(name))
  assert.deepEqual(
    orphans,
    [],
    `registry.ts dispatches tools that no longer exist in TOOL_SPECS: ${orphans.join(', ')}`,
  )
})

/**
 * The names on the wire, in both directions.
 *
 * A tool spec is a contract with a model. The model can only send the
 * properties the schema declares, and the handler can only read the keys it
 * asks for by name — nothing connects the two, and nothing fails when they
 * disagree. A handler reading a key the schema never offers gets `undefined`
 * on every call and reports success; a schema offering a property no handler
 * reads takes an argument from the model and throws it away. Both are silent,
 * and both look exactly like working software from the outside.
 *
 * This is not hypothetical. The template's `create_slice` advertises
 * `description` and reads `summary`, so a model that fills in the field the
 * schema asked for writes an empty summary and is told the slice was created;
 * its `update_slice` keeps the old summary and reports the edit as done. That
 * is filed upstream — the point here is that no test on either side could see
 * it, because every test asserted about one file or the other.
 *
 * The declarations are IMPORTED rather than parsed: specs.ts is pure data and
 * loads in Node. registry.ts is still read as text, because it imports
 * supabase-js and Vite `?raw` markdown and cannot be loaded without a bundler.
 */
const TOOL_SPECS = (await import('@/lib/agent/tools/specs')).TOOL_SPECS

/**
 * The argument keys a dispatch case reads.
 *
 * A case runs to the next `case '...':`, which covers both shapes registry.ts
 * uses — the braced block and the single-expression arm. The four forms it
 * looks for are the four the file uses: `need(args, 'x')` for a required
 * string, `s(args, 'x')` for an optional one, and `args.x` / `args['x']` for
 * everything typed by hand.
 */
function argKeysRead(body) {
  return [
    ...body.matchAll(
      /(?:need|s)\(args, '([a-z_]+)'\)|args\.([a-z_]+)|args\['([a-z_]+)'\]/g,
    ),
  ].map((m) => m[1] ?? m[2] ?? m[3])
}

/**
 * Helpers that read the argument bag on a case's behalf, as `name -> keys`.
 *
 * A case does not have to read `args` in its own body. The application pulls
 * the shared ones out — `readScope` reads `service` for every tool that scopes
 * a read, `listBlueprintArgs` reads the six filters for both the live
 * dispatcher and the no-database trial — so that what an argument MEANS is
 * decided once. A reader that looked only inside the `case` arms would see
 * those ten keys as unread and report that the model's words are thrown away,
 * about handlers that read every one of them. So a call to one of these counts
 * as reading what it reads.
 *
 * Matched on the parameter list rather than on a list of helper names: a
 * seventh helper written tomorrow is followed tomorrow.
 */
function argKeysByHelper(source) {
  const helpers = new Map()
  for (const mark of source.matchAll(
    /^(?:export )?(?:async )?function ([A-Za-z0-9_]+)\(([^)]*)\)/gm,
  )) {
    if (!/\bargs\b/.test(mark[2])) continue
    const start = mark.index
    const end = source.indexOf('\n}', start)
    helpers.set(mark[1], new Set(argKeysRead(source.slice(start, end === -1 ? source.length : end))))
  }
  return helpers
}

function argKeysByCase(source) {
  const helpers = argKeysByHelper(source)
  const marks = [...source.matchAll(/case '([a-z_]+)':/g)]
  return new Map(
    marks.map((mark, index) => {
      const start = mark.index + mark[0].length
      const end = index + 1 < marks.length ? marks[index + 1].index : source.length
      const body = source.slice(start, end)
      const keys = new Set(argKeysRead(body))
      for (const [name, delegated] of helpers) {
        // The helper has to be handed the bag — a call that passes something
        // else is not this case reading these keys.
        if (!new RegExp(`\\b${name}\\([^)]*\\bargs\\b`).test(body)) continue
        for (const key of delegated) keys.add(key)
      }
      return [mark[1], keys]
    }),
  )
}

/**
 * Argument names a handler still accepts and the schema no longer offers.
 *
 * A rename on this wire cannot be a swap. Anything pinned to an older
 * description of these tools keeps sending the old word, and a handler that
 * stopped reading it turns a working call into a refusal. So the schema moves
 * first and the handler keeps accepting both for a release.
 *
 * Every entry is asserted below to still be READ, so an alias whose handler
 * dropped it loses its exemption instead of leaving a carve-out behind for the
 * next rename to slip through. Deleting an entry is how the alias retires:
 * remove the fallback in registry.ts and the line here together.
 */
const ACCEPTED_ALIASES = [
  {
    tool: 'create_slice',
    alias: 'description',
    now: 'summary',
    because:
      'the schema advertised `description` while the handler read `summary` (#272), so a ' +
      'model taught the old wire is still holding the word that used to be dropped',
  },
  {
    tool: 'update_slice',
    alias: 'description',
    now: 'summary',
    because: 'same mismatch, same tool pair',
  },
]

const isAlias = (tool, key) =>
  ACCEPTED_ALIASES.some((entry) => entry.tool === tool && entry.alias === key)

test('every accepted alias is still read, or it has stopped being one', () => {
  const read = argKeysByCase(registry)
  const dead = ACCEPTED_ALIASES.filter(
    (entry) => !read.get(entry.tool)?.has(entry.alias),
  ).map((entry) => `${entry.tool}.${entry.alias}`)
  assert.deepEqual(
    dead,
    [],
    `Exempted as an accepted alias but no longer read by registry.ts: ${dead.join(', ')}. ` +
      'The alias has retired — delete the entry rather than leaving a dead carve-out.',
  )
})

test('every argument a handler reads is one the schema offers', () => {
  const declared = new Map(
    TOOL_SPECS.map((spec) => [
      spec.name,
      new Set(Object.keys(spec.parameters?.properties ?? {})),
    ]),
  )
  const undeclared = []
  for (const [name, keys] of argKeysByCase(registry)) {
    const offered = declared.get(name)
    // A case with no spec is the previous test's failure, not this one's.
    if (!offered) continue
    for (const key of keys) {
      if (offered.has(key) || isAlias(name, key)) continue
      undeclared.push(`${name}.${key}`)
    }
  }
  assert.deepEqual(
    undeclared.sort(),
    [],
    `registry.ts reads arguments no model can send, so they are always undefined: ${undeclared.join(', ')}`,
  )
})

test('every argument the schema offers is one a handler reads', () => {
  const read = argKeysByCase(registry)
  const ignored = []
  for (const spec of TOOL_SPECS) {
    const keys = read.get(spec.name)
    // Tools dispatched elsewhere are out of this file's reach.
    if (!keys) continue
    for (const key of Object.keys(spec.parameters?.properties ?? {})) {
      if (!keys.has(key)) ignored.push(`${spec.name}.${key}`)
    }
  }
  assert.deepEqual(
    ignored.sort(),
    [],
    `TOOL_SPECS offers arguments registry.ts never reads, so a model filling them in is ignored: ${ignored.join(', ')}`,
  )
})
