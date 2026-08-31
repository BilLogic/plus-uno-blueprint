/**
 * The machinery behind `scripts/check-proof-footprint.mjs`, exercised directly.
 *
 * The check is GREEN against the series, which means its headline line cannot
 * be the evidence that it works — a check that parsed nothing would print the
 * same thing. So what is asserted here is that it goes RED on the exact text
 * that shipped, and stays green on the amended text that replaced it. Both
 * halves matter: a rule that fired on the fixed version too would be a rule
 * against proving anything, and the proof is worth keeping.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  blockFootprint,
  findings,
  proofBlocks,
  returnsWhatItBorrowed,
} from '../check-proof-footprint.mjs'

/** The block as it was applied to production, trimmed to what the rule reads. */
const AS_SHIPPED = `
do $do$
declare v_cell uuid;
begin
  select c.id into v_cell from public.cells c join public.lanes ln on ln.id = c.lane_id limit 1;
  perform public.sync_cell_touchpoints(v_cell, array['ZZ Probe A', 'ZZ Probe B']);
  perform public.sync_cell_touchpoints(v_cell, array['ZZ Probe B', 'ZZ Probe A']);
  delete from public.cell_touchpoints ct using public.touchpoints tp
   where ct.touchpoint_id = tp.id and ct.cell_id = v_cell and tp.name like 'ZZ Probe %';
end
$do$;
`

/** The same proof, borrowing and returning. */
const AMENDED = `
do $do$
declare v_cell uuid; v_before jsonb;
begin
  select c.id into v_cell from public.cells c limit 1;
  select coalesce(jsonb_agg(to_jsonb(ct)), '[]'::jsonb) into v_before
    from public.cell_touchpoints ct where ct.cell_id = v_cell;
  perform public.sync_cell_touchpoints(v_cell, array['ZZ Probe A']);
  delete from public.cell_touchpoints where cell_id = v_cell;
  insert into public.cell_touchpoints (cell_id, touchpoint_id, position, origin)
  select v_cell, b.touchpoint_id, b.position, b.origin
    from jsonb_to_recordset(v_before) as b(touchpoint_id uuid, position int, origin text);
end
$do$;
`

test('the block that shipped is caught', () => {
  const found = findings([{ name: '20260830160000_x.sql', sql: AS_SHIPPED }])
  assert.equal(found.length, 1)
  assert.match(found[0].reason, /keeps no copy/)
})

test('the amended block passes', () => {
  assert.deepEqual(findings([{ name: '20260830160000_x.sql', sql: AMENDED }]), [])
})

test('snapshotting without restoring is still caught', () => {
  // The half-fix is the one a reviewer would wave through: it looks like it
  // takes a copy, and the copy is never used.
  const halfway = AMENDED.replace(/insert into public\.cell_touchpoints[\s\S]*?;\n/, '')
  const found = findings([{ name: 'x.sql', sql: halfway }])
  assert.equal(found.length, 1)
  assert.match(found[0].reason, /never puts them back/)
})

test('a proof that builds its own rows is not the target', () => {
  // The rule is about borrowing, not about calling the function. A block that
  // creates its cell owes nothing back, and banning it would ban the only
  // honest way to prove a destructive function behaves.
  const ownRows = `
do $do$
declare v_cell uuid;
begin
  insert into public.cells (id) values (gen_random_uuid()) returning id into v_cell;
  perform public.sync_cell_touchpoints(v_cell, array['ZZ Probe A']);
end
$do$;
`
  assert.deepEqual(findings([{ name: 'x.sql', sql: ownRows }]), [])
})

test('blocks are split on their own dollar tag, not the first one seen', () => {
  // Two blocks in one file, the second nested-looking. Splitting on `$do$`
  // globally would fuse them and let a later block hide inside an earlier
  // one's text.
  const two = `do $do$ begin perform 1; end $do$;\ndo $body$ begin perform 2; end $body$;`
  const blocks = proofBlocks(two)
  assert.equal(blocks.length, 2)
  assert.match(blocks[1], /perform 2/)
})

