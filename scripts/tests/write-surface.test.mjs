#!/usr/bin/env node
/**
 * The served-adapter guard's matchers, and the manifest it grades.
 *
 * The guard exists because a list of identifiers wearing prose reads like
 * prose: `src/lib/agent/canvas-adapter.md` names every write tool and every
 * read tool and calls each row "the FULL surface", and the agent reads that
 * sentence as permission. Upstream's copy of that row named five tools that
 * have never existed here and omitted thirty-three that do (#115).
 *
 * Two halves, both tested here. The MATCHERS decide what the document and the
 * declarations say, and each way they could quietly say the wrong thing is
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
  declaredTools,
  differences,
  documentedKinds,
  documentedTools,
  enforcedKinds,
  latestMigratedKinds,
  listDifferences,
  retiredMentions,
  scannableAdapter,
  supersededPaths,
  wiringFaults,
} from '../check-write-surface.mjs'

// The runner copies test files into a temp dir, so paths resolve from the
// working directory (npm test runs at the repo root), not from import.meta.
const REPO_ROOT = process.cwd()
const read = (path) => readFileSync(resolve(REPO_ROOT, path), 'utf8')

const ADAPTER = 'src/lib/agent/canvas-adapter.md'
const PACKAGE = 'node_modules/agentic-service-blueprinting'

// ---------------------------------------------------------------------------
// The surface rows
// ---------------------------------------------------------------------------

test('differences names a tool the document leaves out', () => {
  // The bug: the agent reads "that is the FULL write surface" and refuses to
  // call a tool it actually has. Thirty-three of ours were missing upstream.
  const diff = differences(['create_step'], ['create_step', 'create_lane'])
  assert.deepEqual(diff.undocumented, ['create_lane'])
  assert.deepEqual(diff.unknown, [])
})

test('differences names a tool the document invents', () => {
  // The bug: #115 exactly — the pinned row says `add_step`, and an agent that
  // trusts it spends a round calling a tool that does not exist.
  const diff = differences(['add_step', 'create_lane'], ['create_step', 'create_lane'])
  assert.deepEqual(diff.unknown, ['add_step'])
  assert.deepEqual(diff.undocumented, ['create_step'])
})

test('differences names a tool the document lists twice', () => {
  // The bug: a set comparison alone passes a row that says `upsert_cell`
  // twice, and a duplicated name is how a row grows out of an edit conflict.
  const diff = differences(['upsert_cell', 'upsert_cell'], ['upsert_cell'])
  assert.deepEqual(diff.duplicated, ['upsert_cell'])
  assert.deepEqual(diff.undocumented, [])
  assert.deepEqual(diff.unknown, [])
})

test('a surface row stops at the em dash', () => {
  // The bug: the write row's prose continues past the list with `ui_command`,
  // which is NOT a write tool. Reading the whole line would report it as a
  // documented write and hide a real omission behind a spurious one.
  const row =
    '| Edit IR JSON | call write tools: `create_step`, `create_lane` — plus `ui_command`\'s few commands marked "[changes data]". That is the FULL write surface; nothing else writes. |'
  assert.deepEqual(documentedTools(row, 'That is the FULL write surface'), [
    'create_step',
    'create_lane',
  ])
})

test('a missing surface row is a failure, not an empty list', () => {
  // The bug: a renamed or deleted row would otherwise compare [] against the
  // roster and report every tool as undocumented — noise that reads as a
  // parser fault and gets the check disabled.
  assert.throws(
    () => documentedTools('# nothing here\n', 'That is the FULL read surface'),
    /no "That is the FULL read surface" row found/,
  )
})

test('declaredTools reads a roster out of specs.ts without a build step', () => {
  const source = [
    "export const READ_TOOL_NAMES = new Set([",
    "  'get_cell',",
    "  'list_findings',",
    "])",
    '',
    'export const WRITE_TOOL_NAMES = new Set([',
    "  'upsert_cell',",
    '])',
  ].join('\n')
  assert.deepEqual(declaredTools(source, 'READ_TOOL_NAMES'), ['get_cell', 'list_findings'])
  // The bug a non-lazy match would cause: `READ_TOOL_NAMES` swallowing every
  // set after it, so the write roster's names count as reads too.
  assert.deepEqual(declaredTools(source, 'WRITE_TOOL_NAMES'), ['upsert_cell'])
})

// ---------------------------------------------------------------------------
// The wiring — the assertion the other three depend on
// ---------------------------------------------------------------------------

const WIRED = {
  loop: [
    "import canvasAdapterDoc from '@/lib/agent/canvas-adapter.md?raw'",
    'export function buildSystem(note) {',
    '  return [ROLE, canvasAdapterDoc, note].join("")',
    '}',
  ].join('\n'),
  read: [
    "import canvasAdapter from '@/lib/agent/canvas-adapter.md?raw'",
    'const REFERENCES = {',
    "  'canvas-adapter': canvasAdapter,",
    '}',
  ].join('\n'),
  harness: "const adapterDoc = readFileSync(resolve(ROOT, 'src/lib/agent/canvas-adapter.md'))",
}

test('correctly wired modules report no fault', () => {
  assert.deepEqual(wiringFaults(WIRED), [])
})

test('a pin bump that reinstates the package adapter in loop.ts fails', () => {
  // THE regression this check exists for. Every other assertion in the file
  // still passes when this happens: the override is still correct, still
  // audited, and no longer read by anything.
  const loop = WIRED.loop.replace(
    "'@/lib/agent/canvas-adapter.md?raw'",
    "'agentic-service-blueprinting/references/canvas-adapter.md?raw'",
  )
  const faults = wiringFaults({ ...WIRED, loop }).map((fault) => fault.problem)
  assert.equal(faults.length, 2)
  assert.match(faults[0], /loop\.ts does not import/)
  assert.match(faults[1], /still imports 'agentic-service-blueprinting/)
})

test('loop.ts keeping BOTH imports fails', () => {
  // The half-migration: the override is imported, the package one is left
  // behind, and which text wins is now a question about which binding
  // buildSystem happens to name.
  const loop = `import stale from 'agentic-service-blueprinting/references/canvas-adapter.md?raw'\n${WIRED.loop}`
  const faults = wiringFaults({ ...WIRED, loop })
  assert.equal(faults.length, 1)
  assert.match(faults[0].problem, /still imports/)
})

test('importing the override without splicing it fails', () => {
  // The bug an import-only check misses: the import survives a refactor that
  // drops the value from the prompt, and the prompt loses its rulebook
  // entirely without a single unresolved reference.
  const loop = WIRED.loop.replace('canvasAdapterDoc, note', 'note')
  const faults = wiringFaults({ ...WIRED, loop })
  assert.equal(faults.length, 1)
  assert.match(faults[0].problem, /buildSystem does not splice it/)
})

test('get_reference serving something other than the imported override fails', () => {
  // The bug: the prompt gets the override and `get_reference('canvas-adapter')`
  // hands the agent a different document, so the agent can be told two
  // incompatible things about its own tools in one session.
  const read = WIRED.read.replace("'canvas-adapter': canvasAdapter", "'canvas-adapter': somethingElse")
  const faults = wiringFaults({ ...WIRED, read })
  assert.equal(faults.length, 1)
  assert.match(faults[0].problem, /REFERENCES maps 'canvas-adapter'/)
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
    ...read('src/lib/agent/tools/read.ts').matchAll(
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
  assert.deepEqual(result.write, { undocumented: [], unknown: [], duplicated: [] })
  assert.deepEqual(result.read, { undocumented: [], unknown: [], duplicated: [] })
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
  // The anchor was `add_step` — a phantom write tool the package adapter named
  // and this app lacked (#115). asb v1.0.0 retired it, converged the package
  // adapter's structure onto this one, and moved its served references to
  // `leads_to` / `enables` (which emptied the supersession list). What still
  // diverges, and why the override stays, is the surface rows: this app's write
  // surface carries stakeholder and evidence tools the template's does not. So
  // the anchor moves to one of those — it trips when the package write surface
  // grows to include them, the real signal to recheck whether the override
  // still earns its keep.
  const ours = read(ADAPTER)
  const theirs = read(join(PACKAGE, 'references/canvas-adapter.md'))
  assert.notEqual(ours, theirs)
  assert.match(ours, /OVERRIDES a pinned package document/)
  assert.doesNotMatch(
    theirs,
    /`create_stakeholder`/,
    'the package adapter now lists create_stakeholder — the #115 surface divergence is closing; recheck whether the override still earns its keep',
  )
})

test('every declared tool is on exactly one surface', () => {
  // specs.ts asserts this at module init; asserted again here because the
  // init throw only fires once something imports specs.ts, and this check runs
  // on files. The bug: a new tool is declared, classified nowhere, and so is
  // absent from both "FULL surface" rows — #115's shape, reintroduced one tool
  // at a time.
  const specs = read('src/lib/agent/tools/specs.ts')
  const declared = [...specs.matchAll(/^ {4}name: '([a-z_]+)',$/gm)].map(([, name]) => name)
  const rosters = ['READ_TOOL_NAMES', 'INTERFACE_TOOL_NAMES', 'WRITE_TOOL_NAMES'].map((name) => [
    name,
    declaredTools(specs, name),
  ])

  assert.ok(declared.length > 40, `only ${declared.length} tool declarations parsed`)
  for (const name of declared) {
    const homes = rosters.filter(([, names]) => names.includes(name)).map(([roster]) => roster)
    assert.equal(homes.length, 1, `${name} is on ${homes.length} surfaces: ${homes.join(', ')}`)
  }
  for (const [roster, names] of rosters) {
    for (const name of names) {
      assert.ok(declared.includes(name), `${roster} lists ${name}, which TOOL_SPECS does not declare`)
    }
  }
})

test('the supersession list is the installed docs that actually teach the wrong enum', () => {
  // Reported as names rather than a count so a failure says which document.
  const claimed = supersededPaths(read(ADAPTER))
  const actual = [
    ...read('src/lib/agent/tools/read.ts').matchAll(
      /from 'agentic-service-blueprinting\/([^']+\.md)\?raw'/g,
    ),
  ]
    .map(([, name]) => name)
    .filter((name) => RETIRED_KINDS.some(([pattern]) => pattern.test(read(join(PACKAGE, name)))))
  assert.deepEqual([...claimed].sort(), [...actual].sort())
})
