-- `owner_team` was empty on all 306 lanes. It is filled BY RULE, not by hand,
-- and the rule is stated here so a reader can tell what was known from what
-- was inferred.
--
-- The rule, from docs/reference/lane-vocabulary.md:
--   an actor lane names a PERSON, so it has no owning team;
--   a tech or actions lane names WORK, so it does.

update public.lanes set owner_team = null, updated_at = now()
where lane_role in ('customer_actions', 'visual', 'step_visual')
   or name in ('Regular Tutor', 'Lead Tutor', 'Teacher', 'Student', 'Storyboard');

update public.lanes set owner_team = name, updated_at = now()
where lane_role = 'partner_actions';

update public.lanes set owner_team = 'Dev', updated_at = now()
where lane_role in ('frontstage_tech', 'backstage_tech');

update public.lanes set owner_team = 'Tutor Supervisors', updated_at = now()
where lane_role in ('frontstage_actions', 'backstage_actions');

-- The one actor lane whose own work IS a team's staff work.
update public.lanes set owner_team = 'Tutor Supervisors', updated_at = now()
where name = 'Supervisor';

update public.lanes l set owner_team = 'Research', updated_at = now()
from public.paths p, public.scenarios sc
where l.path_id = p.id and p.scenario_id = sc.id
  and l.lane_role in ('frontstage_actions', 'backstage_actions')
  and sc.name in ('Goal Setting', 'Help Request');

update public.lanes l set owner_team = 'Instructional Design', updated_at = now()
from public.paths p, public.scenarios sc
where l.path_id = p.id and p.scenario_id = sc.id
  and l.lane_role in ('frontstage_actions', 'backstage_actions')
  and sc.name in ('Onboarding Modules', 'Lesson Modules');

update public.lanes l set owner_team = 'Design', updated_at = now()
from public.paths p, public.scenarios sc
where l.path_id = p.id and p.scenario_id = sc.id
  and l.lane_role in ('frontstage_actions', 'backstage_actions')
  and sc.name = 'Discovery';

-- Support Actions (36 lanes, no lane_role) stays NULL. It holds regulations
-- ("Child protection laws"), mailboxes (help@tutors.plus) and notes about
-- unshipped work — three different kinds of thing, none of them one team's.
-- Guessing a single owner for all 36 would be worse than the gap.

create or replace function public.lanes_owner_team_is_a_party()
returns trigger language plpgsql as $fn$
begin
  if new.owner_team is not null
     and not exists (select 1 from public.stakeholders s where s.name = new.owner_team)
  then
    raise exception 'owner_team "%" is not a party in the registry', new.owner_team;
  end if;
  return new;
end $fn$;

drop trigger if exists lanes_owner_team_is_a_party on public.lanes;
create trigger lanes_owner_team_is_a_party
  before insert or update of owner_team on public.lanes
  for each row execute function public.lanes_owner_team_is_a_party();

do $$
declare unknown int; blank int;
begin
  -- AMENDED 2026-08-31. A census — `expected 158 filled` — stood here,
  -- counting production's lanes on the day. On an empty database `lanes` holds
  -- nothing, it raises, and because a migration is one transaction the
  -- `lanes_owner_team_is_a_party` FUNCTION AND TRIGGER ABOVE ROLL BACK with
  -- it, so the rule this file exists to enforce is absent from every later
  -- replay.
  --
  -- The rule is `20260821340000`'s: amend an applied migration only where
  -- leaving it is actively harmful, and an assertion that disables the only
  -- instrument this repository has for #148 is that case.
  --
  -- Nothing replaces it, because the two assertions below ARE the invariant it
  -- was reaching for: every team named is in the registry, and no work lane is
  -- left without one. `158` was the count those two produce on production —
  -- they say the same thing without the date on it, and they are vacuously
  -- true on an empty database.

  select count(*) into unknown from lanes l
  where l.owner_team is not null
    and not exists (select 1 from stakeholders s where s.name = l.owner_team);
  if unknown > 0 then raise exception '% lanes name a team the registry does not hold', unknown; end if;

  select count(*) into blank from lanes
  where owner_team is null
    and lane_role in ('frontstage_tech','backstage_tech','frontstage_actions','backstage_actions','partner_actions');
  if blank > 0 then raise exception '% work lanes have no team', blank; end if;
end $$;
