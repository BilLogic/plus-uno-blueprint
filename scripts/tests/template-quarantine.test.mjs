#!/usr/bin/env node
/**
 * The quarantine guard's matcher and manifest.
 *
 * The guard decides whether a merge from the template is allowed to have
 * touched a file this instance owns. Two ways it could fail quietly: a
 * pattern that matches less than it reads as (a template merge takes our
 * migrations and CI stays green), or one that matches more (upstream
 * improvements get rejected forever and nobody knows why). Both are tested
 * here.
 *
 * This file used to end that paragraph with "the git walk itself is
 * exercised in CI, where there are merges", and then classification broke in
 * CI and only in CI: a pull request is checked out as a synthetic merge
 * commit, its second parent is the branch, and the branch descends from the
 * template root like everything else here does since the graft. Every PR
 * touching a quarantined path failed while the local run passed. "Exercised
 * in CI" is not a test — it is a place where a failure is attributed to the
 * change under review. The classifier is pinned below instead.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { matches, violations, carriesTemplateContent } from '../check-template-quarantine.mjs'

const manifest = JSON.parse(readFileSync(new URL('../template-quarantine.json', import.meta.url)))
const ROOTS = {
  templateRoot: manifest.templateRootCommit,
  instanceRoot: manifest.instanceRootCommit,
}

test('a subtree pattern covers what is under it', () => {
  assert.ok(matches('supabase/migrations/20250602160000_initial.sql', 'supabase/migrations/**'))
  assert.ok(matches('src/data/nested/deep/file.ts', 'src/data/**'))
})

test('a subtree pattern stops at the directory boundary', () => {
  // The bug this catches: a prefix test without the slash also matches
  // `src/database.ts` and `supabase/migrations-old/…`.
  assert.equal(matches('src/database.ts', 'src/data/**'), false)
  assert.equal(matches('supabase/migrations-archive/x.sql', 'supabase/migrations/**'), false)
})

test('an exact path matches only itself', () => {
  assert.ok(matches('src/config.ts', 'src/config.ts'))
  assert.equal(matches('src/config.test.ts', 'src/config.ts'), false)
  assert.equal(matches('src/agent/config.ts', 'src/config.ts'), false)
})

test('a clean template merge reports nothing', () => {
  const files = ['src/lib/blueprintLayout.ts', 'src/components/blueprint/BlueprintGrid.tsx']
  assert.deepEqual(violations(files, manifest.quarantine), [])
})

test('a merge touching instance-owned files reports each one with its reason', () => {
  const hits = violations(
    ['src/lib/blueprintLayout.ts', 'src/types/database.ts', 'supabase/seed.sql'],
    manifest.quarantine,
  )
  assert.deepEqual(
    hits.map((h) => h.file),
    ['src/types/database.ts', 'supabase/seed.sql'],
  )
  assert.ok(hits.every((h) => h.reason.length > 0), 'every hit explains itself')
})

test('the schema reference is deliberately NOT quarantined', () => {
  // agentic-service-blueprinting#51 makes this the package's portable-core
  // contract, generated upstream. Quarantining it would reject the one
  // supabase/ file we do want from the template.
  assert.deepEqual(violations(['supabase/schema.reference.sql'], manifest.quarantine), [])
  assert.ok(manifest.notQuarantined['supabase/schema.reference.sql'])
})

test('every quarantined path still exists', () => {
  // A manifest naming files that have since moved protects nothing while
  // reading as though it does.
  for (const { path } of manifest.quarantine) {
    const target = path.endsWith('/**') ? path.slice(0, -3) : path
    assert.ok(existsSync(new URL(`../../${target}`, import.meta.url)), `${path} is gone`)
  }
})

test('every quarantined path carries a reason', () => {
  for (const entry of manifest.quarantine) {
    assert.ok(entry.reason && entry.reason.length > 20, `${entry.path} needs a real reason`)
  }
})

/* ------------------------------------------------- which side a commit is on */

/**
 * Three commits, pinned by full sha, one per case the classifier separates.
 * All three are on `main`, so none can move or be rewritten.
 *
 *   the template's line — the second parent of the graft merge (fbb4b24)
 *   ours, from before the graft
 *   ours, from after it (#144 part 3) — the shape a PR's second parent has
 */
const TEMPLATE_SIDE = '0fd6ca05d00ea7df5d78657d1f0a8cc72af59923'
const OURS_BEFORE_GRAFT = '6b4646cf808a3e8238adfafc3848127779b7b5cc'
const OURS_AFTER_GRAFT = 'f8273ba9e714e7e5260608e0b2ba367a90f3abb8'

/**
 * Full history or nothing. A shallow clone cannot answer an ancestry question,
 * and a test that skips when it cannot see is the failure mode this whole file
 * argues against — `.github/workflows/gates.yml` sets `fetch-depth: 0` for it.
 */
function requireFullHistory() {
  const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
    encoding: 'utf8',
  }).trim()
  assert.equal(
    shallow,
    'false',
    'this test needs full history — set fetch-depth: 0 on the job that runs it',
  )
}

test('a commit from the template line carries template content', () => {
  requireFullHistory()
  assert.equal(carriesTemplateContent(TEMPLATE_SIDE, ROOTS), true)
})

test('our own commits do not, on either side of the graft', () => {
  requireFullHistory()
  // The regression: after the graft our commits descend from the template root
  // too, so a template-root test alone calls this one upstream content — and
  // the second parent of a PR's synthetic merge commit is exactly this shape.
  assert.equal(carriesTemplateContent(OURS_AFTER_GRAFT, ROOTS), false)
  assert.equal(carriesTemplateContent(OURS_BEFORE_GRAFT, ROOTS), false)
})

test('the template root alone would have misclassified our branch', () => {
  requireFullHistory()
  // Stated as its own case so the reason for the instance root cannot be
  // deleted as redundant by someone simplifying the manifest.
  const templateRootOnly = { ...ROOTS, instanceRoot: '0000000000000000000000000000000000000000' }
  assert.equal(carriesTemplateContent(OURS_AFTER_GRAFT, templateRootOnly), true)
})

test('both roots are pinned, and they are different commits', () => {
  assert.match(manifest.templateRootCommit, /^[0-9a-f]{40}$/)
  assert.match(manifest.instanceRootCommit, /^[0-9a-f]{40}$/)
  assert.notEqual(manifest.templateRootCommit, manifest.instanceRootCommit)
})
