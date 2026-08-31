/**
 * A touchpoint detail that names nothing has somewhere to wait, and the app
 * keeps putting new ones there.
 *
 * Two properties, and only the first is about a table. The second is the one
 * that matters over time: `sync_cell_touchpoints` DELETES a placement when its
 * name leaves the cell's text, and if that deletion stops parking the writing
 * the queue silently stops filling — which is exactly the failure this ticket
 * exists to end, reappearing in a form nothing on screen would report.
 *
 * AND EVERY ASSERTION IS PROVED TO GO RED. A check that examined nothing
 * would print the same clean line — the standing argument in
 * `scripts/tests/rls-posture.test.mjs` — so each one is paired below with a
 * replayed series that has the defect, and the guard has to fail on it. The
 * red cases are near-misses on purpose: a table with a different column name,
 * and a sync function that captures the removed rows and hands them back
 * without keeping any of them, which is precisely what the code did before
 * `20260830260000` and precisely what a careless `create or replace` would
 * restore.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { replayMigrations } from '../migration-replay.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)

const QUEUE_TABLE = 'unplaced_touchpoint_details'

/** What the queue reads. A column missing here is a queue that cannot render. */
const QUEUE_COLUMNS = [
  'id',
  'cell_id',
  'name',
  'summary',
  'screenshot',
  'url',
  'prominence',
  'origin',
]

/**
 * What is wrong with a replayed series' unplaced-detail queue, as sentences.
 *
 * A function rather than inline assertions, because the RED cases have to run
 * the SAME code the real series runs. A guard proved on a paraphrase of itself
 * is not proved.
 */
export function queueFindings(schema) {
  const findings = []
  const table = schema.tables.get(QUEUE_TABLE)

  if (!table) {
    findings.push(
      `the series never leaves a public.${QUEUE_TABLE} table: 57 authored details have nowhere to wait, and #181 drops the column they are in`,
    )
  } else {
    const columns = [...table.columns.keys()]
    for (const column of QUEUE_COLUMNS) {
      if (!columns.includes(column)) {
        findings.push(`${QUEUE_TABLE} has no ${column} column`)
      }
    }
  }

  const sync = schema.functions.get('public.sync_cell_touchpoints')
  if (!sync) {
    findings.push('the series never leaves a sync_cell_touchpoints function')
  } else if (!new RegExp(`insert\\s+into\\s+public\\.${QUEUE_TABLE}`, 'i').test(sync.definition)) {
    findings.push(
      'sync_cell_touchpoints deletes placements without parking the writing they carried: a newly orphaned detail would vanish instead of joining the queue',
    )
  }

  const restore = schema.functions.get('public.restore_cell_touchpoints')
  if (!restore) {
    findings.push('the series never leaves a restore_cell_touchpoints function')
  } else if (!new RegExp(`delete\\s+from\\s+public\\.${QUEUE_TABLE}`, 'i').test(restore.definition)) {
    findings.push(
      'restore_cell_touchpoints puts the writing back on the placement without clearing the queued copy: taking a save back would leave the same detail in two places',
    )
  }

  for (const fn of ['place_touchpoint_detail', 'discard_touchpoint_detail']) {
    if (!schema.functions.get(`public.${fn}`)) {
      findings.push(`the series never leaves a ${fn} function`)
    }
  }

  return findings
}

/** A throwaway migration series on disk, so the replay is the real replay. */
function seriesOf(...files) {
  const dir = mkdtempSync(join(tmpdir(), 'unplaced-touchpoint-'))
  files.forEach((sql, index) => {
    writeFileSync(join(dir, `2026083026${index}000_probe.sql`), sql)
  })
  return replayMigrations(dir)
}

const CREATES_QUEUE = `
create table public.unplaced_touchpoint_details (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null,
  name text not null,
  summary text,
  screenshot text,
  url text,
  prominence text,
  origin text not null
);
`

/** The body as it stood before this ticket: it hands the rows back and drops them. */
const SYNC_WITHOUT_PARKING = `
create or replace function public.sync_cell_touchpoints(p_cell_id uuid, p_names text[])
returns jsonb language plpgsql as $function$
declare v_removed jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(ct)), '[]'::jsonb) into v_removed
    from public.cell_touchpoints ct where ct.cell_id = p_cell_id;
  delete from public.cell_touchpoints where cell_id = p_cell_id;
  return jsonb_build_object('removed', v_removed);
end
$function$;
create or replace function public.restore_cell_touchpoints(p_cell_id uuid, p_rows jsonb)
returns void language plpgsql as $function$
begin
  delete from public.unplaced_touchpoint_details where cell_id = p_cell_id;
end
$function$;
create or replace function public.place_touchpoint_detail(p_detail_id uuid, p_touchpoint_id uuid)
returns jsonb language sql as $function$ select '{}'::jsonb $function$;
create or replace function public.discard_touchpoint_detail(p_detail_id uuid)
returns jsonb language sql as $function$ select '{}'::jsonb $function$;
`

test('the migration series leaves a queue, and a sync that keeps filling it', () => {
  const schema = replayMigrations(resolve(ROOT, 'supabase/migrations'))
  assert.deepEqual(
    queueFindings(schema),
    [],
    'the 57 orphaned details need a home #181 can drop cells.links without touching, and new orphans have to reach it',
  )
})

test('and the check goes RED on a series with no queue at all', () => {
  const findings = queueFindings(seriesOf(SYNC_WITHOUT_PARKING))
  assert.ok(
    findings.some((finding) => /never leaves a public\.unplaced/.test(finding)),
    `expected the missing-table finding, got ${findings.join(' / ')}`,
  )
})

test('and RED on a sync that captures the removed rows and keeps none of them', () => {
  // The near-miss that reads as done. `v_removed` is populated, the caller
  // gets it, and it looks like the writing was preserved — but the only copy
  // is in a browser tab, which is where it was before this ticket.
  const findings = queueFindings(seriesOf(CREATES_QUEUE, SYNC_WITHOUT_PARKING))
  assert.equal(findings.length, 1, `expected one finding, got ${findings.join(' / ')}`)
  assert.match(findings[0], /without parking the writing/)
})

test('and RED on a restore that leaves the queued copy behind', () => {
  const findings = queueFindings(
    seriesOf(
      CREATES_QUEUE,
      SYNC_WITHOUT_PARKING,
      `create or replace function public.sync_cell_touchpoints(p_cell_id uuid, p_names text[])
       returns jsonb language plpgsql as $function$
       begin
         insert into public.unplaced_touchpoint_details (cell_id, name, origin)
         values (p_cell_id, 'x', 'app');
         return '{}'::jsonb;
       end
       $function$;
       create or replace function public.restore_cell_touchpoints(p_cell_id uuid, p_rows jsonb)
       returns void language plpgsql as $function$
       begin
         update public.cell_touchpoints set summary = null where cell_id = p_cell_id;
       end
       $function$;`,
    ),
  )
  assert.equal(findings.length, 1, `expected one finding, got ${findings.join(' / ')}`)
  assert.match(findings[0], /the same detail in two places/)
})

test('and RED on a queue table that spells a column differently', () => {
  // The shape a rename produces. The table is there, the check would pass a
  // "does it exist" test, and the app's select returns nothing.
  const findings = queueFindings(
    seriesOf(CREATES_QUEUE.replace('screenshot text,', 'picture text,'), SYNC_WITHOUT_PARKING),
  )
  assert.ok(
    findings.some((finding) => /has no screenshot column/.test(finding)),
    `expected the missing-column finding, got ${findings.join(' / ')}`,
  )
})
