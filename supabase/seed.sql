-- Development seed: the service, its phases and their scenarios.
--
-- `scripts/load-seed.mjs` names this file first and the 22 scenario files
-- under `supabase/seeds/` after it. That list IS the seed. `npm run
-- check:seed-load` loads all 23 onto a fresh replay of the migration series
-- and is the only thing that proves they still fit the schema.
--
-- It used to be `supabase/config.toml` `[db.seed].sql_paths` that named them.
-- See "How this file is reached" below for why it no longer does.
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
-- ── How this file is reached, and what happens if it lands on real work ────
--
-- DECIDED 2026-09-09 (#547, and #545 before it). Two changes, and they answer
-- two different questions: what can reach this file, and what it does when it
-- is reached.
--
-- **What can reach it.** It used to be a local-reset artifact by convention
-- and not by construction. `npm run supabase:reset` is `supabase db reset`,
-- whose `--local` is the default — but the same CLI takes `db reset --linked`
-- (seeding unless `--no-seed`), `db push --include-seed` (whose `--linked` IS
-- the default), and `--db-url`, and all three read `[db.seed].sql_paths`. Any
-- of them loaded these 23 files into whatever the CLI was pointed at, and `db
-- push --include-seed` does not have the word "reset" in it to warn anybody —
-- it is otherwise the ordinary way to ship migrations. So `[db.seed]` names
-- nothing now and is disabled; `npm run seed:load -- --apply` is the only
-- named way in, and it needs a connection string typed on purpose.
--
-- **What it does when it is reached.** #545 declined a runtime guard on the
-- ground that local and hosted Supabase are not reliably distinguishable in
-- SQL, and that reasoning was checked again and holds: production has
-- `supabase_vault`, the three hosted roles and a `realtime` schema, and so
-- does a local CLI stack, because parity is the point; `current_database()`
-- is `postgres` on both. A guard that is sometimes wrong reads as one that
-- always works.
--
-- The guard below therefore does not ask WHERE AM I. It asks IS THERE
-- ANYTHING HERE TO LOSE — which needs no environment signal at all, because
-- it measures the thing itself. `scripts/authored_fields.mjs` already
-- enumerates the columns a person types that this seed cannot restore
-- (`CELL_FIELDS`, `LANE_FIELDS`, `PHASE_FIELDS`, the reason its export/restore
-- pair exists). If any row under this service holds one, the load refuses.
--
-- That fails safe in the only direction that matters. A fresh database passes
-- trivially — nothing has been authored yet, so the count is zero. A database
-- somebody has typed into refuses, whether it is the deployment or a
-- colleague's laptop. It is not approximating an environment; the columns it
-- counts ARE the loss.
--
-- ── What it does not cover, tried rather than reasoned about ───────────────
--
-- Measured on a scratch database built from `scripts/replay-prelude.sql` plus
-- the migration series, seeded to 749 cells, every `content` then overwritten
-- with a marker so a loss could be counted.
--
-- 1. **The 22 scenario files carry no guard of their own.** `psql -f
--    supabase/seeds/warm_up_happy_path.sql` on that database overwrote 47 of
--    the 749 markers and exited 0, with no error and nothing printed. The
--    guard stands in front of the SEED — the ordered list starting here — not
--    in front of every file in the directory. Running the whole seed through
--    `scripts/load-seed.mjs` on the same database refused, and all 702
--    remaining markers survived untouched.
-- 2. **A refusal only stops the rest of the load when the caller asked it
--    to.** `psql -f supabase/seed.sql` in its default autocommit, with no
--    `ON_ERROR_STOP`, printed the exception and then ran the deletes anyway:
--    5 marked `phases.business_impact` values, 5 destroyed, plus the whole
--    board underneath by cascade. The same file under `--single-transaction
--    -v ON_ERROR_STOP=1` left all 5 in place. `scripts/load-seed.mjs` passes
--    both flags for exactly this reason, and a hand-rolled psql must too.
-- 3. **It counts columns, not tables.** Resources, evidence, dependencies,
--    slices and findings hang off cells and go down with the deletes below;
--    none of them is an authored COLUMN, so none of them is what makes this
--    refuse. `authored_fields.mjs` has the same blind spot and says so.
-- 4. **`content` and `summary` are seed-carried AND authored.** So a database
--    this seed has already loaded refuses a second load — the two are the
--    same column and nothing can tell them apart. Re-seeding means starting
--    from an empty database, which is what a reset was always supposed to be.
--
-- The refusal names `authored_fields.mjs export` because that is the command
-- that makes the refusal survivable: export, rebuild from empty, restore.

do $guard$
declare
  -- The service this file rebuilds. Everything below hangs off it, and the
  -- guard scopes itself to the same subtree — another service's authored work
  -- is not this file's business and must not make it refuse.
  target constant uuid := 'a0000000-0000-4000-8000-000000000001';

  -- CELL_FIELDS, LANE_FIELDS and PHASE_FIELDS from
  -- `scripts/authored_fields.mjs`, restated. `scripts/tests/seed-loads.test.mjs`
  -- holds these three arrays to that file's three by set equality, so the
  -- restatement cannot drift: adding a column there without adding it here
  -- fails `npm test` rather than leaving this guard quietly blind to it.
  cell_columns constant text[] := array[
    'content', 'summary', 'status', 'function', 'form',
    'value_props', 'owner', 'perceived_owner'
  ];
  lane_columns constant text[] := array['owner_team', 'kpis', 'tools'];
  phase_columns constant text[] := array['business_impact', 'operational_requirements'];

  -- Values that mean "nobody typed this", beyond null and blank.
  -- `cells.status` is `not null default 'live'`, so every row carries one
  -- whether or not a person chose it; counted as content it would make this
  -- guard refuse on every database that has any cells at all. Mirrors
  -- `COLUMN_DEFAULTS` in `authored_fields.mjs`.
  column_defaults constant jsonb := '{"status": "live"}'::jsonb;

  -- The query is BUILT from the arrays rather than written out beside them.
  -- A hand-written predicate is a second copy of the list, and a second copy
  -- is the thing that goes stale — which is how `authored_fields.mjs` spent a
  -- fortnight selecting `cells.maturity`, a column renamed to `status` in
  -- `20260821240000`. A column named here and absent from the schema now
  -- fails this block loudly, and `check:seed-load` is where that shows up.
  scope record;
  column_name text;
  found bigint;
  total bigint := 0;
  detail text := '';
begin
  for scope in
    select *
    from (
      values
        ('cells', cell_columns,
         'public.cells t' ||
         ' join public.paths p on p.id = t.path_id' ||
         ' join public.scenarios s on s.id = p.scenario_id' ||
         ' join public.phases ph on ph.id = s.phase_id' ||
         ' where ph.service_id = $1'),
        ('lanes', lane_columns,
         'public.lanes t' ||
         ' join public.paths p on p.id = t.path_id' ||
         ' join public.scenarios s on s.id = p.scenario_id' ||
         ' join public.phases ph on ph.id = s.phase_id' ||
         ' where ph.service_id = $1'),
        ('phases', phase_columns, 'public.phases t where t.service_id = $1')
    ) as v(table_name, column_list, source)
  loop
    foreach column_name in array scope.column_list
    loop
      -- Empty is null, blank, `[]` or `{}` — the last two so an untouched
      -- jsonb array does not read as content. A text column holding the two
      -- characters `[]` would be miscounted as empty; no column here does.
      execute
        format(
          'select count(*) from %s and btrim(coalesce(t.%I::text, '''')) ' ||
            'not in ('''', ''[]'', ''{}'')%s',
          scope.source,
          column_name,
          case
            when column_defaults ? column_name
              then format(' and t.%I::text is distinct from %L',
                          column_name, column_defaults ->> column_name)
            else ''
          end
        )
        using target
        into found;

      if found > 0 then
        total := total + found;
        detail := detail || format(E'\n  %s row(s) with %s.%s',
                                   found, scope.table_name, column_name);
      end if;
    end loop;
  end loop;

  if total > 0 then
    raise exception
      using
        message =
          'seed refused: this database already holds authored blueprint work, and '
          || 'loading the seed would overwrite it.',
        detail =
          format('%s authored value(s) under service %s:%s', total, target, detail),
        hint =
          'Every insert below is an upsert keyed by a hand-minted id, so a load onto '
          || 'a populated database reports zero errors and silently rewrites these '
          || 'columns; the deletes take the rows underneath outright. Export first — '
          || '`node scripts/authored_fields.mjs export` — then load the seed onto an '
          || 'EMPTY database and `node scripts/authored_fields.mjs restore` onto the '
          || 'result. If you meant a different database, you are pointed at the wrong '
          || 'one: check the connection string, not this file.';
  end if;
end
$guard$;

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
