/**
 * The composition-claim check, exercised through its exit code and through
 * throwaway repositories.
 *
 * The check's whole value is that it FAILS — a surface nobody documented has
 * to turn the build red. So the interesting case is not "the tree is clean
 * today"; it is that an unclaimed file and a stale claim each fail and name
 * what is wrong.
 *
 * The committed tree is still driven the way CI drives it, by running the
 * script, because the exit code is the contract every caller reads. The
 * failing cases are driven against throwaway repositories instead — the shape
 * `the-router-is-a-router.test.mjs` uses — and they must be. They used to
 * plant a real `__HarnessClaimProbe.tsx` inside `src/components/cover/` and
 * delete it a moment later, which made this file a writer into the tree other
 * suites read: vitest runs suites in parallel, about ten of them walk `src`
 * through `tokenModel`, and for the few hundred milliseconds the probe existed
 * either of two things could happen. A walker that sampled the probe and
 * asserted after the delete failed `tokenDiscipline`'s "the sample is the whole
 * tree, file for file"; one that re-read the file it had sampled died on
 * ENOENT inside `tokenModel`'s "keeps every line". That is #423 — roughly
 * three full-suite runs in twenty-five, on branches that changed nothing.
 *
 * So the rule this file now keeps for itself: a test may not write into the
 * tree another suite reads. Do not move these cases back onto the real tree.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { SOURCE_DIRS, sweep } from '../check-harness-claims.mjs'

const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '')
const SCRIPT = join(ROOT, 'scripts/check-harness-claims.mjs')

function run() {
  const result = spawnSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: 'utf8' })
  return { code: result.status, out: `${result.stdout}${result.stderr}` }
}

/**
 * A throwaway repo: the four claimed source directories, the composition
 * folder, and whatever files the test says exist.
 */
function repo(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'harness-claims-'))
  for (const dir of SOURCE_DIRS) mkdirSync(join(root, dir), { recursive: true })
  mkdirSync(join(root, 'docs/guidelines/composition'), { recursive: true })
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), body)
  }
  return { root, done: () => rmSync(root, { recursive: true, force: true }) }
}

/** A composition doc claiming the files it names. */
function claiming(...claims) {
  const list = claims.map((claim) => `  - ${claim}\n`).join('')
  return `---\nsummary: a throwaway composition doc\nclaims:\n${list}---\n`
}

test('every assembled component is claimed by exactly one composition doc', () => {
  const { code, out } = run()
  assert.equal(code, 0, out)
})

test('an unclaimed new file fails the check, and is named', () => {
  const { root, done } = repo({
    'src/components/cover/CoverPage.tsx': 'export const page = null\n',
    'src/components/cover/Unclaimed.tsx': 'export const stray = null\n',
    'docs/guidelines/composition/cover-page.md': claiming('src/components/cover/CoverPage.tsx'),
  })
  try {
    const { problems } = sweep(root)
    assert.equal(problems.length, 1, problems.join('\n'))
    assert.match(problems[0], /Unclaimed\.tsx/, 'the failure must name the file')
    assert.match(problems[0], /claimed by no composition doc/)
  } finally {
    done()
  }
})

test('a claim on a file that no longer exists fails, and names both', () => {
  const ghost = 'src/components/editor/__NoSuchSurface.tsx'
  const { root, done } = repo({
    'docs/guidelines/composition/canvas.md': claiming(ghost),
  })
  try {
    const { problems } = sweep(root)
    assert.equal(problems.length, 1, problems.join('\n'))
    assert.match(problems[0], /__NoSuchSurface\.tsx/, 'the failure must name the missing file')
    assert.match(problems[0], /composition\/canvas\.md/, 'the failure must name the doc that claims it')
  } finally {
    done()
  }
})

test('a file two docs claim fails, and names both docs', () => {
  const shared = 'src/components/cover/CoverPage.tsx'
  const { root, done } = repo({
    [shared]: 'export const page = null\n',
    'docs/guidelines/composition/cover-page.md': claiming(shared),
    'docs/guidelines/composition/sidebar.md': claiming(shared),
  })
  try {
    const { problems } = sweep(root)
    assert.equal(problems.length, 1, problems.join('\n'))
    assert.match(problems[0], /cover-page\.md/, 'the failure must name the first doc')
    assert.match(problems[0], /sidebar\.md/, 'the failure must name the second doc')
  } finally {
    done()
  }
})

test('a co-located test file needs no claim', () => {
  const { root, done } = repo({
    'src/components/cover/CoverPage.tsx': 'export const page = null\n',
    'src/components/cover/coverPage.test.tsx': 'export const probe = null\n',
    'docs/guidelines/composition/cover-page.md': claiming('src/components/cover/CoverPage.tsx'),
  })
  try {
    assert.deepEqual(sweep(root).problems, [])
  } finally {
    done()
  }
})
