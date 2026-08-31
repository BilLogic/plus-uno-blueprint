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
  -- AMENDED. This asserted `renamed = 16` — production's count on the day.
  -- On an empty database it is 0, the exception fires, and because a
  -- migration is one transaction the two UPDATES above roll back with it. So
  -- the file could never replay, and neither could anything downstream of the
  -- rename. Same shape, and the same repair, as `20260821340000`.
  --
  -- The invariant it was reaching for is that the rename left nothing behind,
  -- and the two assertions above already say exactly that: no lane still
  -- carries a role prefix, no slice still names the old actor. What a count
  -- adds is a claim about how many rows this database happens to hold, which
  -- is not a property of the rename.
  --
  -- What is worth asserting instead is the half neither of those covers: the
  -- stakeholder rename and the lane rename must agree. A lane called `Teacher`
  -- with no stakeholder of that name means the first UPDATE matched and the
  -- second did not — the drift this file exists to end, surviving it.
  if renamed > 0 and not exists (
    select 1 from public.stakeholders where name = 'Teacher'
  ) then
    raise exception
      'lane rename: % lanes say Teacher but no stakeholder does', renamed;
  end if;
end $$;

commit;
