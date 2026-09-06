-- Retire the two PLUS repair shims, by correcting the rows they patch.
-- Prepared for #396 Q40 (parent #326). NOT a migration. The owner runs it.
--
-- ══ What this is ═════════════════════════════════════════════════════════
--
-- `src/lib/resolveBlueprint.ts` runs two instance-specific repairs over every
-- blueprint it loads, gated on hardcoded PLUS scenario and path UUIDs:
--
--   src/lib/repairWarmUpAlternatePathBlueprint.ts   the Warm-Up alternate path
--   src/lib/repairDiscoverySadPathBlueprint.ts      the Discovery sad path
--
-- Both are read-time patches for faults in the stored rows. A patch applied on
-- every load is a fault the database still has, described in TypeScript, and
-- #396 Q40 answers "retire them": correct the rows, then the code that patches
-- them has nothing to do and can go.
--
-- This file is the row correction. Deleting the two modules is a separate
-- change, and it must follow this one — remove the shims first and the board
-- draws the uncorrected rows.
--
-- ══ Why it lives under docs/ and not in supabase/migrations/ ═════════════
--
-- Because a file in `supabase/migrations/` that has not been applied is a new
-- entry in `docs/reference/migration-ledger-baseline.json`, and that ratchet
-- exists to catch exactly this — a migration written and never run (ADR 0009).
-- The session that prepared this file never contacts the hosted project, so it
-- cannot apply it, so filing it as a migration would leave the series claiming
-- a change the database has not had.
--
-- `docs/` is executed by nothing. Every tool that reads the migration series —
-- `scripts/apply-pending.mjs`, `scripts/replay-migrations.mjs`,
-- `check:migration-syntax`, `check:proof-footprint`, `check:new-table-grants`
-- — reads `supabase/migrations/` and only that directory, so a file here cannot
-- be picked up by accident. It has neighbours: `schema-snapshot-queries.sql`
-- and `seed-verification.sql` are both operator-run SQL filed in this folder.
--
-- If the owner would rather this be a numbered migration once it has been run,
-- making it one is a rename. The SQL below is written to be safe either way:
-- it is idempotent, it takes no transaction control of its own, and it asserts
-- invariants rather than counting production's rows.
--
-- ══ How to run it ════════════════════════════════════════════════════════
--
--   psql "$DATABASE_URL" -1 -v ON_ERROR_STOP=1 -f docs/reference/retire-plus-repair-shims.sql
--
-- `-1` wraps the whole file in ONE transaction and `ON_ERROR_STOP=1` aborts on
-- the first error, so a failed assertion rolls the whole repair back rather
-- than leaving the board half-corrected. Both flags are required; without `-1`
-- psql commits statement by statement.
--
-- It prints its own before-and-after counts as NOTICEs. Read them. A run that
-- reports zero rows changed on both boards is a database that was already
-- correct, which is a legitimate and expected outcome for the Warm-Up half.
--
-- To see what it WOULD do without doing it, run it inside a transaction you
-- roll back:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -c 'begin' -f docs/reference/retire-plus-repair-shims.sql -c 'rollback'
--
-- ══ What each half corrects ══════════════════════════════════════════════
--
-- ── A. The Warm-Up alternate path — expected to be a no-op ───────────────
--
-- `repairWarmUpAlternatePathBlueprint` does two things.
--
-- It reassigns cells to lanes. Every cell of the alternate path carries an id
-- of the form `a0000000-0000-4000-8000-00000006SSNN`, where NN names the lane
-- it belongs to: NN `03` is lane `…0403`, NN `06` is lane `…0406`. The shim
-- rewrites `lane_id` from the id whenever the two disagree.
--
-- And `repairWarmUpPathLanePositions` realigns the path's lane ROW positions,
-- by lane name, against the reference swimlanes — three lanes each sat one slot
-- late, leaving position 1 vacant and colliding two lanes at position 4.
--
-- Both were fixed at source on 2026-08-21. `20260821270000` moved lanes `…0401`,
-- `…0402` and `…0403` to positions 1, 2 and 3, and asserted that the Warm-Up
-- happy and variant paths then listed their lanes in the same order; the
-- cell-to-lane assignment was found clean at the same time, 0 of 28 misfiled.
-- The shim's own header records this and says it survives only for the no-DB
-- dev fallback.
--
-- So section A is expected to change nothing, and it is here anyway, because
-- "expected" is not "verified" and the shim is being deleted on the strength of
-- it. It reports what it found. If it changes rows, the 2026-08-21 fix has been
-- undone by something and that is worth knowing before the shim goes.
--
-- ── B. The Discovery sad path — the real correction ──────────────────────
--
-- `repairDiscoverySadPathBlueprint` moves the sad path's outcome cells off the
-- step the HAPPY path ends on (`…0716`, "Interested in joining PLUS") and onto
-- the sad path's own final step (`…0717`, "Not interested in joining PLUS"),
-- and puts `…0717` in the path's step list in place of `…0716`. Without it the
-- two outcomes share one column and the integrated view stacks the sad ending
-- on top of the happy one.
--
-- The series says this was corrected once, by `20250628140000`, and then that
-- `20250710134500` deleted the whole sad path from the database. Whether the
-- path was later re-imported — the board arrived as imported data, so the
-- series is not the record of fact (ADR 0009) — is a question only the live
-- database answers, which is why every statement below is scoped so that an
-- absent path matches zero rows and the file succeeds having done nothing.
--
-- ══ What it deliberately does not do ═════════════════════════════════════
--
-- It never INSERTS a cell. The Discovery shim, when the database is missing the
-- sad path's outcome cells, appends them from the in-code fallback fixture.
-- Materialising a fixture into the database is authoring content, not repairing
-- a row, and it is not what "retire the shim" asks for. If the live sad path
-- turns out to be missing cells the fallback supplies, that is a seed to run
-- and a decision for the owner, and this file reports the gap rather than
-- filling it.
--
-- It also forces nothing through a unique constraint. `cells` is unique on
-- (lane_id, step_id, position) and that constraint is not deferrable, so a move
-- into an occupied slot would raise a bare 23505 naming an index. Both halves
-- look for that collision first and raise a message naming the cells instead.

