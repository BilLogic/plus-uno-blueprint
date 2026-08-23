-- CPO and CMU HR act in this service, and had nowhere to act.
--
-- The tutor deals with both DIRECTLY — "Completes PA Act 153 clearances with
-- the CPO", "Meets with the CMU HR department for the I-9 meeting" — so they
-- sit below the line of interaction and above the line of visibility, in the
-- frontstage band. Until now CMU HR's two acts were filed under PLUS's own
-- Front Stage Actions, which claims PLUS did them, and the CPO's act (granting
-- the clearance) existed only as a clause inside somebody else's cell.
--
-- Two scenarios, three lanes. Everywhere else an external body is a tech pill
-- (Workday) or a regulation ("Child protection laws" in Support Actions), and
-- both of those are already right.

update public.lanes l set position = l.position + 2
from public.paths p, public.scenarios sc
where l.path_id = p.id and p.scenario_id = sc.id
  and sc.name = 'Tech Setup' and l.position >= 4;

update public.lanes l set position = l.position + 1
from public.paths p, public.scenarios sc
where l.path_id = p.id and p.scenario_id = sc.id
  and sc.name = 'Interview & Offer' and l.position >= 4;

insert into public.lanes (id, path_id, name, lane_role, position, origin)
select gen_random_uuid(), p.id, v.name, 'partner_actions', v.position, 'app'
from public.paths p
join public.scenarios sc on sc.id = p.scenario_id
cross join (values ('CMU HR', 4), ('CPO', 5)) as v(name, position)
where sc.name = 'Tech Setup' and p.path_type = 'happy';

insert into public.lanes (id, path_id, name, lane_role, position, origin)
select gen_random_uuid(), p.id, 'CPO', 'partner_actions', 4, 'app'
from public.paths p
join public.scenarios sc on sc.id = p.scenario_id
where sc.name = 'Interview & Offer' and p.path_type = 'happy';

update public.cells c
set lane_id = (
      select l.id from public.lanes l
      join public.paths p on p.id = l.path_id
      join public.scenarios sc on sc.id = p.scenario_id
      where sc.name = 'Tech Setup' and l.name = 'CMU HR'
        and p.path_type = 'happy'
      limit 1
    ),
    updated_at = now()
where c.content in (
  'CMU HR department sends clearance materials.',
  'CMU HR department reviews employment forms at an I-9 meeting.'
);

-- The CPO's own act, which had no row at all. `path_id` is not derived from
-- the lane: a trigger checks the step belongs to THAT path, so both must be
-- set together.
insert into public.cells (id, path_id, lane_id, step_id, position, content, summary, status)
select
  gen_random_uuid(), p.id, l.id, s.id, 0,
  'Runs the Act 153 checks and confirms the result to PLUS.',
  'The CPO is the only party that can clear a tutor and PLUS cannot verify it themselves, so how long this takes is outside anyone''s control here.',
  'live'
from public.lanes l
join public.paths p on p.id = l.path_id
join public.scenarios sc on sc.id = p.scenario_id
join public.path_steps ps on ps.path_id = p.id
join public.steps s on s.id = ps.step_id
where l.name = 'CPO' and l.lane_role = 'partner_actions'
  and (
    (sc.name = 'Tech Setup' and s.name = 'Send clearances')
    or (sc.name = 'Interview & Offer' and s.name = 'Group interviews')
  );

do $$
declare n int;
begin
  select count(*) into n from lanes where lane_role = 'partner_actions';
  if n <> 3 then raise exception 'expected 3 partner lanes, got %', n; end if;

  select count(*) into n from cells c
  join lanes l on l.id = c.lane_id where l.lane_role = 'partner_actions';
  if n <> 4 then raise exception 'expected 4 partner cells, got %', n; end if;

  -- Scoped to the two scenarios this touches. Warm-Up's "No screen share"
  -- path already holds two lanes at position 4 — a pre-existing fault that
  -- `repairWarmUpAlternatePathBlueprint` patches client-side, and not this
  -- migration's to fix.
  select count(*) into n from (
    select l.path_id, l.position
    from lanes l join paths p on p.id = l.path_id
    join scenarios sc on sc.id = p.scenario_id
    where sc.name in ('Tech Setup', 'Interview & Offer')
    group by l.path_id, l.position having count(*) > 1
  ) dupes;
  if n > 0 then raise exception '% duplicate lane positions', n; end if;
end $$;
