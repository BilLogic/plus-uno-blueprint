import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

/**
 * The eval harness mirrors the app's tool surface. That mirror is what makes
 * a harness result mean anything — a case that passes against a tool set the
 * app does not have is measuring nothing.
 *
 * Three lists have to agree, and the third is the dangerous one: a name
 * missing from `cases.mjs`'s WRITES makes a "no writes happened" trace check
 * PASS, so drift there hides itself instead of failing loudly. Hence a test
 * rather than a comment asking humans to remember.
 *
 * Deliberately text-parsed: `registry.ts` imports supabase-js and Vite `?raw`
 * markdown, so it cannot be loaded from Node without a bundler.
 */
// The runner copies test files into a temp dir, so paths resolve from the
// working directory (npm test runs at the repo root), not from import.meta.
const REPO_ROOT = process.cwd()

function read(path) {
  return readFileSync(resolve(REPO_ROOT, path), 'utf8')
}

/** Every `name: '...'` inside the first TOOL_SPECS array literal. */
function specNames(source) {
  const start = source.indexOf('TOOL_SPECS')
  assert.ok(start !== -1, 'TOOL_SPECS not found')
  const body = source.slice(start)
  return new Set(
    [...body.matchAll(/^\s*(?:\{\s*)?name: '([a-z_]+)'/gm)]
      .map((m) => m[1])
      // `__text` is the harness's own trace marker for model prose, not a
      // tool the model can call — it has no app counterpart by design.
      .filter((name) => !name.startsWith('__')),
  )
}

/** The string members of a `new Set([...])` assigned to `name`. */
function setMembers(source, name) {
  const at = source.indexOf(`${name} = new Set([`)
  assert.ok(at !== -1, `${name} not found`)
  const body = source.slice(at, source.indexOf('])', at))
  return new Set([...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))
}

const registry = read('src/lib/agent/tools/registry.ts')
const harness = read('scripts/agent-harness/run.mjs')
const cases = read('scripts/agent-harness/cases.mjs')

test('harness mirrors the app tool surface', () => {
  const app = specNames(registry)
  const mirror = specNames(harness)
  const missing = [...app].filter((name) => !mirror.has(name))
  const extra = [...mirror].filter((name) => !app.has(name))
  assert.deepEqual(
    { missing, extra },
    { missing: [], extra: [] },
    'scripts/agent-harness/run.mjs TOOL_SPECS drifted from registry.ts',
  )
})

test('all three write-tool sets agree', () => {
  const app = setMembers(registry, 'WRITE_TOOL_NAMES')
  const mirror = setMembers(harness, 'WRITE_TOOLS')
  const rubric = setMembers(cases, 'WRITES')
  assert.deepEqual(
    [...mirror].sort(),
    [...app].sort(),
    "run.mjs WRITE_TOOLS drifted from registry.ts WRITE_TOOL_NAMES",
  )
  // cases.mjs may legitimately track MORE than the write set is not true —
  // it must match, or "zero writes" checks silently stop covering a tool.
  assert.deepEqual(
    [...rubric].sort(),
    [...app].sort(),
    'cases.mjs WRITES drifted — a missing name makes no-write checks pass vacuously',
  )
})

test('every write tool is dispatchable', () => {
  const app = setMembers(registry, 'WRITE_TOOL_NAMES')
  for (const name of app) {
    assert.ok(
      registry.includes(`case '${name}':`),
      `${name} is listed as a write tool but has no dispatch case`,
    )
  }
})
