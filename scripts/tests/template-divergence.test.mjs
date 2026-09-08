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
import {
  bucketOf,
  enrollableCandidates,
  inScope,
  stripProse,
  tally,
} from '../measure-template-divergence.mjs'
import { RECONCILED_FILES } from '../reconciled-files.mjs'

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

/*
  `--enrollable`: shared files that differ from the pinned template by prose
  alone, and so are one agreed comment away from the drift gate.

  The report is only useful if it is honest in both directions — a file that
  differs in code must never appear, or someone enrols it and reddens the
  gate; a file that differs only in a comment must appear, or the cheapest
  enrolments stay invisible. Both, plus the crudeness the stripper is allowed,
  are pinned here.
*/
test('prose comes out and code stays in', () => {
  assert.equal(stripProse('const a = 1 // why\n\n/* block */\nconst b = 2\n'), 'const a = 1\nconst b = 2')
  assert.equal(stripProse('  /*\n   * many\n   * lines\n   */\n  x()\n'), 'x()')
})

test('a file that differs only in a comment is a candidate', () => {
  const candidates = enrollableCandidates({
    paths: ['src/lib/a.ts'],
    readInstance: () => '// our words\nexport const a = 1\n',
    readAsb: () => '// their words\nexport const a = 1\n',
  })
  assert.deepEqual(candidates, ['src/lib/a.ts'])
})

test('a file that differs in code is never a candidate', () => {
  const candidates = enrollableCandidates({
    paths: ['src/lib/a.ts'],
    readInstance: () => '// same words\nexport const a = 1\n',
    readAsb: () => '// same words\nexport const a = 2\n',
  })
  assert.deepEqual(candidates, [])
})

test('an already-enrolled path is left out — the gate owns it', () => {
  const enrolled = RECONCILED_FILES[0]
  assert.ok(enrolled, 'the allowlist is empty, so this test proves nothing')
  const candidates = enrollableCandidates({
    paths: [enrolled],
    readInstance: () => '// ours\nx()\n',
    readAsb: () => '// theirs\nx()\n',
  })
  assert.deepEqual(candidates, [])
})

test('a path missing on either side is not a candidate', () => {
  assert.deepEqual(
    enrollableCandidates({ paths: ['src/lib/a.ts'], readInstance: () => 'x()', readAsb: () => null }),
    [],
  )
  assert.deepEqual(
    enrollableCandidates({ paths: ['src/lib/a.ts'], readInstance: () => null, readAsb: () => 'x()' }),
    [],
  )
})

test('a `//` inside a string is treated as a comment, and that is the safe way to be wrong', () => {
  // The output is a list for a person to check before enrolling, and
  // `check:reconciled` is what actually refuses, so a false candidate costs a
  // second look and a false negative costs an enrolment nobody notices.
  assert.equal(stripProse("const u = 'https://example.test'"), "const u = 'https:")
})