-- ── The repair ────────────────────────────────────────────────────────────

do $repair$
declare
  -- Warm-Up, its alternate path, and the happy path its lane order is
  -- measured against.
  k_warm_up_scenario   constant uuid := 'a0000000-0000-4000-8000-000000000203';
  k_warm_up_happy      constant uuid := 'a0000000-0000-4000-8000-000000000300';
  k_warm_up_alternate  constant uuid := 'a0000000-0000-4000-8000-000000000350';

  -- Application → Discovery, its sad path, and the two candidate final steps.
  k_discovery_sad      constant uuid := 'a0000000-0000-4000-8000-000000000701';
  k_happy_final_step   constant uuid := 'a0000000-0000-4000-8000-000000000716';
  k_sad_final_step     constant uuid := 'a0000000-0000-4000-8000-000000000717';
  k_sad_final_position constant integer := 6;

  v_before  integer;
  v_after   integer;
  v_changed integer;
  v_detail  text;
begin

  -- ══ A1. Warm-Up alternate path: every cell in the lane its id names ═══
  --
  -- The id shape is `a0000000-0000-4000-8000-00000006SSNN`; NN is the lane
  -- suffix. NN `05` is absent from the shim's map and is left alone here too —
  -- the shim returns no lane for it and changes nothing, and this file is a
  -- transcription of the shim, not an extension of it.

  -- Dropped first so the block may be run twice inside one transaction —
  -- `on commit drop` only fires at commit, and a rehearsal that runs the
  -- repair against a clean board and then against a drifted one needs the
  -- second run to build this table again.
  drop table if exists pending_warm_up_lane_moves;
  create temporary table pending_warm_up_lane_moves on commit drop as
  select
    c.id                                                as cell_id,
    c.lane_id                                           as from_lane_id,
    l.id                                                as to_lane_id,
    c.step_id,
    c.position
  from public.cells c
  join public.lanes l
    on l.path_id = k_warm_up_alternate
   and l.id = ('a0000000-0000-4000-8000-0000000004' || right(c.id::text, 2))::uuid
  where c.path_id = k_warm_up_alternate
    and c.id::text ~ '^a0000000-0000-4000-8000-00000006[0-9]{4}$'
    and right(c.id::text, 2) <> '05'
    and c.lane_id is distinct from l.id;

  select count(*) into v_before from pending_warm_up_lane_moves;
  raise notice
    'A1 before: % Warm-Up alternate-path cell(s) sit in a lane their id does not name', v_before;

  -- A move into a slot another cell already holds would raise 23505 against
  -- `cells_lane_step_slot_unique`, which is not deferrable. Name the pair.
  select string_agg(format('%s -> lane %s slot (%s, %s)',
           m.cell_id, m.to_lane_id, m.step_id, m.position), '; ')
    into v_detail
    from pending_warm_up_lane_moves m
   where exists (
     select 1
       from public.cells occupied
      where occupied.lane_id = m.to_lane_id
        and occupied.step_id = m.step_id
        and occupied.position = m.position
        and occupied.id <> m.cell_id
   );
  if v_detail is not null then
    raise exception
      'A1: the correct lane slot is already occupied for: %. Resolve by hand — forcing the move would raise 23505 on cells_lane_step_slot_unique', v_detail;
  end if;

  update public.cells c
     set lane_id = m.to_lane_id,
         updated_at = now()
    from pending_warm_up_lane_moves m
   where c.id = m.cell_id;
  get diagnostics v_changed = row_count;

  select count(*) into v_after
    from public.cells c
    join public.lanes l
      on l.path_id = k_warm_up_alternate
     and l.id = ('a0000000-0000-4000-8000-0000000004' || right(c.id::text, 2))::uuid
   where c.path_id = k_warm_up_alternate
     and c.id::text ~ '^a0000000-0000-4000-8000-00000006[0-9]{4}$'
     and right(c.id::text, 2) <> '05'
     and c.lane_id is distinct from l.id;

  raise notice
    'A1 after:  % cell(s) moved, % still misfiled (must be 0)', v_changed, v_after;

  if v_after <> 0 then
    raise exception
      'A1: % Warm-Up alternate-path cell(s) are still in the wrong lane after the move', v_after;
  end if;

  -- ══ A2. Warm-Up alternate path: lane rows in the reference order ══════
  --
  -- The reference is the same scenario's HAPPY path, matched by lane name.
  -- That is the invariant `20260821270000` asserted when it made this
  -- correction at source, and it needs no fixture to state.

  -- Dropped first so the block may be run twice inside one transaction —
  -- `on commit drop` only fires at commit, and a rehearsal that runs the
  -- repair against a clean board and then against a drifted one needs the
  -- second run to build this table again.
  drop table if exists pending_warm_up_lane_positions;
  create temporary table pending_warm_up_lane_positions on commit drop as
  select
    alt.id       as lane_id,
    alt.name     as lane_name,
    alt.position as from_position,
    happy.position as to_position
  from public.lanes alt
  join public.lanes happy
    on happy.path_id = k_warm_up_happy
   and happy.name = alt.name
  where alt.path_id = k_warm_up_alternate
    and alt.position is distinct from happy.position;

  select count(*) into v_before from pending_warm_up_lane_positions;
  raise notice
    'A2 before: % Warm-Up alternate-path lane row(s) sit at a different position from the happy path lane of the same name', v_before;

  -- `lanes_path_position_unique` IS deferrable and initially deferred, so the
  -- rows may pass through a duplicate position inside this transaction and
  -- settle before commit. A second lane of the same name on either path would
  -- make the join ambiguous, so that is refused rather than guessed at.
  select string_agg(format('%s x%s', name, n), '; ') into v_detail
    from (
      select l.name, count(*) as n
        from public.lanes l
       where l.path_id in (k_warm_up_happy, k_warm_up_alternate)
       group by l.path_id, l.name
      having count(*) > 1
    ) duplicated;
  if v_detail is not null then
    raise exception
      'A2: a Warm-Up path carries repeated lane names (%), so matching by name is ambiguous. Resolve by hand', v_detail;
  end if;

  update public.lanes l
     set position = p.to_position,
         updated_at = now()
    from pending_warm_up_lane_positions p
   where l.id = p.lane_id;
  get diagnostics v_changed = row_count;

  select count(*) into v_after
    from public.lanes alt
    join public.lanes happy
      on happy.path_id = k_warm_up_happy
     and happy.name = alt.name
   where alt.path_id = k_warm_up_alternate
     and alt.position is distinct from happy.position;

  raise notice
    'A2 after:  % lane row(s) moved, % still out of order (must be 0)', v_changed, v_after;

  if v_after <> 0 then
    raise exception
      'A2: % Warm-Up alternate-path lane row(s) still differ from the happy path order', v_after;
  end if;

  -- ══ B1. Discovery sad path: its own final step, in the step list ══════
  --
  -- The membership row goes in BEFORE the cells move, because
  -- `cells_validate_path_match` refuses a cell whose step is not linked to its
  -- path. `path_steps_path_column_unique` is deferrable, so `…0716` and
  -- `…0717` may both sit at position 6 until B3 removes the first.

  select count(*) into v_before
    from public.path_steps
   where path_id = k_discovery_sad
     and step_id = k_sad_final_step;

  if not exists (select 1 from public.paths where id = k_discovery_sad) then
    raise notice
      'B: the Discovery sad path is not in this database. Sections B1-B3 match nothing and change nothing; the shim has been patching a path that only the in-code fallback supplies';
  end if;

  insert into public.path_steps (path_id, step_id, position)
  select k_discovery_sad, k_sad_final_step, k_sad_final_position
   where exists (select 1 from public.paths where id = k_discovery_sad)
     and exists (select 1 from public.steps where id = k_sad_final_step)
  on conflict (path_id, step_id) do update
     set position = excluded.position;
  get diagnostics v_changed = row_count;

  raise notice
    'B1: sad-path final step … 0717 was in the step list % time(s) before; % row written', v_before, v_changed;

  -- ══ B2. Discovery sad path: outcome cells onto the sad final step ═════

  -- Dropped first so the block may be run twice inside one transaction —
  -- `on commit drop` only fires at commit, and a rehearsal that runs the
  -- repair against a clean board and then against a drifted one needs the
  -- second run to build this table again.
  drop table if exists pending_sad_step_moves;
  create temporary table pending_sad_step_moves on commit drop as
  select c.id as cell_id, c.lane_id, c.position
    from public.cells c
   where c.path_id = k_discovery_sad
     and c.step_id = k_happy_final_step;

  select count(*) into v_before from pending_sad_step_moves;
  raise notice
    'B2 before: % Discovery sad-path cell(s) sit on the HAPPY path final step … 0716', v_before;

  select string_agg(format('%s -> slot (lane %s, step …0717, %s)',
           m.cell_id, m.lane_id, m.position), '; ')
    into v_detail
    from pending_sad_step_moves m
   where exists (
     select 1
       from public.cells occupied
      where occupied.lane_id = m.lane_id
        and occupied.step_id = k_sad_final_step
        and occupied.position = m.position
        and occupied.id <> m.cell_id
   );
  if v_detail is not null then
    raise exception
      'B2: the sad final step already holds a cell in that slot for: %. Resolve by hand — forcing the move would raise 23505 on cells_lane_step_slot_unique', v_detail;
  end if;

  update public.cells c
     set step_id = k_sad_final_step,
         updated_at = now()
    from pending_sad_step_moves m
   where c.id = m.cell_id;
  get diagnostics v_changed = row_count;

  select count(*) into v_after
    from public.cells
   where path_id = k_discovery_sad
     and step_id = k_happy_final_step;

  raise notice
    'B2 after:  % cell(s) moved onto … 0717, % still on … 0716 (must be 0)', v_changed, v_after;

  if v_after <> 0 then
    raise exception
      'B2: % Discovery sad-path cell(s) are still on the happy path final step', v_after;
  end if;

  -- ══ B3. Discovery sad path: drop the happy final step from its list ═══

  select count(*) into v_before
    from public.path_steps
   where path_id = k_discovery_sad
     and step_id = k_happy_final_step;

  delete from public.path_steps
   where path_id = k_discovery_sad
     and step_id = k_happy_final_step;
  get diagnostics v_changed = row_count;

  raise notice
    'B3: happy final step … 0716 was in the sad path step list % time(s); % row(s) removed', v_before, v_changed;

  -- ══ The invariants the shims exist to guarantee ═══════════════════════
  --
  -- Each is vacuously true of a database that does not carry the path, which
  -- is the point: this file succeeds having done nothing rather than asserting
  -- a count only production could satisfy (ADR 0009).

  select count(*) into v_after
    from public.cells c
    join public.lanes l
      on l.path_id = k_warm_up_alternate
     and l.id = ('a0000000-0000-4000-8000-0000000004' || right(c.id::text, 2))::uuid
   where c.path_id = k_warm_up_alternate
     and c.id::text ~ '^a0000000-0000-4000-8000-00000006[0-9]{4}$'
     and right(c.id::text, 2) <> '05'
     and c.lane_id is distinct from l.id;
  if v_after <> 0 then
    raise exception 'invariant: % Warm-Up alternate cell(s) misfiled', v_after;
  end if;

  select count(*) into v_after
    from public.lanes alt
    join public.lanes happy
      on happy.path_id = k_warm_up_happy
     and happy.name = alt.name
   where alt.path_id = k_warm_up_alternate
     and alt.position is distinct from happy.position;
  if v_after <> 0 then
    raise exception 'invariant: % Warm-Up alternate lane(s) out of order', v_after;
  end if;

  select count(*) into v_after
    from public.path_steps
   where path_id = k_discovery_sad
     and step_id = k_happy_final_step;
  if v_after <> 0 then
    raise exception 'invariant: the Discovery sad path still lists the happy final step';
  end if;

  select count(*) into v_after
    from public.cells
   where path_id = k_discovery_sad
     and step_id = k_happy_final_step;
  if v_after <> 0 then
    raise exception 'invariant: % Discovery sad-path cell(s) still on the happy final step', v_after;
  end if;

  -- The one thing this file will not do for you: if the sad path exists and
  -- has no outcome cells at all, the shim was appending them from the in-code
  -- fallback and there is content missing from the database. Reported, never
  -- invented.
  if exists (select 1 from public.paths where id = k_discovery_sad)
     and not exists (
       select 1 from public.cells
        where path_id = k_discovery_sad
          and step_id = k_sad_final_step
     ) then
    raise notice
      'B: the Discovery sad path exists and holds NO cell on its final step … 0717. The shim was supplying those from the in-code fallback. Retiring it will leave that column empty until the seed supabase/seeds/application_discovery_sad_path.sql is run';
  end if;

  raise notice 'repair complete — every invariant the two shims guarantee now holds in the rows';
end
$repair$;
