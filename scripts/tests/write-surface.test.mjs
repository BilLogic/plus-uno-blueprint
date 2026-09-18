#!/usr/bin/env node
/**
 * The served-adapter guard's matchers, and the manifest it grades.
 *
 * The guard exists because a list of identifiers wearing prose reads like
 * prose: `deployment/agent/canvas-adapter.md` used to name every write tool
 * and every read tool and call each row "the FULL surface", and the agent
 * reads that sentence as permission. Upstream's copy of that row named five
 * tools that have never existed here and omitted thirty-three that do (#115).
 *
 * THE LISTS ARE GONE. The application renders those two rows from the roster
 * of the session the document is served to, so the surface a row states is the
 * surface that session has and the drift class closes. What the guard holds
 * now is that this override still carries the placeholders rather than a list
 * of its own, that the placeholders are the ones the application substitutes,
 * and — the assertion everything else depends on — that the wiring still
 * carries this file to the prompt rather than the package's.
 *
 * Two halves, both tested here. The MATCHERS decide what the document and the
 * application say, and each way they could quietly say the wrong thing is
 * pinned below with the bug it catches. The MANIFEST — the real repository —
 * is graded at the end, so this suite fails the same way `npm run
 * check:write-surface` does rather than only proving the parser works.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  RETIRED_KINDS,
  adapterImport,
  compare,
  differences,
  documentedKinds,
  enforcedKinds,
  latestMigratedKinds,
  listDifferences,
  placeholderTokens,
  retiredMentions,
  scannableAdapter,
  supersededPaths,
  surfaceRowFaults,
  wiringFaults,
} from '../check-write-surface.mjs'

// The runner copies test files into a temp dir, so paths resolve from the
// working directory (npm test runs at the repo root), not from import.meta.
const REPO_ROOT = process.cwd()
const read = (path) => readFileSync(resolve(REPO_ROOT, path), 'utf8')

// This deployment's own adapter, and the application it overrides one document
// of. The adapter moved to `deployment/` with the rest of this repository's
// code; the application moved into the package. `APP` is how the two are told
// apart at every read below.
const ADAPTER = 'deployment/agent/canvas-adapter.md'
const PACKAGE = 'node_modules/agentic-service-blueprinting'
const APP = `${PACKAGE}/src`

// ---------------------------------------------------------------------------
// The surface rows, and the set diff the dependency vocabulary still uses
// ---------------------------------------------------------------------------

const TOKENS = { read: '{{read_tools}}', write: '{{write_tools}}' }

const RENDERED = [
  '| Edit IR JSON | call write tools: {{write_tools}} — plus `ui_command`\'s few commands marked "[changes data]". That is the FULL write surface; nothing else writes. |',
  '| Read the blueprint | call read tools: {{read_tools}} — none of them move the user\'s canvas. That is the FULL read surface; nothing else reads. |',
].join('\n')

test('a document whose rows are rendered reports no fault', () => {
  assert.deepEqual(surfaceRowFaults(RENDERED, TOKENS), [])
})

test('a row that names a tool by hand is the old defect returning', () => {
  // THE regression this replaced a list comparison with. A hand-written name
  // is a second statement of the roster, and the second statement is what
  // carried a retiring alias into every system prompt for a release.
  const row = RENDERED.replace(
    'call write tools: {{write_tools}}',
    'call write tools: {{write_tools}}, `create_step`',
  )
  const faults = surfaceRowFaults(row, TOKENS).map((fault) => fault.problem)
  assert.equal(faults.length, 1)
  assert.match(faults[0], /names create_step by hand/)
})

test('only the part before the em dash counts', () => {
  // The bug reading the whole line would cause: `ui_command` sits past the
  // dash on the write row and is NOT a write tool, so a whole-line matcher
  // fails a correctly rendered document — which is how a guard gets disabled.
  assert.ok(RENDERED.includes('`ui_command`'))
  assert.deepEqual(surfaceRowFaults(RENDERED, TOKENS), [])
})

test('a row that lost its placeholder fails', () => {
  // The bug: somebody replaces the placeholder with the list it rendered to
  // once, and the document is frozen at one session's roster forever after.
  const row = RENDERED.replace('{{read_tools}}', 'the reads')
  const faults = surfaceRowFaults(row, TOKENS).map((fault) => fault.problem)
  assert.equal(faults.length, 1)
  assert.match(faults[0], /read row does not carry \{\{read_tools\}\}/)
})

test('a missing surface row is a failure, not an empty list', () => {
  // The bug: a renamed or deleted row would otherwise report nothing at all —
  // a document with no surface mapping in it, passing green.
  const faults = surfaceRowFaults('# nothing here\n', TOKENS).map((fault) => fault.problem)
  assert.equal(faults.length, 2)
  assert.match(faults[0], /no "That is the FULL write surface" row at all/)
})

test('the placeholder tokens are read out of the application, not spelled here', () => {
  const source = [
    "export const READ_TOOLS_PLACEHOLDER = '{{read_tools}}'",
    "export const WRITE_TOOLS_PLACEHOLDER = '{{write_tools}}'",
  ].join('\n')
  assert.deepEqual(placeholderTokens(source), TOKENS)
})

test('an application that renamed a placeholder refuses the run', () => {
  // The bug a spelled-here copy would cause: the application substitutes a
  // token this file no longer uses, the override reaches the model with `{{`
  // still in it, and the check that should have said so compares two
  // hard-coded strings and passes.
  assert.throws(
    () => placeholderTokens("export const WRITE_TOOLS_PLACEHOLDER = '{{write_tools}}'"),
    /no longer exports READ_TOOLS_PLACEHOLDER/,
  )
})

test('differences names a value the document leaves out', () => {
  // Now the dependency vocabulary's matcher, not the surface rows'. The bug:
  // the constraint accepts a kind the override does not state, so the agent
  // never writes one.
  const diff = differences(['leads_to'], ['leads_to', 'enables'])
  assert.deepEqual(diff.undocumented, ['enables'])
  assert.deepEqual(diff.unknown, [])
})

test('differences names a value the document invents', () => {
  // The bug: the override states a kind the constraint refuses, and every
  // write the agent attempts with it is rejected.
  const diff = differences(['trigger', 'enables'], ['leads_to', 'enables'])
  assert.deepEqual(diff.unknown, ['trigger'])
  assert.deepEqual(diff.undocumented, ['leads_to'])
})

test('differences names a value the document lists twice', () => {
  // The bug: a set comparison alone passes a bullet that says `enables`
  // twice, and a duplicate is how a line grows out of an edit conflict.
  const diff = differences(['enables', 'enables'], ['enables'])
  assert.deepEqual(diff.duplicated, ['enables'])
  assert.deepEqual(diff.undocumented, [])
  assert.deepEqual(diff.unknown, [])
})

// ---------------------------------------------------------------------------
// The wiring — the assertion the other three depend on
// ---------------------------------------------------------------------------

const WIRED = {
  // The prompt reads the LOADER's record, through the same call
  // `get_reference` makes and against the same roster. The override reaches
  // that record as configuration (`deployment.ts`, `agent.references`), so the
  // tool and the prompt serve one document rather than two copies that can
  // drift — and one rendering of its surface rows rather than two.
  loop: [
    "import { readReference } from '@/lib/agent/tools/references'",
    'export function buildStableSystem(note, skill, roster) {',
    "  return [ROLE, readReference('canvas-adapter', roster), note].join(\"\")",
    '}',
  ].join('\n'),
  config: [
    "import canvasAdapter from '~/agent/canvas-adapter.md?raw'",
    'export const unoDeploymentConfig = {',
    '  agent: {',
    '    references: {',
    "      'canvas-adapter': canvasAdapter,",
    '    },',
    '  },',
    '}',
  ].join('\n'),
  // The loader's own line: a deployment's document wins for a name both sides
  // have. Without it the override is supplied and the template's is served.
  references: "const doc = Object.hasOwn(deployment, name) ? deployment[name] : TEMPLATE[name]",
  harness: "const adapterDoc = readFileSync(resolve(ROOT, 'deployment/agent/canvas-adapter.md'))",
}

test('correctly wired modules report no fault', () => {
  assert.deepEqual(wiringFaults(WIRED), [])
})

test('a pin bump that reinstates the package adapter in loop.ts fails', () => {
  // THE regression this check exists for. Every other assertion in the file
  // still passes when this happens: the override is still correct, still
  // audited, and no longer read by anything.
  const loop = WIRED.loop.replace(
    "readReference('canvas-adapter', roster)",
    'packageAdapter',
  ).replace(
    "import { readReference } from '@/lib/agent/tools/references'",
    "import packageAdapter from 'agentic-service-blueprinting/references/canvas-adapter.md?raw'",
  )
  const faults = wiringFaults({ ...WIRED, loop }).map((fault) => fault.problem)
  assert.equal(faults.length, 2)
  assert.match(faults[0], /does not splice readReference/)
  assert.match(faults[1], /still imports 'agentic-service-blueprinting/)
})

test('loop.ts importing the override again fails, even while splicing the record', () => {
  // A second copy of the same document. It reads as harmless — the two are
  // identical today — and it is how the prompt and `get_reference` came apart
  // before: one of them keeps the stale bytes after the other is re-registered.
  const loop = `import canvasAdapterDoc from '~/agent/canvas-adapter.md?raw'\n${WIRED.loop}`
  const faults = wiringFaults({ ...WIRED, loop })
  assert.equal(faults.length, 1)
  assert.match(faults[0].problem, /imports the override directly/)
})

test('reading the record without splicing it fails', () => {
  // The bug an import-only check misses: the read survives a refactor that
  // drops the value from the prompt, and the prompt loses its rulebook
  // entirely without a single unresolved reference.
  const loop = WIRED.loop.replace("readReference('canvas-adapter', roster), note", 'note')
  const faults = wiringFaults({ ...WIRED, loop })
  assert.equal(faults.length, 1)
  assert.match(faults[0].problem, /does not splice readReference/)
})

test('supplying something other than the imported override fails', () => {
  // The bug: the config imports the override and hands the loader a different
  // document, so the prompt and `get_reference` can tell the agent two
  // incompatible things about its own tools in one session.
  const config = WIRED.config.replace(
    "'canvas-adapter': canvasAdapter",
    "'canvas-adapter': somethingElse",
  )
  const faults = wiringFaults({ ...WIRED, config })
  assert.equal(faults.length, 1)
  assert.match(faults[0].problem, /supplies 'canvas-adapter' as something other than/)
})

test('naming the document outside agent.references fails', () => {
  // The bug the move to configuration introduced: the key is spelled, the
  // import resolves, nothing is unresolved — and a key outside that block is
  // read by nothing, so the template's adapter is what the agent gets.
  const config = WIRED.config.replace('    references: {\n', '    somewhereElse: {\n')
  const faults = wiringFaults({ ...WIRED, config })
  assert.equal(faults.length, 1)
  assert.match(faults[0].problem, /not on `agent.references`/)
})

test('a loader that stopped preferring the deployment document fails', () => {
  // The bug: the field is supplied and read, and the loader hands back the
  // template's copy for a name both have — the override audited, correct, and
  // never served.
  const faults = wiringFaults({ ...WIRED, references: 'const doc = TEMPLATE[name]' })
  assert.equal(faults.length, 1)
  assert.match(faults[0].problem, /no longer prefers a deployment's document/)
})

test('the eval harness reading a different adapter fails', () => {
  // The bug: the suite grades the agent against a rulebook the app never
  // serves, so a passing eval says nothing about production.
  const faults = wiringFaults({ ...WIRED, harness: "const adapterDoc = referencePath('canvas-adapter')" })
  assert.equal(faults.length, 1)
  assert.match(faults[0].problem, /run\.mjs does not read/)
})

test('adapterImport ignores a specifier that merely contains the path', () => {
  // The bug a bare `includes` would cause: a comment mentioning the package
  // adapter (this repo's code is full of them, on purpose) reading as an
  // import and failing a correctly-wired file.
  assert.equal(
    adapterImport(
      "// see agentic-service-blueprinting/references/canvas-adapter.md?raw\n",
      { specifier: 'agentic-service-blueprinting/references/canvas-adapter.md' },
    ),
    null,
  )
})

// ---------------------------------------------------------------------------
// The dependency vocabulary
// ---------------------------------------------------------------------------

test('the retired table is this instance\'s direction, not upstream\'s', () => {
  // The bug: upstream's check-dependency-kinds.mjs retires `leads_to` in
  // favour of `trigger` — the exact inverse of this database. Vendored
  // unchanged it fails on correct code, including the tool declaration below.
  const correct = "kind: { type: 'string', enum: ['leads_to', 'enables'] }"
  assert.deepEqual(retiredMentions([correct]), [])
  assert.ok(RETIRED_KINDS.some(([, found]) => found === '`trigger`'))
  assert.ok(RETIRED_KINDS.some(([, found]) => found === '`needs`'))
})

test('the bare phrase the package adapter uses is caught, not just code spans', () => {
  // The bug: "trigger-vs-needs semantics" is the pinned adapter's own wording
  // and carries no backticks, so a code-span-only matcher misses the one line
  // of wrong vocabulary that reached every system prompt this app sent.
  const hits = retiredMentions(['Per-tool write rules (content required, trigger-vs-needs semantics,'])
  assert.equal(hits.length, 1)
  assert.equal(hits[0].found, 'trigger-vs-needs')
})

test('ordinary English and Postgres triggers are not retired spellings', () => {
  // The bug the other direction: a bare-word matcher needs an exemption for
  // every sentence, and each exemption is a place to hide something real.
  assert.deepEqual(
    retiredMentions([
      'The DB trigger cells_validate_path_match enforces, on every cell insert:',
      'Propose structure as plain text FIRST and get a nod — the grid needs one.',
    ]),
    [],
  )
})

test('sets_off counts anywhere, because it is not English', () => {
  // The intermediate spelling (20260820110000, replaced by 20260820180000).
  const hits = retiredMentions(['record it as sets_off when the source causes the target'])
  assert.deepEqual(hits.map((h) => h.found), ['sets_off'])
})

test('the supersession block may name the retired spellings; nothing else may', () => {
  // Without the carve-out the document cannot say which installed references
  // are wrong — the one thing it must say, because they are unfixable here.
  const doc = [
    '# Adapter',
    '',
    '## Superseded package references',
    '',
    'These still teach `trigger` / `needs`:',
    '- `references/data-model.md`',
    '',
    '## Etiquette',
    '',
    'Say `trigger` here and it is a bug.',
  ].join('\n')
  const hits = retiredMentions(scannableAdapter(doc))
  assert.equal(hits.length, 1)
  assert.equal(hits[0].found, '`trigger`')
})

test('exactly one dependency-kind constraint, or the parse is a failure', () => {
  // The bug: a second matching constraint means the parser picked one at
  // random, and a check that grades the document against a coin toss is worse
  // than none.
  const one = "  kind text not null default 'leads_to' check (kind in ('leads_to','enables')),"
  assert.deepEqual(enforcedKinds(one), ['leads_to', 'enables'])
  assert.throws(() => enforcedKinds(`${one}\n${one}`), /found 2/)
  assert.throws(() => enforcedKinds('create table t ();'), /found 0/)
})

test('the enum bullet is read up to the sentence end, not the whole line', () => {
  const bullet =
    '- `cell_dependencies.kind`: `leads_to` | `enables`. `leads_to` is temporal — the source makes the target happen.'
  assert.deepEqual(documentedKinds(bullet), ['leads_to', 'enables'])
})

test('the LAST migration to define the constraint wins', () => {
  // The bug: this series defines the constraint three times — trigger/needs
  // (20260729120000), sets_off/enables (20260820110000), leads_to/enables
  // (20260820180000). Taking the first would enforce the vocabulary #115 is
  // about, and taking any but the last would enforce a dead one.
  const migrations = [
    {
      name: '20260820180000_sets_off_becomes_leads_to.sql',
      sql: "add constraint cell_dependencies_kind_check\n  check (kind in ('leads_to', 'enables'));",
    },
    {
      name: '20260729120000_derived_layer.sql',
      sql: "constraint cell_triggers_kind_check check (kind in ('trigger','needs')),",
    },
  ]
  assert.deepEqual(latestMigratedKinds(migrations).kinds, ['leads_to', 'enables'])
})

test('listDifferences names both a missing warning and a stale one', () => {
  // Missing: a package doc teaches the wrong enum and the agent reads it
  // unwarned. Stale: a pin bump fixed a doc and the override still calls it
  // wrong, which trains the agent to distrust a document that is now correct.
  const diff = listDifferences(['a.md', 'gone.md'], ['a.md', 'new.md'])
  assert.deepEqual(diff.unnamed, ['new.md'])
  assert.deepEqual(diff.stale, ['gone.md'])
})

// ---------------------------------------------------------------------------
// The manifest — the real repository
// ---------------------------------------------------------------------------

function liveResult() {
  const referenceDocs = [
    ...read(`${APP}/lib/agent/tools/referenceDocs.ts`).matchAll(
      /from 'agentic-service-blueprinting\/([^']+\.md)\?raw'/g,
    ),
  ].map(([, name]) => ({ name, text: read(join(PACKAGE, name)) }))
  const dir = resolve(REPO_ROOT, 'supabase/migrations')
  const migrations = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => ({ name, sql: readFileSync(join(dir, name), 'utf8') }))
  return compare({ read, referenceDocs, migrations })
}

test('this repository passes its own guard', () => {
  const result = liveResult()
  assert.deepEqual(result.wiring, [])
  assert.deepEqual(result.rows, [])
  assert.equal(result.snapshotDrift, null)
  assert.deepEqual(result.kinds, { undocumented: [], unknown: [], duplicated: [] })
  assert.deepEqual(result.retired, [])
  assert.deepEqual(result.superseded, { unnamed: [], stale: [] })
})

test('the override is the file the app serves, and the package copy still differs', () => {
  // If these two ever match, the divergence is over and the override should be
  // deleted rather than maintained. Until then, this is the proof that the
  // override is doing work — a pin bump that converges upstream fails here and
  // asks for that decision instead of leaving a redundant file behind.
  //
  // The anchor has moved four times, and each move is a reason for the
  // override that stopped being one. It was `add_step`, a phantom write tool
  // the package adapter named and this app lacked; then `search_blueprint`, on
  // the reasoning that ranked search needs pgvector a portable core cannot
  // carry; then `list_scenarios`, on the reasoning that the package named a
  // tool this app did not have; then the package's read-row HEDGE about
  // `search_blueprint` — correct upstream, noise here, since this database
  // carries the function always and an agent told to doubt a tool it has is an
  // agent that will decline to use it.
  //
  // ALL FOUR ARE GONE, and the last two went together. This app IS the
  // package's registry, so the two cannot disagree about which tools exist;
  // and the rows no longer name tools at all, so there is no hedge left in
  // either copy to differ about. `check:write-surface` proves that on every
  // run by holding both rows to the placeholders instead of to a list.
  //
  // What still keeps the override is what this DATABASE has and the
  // template's does not, plus one structural dependency:
  //
  //   - `cell_dependencies.kind` is `leads_to` | `enables` here, enforced by a
  //     CHECK constraint, and the override states the enforced pair as a
  //     bullet. The package's adapter names the semantics in prose and states
  //     no enum, because the pair is not the same promise in every deployment.
  //     `documentedKinds` reads that bullet; a copy without it is a rulebook
  //     that never tells the agent which two values a write may carry.
  //   - `## Superseded package references` is a heading
  //     `scripts/check-write-surface.mjs` uses to BOUND its retired-spelling
  //     scan of the rest of this file. The package's copy has no such heading,
  //     so serving it would silently unbound that scan.
  //
  // Both are asserted from both sides. When the package grows the enum bullet
  // AND the heading, this trips, and deleting the override becomes the right
  // thing to do rather than the convenient one.
  const ours = read(ADAPTER)
  const theirs = read(join(PACKAGE, 'references/canvas-adapter.md'))
  assert.notEqual(ours, theirs)
  assert.match(ours, /OVERRIDES a pinned package document/)
  assert.match(
    ours,
    /^## Superseded package references$/m,
    'the override lost the heading check-write-surface.mjs bounds its scan with',
  )
  assert.match(
    ours,
    /^- `cell_dependencies\.kind`:/m,
    'the override lost the enum bullet documentedKinds reads',
  )
  assert.doesNotMatch(
    theirs,
    /^## Superseded package references$/m,
    'the package adapter grew the heading that bounds the retired-spelling scan. If it ' +
      'has also grown a cell_dependencies.kind enum bullet, the last two reasons this ' +
      'override exists are gone — delete it and serve the package copy.',
  )
  assert.doesNotMatch(
    theirs,
    /^- `cell_dependencies\.kind`:/m,
    'the package adapter now states the dependency-kind enum. If it has also grown the ' +
      '"Superseded package references" heading, the last two reasons this override ' +
      'exists are gone — delete it and serve the package copy.',
  )
  // And the one config field the override's own header claims as this
  // deployment's: ranked search is on here, so the agent always has the tool.
  assert.match(read('deployment/deployment.ts'), /search:\s*\{\s*\n?\s*enabled: true/)
})

test('a surface is a required field of a tool definition, not a roster to keep in step', () => {
  // This used to read three name sets out of `specs.ts` and assert that every
  // declared tool was on exactly one of them — the bug being a new tool
  // classified nowhere, absent from both "FULL surface" rows, which is #115's
  // shape reintroduced one tool at a time.
  //
  // The sets are gone. Each tool is one definition carrying its own `surface`,
  // required by the type, so "on exactly one surface" is no longer a property
  // anything can violate — a definition without one does not compile. What is
  // worth holding is that the guarantee is still structural: a `surface` made
  // optional, or a fourth value added to the union, would put the old defect
  // class back and this file would have nothing to say about it.
  const definition = read(`${APP}/lib/agent/tools/definition.ts`)
  assert.match(
    definition,
    /^ {2}surface: ToolSurface$/m,
    'surface is no longer a required field of ToolDefinition — a tool can be declared on no ' +
      'surface again, and the adapter rows would render without it',
  )
  const union = /export type ToolSurface = ([^\n]+)/.exec(definition)
  assert.ok(union, 'no ToolSurface union found — the reader can no longer see the surfaces')
  assert.deepEqual(
    [...union[1].matchAll(/'([a-z]+)'/g)].map(([, name]) => name).sort(),
    ['interface', 'read', 'write'],
    'the surfaces the canvas adapter states are no longer exactly read/interface/write',
  )
})

test('the supersession list is the installed docs that actually teach the wrong enum', () => {
  // Reported as names rather than a count so a failure says which document.
  const claimed = supersededPaths(read(ADAPTER))
  const actual = [
    ...read(`${APP}/lib/agent/tools/referenceDocs.ts`).matchAll(
      /from 'agentic-service-blueprinting\/([^']+\.md)\?raw'/g,
    ),
  ]
    .map(([, name]) => name)
    .filter((name) => RETIRED_KINDS.some(([pattern]) => pattern.test(read(join(PACKAGE, name)))))
  assert.deepEqual([...claimed].sort(), [...actual].sort())
})
