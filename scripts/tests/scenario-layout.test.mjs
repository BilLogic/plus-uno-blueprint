/**
 * #280 — a scenario left merged opens merged.
 *
 * `scenarios.layout` used to be `single | stacked` with `merged` chosen per
 * session and thrown away on reload. Now the column is `stacked | merged`,
 * the header toggle writes it through `update_scenario_layout`, and `single`
 * is gone — a one-path scenario is stacked with one band.
 *
 * What the static replay can hold the series to: the write exists, anon is
 * not granted it, `create_scenario` no longer knows the retired token, and
 * the rename map says so. The live shape — the CHECK refusing `single`, the
 * one production row reading `stacked` — is the migration's own proof block,
 * which the empty-database replay runs.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { replayMigrations } from '../migration-replay.mjs'
import { RENAME_MAP } from '../retired-vocabulary.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const schema = replayMigrations(resolve(ROOT, 'supabase/migrations'))

test('the toggle has a recorded write, and anon cannot call it', () => {
  const fn = schema.functions.get('public.update_scenario_layout')
  assert.ok(fn, 'the series never leaves an update_scenario_layout function')
  assert.match(fn.definition, /is_service_account\(\)/)
  assert.match(fn.definition, /'stacked', 'merged'/)
  assert.doesNotMatch(fn.definition, /'single'/)
})

test('create_scenario defaults to stacked and no longer refuses merged', () => {
  const fn = schema.functions.get('public.create_scenario')
  assert.ok(fn)
  assert.match(fn.definition, /layout text DEFAULT 'stacked'/i)
  assert.doesNotMatch(fn.definition, /'single'/)
  assert.doesNotMatch(fn.definition, /is a display state/)
})

test('the layout CHECK survives the re-issue under its own name', () => {
  assert.ok(
    schema.constraints.get('scenarios.scenarios_layout_check'),
    'scenarios_layout_check is gone — the column is unconstrained',
  )
})

test('the rename map records single → stacked with its migration', () => {
  const row = RENAME_MAP.find((entry) =>
    entry.was.includes("scenarios.layout = 'single'"),
  )
  assert.ok(row, 'no rename-map row retires scenarios.layout = single')
  assert.deepEqual(row.is, ["scenarios.layout = 'stacked'"])
  assert.deepEqual(row.migrations, ['20260902120000'])
  assert.deepEqual(row.copy, ['single'])
})
