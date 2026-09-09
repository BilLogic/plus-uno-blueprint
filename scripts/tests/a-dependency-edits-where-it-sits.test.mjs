#!/usr/bin/env node
/**
 * #550 — editing an edge in place, and the retirement of `name`.
 *
 * THE BEHAVIOUR IS PERFORMED IN THE MIGRATIONS, not here, for the reason
 * `scripts/tests/integrity-guards.test.mjs` gives: it needs a database and
 * this repository has none to give a pull request.
 * `20260909030000_a_dependency_can_be_edited_where_it_sits.sql` builds a
 * fixture under `set local role authenticated` with a service-account JWT,
 * changes an edge's kind and then its target through the new function, and
 * raises unless one row survives each time and the returned row is the row as
 * it stood. `20260909040000_the_eight_names_were_always_notes.sql` raises
 * unless exactly eight names move into notes.
 *
 * What is here is the DECLARATION side: that those assertions are in those
 * files, that the proof is not an owner run, and that the two halves of the
 * retirement actually happened in the app. Every one is shown going red
 * against a copy with the declaration cut out, because a search two lists
 * failed to find passes exactly as loudly as a search that agreed — the
 * argument `scripts/tests/rls-posture.test.mjs` makes and `integrity-guards`
 * makes again.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = process.cwd()
const read = (path) => readFileSync(resolve(REPO_ROOT, path), 'utf8')

const EDIT_MIGRATION =
  'supabase/migrations/20260909030000_a_dependency_can_be_edited_where_it_sits.sql'
const BACKFILL_MIGRATION =
  'supabase/migrations/20260909040000_the_eight_names_were_always_notes.sql'
const BASELINE = 'docs/reference/migration-replay-baseline.json'

/** The `update` statement inside the new function, and nothing else. */
export function updateStatement(sql) {
  const match = sql.match(/update public\.cell_dependencies d\b[\s\S]*?where d\.id = previous\.id;/)
  return match ? match[0] : ''
}

/**
 * The file with its `--` comments removed.
 *
 * Every migration here argues for itself at length, and stage 2 is named in
 * that argument — so "this file does not drop the column" has to be asked of
 * the statements and not of the prose that says a later file will.
 */
export function statementsOnly(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
}

/** Every `raise exception` message the file can produce. */
export function raiseMessages(sql) {
  return [...sql.matchAll(/raise exception\s+'([^']*)'/g)].map((m) => m[1])
}

/* --------------------------------------------------------- the new function */

test('the edit is one function, granted to the role the app signs in as', () => {
  const sql = read(EDIT_MIGRATION)
  // Four arguments, all required. A default on any of them would make an
  // omitted argument a silent erase rather than a loud "function does not
  // exist" — the reason the header gives for refusing them.
  assert.match(
    sql,
    /FUNCTION public\.update_cell_dependency\(dependency_id uuid, kind text, target_cell_id uuid, note text\)/,
  )
  assert.doesNotMatch(sql, /update_cell_dependency\([^)]*DEFAULT/i)
  assert.match(
    sql,
    /grant execute on function public\.update_cell_dependency\(uuid, text, uuid, text\)\s*\n?\s*to authenticated, service_role;/,
  )

  // Red: a signature that grew a default would stop being caught.
  assert.doesNotMatch(
    sql.replace('note text)', 'note text DEFAULT NULL)'),
    /FUNCTION public\.update_cell_dependency\(dependency_id uuid, kind text, target_cell_id uuid, note text\)/,
  )
})

test('it carries the note and does not touch the retired column', () => {
  const statement = updateStatement(read(EDIT_MIGRATION))
  assert.notEqual(statement, '', 'the function has no update statement')
  // The note travels on every write, including the ones that are not about it:
  // an update told nothing about the note would clear it on a kind change.
  assert.match(statement, /note = nullif\(btrim\(update_cell_dependency\.note\), ''\)/)
  assert.match(statement, /kind = update_cell_dependency\.kind/)
  assert.match(statement, /target_cell_id = update_cell_dependency\.target_cell_id/)
  // `name` is retired by the sibling migration. A write path that still set it
  // would keep the column alive underneath a UI that has stopped showing it.
  assert.doesNotMatch(statement, /\bname\s*=/)

  // Red: the assertion above finds a reinstated write.
  assert.match(
    statement.replace('kind = update_cell_dependency.kind', 'name = null, kind = update_cell_dependency.kind'),
    /\bname\s*=/,
  )
})

test('the returned row is the row as it stood, note included', () => {
  const sql = read(EDIT_MIGRATION)
  // `previous`, captured before the update — an inverse built from the row as
  // it now stands would restore the edit rather than undo it.
  for (const field of ['id', 'source_cell_id', 'target_cell_id', 'kind', 'note']) {
    assert.match(
      sql,
      new RegExp(`'${field}', previous\\.${field}`),
      `the returned row does not carry ${field} as it stood`,
    )
  }
  assert.doesNotMatch(sql.split('jsonb_build_object')[1] ?? '', /previous\.name/)
})

/* ------------------------------------------------------------- the proof */

