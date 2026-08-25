#!/usr/bin/env node
/**
 * The quarantine guard's matcher and manifest.
 *
 * The guard decides whether a merge from the template is allowed to have
 * touched a file this instance owns. Two ways it could fail quietly: a
 * pattern that matches less than it reads as (a template merge takes our
 * migrations and CI stays green), or one that matches more (upstream
 * improvements get rejected forever and nobody knows why). Both are tested
 * here. The git walk itself is exercised in CI, where there are merges.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { matches, violations } from '../check-template-quarantine.mjs'

const manifest = JSON.parse(readFileSync(new URL('../template-quarantine.json', import.meta.url)))

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
