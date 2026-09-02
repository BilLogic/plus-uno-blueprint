/**
 * #276 — a placement says what a tool does here, and nothing else.
 *
 * `cell_touchpoints` is summary + role. Its two URL columns became resources
 * (20260902130000) and left (20260902160000); the four functions that read
 * or wrote them now move a placement's resources instead. The replayed
 * series must leave the table without the columns and the functions without
 * a reference to them — and the sync must hand a removed placement's
 * resources back, or a revert re-creates the placement bare.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { replayMigrations } from '../migration-replay.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)

const PLACEMENT_FUNCTIONS = [
  'sync_cell_touchpoints',
  'restore_cell_touchpoints',
  // #277 replaced the queue's place/restore pair with these.
  'set_placement_touchpoint',
  'remove_placement',
  'restore_placement',
]

/** What is wrong with a replayed series' placements, as sentences. */
export function placementFindings(schema) {
  const findings = []
  const table = schema.tables.get('cell_touchpoints')
  if (!table) {
    findings.push('the series never leaves a cell_touchpoints table')
  } else {
    for (const column of ['screenshot', 'url']) {
      if (table.columns.has(column)) {
        findings.push(`cell_touchpoints still has a ${column} column — it is a resource on the placement`)
      }
    }
    for (const column of ['summary', 'role']) {
      if (!table.columns.has(column)) findings.push(`cell_touchpoints has no ${column} column`)
    }
  }
  for (const name of PLACEMENT_FUNCTIONS) {
    const fn = schema.functions.get(`public.${name}`)
    if (!fn) {
      findings.push(`the series never leaves a ${name} function`)
      continue
    }
    if (/\bct\.(screenshot|url)\b/.test(fn.definition)) {
      findings.push(`${name} still reads cell_touchpoints.screenshot or .url`)
    }
  }
  const sync = schema.functions.get('public.sync_cell_touchpoints')
  if (sync && !/'resources'/.test(sync.definition)) {
    findings.push(
      'sync_cell_touchpoints hands a removed placement back without its resources: a revert would re-create it bare',
    )
  }
  return findings
}

function seriesOf(...files) {
  const dir = mkdtempSync(join(tmpdir(), 'placement-columns-'))
  files.forEach((sql, index) => {
    writeFileSync(join(dir, `2026090216${index}000_probe.sql`), sql)
  })
  return replayMigrations(dir)
}

const BEFORE = `
create table public.cell_touchpoints (
  id uuid primary key,
  cell_id uuid not null,
  touchpoint_id uuid not null,
  position int not null,
  summary text,
  screenshot text,
  url text,
  role text
);
create or replace function public.sync_cell_touchpoints(p_cell_id uuid, p_names text[])
returns jsonb language plpgsql as $function$
begin
  return (select jsonb_agg(jsonb_build_object('summary', ct.summary, 'screenshot', ct.screenshot))
            from public.cell_touchpoints ct where ct.cell_id = p_cell_id);
end
$function$;
create or replace function public.restore_cell_touchpoints(p_cell_id uuid, p_rows jsonb)
returns void language plpgsql as $function$ begin end $function$;
create or replace function public.set_placement_touchpoint(p_placement_id uuid, p_touchpoint_id uuid default null, p_name text default null)
returns jsonb language plpgsql as $function$ begin return '{}'::jsonb; end $function$;
create or replace function public.remove_placement(p_placement_id uuid)
returns jsonb language plpgsql as $function$ begin return '{}'::jsonb; end $function$;
create or replace function public.restore_placement(p_row jsonb, p_resources jsonb default '[]'::jsonb)
returns jsonb language plpgsql as $function$ begin return '{}'::jsonb; end $function$;
`

test('RED on the series as it stood before #276', () => {
  const findings = placementFindings(seriesOf(BEFORE))
  assert.ok(findings.some((f) => /still has a screenshot column/.test(f)), findings.join(' / '))
  assert.ok(findings.some((f) => /still has a url column/.test(f)), findings.join(' / '))
  assert.ok(findings.some((f) => /sync_cell_touchpoints still reads/.test(f)), findings.join(' / '))
  assert.ok(findings.some((f) => /re-create it bare/.test(f)), findings.join(' / '))
})

test('the real series leaves a placement as summary + role, with its resources travelling', () => {
  const schema = replayMigrations(resolve(ROOT, 'supabase/migrations'))
  assert.deepEqual(placementFindings(schema), [])
})