test('the proof runs as authenticated, not as the owner', () => {
  const sql = read(EDIT_MIGRATION)
  // An owner run cannot see a missing grant, and the restrictive
  // service-account policies on this table match zero rows silently under a
  // plain authenticated session — so a proof that never leaves the owner
  // proves nothing about either.
  assert.match(sql, /set local role authenticated/)
  assert.match(sql, /request\.jwt\.claims/)
  assert.match(sql, /"app_metadata":\{"role":"service"\}/)

  // And it gives the role back, or every statement after it in the migration
  // runs as somebody else.
  assert.match(sql, /reset role/)

  // Red.
  assert.doesNotMatch(sql.replace(/set local role authenticated/g, ''), /set local role authenticated/)
})

test('the proof pins one row per edit, and the fixture does not survive it', () => {
  const messages = raiseMessages(read(EDIT_MIGRATION))
  const has = (fragment) => messages.some((m) => m.includes(fragment))
  // The defect the function exists to fix: through `set_cell_dependency` a
  // kind change leaves 2 rows and a target change leaves 3.
  assert.ok(has('a kind change left'), 'nothing asserts the row count after a kind change')
  assert.ok(has('a target change left'), 'nothing asserts the row count after a target change')
  assert.ok(
    has('the edited row is gone'),
    'nothing asserts the surviving row is the row that was edited',
  )
  assert.ok(has('undo left the edge as'), 'the undo is not performed')
  assert.ok(
    has('the issue-550 fixture survived the rollback'),
    'nothing checks the fixture was given back',
  )

  // Red: the messages are what carry the claims, so a proof reduced to its
  // fixture stops satisfying any of them.
  assert.equal(
    raiseMessages(read(EDIT_MIGRATION).replace(/raise exception\s+'a kind change left[^;]*;/, '')).some(
      (m) => m.includes('a kind change left'),
    ),
    false,
  )
})

test('the drawn kind the proof counts is the kind the canvas filters on', () => {
  // "leads_to draws an arrow and enables does not, and that asymmetry survives
  // a kind change" is two claims in two places. The migration proves the data
  // half — the count of `leads_to` rows goes to 0 and back to 1 across the
  // change — and this is the line that makes that count the thing that draws.
  const arrows = read('src/components/blueprint/BlueprintDependencyArrows.tsx')
  assert.match(arrows, /kind \?\? 'leads_to'\) === 'leads_to'/)
  assert.match(read(EDIT_MIGRATION), /kind = 'leads_to'/)
})

/* ------------------------------------------------- retiring `name`, stage 1 */

test('the backfill raises unless exactly eight names move', () => {
  const sql = read(BACKFILL_MIGRATION)
  assert.match(sql, /if moved_count <> 8 then/)
  assert.match(sql, /expected to move 8 names into note, moved %/)
  // The post-condition beside it, which is the assertion that survives an
  // empty database and every later one: nothing is left holding a name and no
  // note. It is what a reader should look at first when this file goes red.
  assert.match(sql, /rows still carry a name and no note/)
  // It copies. A drop here would make stage 2 a consequence of running stage 1
  // rather than a decision — asked of the statements, because the header names
  // stage 2 in prose on purpose.
  assert.doesNotMatch(statementsOnly(sql), /drop column/i)

  // Red.
  assert.doesNotMatch(sql.replace('if moved_count <> 8 then', 'if false then'), /if moved_count <> 8 then/)
})

test('the count that cannot replay is recorded as deliberate', () => {
  // On an empty database the right number to move is zero, so the assertion
  // fires and the file cannot replay. That is the price of the count, and
  // ADR 0009 says the price is paid in this file rather than argued away.
  const baseline = JSON.parse(read(BASELINE))
  assert.ok(
    baseline.failing.includes('20260909040000_the_eight_names_were_always_notes.sql'),
    'the backfill is not recorded as unable to replay',
  )
  assert.match(baseline.why, /20260909040000/)
})

test('neither the editor nor the agent tool writes name any more', () => {
  // The other half of stage 1. The column keeps its data and loses its job, so
  // the two things that used to write it have to stop.
  // Scoped to the two dependency wrappers: `name` is an ordinary argument on
  // half the file's other functions, and a whole-file search would be about
  // lanes and paths rather than about edges.
  const rpc = read('src/lib/authoringRpc.ts')
  for (const wrapper of ['setCellDependency', 'updateCellDependency']) {
    const body =
      rpc.match(new RegExp(`export function ${wrapper}\\(([\\s\\S]*?)\\n\\}`))?.[0] ?? ''
    assert.notEqual(body, '', `${wrapper} is gone`)
    assert.doesNotMatch(body, /\bname\b/, `${wrapper} still names the retired column`)
    assert.match(body, /\bnote\b/, `${wrapper} does not carry the note`)
  }

  const registry = read('src/lib/agent/tools/registry.ts')
  const call = registry.match(/case 'create_cell_dependency': \{[\s\S]*?\n      \}/)?.[0] ?? ''
  assert.notEqual(call, '', 'create_cell_dependency is gone from the registry')
  assert.match(call, /note: s\(args, 'label'\) \?\? null/)
  assert.doesNotMatch(call, /name: s\(args, 'label'\)/)

  // The argument itself does NOT move: `specs.ts` is a pinned cross-repo
  // contract and renaming an argument there without an upstream release is a
  // skill telling a model to send something this app rejects.
  assert.match(read('src/lib/agent/tools/specs.ts'), /label: str\(/)

  // Red.
  assert.match(call.replace("note: s(args, 'label')", "name: s(args, 'label')"), /name: s\(args, 'label'\)/)
})
