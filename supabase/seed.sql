-- Development seed: service lifecycle with phases and in-session scenarios

insert into public.services (id, name, summary)
values (
  'a0000000-0000-4000-8000-000000000001',
  'PLUS Application',
  'Application through onboarding and session lifecycle'
)
on conflict (id) do update set
  name = excluded.name,
  summary = excluded.summary;

-- Replace any prior demo phases/scenarios for this lifecycle
delete from public.phases
where service_id = 'a0000000-0000-4000-8000-000000000001';

insert into public.phases (
  id,
  service_id,
  name,
  summary,
  position,
  loops_to_phase_id
)
values
  (
    'a0000000-0000-4000-8000-000000000101',
    'a0000000-0000-4000-8000-000000000001',
    'Application',
    'Potential tutors discover, interview and receive an offer to join the PLUS Team',
    1,
    null
  ),
  (
    'a0000000-0000-4000-8000-000000000102',
    'a0000000-0000-4000-8000-000000000001',
    'Onboarding',
    'The tutor goes through required onboarding before joining a tutoring session.',
    2,
    null
  ),
  (
    'a0000000-0000-4000-8000-000000000103',
    'a0000000-0000-4000-8000-000000000001',
    'Pre-session',
    'Preparation before a live tutoring session',
    3,
    null
  ),
  (
    'a0000000-0000-4000-8000-000000000104',
    'a0000000-0000-4000-8000-000000000001',
    'In-session',
    'Tutoring activities that occur during live sessions.',
    4,
    null
  ),
  (
    'a0000000-0000-4000-8000-000000000105',
    'a0000000-0000-4000-8000-000000000001',
    'Post-session',
    'Wrap-up after session; may return to pre-session',
    5,
    'a0000000-0000-4000-8000-000000000103'
  )
on conflict (id) do update set
  name = excluded.name,
  summary = excluded.summary,
  position = excluded.position,
  loops_to_phase_id = excluded.loops_to_phase_id;

-- Application phase scenarios
delete from public.scenarios
where phase_id = 'a0000000-0000-4000-8000-000000000101';

insert into public.scenarios (id, phase_id, name, summary, position, layout)
values
  (
    'a0000000-0000-4000-8000-000000000121',
    'a0000000-0000-4000-8000-000000000101',
    'Discovery',
    'Potential tutors discover plus',
    1,
    'stacked'
  ),
  (
    'a0000000-0000-4000-8000-000000000122',
    'a0000000-0000-4000-8000-000000000101',
    'Interview & Offer',
    'Potential Tutors Interview for role and receive an offer.',
    2,
    'stacked'
  )
on conflict (id) do update set
  name = excluded.name,
  summary = excluded.summary,
  position = excluded.position,
  layout = excluded.layout;

-- Onboarding phase scenarios
delete from public.scenarios
where phase_id = 'a0000000-0000-4000-8000-000000000102';

insert into public.scenarios (id, phase_id, name, summary, position, layout)
values
  (
    'a0000000-0000-4000-8000-000000000120',
    'a0000000-0000-4000-8000-000000000102',
    'Tech Setup',
    'The tutor sets up necessary tech and obtains required clearances.',
    1,
    'stacked'
  ),
  (
    'a0000000-0000-4000-8000-000000000123',
    'a0000000-0000-4000-8000-000000000102',
    'Onboarding Modules',
    'The tutor completes required onboarding modules.',
    2,
    'stacked'
  ),
  (
    'a0000000-0000-4000-8000-000000000124',
    'a0000000-0000-4000-8000-000000000102',
    'Lesson Modules',
    'The tutor goes through required lessons before joining a tutoring session.',
    3,
    'stacked'
  ),
  (
    'a0000000-0000-4000-8000-000000000125',
    'a0000000-0000-4000-8000-000000000102',
    'Session Sign Up',
    'The tutor signs up for recurring sessions for the semester.',
    4,
    'stacked'
  )
on conflict (id) do update set
  name = excluded.name,
  summary = excluded.summary,
  position = excluded.position,
  layout = excluded.layout;

-- Pre-session scenarios
delete from public.scenarios
where phase_id = 'a0000000-0000-4000-8000-000000000103';

insert into public.scenarios (id, phase_id, name, summary, position, layout)
values
  (
    'a0000000-0000-4000-8000-000000000126',
    'a0000000-0000-4000-8000-000000000103',
    'Standard Scheduling',
    null,
    1,
    'stacked'
  ),
  (
    'a0000000-0000-4000-8000-000000000127',
    'a0000000-0000-4000-8000-000000000103',
    'Fill-in Request',
    null,
    2,
    'stacked'
  ),
  (
    'a0000000-0000-4000-8000-000000000128',
    'a0000000-0000-4000-8000-000000000103',
    'Call-off Request',
    null,
    3,
    'stacked'
  )
on conflict (id) do update set
  name = excluded.name,
  summary = excluded.summary,
  position = excluded.position,
  layout = excluded.layout;

-- In-session scenarios
delete from public.scenarios
where phase_id = 'a0000000-0000-4000-8000-000000000104';

