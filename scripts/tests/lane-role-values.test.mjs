/**
 * The lane-role VALUE sweep — its vocabulary, its narrowings, and its red.
 *
 * The sweep's whole claim is that it derives the retired vocabulary from the
 * schema rather than carrying a copy, so the tests that matter are the ones
 * that plant a schema and check what comes back. A reader that quietly found
 * nothing would make the tree-is-clean assertion pass exactly as loudly as a
 * clean tree does — the same argument `lane-roles.test.mjs` and `rls-posture`
 * both make about their own readers.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { CONSTRAINT_MIGRATION } from '../lane-roles.mjs'
import {
  DATED_RECORDS,
  LANE_ROLE_VALUE_EXEMPTIONS,
  effectiveExemptions,
  findings,
  isExemptPath,
  laneRoleValuesInSeries,
  latestConstraintMigration,
  occurrences,
  replacementForValue,
  retiredLaneRoleValues,
  staleConstraintPointer,
  unheldDeclinedValues,
} from '../check-lane-role-values.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)

/** A throwaway tree with `supabase/migrations` holding the given files. */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'lane-role-values-'))
  mkdirSync(join(root, 'supabase', 'migrations'), { recursive: true })
  for (const [name, sql] of Object.entries(files)) {
    writeFileSync(join(root, 'supabase', 'migrations', name), sql)
  }
  return root
}

/* -------------------------------------------------------------- the reader */

test('the series reader finds values in a list, in a comparison and in a comment', () => {
  const root = fixture({
    '20260101000000_a.sql': [
      "update public.layers set layer_role = 'old_role' where name = 'X';",
      "alter table public.lanes add constraint lanes_lane_role_check",
      "  check (lane_role is null or lane_role in ('kept_role', 'listed_role'));",
      "comment on column public.lanes.lane_role is",
      "  'Semantic key. Canonical values: kept_role, listed_role, documented_role. '",
      "  'Null = generic swimlane.';",
    ].join('\n'),
  })
  assert.deepEqual(laneRoleValuesInSeries(root), [
    'documented_role',
    'kept_role',
    'listed_role',
    'old_role',
  ])
})

test('the reader throws rather than reporting an empty vocabulary', () => {
  // A reader that returned [] here would make every retired value disappear
  // and the whole sweep pass against any tree at all.
  assert.throws(() => laneRoleValuesInSeries(fixture({})))
  assert.throws(() => laneRoleValuesInSeries('/nonexistent-tree'))
})

test('the reader does not mistake a neighbouring literal for a role', () => {
  // The shape a lazy window-based reader gets wrong: `'app'` and the join
  // alias are both quoted tokens within a few characters of the column.
  const root = fixture({
    '20260101000000_a.sql': [
      "select l.id from public.lanes l",
      "  join public.cells c on c.lane_id = l.id",
      " where l.lane_role in ('kept_role') and c.origin = 'app';",
    ].join('\n'),
  })
  assert.deepEqual(laneRoleValuesInSeries(root), ['kept_role'])
})

/* ------------------------------------------------------ the live half is live */

test('the constraint this repository reads its vocabulary from is the last one', () => {
  assert.equal(latestConstraintMigration(), CONSTRAINT_MIGRATION)
  assert.equal(staleConstraintPointer(), null)
})

test('a later redefinition of the constraint is reported, not read as history', () => {
  // `lane-roles.test.mjs` asserts only that CONSTRAINT_MIGRATION still EXISTS,
  // which a later redefinition leaves true — and a stale pointer would make
  // every role added since look retired and get swept out of the tree.
  const root = fixture({
    [CONSTRAINT_MIGRATION]:
      "alter table public.lanes add constraint lanes_lane_role_check check (lane_role in ('a_role'));",
    '29990101000000_later.sql':
      "alter table public.lanes add constraint lanes_lane_role_check check (lane_role in ('a_role', 'b_role'));",
  })
  assert.equal(latestConstraintMigration(root), '29990101000000_later.sql')
  assert.match(staleConstraintPointer(root), /29990101000000_later\.sql redefines/)
})

/* ------------------------------------------------------------ the subtraction */

test('retired is everything the series named and the constraint no longer admits', () => {
  const { swept, declined } = retiredLaneRoleValues()
  assert.deepEqual(swept, ['backstage_tech', 'frontstage_tech', 'step_visual', 'support_systems'])
  // A single English word is declined on purpose; see the sweep's header.
  assert.deepEqual(declined, ['visual'])
})

