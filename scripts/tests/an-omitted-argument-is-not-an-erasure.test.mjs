#!/usr/bin/env node
/**
 * The upsert stops erasing the words nobody mentioned.
 *
 * THE BEHAVIOUR IS PERFORMED IN THE MIGRATION, not here, for the reason
 * `scripts/tests/integrity-guards.test.mjs` gives: it needs a database and this
 * repository has none to give a pull request.
 * `20260909050000_an_omitted_argument_is_not_an_erasure.sql` builds a fixture
 * under `set local role authenticated` with a service-account JWT, authors an
 * edge carrying both prose columns, re-runs the call the agent tool sends, and
 * raises unless both survive — then supplies new values and raises unless they
 * replace.
 *
 * What is here is the DECLARATION side: that the conflict clause coalesces
 * both columns, that the proof is not an owner run, and that the wrapper's
 * comment no longer claims an omitted argument is what protects the column.
 * Every one is shown going red against a copy with the claim cut out, because
 * a search two lists failed to find passes exactly as loudly as a search that
 * agreed.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { appSource } from '../app-source.mjs'

const REPO_ROOT = process.cwd()
/** A file of THIS repository: the migration, the replay baseline. */
const read = (path) => readFileSync(resolve(REPO_ROOT, path), 'utf8')

const MIGRATION =
  'supabase/migrations/20260909050000_an_omitted_argument_is_not_an_erasure.sql'
const BASELINE = 'docs/reference/migration-replay-baseline.json'

/** The `on conflict` clause of the function, and nothing else. */
export function conflictClause(sql) {
  const match = sql.match(/on conflict on constraint[\s\S]*?returning id into dependency_id;/)
  return match ? match[0] : ''
}

/** Every `raise exception` message the file can produce. */
export function raiseMessages(sql) {
  return [...sql.matchAll(/raise exception\s+'([^']*)'/g)].map((m) => m[1])
}

test('both prose columns coalesce against the row already there', () => {
  const clause = conflictClause(read(MIGRATION))
  assert.notEqual(clause, '', 'the function has no conflict clause')

  for (const column of ['name', 'note']) {
    assert.match(
      clause,
      new RegExp(`${column} = coalesce\\(excluded\\.${column}, public\\.cell_dependencies\\.${column}\\)`),
      `${column} is assigned straight from excluded, so an omitted argument erases it`,
    )
  }

  // Red: the assertion above finds a plain assignment reinstated on either
  // column, which is the shape of the defect and the shape a later rewrite
  // would most naturally take.
  assert.doesNotMatch(
    clause.replace(
      'note = coalesce(excluded.note, public.cell_dependencies.note)',
      'note = excluded.note',
    ),
    /note = coalesce\(excluded\.note, public\.cell_dependencies\.note\)/,
  )
})

test('the proof runs as authenticated, not as the owner', () => {
  const sql = read(MIGRATION)
  // An owner run cannot see a missing grant, and the restrictive
  // service-account policies on this table match zero rows silently under a
  // plain authenticated session.
  assert.match(sql, /set local role authenticated/)
  assert.match(sql, /request\.jwt\.claims/)
  assert.match(sql, /"app_metadata":\{"role":"service"\}/)
  assert.match(sql, /reset role/)

  // Red.
  assert.doesNotMatch(
    sql.replace(/set local role authenticated/g, ''),
    /set local role authenticated/,
  )
})

test('the proof performs both directions, and gives the fixture back', () => {
  const messages = raiseMessages(read(MIGRATION))
  const has = (fragment) => messages.some((m) => m.includes(fragment))

  // The defect: a bare re-run of the agent tool's call over an edge that
  // already exists.
  assert.ok(has('an omitted name erased'), 'nothing asserts the retired column survives a bare re-run')
  assert.ok(has('an omitted note erased'), 'nothing asserts the note survives a bare re-run')
  // And the other direction, without which a function that preserved
  // everything would pass.
  assert.ok(has('a supplied argument no longer replaces'), 'nothing asserts a supplied argument still writes')
  assert.ok(has('one column moved and took the other with it'), 'nothing asserts the two columns move independently')
  assert.ok(has('the omitted-argument fixture survived the rollback'), 'nothing checks the fixture was given back')

  // Red: the messages are what carry the claims.
  assert.equal(
    raiseMessages(
      read(MIGRATION).replace(/raise exception\s+'an omitted note erased[^;]*;/, ''),
    ).some((m) => m.includes('an omitted note erased')),
    false,
  )
})

test('it asserts a post-condition, not a census', () => {
  const sql = read(MIGRATION)
  // Eight is what this table held on one morning — ADR 0009 refuses a count
  // wearing an invariant's clothes, and a file that asserted it could not
  // replay against an empty database. The proof authors its own edge.
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ''), /<>\s*8\b/)
  const baseline = JSON.parse(read(BASELINE))
  assert.ok(
    !baseline.failing.includes('20260909050000_an_omitted_argument_is_not_an_erasure.sql'),
    'the migration is recorded as unable to replay, but it replays',
  )
})

/**
 * A sentence claiming that leaving an argument out is what saves a column.
 *
 * A SHAPE RATHER THAN THE ONE SENTENCE THAT SHIPPED. "Omitting leaves the
 * column alone" is the wording this file was written about; the claim is what
 * is wrong with it, and the next writer will phrase it their own way.
 */
export const OMISSION_PROTECTS = /omit\w*[^.]{0,80}(?:leaves|protects?|preserves?|keeps)/i

test('the wrapper no longer says an omitted argument is what protects the column', () => {
  // The comment this replaces reasoned that omitting `name` rather than
  // sending null "leaves the column alone". It does not: the argument defaults
  // to null, so the two calls are the same call by the time the function sees
  // them. A comment that states the opposite of what the database does is what
  // sent the last reader looking in the wrong place.
  //
  // THE CITATION MOVED OUT OF THE COMMENT AND INTO THIS TEST. The wrapper is
  // the APPLICATION's and the application is the installed package now, so the
  // comment is a file two repositories share — and a shared file cites no
  // migration filename, because `20260909050000` is an address in this
  // deployment's database and in nothing of the template's. The pairing is
  // therefore performed here rather than asserted as a string: the app's
  // wrapper claims nothing about omission, and THIS repository's function is
  // what actually makes an omitted argument survive.
  const rpc = appSource('lib/authoringRpc.ts')
  const body = rpc.match(/export function setCellDependency\(([\s\S]*?)\n\}/)?.[0] ?? ''
  assert.notEqual(body, '', 'setCellDependency is gone')
  assert.doesNotMatch(body, OMISSION_PROTECTS)

  assert.match(
    conflictClause(read(MIGRATION)),
    /name = coalesce\(excluded\.name, public\.cell_dependencies\.name\)/,
    'the wrapper is quiet about omission because the database handles it — and here it does not',
  )

  // Red, both ways: the pattern finds the sentence that shipped, and it finds
  // the same claim in somebody else's words.
  assert.match(
    body.replace(
      'The badge on the arrow',
      'Omitting leaves the column alone. The badge on the arrow',
    ),
    OMISSION_PROTECTS,
  )
  assert.match('// omitting the note keeps whatever was there', OMISSION_PROTECTS)
})