test('the amended migration in the series is green, and would not be without the restore', () => {
  // Against the real file, so this test fails if someone reverts it.
  const path =
    'supabase/migrations/20260830160000_a_placement_sync_is_one_transaction.sql'
  const sql = readFileSync(path, 'utf8')
  assert.deepEqual(findings([{ name: path, sql }]), [])

  const proof = proofBlocks(sql).find((block) => blockFootprint(block).syncs)
  assert.ok(proof, 'the reorder proof is still in that file')
  assert.equal(blockFootprint(proof).borrows, true)
  assert.equal(blockFootprint(proof).restores, true)
})

test('a block proving the call was refused is not asked to restore anything', () => {
  // The companion proof in the same file: it picks a cell holding no
  // placements, calls the function, and asserts it skipped. Nothing was
  // taken, so there is nothing to give back — and if the gate ever broke,
  // that assertion is what would say so.
  const refusal = `
do $do$
declare v_cell uuid; v_result jsonb;
begin
  select c.id into v_cell from public.cells c
   where not exists (select 1 from public.cell_touchpoints where cell_id = c.id) limit 1;
  v_result := public.sync_cell_touchpoints(v_cell, array['a sentence about what somebody did']);
  if (v_result ->> 'skipped') <> 'true' then
    raise exception 'an ordinary cell was synced instead of skipped';
  end if;
end
$do$;
`
  assert.deepEqual(findings([{ name: 'x.sql', sql: refusal }]), [])
})

/**
 * The second way to give a borrowed row back, found by #187's proof.
 *
 * Rather than snapshotting what the sync would displace, it builds the wanted
 * list out of the cell's OWN content and appends the probes to it. Nothing is
 * displaced at all — the real names are in the list, so the sync keeps them —
 * and the borrowed text goes back at the end. It is the safer of the two
 * designs, and the first version of this rule flagged it, which is the kind
 * of false positive that gets a check switched off.
 */
const APPENDS_TO_CONTENT = `
do $do$
declare v_cell uuid; v_content text; v_names text[];
begin
  select c.id, c.content into v_cell, v_content from public.cells c limit 1;
  update public.cells set content = v_content || ', ZZ Rename A' where id = v_cell;
  select array_agg(item order by ord) into v_names from public.cells c,
    unnest(regexp_split_to_array(c.content, E'[\n,]')) with ordinality as t(item, ord)
   where c.id = v_cell;
  perform public.sync_cell_touchpoints(v_cell, v_names);
  delete from public.touchpoints where name like 'ZZ Rename %';
  update public.cells set content = v_content where id = v_cell;
end
$do$;
`

test('appending probes to the cell own content is the other safe shape', () => {
  assert.deepEqual(findings([{ name: '20260830220000_x.sql', sql: APPENDS_TO_CONTENT }]), [])
  const footprint = blockFootprint(APPENDS_TO_CONTENT)
  assert.equal(footprint.snapshots, false, 'it takes no snapshot, and needs none')
  assert.equal(returnsWhatItBorrowed(footprint), true)
})

test('appending to the content and never putting it back is caught', () => {
  // The half-fix of this shape: the placements are safe, and the cell is left
  // permanently displaying a probe.
  const kept = APPENDS_TO_CONTENT.replace(
    /update public\.cells set content = v_content where id = v_cell;\n/,
    '',
  )
  const found = findings([{ name: 'x.sql', sql: kept }])
  assert.equal(found.length, 1)
  assert.match(found[0].reason, /never puts the content back/)
})

test('the rename proof in the series takes the content route', () => {
  // Against the real file, so this fails if someone rewrites that proof into
  // the destructive shape.
  const path =
    'supabase/migrations/20260830220000_a_rename_moves_the_word_in_every_cell.sql'
  const sql = readFileSync(path, 'utf8')
  assert.deepEqual(findings([{ name: path, sql }]), [])

  const proof = proofBlocks(sql).find((block) => blockFootprint(block).syncs)
  assert.ok(proof, 'the rename proof is still in that file')
  const footprint = blockFootprint(proof)
  assert.equal(footprint.derivesFromContent, true)
  assert.equal(footprint.restoresContent, true)
})
