/**
 * #273 — one list edits everything a placement points at.
 *
 * The static replay holds the series to the three functions this needs,
 * definer-guarded, closed to anon, and to the rule the ticket is firm
 * about: the list sync never writes `featured` (so a reorder changes no
 * featured value) and never rewrites `kind` on a kept row.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { replayMigrations } from '../migration-replay.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const schema = replayMigrations(resolve(ROOT, 'supabase/migrations'))

const FUNCTIONS = [
  'public.sync_placement_resources',
  'public.set_featured_resource',
  'public.restore_featured_resources',
]

test('the three placement-resource writes exist and are guarded', () => {
  for (const name of FUNCTIONS) {
    const fn = schema.functions.get(name)
    assert.ok(fn, `the series never leaves ${name}`)
    assert.match(fn.definition, /security definer/i, `${name} is not SECURITY DEFINER`)
    assert.match(fn.definition, /is_service_account\(\)/, `${name} has no service-account guard`)
  }
})

test('the list sync writes order, never featured, never a kept row’s kind', () => {
  const sync = schema.functions.get('public.sync_placement_resources')
  assert.ok(sync)
  const update = /update public\.resources x\s+set([\s\S]*?)from rows from/i.exec(sync.definition)
  assert.ok(update, 'the sync has no in-place UPDATE of kept rows')
  assert.match(update[1], /position\s*=/)
  assert.doesNotMatch(update[1], /featured/)
  assert.doesNotMatch(update[1], /\bkind\s*=/)
})

test('featuring a preview clears the previous one in the same function', () => {
  const fn = schema.functions.get('public.set_featured_resource')
  assert.ok(fn)
  assert.match(fn.definition, /set featured = false/)
  assert.match(fn.definition, /'previous'/)
})
