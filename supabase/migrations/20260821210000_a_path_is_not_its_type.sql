-- 23 paths were called "Happy Path" and one "Alternate Path". A type is not a
-- name: it says nothing `path_type` does not already carry, and in a compare
-- view two scenarios side by side both read "Happy Path".
--
-- Every name below is derived from that path's own first steps. The reasoning
-- per path, and the three that encode a real branching rule, are in
-- docs/reference/path-names-draft.md.

create temp table rename_map (scenario text, old_name text, new_name text) on commit drop;

insert into rename_map values
  ('Discovery',                        'Happy Path',     'Discovers and applies'),
  ('Interview & Offer',                'Happy Path',     'Group interview to offer'),
  ('Tech Setup',                       'Happy Path',     'Clearances then I-9'),
  ('Onboarding Modules',               'Happy Path',     'Reads the module end to end'),
  ('Lesson Modules',                   'Happy Path',     'Works through the lesson'),
  ('Session Sign Up',                  'Happy Path',     'Signs up without conflicts'),
  ('Tutor Profile & Maintenance',      'Happy Path',     'Completes and updates the profile'),
  ('Standard Scheduling',              'Happy Path',     'Views schedule and reconfirms'),
  ('Call-off Request',                 'Happy Path',     'Call-off 12h+ (auto-approved)'),
  ('Fill-in Request',                  'Happy Path',     'Takes a slot from the pool'),
  ('Session Prep & Resources',         'Happy Path',     'Finds and assigns resources'),
  ('Before Students Join',             'Happy Path',     'Room setup before students arrive'),
  ('Student Just Joined',              'Happy Path',     'Full room joins on time'),
  ('Warm-Up',                          'Happy Path',     'Screen shared at greeting'),
  ('Warm-Up',                          'Alternate Path', 'No screen share'),
  ('Goal Setting',                     'Happy Path',     'Overview (all conditions)'),
  ('Student Kickoff Interview',        'Happy Path',     'Conducts the kickoff interview'),
  ('Help Request',                     'Happy Path',     'Tutor resolves it in the room'),
  ('Wrap-Up',                          'Happy Path',     'Debrief and close out'),
  ('Session Reflection',               'Happy Path',     'Completes the reflection form'),
  ('Personalized Coaching',            'Happy Path',     'Reflection into AI Coach'),
  ('Reporting Hours',                  'Happy Path',     'Hours reported and approved'),
  ('Reporting an Issue',               'Happy Path',     'Raised and resolved with supervisors'),
  ('Supervisor Program Administration','Happy Path',     'Runs the program day to day');

-- Assert the map matches the board before touching anything: a scenario renamed
-- upstream would otherwise leave a path silently un-renamed.
do $$
declare
  unmatched int;
begin
  select count(*) into unmatched
  from rename_map m
  where not exists (
    select 1 from paths p join scenarios sc on sc.id = p.scenario_id
    where sc.name = m.scenario and p.name = m.old_name
  );
  if unmatched > 0 then
    raise exception '% rows in the map match no path', unmatched;
  end if;
end $$;

update paths p
set name = m.new_name, updated_at = now()
from rename_map m, scenarios sc
where sc.id = p.scenario_id
  and sc.name = m.scenario
  and p.name = m.old_name;

do $$
declare
  leftover int;
begin
  select count(*) into leftover
  from paths where name in ('Happy Path', 'Alternate Path', 'Sad Path');
  if leftover > 0 then
    raise exception '% paths still named after their type', leftover;
  end if;
end $$;
