-- Seeding the teams into the registry made them selectable as a LANE'S
-- STAKEHOLDER, which they cannot be: a stakeholder is who appears in the
-- blueprint as an actor, and Design does not stand in a room.
--
-- `kind` could not tell them apart — Regular Tutor, Lead Tutor and Supervisor
-- are `staff` too, and they ARE actors. So teams get their own kind, and each
-- column reads the kinds it accepts:
--
--   lanes.stakeholder_id  <- staff | recipient | partner | provider  (actors)
--   lanes.owner_team      <- team | partner                          (groups)
--
-- Partner is in both on purpose: CPO both acts in a lane and owns it.

alter table public.stakeholders drop constraint if exists stakeholders_kind_check;
alter table public.stakeholders
  add constraint stakeholders_kind_check
  check (kind in ('recipient', 'staff', 'partner', 'provider', 'team'));

update public.stakeholders set kind = 'team', updated_at = now()
where name in (
  'Design', 'Dev', 'Product', 'Research', 'Tutor Supervisors', 'Partnership',
  'Product Design', 'Design Ops', 'Instructional Design', 'Marketing'
);

comment on column public.stakeholders.kind is
  'What sort of party this is. staff/recipient/partner/provider are ACTORS — they can be a lane''s stakeholder. team is an accountable group — it can be a lane''s owner_team and never its stakeholder.';

do $$
declare n int;
begin
  -- AMENDED 2026-08-31. A census — `expected 10 teams` — stood here, counting
  -- production's registry on the day. On an empty database the registry is
  -- empty, it raises, and because a migration is one transaction the
  -- CONSTRAINT SWAP ABOVE ROLLS BACK, so `stakeholders_kind_check` never
  -- learns the word `team` and everything downstream that writes one is
  -- refused.
  --
  -- The rule is `20260821340000`'s: amend an applied migration only where
  -- leaving it is actively harmful, and an assertion that disables the only
  -- instrument this repository has for #148 is that case.
  --
  -- What replaces it is what it was reaching for: every name on the list above
  -- that the registry holds is now a team. Vacuously true on an empty
  -- database, and on production exactly as strong — those ten names are the
  -- ten it counted.
  select count(*) into n from stakeholders
  where kind <> 'team'
    and name in (
      'Design', 'Dev', 'Product', 'Research', 'Tutor Supervisors', 'Partnership',
      'Product Design', 'Design Ops', 'Instructional Design', 'Marketing'
    );
  if n > 0 then raise exception '% groups are still not of kind team', n; end if;

  select count(*) into n from lanes l
  join stakeholders s on s.id = l.stakeholder_id where s.kind = 'team';
  if n > 0 then raise exception '% lanes name a team as their stakeholder', n; end if;

  select count(*) into n from lanes l
  join stakeholders s on s.name = l.owner_team
  where s.kind not in ('team', 'partner');
  if n > 0 then raise exception '% lanes are owned by an actor rather than a group', n; end if;
end $$;