insert into public.scenarios (id, phase_id, name, summary, position, layout)
values
  (
    'a0000000-0000-4000-8000-000000000201',
    'a0000000-0000-4000-8000-000000000104',
    'Before Students Join',
    'Teachers and tutors prepare the session before students join.',
    1,
    'stacked'
  ),
  (
    'a0000000-0000-4000-8000-000000000202',
    'a0000000-0000-4000-8000-000000000104',
    'Student Just Joined',
    'Teachers and tutors welcome students as they join the session.',
    2,
    'stacked'
  ),
  (
    'a0000000-0000-4000-8000-000000000203',
    'a0000000-0000-4000-8000-000000000104',
    'Warm-Up',
    'Tutors greet and move students to breakout rooms as the session begins.',
    3,
    'stacked'
  ),
  (
    'a0000000-0000-4000-8000-000000000204',
    'a0000000-0000-4000-8000-000000000104',
    'Goal Setting',
    'Tutors guide students through goal setting in breakout sessions.',
    4,
    'stacked'
  ),
  (
    'a0000000-0000-4000-8000-000000000205',
    'a0000000-0000-4000-8000-000000000104',
    'Help Request',
    'Tutors receive and resolve student help requests during the session.',
    5,
    'stacked'
  ),
  (
    'a0000000-0000-4000-8000-000000000206',
    'a0000000-0000-4000-8000-000000000104',
    'Wrap-Up',
    'Teachers and tutors close breakout sessions, debrief, and complete wrap-up tasks.',
    6,
    'stacked'
  )
on conflict (id) do update set
  name = excluded.name,
  summary = excluded.summary,
  position = excluded.position,
  layout = excluded.layout;

-- Post-session scenarios
delete from public.scenarios
where phase_id = 'a0000000-0000-4000-8000-000000000105';

insert into public.scenarios (id, phase_id, name, summary, position, layout)
values
  (
    'a0000000-0000-4000-8000-000000000207',
    'a0000000-0000-4000-8000-000000000105',
    'Reporting an Issue',
    'Tutors report session issues to the tutor supervisor team after the session.',
    1,
    'stacked'
  ),
  (
    'a0000000-0000-4000-8000-000000000208',
    'a0000000-0000-4000-8000-000000000105',
    'Reporting Hours',
    'Tutors log their tutoring hours after the session.',
    2,
    'stacked'
  )
on conflict (id) do update set
  name = excluded.name,
  summary = excluded.summary,
  position = excluded.position,
  layout = excluded.layout;

-- Warm-Up Happy Path blueprint (see supabase/seeds/warm_up_happy_path.sql)
-- Application Discovery paths (see supabase/seeds/application_discovery_happy_path.sql and application_discovery_sad_path.sql)
-- Application Interview paths (see supabase/seeds/application_interview_happy_path.sql)
-- Onboarding Tech Setup path (see supabase/seeds/onboarding_tech_setup_happy_path.sql)
-- Onboarding Session Sign Up path (see supabase/seeds/onboarding_session_sign_up_happy_path.sql)
-- Pre-session Standard Scheduling path (see supabase/seeds/pre_session_standard_scheduling_happy_path.sql)
-- Pre-session Fill-in Request path (see supabase/seeds/pre_session_fill_in_request_happy_path.sql)
-- Pre-session Call-off Request path (see supabase/seeds/pre_session_call_off_request_happy_path.sql)
-- In-session Before Students Join path (see supabase/seeds/in_session_before_students_join_happy_path.sql)
-- In-session Student Just Joined path (see supabase/seeds/in_session_students_just_joined_happy_path.sql)
-- In-session Goal-Setting Phase path (see supabase/seeds/in_session_goal_setting_happy_path.sql)
-- In-session Help Request path (see supabase/seeds/in_session_help_request_happy_path.sql)
-- In-session Wrap-Up path (see supabase/seeds/in_session_wrap_up_happy_path.sql)
-- Post-session Reporting an Issue path (see supabase/seeds/post_session_reporting_an_issue_happy_path.sql)
-- Post-session Reporting Hours path (see supabase/seeds/post_session_reporting_hours_happy_path.sql)

-- ── What each scenario file's last two statements are ─────────────────────
--
-- Every scenario file ends in an `insert into public.cell_touchpoints` and an
-- `insert into public.resources`, and both are content this seed used to write
-- into one jsonb column on `cells`.
--
-- `cells.links` held three unrelated things under a name describing one of
-- them. A `type = 'tech_description'` entry was a TOUCHPOINT PLACEMENT — the
-- tool a cell shows, with a sentence about what it does at that moment.
-- 20260830260000 parked every one the registry could not name and
-- 20260902170000 folded that queue back in, so each is a placement now,
-- name-only: this seed stands up no `touchpoints` registry, and a name-only
-- placement is a first-class one. A `type = 'url'` entry was a RESOURCE, and
-- 20260830280000 moved those to their own table. What a placement carried
-- beside its sentence — a link, and a screenshot — became a featured resource
-- of its own, hanging off the placement rather than the cell (20260902170000).
-- Then 20260830280000 dropped the column.
--
-- Two more things about those rows read oddly until you know where they came
-- from. The ids are derived rather than authored, so a re-run of this seed
-- upserts the same rows instead of duplicating them. And every image url is
-- the `cell-attachments` bucket's, because 20260902180000 moved the shipped
-- images there and then forbade a url that points inside whatever site
-- deployed this template.

-- The "Example API" placeholder row that used to sit here is gone with the
-- table it belonged to. `services` was a separate legacy catalog holding that
-- one reader-less row until 20260821340000 dropped it outright and renamed
-- `service_lifecycles` to `services` — so the same statement now inserts a
-- SECOND, phase-less service into the hierarchy this file just built, which
-- the service switcher would offer and no board would answer for.
