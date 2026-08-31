-- Second naming pass. The first named paths for what happens on them, which
-- restated the scenario: `Session Reflection › Completes the reflection form`
-- said it twice.
--
-- The rule now: the scenario names the activity, the path names WHICH WAY
-- through it — the condition that puts someone on this route rather than a
-- sibling. Every name is taken from that path's own summary.
--
-- Nine scenarios have one route and no branching condition anywhere in their
-- content. Those get `Standard`. Inventing a condition would be worse than
-- admitting there is one way through.

create temp table path_rename (old_name text primary key, new_name text) on commit drop;

insert into path_rename values
  ('Room setup before students arrive',        'Setup goes to plan'),
  ('Call-off 12h+ (auto-approved)',            '12+ hours ahead'),
  ('Late call-off (<12h)',                     'Under 12 hours'),
  ('Swap instead of call-off',                 'Swap offered instead'),
  ('Discovers and applies',                    'Standard'),
  ('Takes a slot from the pool',               'Slot gets covered'),
  ('Overview (all conditions)',                'All conditions'),
  ('Set Goals',                                'No prior goals'),
  ('Update Goals',                             'New cycle, goals exist'),
  ('Check Goals',                              'Mid-cycle check'),
  ('Set Goals Edge Case',                      'Missed last session, no goals'),
  ('Update Goals Edge Case',                   'Missed last session, has goals'),
  ('Tutor resolves it in the room',            'Resolved in the room'),
  ('Escalation',                               'Routed out'),
  ('Group interview to offer',                 'Standard'),
  ('Supervisor-registration clearance',        'Supervisor-registered clearance'),
  ('Works through the lesson',                 'Standard'),
  ('Reads the module end to end',              'Standard'),
  ('Reflection into AI Coach',                 'After a reflection'),
  ('Raised and resolved with supervisors',     'Standard'),
  ('Hours reported and approved',              'Reported on time'),
  ('Missed hours',                             'Deadline missed'),
  ('Finds and assigns resources',              'Standard'),
  ('Completes the reflection form',            'Filed in one sitting'),
  ('Signs up without conflicts',               'No conflicts'),
  ('Soft-conflict sign-up gate',               'Soft-conflict gate'),
  ('Views schedule and reconfirms',            'Schedule as issued'),
  ('In-app session creation & reconfirmation', 'Created in the app'),
  ('Full room joins on time',                  'Full room, on time'),
  ('No or Few Students Join',                  'Few or none by 10 min'),
  ('Conducts the kickoff interview',           'New student'),
  ('Runs the program day to day',              'Standard'),
  ('Clearances then I-9',                      'Standard'),
  ('Completes and updates the profile',        'Standard'),
  ('Screen shared at greeting',                'Student shares screen'),
  ('Debrief and close out',                    'Rooms close on time'),
  ('Lead Dashboard Wrap-Up',                   'Lead works from a dashboard'),
  ('Reflection redesign',                      'Redesigned reflection');
-- 'No screen share' keeps its name: it already states its condition.

do $$
declare unmatched int;
begin
  -- Only where there are paths to rename. This map is keyed on the path name
  -- alone, so there is no finer scope than "the board exists"; unscoped it
  -- raised on every empty replay and rolled the file back (#148).
  select count(*) into unmatched from path_rename m
  where exists (select 1 from paths)
    and not exists (select 1 from paths p where p.name = m.old_name);
  if unmatched > 0 then raise exception '% mapped names match no path', unmatched; end if;
end $$;

update paths p set name = m.new_name, updated_at = now()
from path_rename m where p.name = m.old_name;

do $$
declare n int;
begin
  select count(*) into n from (
    select name from paths where name <> 'Standard'
    group by name having count(*) > 1
  ) dupes;
  if n > 0 then raise exception '% non-Standard names appear more than once', n; end if;

  -- "9 Standard paths" was a measurement of the day, and a count is not what
  -- the rename is for. What it is for is that no path is left wearing a name
  -- the map retired — true of an empty database and of a renamed one, false
  -- only if the update matched nothing it should have.
  select count(*) into n from paths p
  join path_rename m on m.old_name = p.name;
  if n > 0 then raise exception '% paths still bear a retired name', n; end if;
end $$;
