-- 1. "Tech Setup" is two-thirds not tech.
--
-- Its nine steps: Clearance email, Obtain clearances, Send clearances (the
-- clearances), I-9 meeting, Attend I-9 meeting, Payroll setup (the
-- employment), then Join Slack, PLUS app login, Complete tutor profile (the
-- tech). Only the last third is what the name claimed, which is also why both
-- partner lanes landed here.

update public.scenarios
set name = 'Employment & Access',
    summary = 'The tutor gets cleared, gets on payroll, and gets their accounts — the clearances and the I-9 make them employable, Slack and the PLUS app give them access.',
    updated_at = now()
where name = 'Tech Setup';

-- 2. Warm-Up's "No screen share" path had two lanes at position 4.
--
-- Teacher, Lead Tutor and Regular Tutor each sat one slot late against the
-- same scenario's happy path, leaving position 1 vacant and colliding Regular
-- Tutor with Front Stage Tech. `repairWarmUpAlternatePathBlueprint` patches
-- this client-side on every load; this is the same repair, once, at source.
--
-- Ascending order, one statement each: `unique (path_id, position)` is not
-- deferred, so a single UPDATE could collide mid-flight.

update public.lanes set position = 1, updated_at = now()
where id = 'a0000000-0000-4000-8000-000000000401';  -- Teacher, was 2

update public.lanes set position = 2, updated_at = now()
where id = 'a0000000-0000-4000-8000-000000000402';  -- Lead Tutor, was 3

update public.lanes set position = 3, updated_at = now()
where id = 'a0000000-0000-4000-8000-000000000403';  -- Regular Tutor, was 4

do $$
declare n int; happy text; variant text;
begin
  select count(*) into n from scenarios where name = 'Tech Setup';
  if n > 0 then raise exception 'Tech Setup survived the rename'; end if;

  select count(*) into n from scenarios where name = 'Employment & Access';
  if n <> 1 then raise exception 'expected 1 renamed scenario, got %', n; end if;

  select count(*) into n from (
    select path_id, position from lanes group by path_id, position having count(*) > 1
  ) dupes;
  if n > 0 then raise exception '% duplicate lane positions remain', n; end if;

  select string_agg(l.name, '|' order by l.position) into happy
  from lanes l join paths p on p.id = l.path_id
  join scenarios sc on sc.id = p.scenario_id
  where sc.name = 'Warm-Up' and p.path_type = 'happy';

  select string_agg(l.name, '|' order by l.position) into variant
  from lanes l join paths p on p.id = l.path_id
  join scenarios sc on sc.id = p.scenario_id
  where sc.name = 'Warm-Up' and p.path_type = 'variant';

  if happy is distinct from variant then
    raise exception 'Warm-Up lane order still differs: % vs %', happy, variant;
  end if;
end $$;
