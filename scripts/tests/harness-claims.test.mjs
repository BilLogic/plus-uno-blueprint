/**
 * The composition-claim check, exercised through its exit code.
 *
 * The check's whole value is that it FAILS — a surface nobody documented has
 * to turn the build red. So the interesting case is not "the tree is clean
 * today"; it is that an unclaimed file and a stale claim each fail and name
 * what is wrong. Both are driven here the way CI drives them, by running the
 * script, because the exit code is the contract every caller reads.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '')
const SCRIPT = join(ROOT, 'scripts/check-harness-claims.mjs')

function run() {
  const result = spawnSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: 'utf8' })
  return { code: result.status, out: `${result.stdout}${result.stderr}` }
}

test('every assembled component is claimed by exactly one composition doc', () => {
  const { code, out } = run()
  assert.equal(code, 0, out)
})

test('an unclaimed new file fails the check, and is named', () => {
  const stray = join(ROOT, 'src/components/cover/__HarnessClaimProbe.tsx')
  writeFileSync(stray, 'export const probe = null\n')
  try {
    const { code, out } = run()
    assert.equal(code, 1, 'an unclaimed file must fail the check')
    assert.match(out, /__HarnessClaimProbe\.tsx/, 'the failure must name the file')
  } finally {
    rmSync(stray, { force: true })
  }
})

test('a claim on a file that no longer exists fails, and names both', () => {
  const doc = join(ROOT, 'docs/guidelines/composition/canvas.md')
  const original = readFileSync(doc, 'utf8')
  const ghost = 'src/components/editor/__NoSuchSurface.tsx'
  writeFileSync(doc, original.replace('claims:\n', `claims:\n  - ${ghost}\n`))
  try {
    const { code, out } = run()
    assert.equal(code, 1, 'a stale claim must fail the check')
    assert.match(out, /__NoSuchSurface\.tsx/, 'the failure must name the missing file')
    assert.match(out, /composition\/canvas\.md/, 'the failure must name the doc that claims it')
  } finally {
    writeFileSync(doc, original)
  }
})

test('a co-located test file needs no claim', () => {
  const stray = join(ROOT, 'src/components/cover/__harnessClaimProbe.test.tsx')
  mkdirSync(join(ROOT, 'src/components/cover'), { recursive: true })
  writeFileSync(stray, 'export const probe = null\n')
  try {
    const { code, out } = run()
    assert.equal(code, 0, out)
  } finally {
    rmSync(stray, { force: true })
  }
})
