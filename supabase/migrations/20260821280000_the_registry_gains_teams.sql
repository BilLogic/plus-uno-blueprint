-- The registry held six rows — actors and PLUS — and no teams, so
-- `lanes.owner_team` had a rule ("from the closed list") and no list.
--
-- One table for every party, with a parent link so Instructional Design and
-- Marketing roll up to Design. Teams and stakeholders were drafted as two
-- vocabularies; they are one. See docs/reference/lane-vocabulary.md.
--
-- `stakeholders.service_id` points at `service_lifecycles`, not `services`.

alter table public.stakeholders
  add column if not exists parent_id uuid references public.stakeholders(id);

comment on column public.stakeholders.parent_id is
  'The party this one is part of. Design''s four sub-teams point at Design, so "what does Design own?" rolls them up while a lane can still name the specific one.';

insert into public.stakeholders (id, service_id, name, kind, note)
select gen_random_uuid(), sl.id, v.name, v.kind, v.note
from public.service_lifecycles sl
cross join (values
  ('Design',            'staff',   'Screens and flows, the design system, how the service is taught, and how it is presented outside.'),
  ('Dev',               'staff',   'The PLUS app — every servlet, job and integration behind a tech pill.'),
  ('Product',           'staff',   'What gets built and in what order. Named in no cell on the board today.'),
  ('Research',          'staff',   'Study design and its inputs to the product — student ordering, session condition, the reflection questions as an instrument.'),
  ('Tutor Supervisors', 'staff',   'Recruiting, clearances, roster and session administration, call-offs, hours, reflection follow-up.'),
  ('Partnership',       'staff',   'The relationship with schools and districts.'),
  ('CMU HR',            'partner', 'Employment, the I-9, payroll in Workday. Outside PLUS.'),
  ('CPO',               'partner', 'Act 153 clearances and their verification — what PLUS is not allowed to verify itself.')
) as v(name, kind, note)
where not exists (
  select 1 from public.stakeholders x where x.name = v.name and x.service_id = sl.id
);

insert into public.stakeholders (id, service_id, name, kind, note, parent_id)
select gen_random_uuid(), d.service_id, v.name, 'staff', v.note, d.id
from public.stakeholders d
cross join (values
  ('Product Design',       'The screens and flows a tutor moves through.'),
  ('Design Ops',           'The design system, the libraries, and how design work ships.'),
  ('Instructional Design', 'Onboarding modules, lesson modules, quizzes, supplementary materials, and the reflection questions as pedagogy.'),
  ('Marketing',            'The public face — the marketing site, social channels, the Handshake posting.')
) as v(name, note)
where d.name = 'Design'
  and not exists (select 1 from public.stakeholders x where x.name = v.name);

do $$
declare n int;
begin
  -- AMENDED 2026-08-31. Two censuses stood here — `expected at least 12 staff
  -- parties`, `expected 4 sub-teams under Design` — counting the whole table
  -- against production's numbers on the day. On an empty database there is no
  -- `service_lifecycles` row for the two inserts above to hang off, nothing is
  -- seeded, the first raises, and because a migration is one transaction
  -- `add column parent_id` ROLLS BACK WITH IT.
  --
  -- The rule is `20260821340000`'s: amend an applied migration only where
  -- leaving it is actively harmful, and an assertion that disables the only
  -- instrument this repository has for #148 is that case.
  --
  -- What replaces them is what they were reaching for, per-name rather than
  -- per-count: every party this file seeds is present wherever its service is,
  -- and every sub-team hangs off Design. Vacuously true on an empty database,
  -- and on production exactly as strong — the 8 + 4 names are what made 12.
  select count(*) into n
  from public.service_lifecycles sl
  cross join (values
    ('Design'), ('Dev'), ('Product'), ('Research'),
    ('Tutor Supervisors'), ('Partnership'), ('CMU HR'), ('CPO')
  ) as want(name)
  where not exists (
    select 1 from public.stakeholders s
    where s.service_id = sl.id and s.name = want.name
  );
  if n > 0 then raise exception '% seeded parties are missing from the registry', n; end if;

  select count(*) into n
  from public.stakeholders d
  cross join (values
    ('Product Design'), ('Design Ops'), ('Instructional Design'), ('Marketing')
  ) as want(name)
  where d.name = 'Design'
    and not exists (
      select 1 from public.stakeholders s
      where s.parent_id = d.id and s.name = want.name
    );
  if n > 0 then raise exception '% Design sub-teams are missing or unparented', n; end if;

  select count(*) into n from stakeholders c
  join stakeholders p on p.id = c.parent_id where p.name <> 'Design';
  if n > 0 then raise exception '% sub-teams hang off something other than Design', n; end if;

  select count(*) into n from stakeholders c
  join stakeholders p on p.id = c.parent_id where p.parent_id is not null;
  if n > 0 then raise exception 'the party hierarchy is more than one level deep'; end if;
end $$;
