/**
 * The machinery behind `scripts/apply-pending.mjs`, exercised directly.
 *
 * This is the first script here that WRITES to production, so the tests are
 * about what it refuses. The dangerous version of this tool is the obvious
 * one: apply every file with no ledger row. Against this database that is 172
 * files, of which four are pending and 168 ran years ago under identities the
 * ledger records differently — #148 in one sentence. Running them again would
 * re-create a schema that already exists.
 *
 * So the load-bearing assertions are the cutoff and the absence of an "all".
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { ledgerInsert, pending, withheld } from '../apply-pending.mjs'

/** The shape #148 describes: old files recorded under an apply-time version. */
const FILES = [
  '20250603140000_warm_up_layer_order.sql',
  // Earlier than the cutoff and in no ledger row under any identity — the
  // population the cutoff exists to withhold. There are 168 of these.
  '20250604120000_something_the_ledger_never_saw.sql',
  '20260830250000_a_placement_gets_an_author.sql',
  '20260830260000_a_detail_nobody_placed_has_somewhere_to_wait.sql',
  '20260830290000_a_panel_writes_its_own_columns.sql',
  'not-a-migration.txt',
]

const LEDGER = [
  // Recorded under `version_name`, which is one of the two shapes that count.
  { version: '20260830250000', name: '20260830250000_a_placement_gets_an_author' },
  // An MCP row: apply-time version, bare name. Matches by name, so its file
  // is NOT pending — this is the case a second matcher would get wrong.
  { version: '20260603010203', name: 'warm_up_layer_order' },
]

test('the cutoff selects the pending files and nothing else', () => {
  const queue = pending(FILES, LEDGER, '20260830260000')
  assert.deepEqual(queue.map((e) => e.file), [
    '20260830260000_a_detail_nobody_placed_has_somewhere_to_wait.sql',
    '20260830290000_a_panel_writes_its_own_columns.sql',
  ])
})

test('a file the ledger records under an MCP identity is not pending', () => {
  // The reason this file reuses `ledgerDrift` instead of writing its own
  // matcher. `warm_up_layer_order` has no row under its own version, and
  // re-applying it would re-run the creation of a lane order that exists.
  const queue = pending(FILES, LEDGER, '20250101000000')
  assert.ok(!queue.some((e) => e.file.includes('warm_up_layer_order')))
})

test('there is no way to ask for all of them', () => {
  // Not an oversight. A flag meaning "all" would eventually be used.
  assert.throws(() => pending(FILES, LEDGER), /no "all" here/)
  assert.throws(() => pending(FILES, LEDGER, ''), /no "all" here/)
})

test('the plan says how many the cutoff is holding back', () => {
  // A cutoff that silently hid work would be the same defect as the ledger
  // gap it exists to navigate.
  assert.equal(withheld(FILES, LEDGER, '20260830260000'), 1)
  assert.equal(withheld(FILES, LEDGER, '20250101000000'), 0)
  // And it is the one that is genuinely unrecorded, not the one the ledger
  // holds under an MCP identity.
  assert.deepEqual(
    pending(FILES, LEDGER, '20250101000000').map((e) => e.version),
    ['20250604120000', '20260830260000', '20260830290000'],
  )
})

test('the queue is in filename order, which is series order', () => {
  const shuffled = [...FILES].reverse()
  assert.deepEqual(
    pending(shuffled, LEDGER, '20260830260000').map((e) => e.version),
    ['20260830260000', '20260830290000'],
  )
})

test('the ledger row is written under the filename version, not the apply time', () => {
  // The distinction that IS #148: the schema went in over MCP, which stamps
  // `now()`, so not one repository version appears in the ledger.
  const sql = ledgerInsert('20260830260000', 'a_detail_nobody_placed_has_somewhere_to_wait')
  assert.match(sql, /values \('20260830260000', 'a_detail_nobody_placed_has_somewhere_to_wait'\)/)
  assert.match(sql, /on conflict \(version\) do nothing/)
  assert.doesNotMatch(sql, /now\(\)/)
})

test('a name with a quote in it cannot end the statement', () => {
  const sql = ledgerInsert('20260830260000', "o'brien")
  assert.match(sql, /'o''brien'/)
})

test('a file whose name does not parse is not applied', () => {
  // `parseMigrationFiles` yields a null version for it. Applying a file this
  // script cannot name is applying something it cannot record.
  const queue = pending(FILES, LEDGER, '20250101000000')
  assert.ok(!queue.some((e) => e.file === 'not-a-migration.txt'))
})
