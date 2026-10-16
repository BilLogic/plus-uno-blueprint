#!/usr/bin/env node
/**
 * A path kind left out is a variant.
 *
 * THE BEHAVIOUR IS PERFORMED IN THE MIGRATION, not here: it needs a database
 * and this repository has none to give a pull request.
 * `20261015130000_a_path_kind_left_out_is_a_variant.sql` rewrites the default
 * of `create_path` and `duplicate_path`, then calls both with `kind` left out
 * under an authenticated service-account session and raises unless each made
 * a `variant` path — rolling its fixture back either way. Replayed against a
 * local Postgres 17, the same call before the rewrite is refused by
 * `paths_kind_check`.
 *
 * What is here is the DECLARATION side: the rewrite names both functions and
 * the one default it moves, the default it lands on is a kind the check
 * admits, and the proof omits `kind` rather than passing it. Each is shown
 * going red against a copy with the claim cut out.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = process.cwd()
const read = (path) => readFileSync(resolve(REPO_ROOT, path), 'utf8')

const MIGRATION = 'supabase/migrations/20261015130000_a_path_kind_left_out_is_a_variant.sql'
const BASELINE = 'docs/reference/migration-replay-baseline.json'
const SCHEMA = 'supabase/schema.reference.sql'

/**
 * The kinds `paths_kind_check` admits, as `supabase/schema.reference.sql`
 * declares them. The migrations never spell the check out under that name —
 * it arrived by rename — so the reference DDL is where the set is written.
 */
export function admittedKinds() {
  const match = read(SCHEMA).match(/^\s*kind text not null check \(kind in \(([^)]*)\)\)/m)
  return match ? [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : null
}

/** The calls the proof makes, stripped of comments. */
export function proofCalls(sql) {
  return [...sql.replace(/^\s*--.*$/gm, '').matchAll(/:= public\.(create_path|duplicate_path)\(([^;]*)\);/g)]
    .map((m) => ({ fn: m[1], args: m[2].split(',').map((a) => a.trim()) }))
}

test('the rewrite moves the default of both functions to variant', () => {
  const sql = read(MIGRATION)
  assert.match(sql, /'public\.create_path\(uuid, text, text, uuid\)'::regprocedure/)
  assert.match(sql, /'public\.duplicate_path\(uuid, text, text, boolean, boolean\)'::regprocedure/)
  assert.match(sql, /'kind text DEFAULT ''alternative''::text',\s*'kind text DEFAULT ''variant''::text'/)

  // Red: a rewrite that dropped a function no longer names it.
  assert.doesNotMatch(
    sql.replace(/\s*'public\.duplicate_path[^']*'::regprocedure/, ''),
    /'public\.duplicate_path\(uuid, text, text, boolean, boolean\)'::regprocedure/,
  )
})

test('variant is a kind the check admits, and alternative is not', () => {
  const kinds = admittedKinds()
  assert.ok(kinds, 'the reference schema declares no kind check on paths')
  assert.ok(kinds.includes('variant'), `paths_kind_check admits ${kinds.join(', ')}, not variant`)
  assert.ok(!kinds.includes('alternative'), 'paths_kind_check admits alternative, so the old default was never wrong')
})

test('the proof calls both functions with kind left out', () => {
  const calls = proofCalls(read(MIGRATION))
  const createPath = calls.find((c) => c.fn === 'create_path')
  const duplicatePath = calls.find((c) => c.fn === 'duplicate_path')
  assert.ok(createPath, 'the proof never calls create_path')
  assert.ok(duplicatePath, 'the proof never calls duplicate_path')
  // Two arguments: the parent and the name. A third would be the kind, and a
  // proof that passes it proves nothing about the default.
  assert.equal(createPath.args.length, 2)
  assert.equal(duplicatePath.args.length, 2)

  // Red: a proof that passes the kind is caught.
  const passed = proofCalls(
    read(MIGRATION).replace("create_path(scen, 'fixture made path')", "create_path(scen, 'fixture made path', 'variant')"),
  ).find((c) => c.fn === 'create_path')
  assert.equal(passed.args.length, 3)
})

test('the proof runs as authenticated, and gives the fixture back', () => {
  const sql = read(MIGRATION)
  assert.match(sql, /set local role authenticated/)
  assert.match(sql, /"app_metadata":\{"role":"service"\}/)
  assert.match(sql, /the kind-left-out fixture survived the rollback/)
  const baseline = JSON.parse(read(BASELINE))
  assert.ok(
    !baseline.failing.includes('20261015130000_a_path_kind_left_out_is_a_variant.sql'),
    'the migration is recorded as unable to replay, but it replays',
  )
})
