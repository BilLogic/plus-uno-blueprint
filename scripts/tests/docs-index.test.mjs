/**
 * The index generator, exercised through its exit code.
 *
 * Two contracts, both of which only matter when they FAIL: the committed
 * INDEX.md must match what the generator would write, and a doc with no
 * frontmatter summary must stop the build rather than produce a blank cell.
 * The second is the one worth a test — a blank cell looks like an answer.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '')
const SCRIPT = join(ROOT, 'scripts/generate-docs-index.mjs')

function run(...args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8' })
  return { code: result.status, out: `${result.stdout}${result.stderr}` }
}

test('the committed INDEX.md is what the generator writes', () => {
  const { code, out } = run('--check')
  assert.equal(code, 0, out)
})

test('a doc with no frontmatter summary fails generation, and is named', () => {
  const doc = join(ROOT, 'docs/connectors/netlify.md')
  const original = readFileSync(doc, 'utf8')
  writeFileSync(doc, original.replace('summary:', 'note:'))
  try {
    const { code, out } = run()
    assert.equal(code, 1, 'a missing summary must fail, not render a blank cell')
    assert.match(out, /netlify\.md/, 'the failure must name the doc')
  } finally {
    writeFileSync(doc, original)
  }
})