test('a declined value the rename map does not carry is a finding', () => {
  assert.deepEqual(unheldDeclinedValues(retiredLaneRoleValues().declined), [])
  const unheld = unheldDeclinedValues(['orphan'], ['something_else'])
  assert.equal(unheld.length, 1)
  assert.match(unheld[0], /nothing holds it/)
})

test('the message names the one value that replaced this one', () => {
  assert.equal(replacementForValue('frontstage_tech'), 'frontstage_touchpoints')
  assert.equal(replacementForValue('backstage_tech'), 'backstage_touchpoints')
  // Retired unused rather than renamed: there is nothing to point at, and the
  // failure message says so instead of inventing a replacement.
  assert.equal(replacementForValue('support_systems'), null)
})

/* ------------------------------------------------------------- the narrowings */

test('a retired value is matched as a whole word and never inside a longer name', () => {
  assert.deepEqual(occurrences('lane_role: frontstage_tech,', ['frontstage_tech']), [
    { line: 1, value: 'frontstage_tech' },
  ])
  // The replay baseline records `20250608120000_add_step_visual_layer.sql`. A
  // migration filename is a different identifier, not a use of the value.
  assert.deepEqual(occurrences('"20250608120000_add_step_visual_layer.sql"', ['step_visual']), [])
  assert.deepEqual(occurrences('frontstage_technology', ['frontstage_tech']), [])
})

test('dated records and test files are out of subject, and documents are not', () => {
  for (const record of DATED_RECORDS) {
    assert.equal(isExemptPath(record.endsWith('/') ? `${record}whatever.md` : record), true, record)
  }
  assert.equal(isExemptPath('scripts/tests/lane-role-values.test.mjs'), true)
  assert.equal(isExemptPath('src/lib/laneRoles.test.ts'), true)
  assert.equal(isExemptPath('docs/reference/erd.mmd'), false)
  assert.equal(isExemptPath('src/lib/agent/tools/specs.ts'), false)
  // `docs/reference` is not `docs/adr`, and a prefix rule that matched on the
  // parent would take the whole of `docs/` with it.
  assert.equal(isExemptPath('docs/adr-notes.md'), false)
})

test('the sweep fires on a file it covers and stays quiet on one it does not', () => {
  const covered = findings(ROOT, { files: ['docs/reference/erd.mmd'] })
  assert.deepEqual(covered, [])

  const planted = findings(ROOT, { files: ['supabase/migrations/20260830150000_the_tech_lanes_were_never_only_tech.sql'] })
  assert.deepEqual(planted, [], 'a migration is a dated record and keeps its spelling')

  // The unfiltered sweep of the same migration, read as an ordinary file,
  // proves the matcher itself is not the thing returning nothing.
  const unswept = occurrences(
    "where lane_role in ('frontstage_tech', 'backstage_tech')",
    retiredLaneRoleValues().swept,
  )
  assert.equal(unswept.length, 2)
})

/* -------------------------------------------------------------- the exemptions */

test('every exemption is still excusing something the sweep would flag', () => {
  // Rule 2 of `retired-vocabulary.test.mjs`, applied to this list. An
  // exemption whose subject is gone is a licence nobody is using, and the
  // next person to write that word inherits it.
  const unfiltered = findings(ROOT, { applyExemptions: false }).map((one) => one.identifier)
  const stale = LANE_ROLE_VALUE_EXEMPTIONS.map((entry) => entry.identifier).filter(
    (identifier) => !unfiltered.includes(identifier),
  )
  assert.deepEqual(
    stale,
    [],
    `Exempt from the lane-role value sweep but no longer flagged by it: ${stale.join(', ')}. ` +
      'The mention it excused is gone — delete the exemption, or move it if the file did.',
  )
})

test("the self-exemption covers only the values this file exempts", () => {
  const derived = effectiveExemptions([
    { identifier: 'somewhere/else.md a_role', because: 'a reason long enough to count' },
  ])
  assert.equal(derived.has('somewhere/else.md a_role'), true)
  assert.equal(derived.has('scripts/check-lane-role-values.mjs a_role'), true)
  assert.equal(derived.has('scripts/check-lane-role-values.mjs frontstage_tech'), false)
})

/* --------------------------------------------------------------- the tree today */

test('no tracked file outside the dated records spells a retired lane role', () => {
  const problems = findings(ROOT).map((one) => `${one.file}:${one.line} ${one.value}`)
  assert.deepEqual(
    problems,
    [],
    `A retired lane_role value in the tracked tree: ${problems.join(', ')}. Nothing ` +
      'typechecks a value — a write built from one is refused at save time and a read ' +
      'built from one comes back empty while reporting success.',
  )
})
