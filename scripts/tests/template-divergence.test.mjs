#!/usr/bin/env node
/**
 * The divergence reporter's bucketing and tally.
 *
 * The report is only worth reading if a file lands in exactly one row and
 * every column means what its header says. Two ways that goes wrong quietly:
 * an ordering slip that files `src/lib/x.ts` under the catch-all `src (other)`
 * so a whole area reads as empty, and a scope leak that pulls `supabase/`
 * back in — ~800 instance migrations against a dummy backend would swamp
 * every other number in the table. Both are pinned here.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { bucketOf, inScope, tally } from '../measure-template-divergence.mjs'

test('the specific bucket wins over the src catch-all', () => {
  assert.equal(bucketOf('src/lib/agent/tools/read.ts'), 'src/lib')
  assert.equal(bucketOf('src/components/editor/EditorShell.tsx'), 'src/components')
  assert.equal(bucketOf('src/content/coverContent.ts'), 'src (other)')
  assert.equal(bucketOf('package.json'), 'root files')
  assert.equal(bucketOf('docs/engineering/standards.md'), 'docs')
})

test('supabase and generated trees stay out of scope', () => {
  assert.equal(inScope('supabase/migrations/20250602160000_initial.sql'), false)
  assert.equal(inScope('dist/index.js'), false)
  assert.equal(inScope('.claude/settings.json'), false)
  assert.equal(inScope('public/blueprint-images/one.png'), false)
  assert.equal(inScope('src/lib/blueprintContract.ts'), true)
  assert.equal(inScope('hooks/secret_guard.py'), true)
})

test('a shared path is identical or differing, never counted as only-one-side', () => {
  const rows = tally(
    new Map([
      ['src/lib/same.ts', 'aaa'],
      ['src/lib/drifted.ts', 'bbb'],
      ['src/data/ours.ts', 'ccc'],
    ]),
    new Map([
      ['src/lib/same.ts', 'aaa'],
      ['src/lib/drifted.ts', 'zzz'],
      ['hooks/theirs.py', 'ddd'],
    ]),
  )
  assert.deepEqual(
    { ...rows.get('src/lib'), differing: rows.get('src/lib').differing },
    { identical: 1, differ: 1, oursOnly: 0, theirsOnly: 0, differing: ['src/lib/drifted.ts'] },
  )
  assert.equal(rows.get('src/data').oursOnly, 1)
  assert.equal(rows.get('hooks').theirsOnly, 1)
})

test('out-of-scope paths are dropped rather than bucketed somewhere', () => {
  const rows = tally(new Map([['supabase/seed.sql', 'aaa']]), new Map([['supabase/seed.sql', 'bbb']]))
  const counted = [...rows.values()].reduce((n, r) => n + r.identical + r.differ + r.oursOnly + r.theirsOnly, 0)
  assert.equal(counted, 0)
})
