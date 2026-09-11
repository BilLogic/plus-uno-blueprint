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
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ledgerInsert, pending, transactionControl, withheld } from '../apply-pending.mjs'

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

// ── The transaction guard ───────────────────────────────────────────────────
//
// The second thing this script refuses. A file carrying its own `begin;` ends
// the transaction the script opened, so the ledger insert appended after it
// commits separately — and a file that then fails leaves partial work behind
// AND a row saying it ran. psql reports that as a warning and nothing else.

const MIGRATIONS = fileURLToPath(new URL('../../supabase/migrations', import.meta.url))

/**
 * What a text search would have said, and the reason this reads a parse tree.
 *
 * Not a strawman: `begin;` is the shape a grep for this defect would look for.
 * It is wrong in both directions, and the fixtures below show each.
 */
function naiveHits(sql) {
  return sql
    .split('\n')
    .flatMap((line, index) => (/\b(begin|commit)\s*;/i.test(line) ? [index + 1] : []))
}

test('a file that opens its own transaction is caught, with the line and the spelling', async () => {
  const sql = ['-- a repair', 'begin;', "update public.cells set body = '';", 'commit;', ''].join('\n')
  assert.deepEqual(await transactionControl(sql), [
    { statement: 'begin', line: 2 },
    { statement: 'commit', line: 4 },
  ])
})

test('a plpgsql begin is not transaction control, and neither is one in a comment', async () => {
  // Three `begin`s and two `commit`s in the text; none of them is a statement.
  // The function body's `begin … end;` is plpgsql, the dollar-quoted notice is
  // a string constant, and the last one is a comment.
  const sql = `create function public.f() returns void language plpgsql as $fn$
begin
  raise notice '%', $doc$
begin;
commit;
$doc$;
end;
$fn$;

-- the shape this file used to have:
-- begin;
`
  assert.deepEqual(await transactionControl(sql), [])
  // And the same text read as text, which is what the parser is here to beat.
  assert.deepEqual(naiveHits(sql), [4, 5, 11])
})

test('the two of them in one file are told apart', async () => {
  // The file that took this to production. Transaction control on 34 and 373,
  // a `do $$ begin` on 244, all in one file — which is why it is the fixture.
  const file = join(MIGRATIONS, '20260910010000_the_board_in_typescript_moves_into_the_database.sql')
  const sql = readFileSync(file, 'utf8')
  assert.deepEqual(await transactionControl(sql), [
    { statement: 'begin', line: 34 },
    { statement: 'commit', line: 373 },
  ])
  assert.match(sql.split('\n')[243], /^begin$/)
})

test('commit spelled `end`, and the rest of the spellings', async () => {
  // `end` is a commit, and a file that only rolls back still ends the
  // transaction the ledger row was going to be written in.
  assert.deepEqual(await transactionControl('start transaction;\nselect 1;\nend;\n'), [
    { statement: 'start transaction', line: 1 },
    { statement: 'end', line: 3 },
  ])
  assert.deepEqual(await transactionControl('rollback;\n'), [{ statement: 'rollback', line: 1 }])
})

test('a savepoint is not an escape from the transaction, and is allowed', async () => {
  // `savepoint`, `release` and `rollback to` nest inside the transaction this
  // script opened rather than ending it, so they cost the ledger nothing.
  const sql = 'savepoint s;\nupdate public.cells set body = null;\nrollback to savepoint s;\nrelease s;\n'
  assert.deepEqual(await transactionControl(sql), [])
})

test('the line is counted in bytes, because that is what the parser reports', async () => {
  // `stmt_location` is a byte offset and this series writes em dashes in its
  // comments. Slicing the JavaScript string by it drifts by one line for every
  // two multi-byte characters above the statement, which is a wrong line
  // number in exactly the files most likely to carry prose.
  const sql = '-- ————— five em dashes, fifteen bytes, five characters\nselect 1;\nbegin;\n'
  assert.deepEqual(await transactionControl(sql), [{ statement: 'begin', line: 3 }])
})

test('the exposure the guard arrived too late for is these sixteen files', async () => {
  // Inventoried rather than guessed, and frozen here rather than counted: a
  // seventeenth entry is a new file carrying the defect, and this test is the
  // first place it shows. All sixteen are applied and none may be edited —
  // #606 changes the rule going forward, not the record of what went in.
  const carried = []
  for (const name of readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort()) {
    const found = await transactionControl(readFileSync(join(MIGRATIONS, name), 'utf8'))
    if (found.length > 0) carried.push(name)
  }
  assert.deepEqual(carried, [
    '20260820190000_touchpoint_cells_are_names.sql',
    '20260820200000_teacher_lane_drops_its_role_prefix.sql',
    '20260820210000_every_step_says_what_happens.sql',
    '20260820220000_a_route_says_when_it_applies.sql',
    '20260821100000_shipped_is_not_planned.sql',
    '20260821110000_a_lane_that_says_something.sql',
    '20260821120000_one_word_for_unbuilt.sql',
    '20260821130000_maturity_is_not_a_name.sql',
    '20260821140000_the_post_session_two_features.sql',
    '20260821150000_session_reflection_is_a_scenario.sql',
    '20260821160000_no_more_pencil.sql',
    '20260821170000_one_ladder_for_how_built.sql',
    '20260821180000_phases_say_what_they_cost.sql',
    '20260821190000_every_cell_says_what_it_means.sql',
    '20260821390000_three_things_the_sweeps_missed.sql',
    '20260910010000_the_board_in_typescript_moves_into_the_database.sql',
  ])
})
