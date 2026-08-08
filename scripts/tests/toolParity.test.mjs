import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

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
// registry.ts. The parity checks read each from where it lives.
const specs = read('src/lib/agent/tools/specs.ts')
const registry = read('src/lib/agent/tools/registry.ts')
const harness = read('scripts/agent-harness/run.mjs')
const cases = read('scripts/agent-harness/cases.mjs')

test('harness imports the app tool specs instead of forking them', () => {
  // The wiring: rolldown bundles specs.ts and the harness destructures the
  // three exports from the bundle.
  assert.ok(
    harness.includes('src/lib/agent/tools/specs.ts'),
    'run.mjs no longer bundles src/lib/agent/tools/specs.ts',
  )
  assert.match(
    harness,
    /\{\s*TOOL_SPECS,\s*WRITE_TOOL_NAMES,\s*MOBILE_READ_TOOL_NAMES\s*\}/,
    'run.mjs no longer imports TOOL_SPECS/WRITE_TOOL_NAMES/MOBILE_READ_TOOL_NAMES from the specs bundle',
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
