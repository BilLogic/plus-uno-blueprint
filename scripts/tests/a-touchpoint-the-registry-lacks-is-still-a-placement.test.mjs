/**
 * #277 — a touchpoint the registry lacks is still a placement.
 *
 * `unplaced_touchpoint_details` was where 57 authored details waited,
 * invisible; a placement can name its touchpoint by `name` alone now, and
 * the queue folded in. The replayed series must leave no queue table and no
 * queue function, must leave `cell_touchpoints` with a nullable
 * `touchpoint_id`, a `name`, and the exactly-one check, and must leave the
 * sync keeping a removed placement's writing as a name-only row rather than
 * parking it somewhere the board cannot draw.
 *
 * Replaces `unplaced-touchpoint-details.test.mjs`, which held the queue in
 * place; this holds its absence.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { replayMigrations } from '../migration-replay.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)

const QUEUE_FUNCTIONS = ['place_touchpoint_detail', 'discard_touchpoint_detail', 'restore_touchpoint_detail']
const PLACEMENT_FUNCTIONS = [
  'sync_cell_touchpoints',
  'restore_cell_touchpoints',
  'set_placement_touchpoint',
  'remove_placement',
  'restore_placement',
]

/** What is wrong with a replayed series, as sentences. */
export function findings(schema) {
  const out = []
  if (schema.tables.has('unplaced_touchpoint_details')) {
    out.push('the series still leaves an unplaced_touchpoint_details table: the queue was folded into cell_touchpoints')
  }
  for (const fn of QUEUE_FUNCTIONS) {
    if (schema.functions.has(`public.${fn}`)) out.push(`the series still leaves ${fn}`)
  }
  const table = schema.tables.get('cell_touchpoints')
  if (!table) {
    out.push('the series never leaves a cell_touchpoints table')
  } else {
    if (!table.columns.has('name')) out.push('cell_touchpoints has no name column, so a touchpoint the registry lacks has no placement')
    if (!schema.constraints.has('cell_touchpoints.cell_touchpoints_one_identity')) {
      out.push('cell_touchpoints has no one-identity check: a row could name its touchpoint both ways or neither')
    }
  }
  for (const fn of PLACEMENT_FUNCTIONS) {
    const found = schema.functions.get(`public.${fn}`)
    if (!found) {
      out.push(`the series never leaves a ${fn} function`)
      continue
    }
    // Naming a placement's touchpoint — linking, unlinking, keeping a removed
    // row name-only, putting one back — writes `touchpoint_id` and `name`,
    // which no panel may write directly: `authenticated` holds column grants
    // on summary, role and position only. So each of these is a structural
    // write, SECURITY DEFINER behind `is_service_account()`, like every
    // other; as SECURITY INVOKER it fails for the very session it exists for.
    if (!/security\s+definer/i.test(found.definition)) {
      out.push(`${fn} runs as the caller, whose grants do not reach touchpoint_id or name`)
    }
    if (!/is_service_account\(\)/.test(found.definition)) {
      out.push(`${fn} is not behind is_service_account()`)
    }
  }
  const sync = schema.functions.get('public.sync_cell_touchpoints')
  if (sync && /unplaced_touchpoint_details/.test(sync.definition)) {
    out.push('sync_cell_touchpoints still parks writing in the queue instead of keeping the row name-only')
  }
  if (sync && !/touchpoint_id\s*=\s*null/.test(sync.definition)) {
    out.push('sync_cell_touchpoints deletes a removed placement outright: its writing would vanish instead of staying as a name-only row')
  }
  return out
}

function seriesOf(...files) {
  const dir = mkdtempSync(join(tmpdir(), 'registry-lacks-'))
  files.forEach((sql, index) => writeFileSync(join(dir, `2026090217${index}000_probe.sql`), sql))
  return replayMigrations(dir)
}

const BEFORE = `
create table public.cell_touchpoints (
  id uuid primary key, cell_id uuid not null, touchpoint_id uuid not null, position int not null,
  summary text, role text
);
create table public.unplaced_touchpoint_details (
  id uuid primary key, cell_id uuid not null, name text not null, summary text
);
create or replace function public.sync_cell_touchpoints(p_cell_id uuid, p_names text[])
returns jsonb language plpgsql as $function$
begin
  insert into public.unplaced_touchpoint_details (cell_id, name) select p_cell_id, 'x';
  delete from public.cell_touchpoints where cell_id = p_cell_id;
  return '{}'::jsonb;
end
$function$;
create or replace function public.place_touchpoint_detail(p_detail_id uuid, p_touchpoint_id uuid)
returns jsonb language plpgsql as $function$ begin return '{}'::jsonb; end $function$;
`

test('RED on the series as it stood before #277', () => {
  const found = findings(seriesOf(BEFORE))
  assert.ok(found.some((f) => /still leaves an unplaced_touchpoint_details table/.test(f)), found.join(' / '))
  assert.ok(found.some((f) => /still leaves place_touchpoint_detail/.test(f)), found.join(' / '))
  assert.ok(found.some((f) => /has no name column/.test(f)), found.join(' / '))
  assert.ok(found.some((f) => /no one-identity check/.test(f)), found.join(' / '))
  assert.ok(found.some((f) => /still parks writing in the queue/.test(f)), found.join(' / '))
  assert.ok(found.some((f) => /runs as the caller/.test(f)), found.join(' / '))
})

test('the real series folds the queue into placements', () => {
  assert.deepEqual(findings(replayMigrations(resolve(ROOT, 'supabase/migrations'))), [])
})
