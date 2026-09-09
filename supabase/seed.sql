-- Development seed: the service, its phases and their scenarios.
--
-- `supabase/config.toml` `[db.seed].sql_paths` names this file first and the
-- 22 scenario files under `supabase/seeds/` after it. That list IS the seed.
-- `npm run check:seed-load` loads all 23 onto a fresh replay of the migration
-- series and is the only thing that proves they still fit the schema.
--
-- ── This file rebuilds what it owns, and it does not own the service row ───
--
-- Everything below the service is delete-then-insert: this service's phases
-- are deleted and rewritten, and so are each phase's scenarios. The seed owns
-- those subtrees outright, and rebuilding them is what a reset means. Their
-- `on conflict` clauses cannot fire — the rows were deleted a statement ago.
--
-- The `services` row is the exception, deliberately. It is the anchor the rest
-- hangs off, it predates the seed on any database that has one, and this file
-- could not delete it without taking the whole board down with it. So the
-- insert makes sure the anchor EXISTS and says nothing further: on a database
-- that already has the row, `do nothing` leaves the name and the summary to
-- whoever set them.
--
-- That is #313's rule reaching the columns beside the one it was written for.
-- `entity_examples` is absent from this insert because a seed that says
-- nothing about a column cannot wrongly clear it. `name` and `summary` were
-- not absent: they carried `on conflict (id) do update set` from this
-- repository's first commit, through two mechanical renames, and nobody ever
-- decided they should. Overwriting is a decision, and this file has no
-- standing to make it — `20260821360000_the_service_says_what_it_is` renamed
-- the service and rewrote its summary, and the migration series is the
-- authority on that row. The values below are that migration's, restated so a
-- fresh local database is named what the deployed one is; on a replay from
-- empty the migration matches no row, so this insert is the only thing that
-- names the service locally, and `services.slug` stays null there, which is
-- why the local route is the name-derived one (`src/lib/serviceSlug.ts`).
-- When the series moves the name again, this copy is what goes stale.
--
-- ── Nothing structural stops this file reaching a hosted project ───────────
--
-- It is a local-reset artifact by convention, not by construction.
-- `npm run supabase:reset` is `supabase db reset`, whose `--local` is the
-- default — but the same CLI takes `db reset --linked` (seeding unless
-- `--no-seed`), `db push --include-seed` (whose `--linked` IS the default),
-- and `--db-url`, and all three read the `[db.seed].sql_paths` above. Any of
-- them loads these 23 files into a hosted project, and `db push
-- --include-seed` does not have the word "reset" in it to warn anybody. The
-- `do nothing` below is why the service row would survive that; the deletes
-- further down are why nothing underneath it would. There is no guard here
-- because a hosted database is not reliably distinguishable from a local one
-- in SQL, and a guard that is sometimes wrong would read as one that always
-- works. Point these commands at a deployment only on purpose.

insert into public.services (id, name, summary)
values (
  'a0000000-0000-4000-8000-000000000001',
  'PLUS Tutoring',
  'A hybrid human-AI tutoring service: university students run live, in-class math sessions for middle schoolers, supported by an app that handles their hiring, scheduling, session tooling and reflection.'
)
on conflict (id) do nothing;

-- Replace any prior demo phases/scenarios for this service
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
