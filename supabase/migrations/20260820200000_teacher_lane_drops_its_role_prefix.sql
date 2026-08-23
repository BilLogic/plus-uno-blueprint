/*
  `Partner Action: Teacher` becomes `Teacher`.

  The lane label carried the blueprint's own structure bolted onto the front
  of the person in it. `lane_role` stores the role and `stakeholders.kind`
  stores 'partner', so the prefix was a third copy of a fact two columns
  already hold.

  Stakeholder FIRST: `stakeholders_rename_slices()` rewrites `slices.actor`
  from that update. `lanes.name` has no such trigger and is updated here.
  The old label goes into `aliases`, which is what the alias-aware backfill
  and the value-ledger cross-check read.

  App side, same window: `TEACHER_LANE_NAME` (was `PARTNER_ACTION_LAYER_NAME`)
  in blueprintLayout.ts, the LAYER_STYLES key in blueprintTheme.ts, the
  walkthrough lists, and every offline fallback in src/data.
*/
begin;

update public.stakeholders
set name = 'Teacher',
    aliases = array['teacher', 'Partner Action: Teacher'],
    note = 'The school-side teacher in the room.'
where name = 'Partner Action: Teacher';

update public.lanes
set name = 'Teacher'
where name = 'Partner Action: Teacher';

do $$
declare
  lanes_left int;
  slices_left int;
  renamed int;
begin
  select count(*) into lanes_left from public.lanes where name like '%: %';
  select count(*) into slices_left from public.slices where actor = 'Partner Action: Teacher';
  select count(*) into renamed from public.lanes where name = 'Teacher';

  if lanes_left <> 0 then
    raise exception 'lane rename: % lanes still carry a role prefix', lanes_left;
  end if;
  if slices_left <> 0 then
    raise exception 'lane rename: % slices still say the old actor', slices_left;
  end if;
  if renamed <> 16 then
    raise exception 'lane rename: expected 16 Teacher lanes, found %', renamed;
  end if;
end $$;

commit;
