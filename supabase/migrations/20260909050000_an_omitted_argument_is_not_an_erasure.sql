-- An argument nobody sent is not an erasure.
--
-- `set_cell_dependency` upserts, and its `do update` took both prose columns
-- straight off the row it had tried to insert:
--
--     do update set name = excluded.name, note = excluded.note
--
-- Both arguments default to null, so an omitted argument and an argument sent
-- as null arrive identically. A call that says nothing about the words does not
-- leave them alone — it CLEARS them, on an edge that already exists, and
-- reports success by returning the id it did the damage under.
--
-- The comment in `authoringRpc.ts` said the opposite. It reasoned that
-- `setCellDependency` should OMIT `name` rather than send a null, because a
-- null "would ERASE the sentence on any edge an author happens to edit" and
-- "omitting leaves the column alone". The first half was right and the second
-- half was wrong, and the wrapper is written the way the wrong half asked for.
-- It made no difference: what arrives at the function is null either way. The
-- comment is corrected in the same change as this file.
--
-- ── WHO REACHES IT, AND WHAT IS AT STAKE HERE ─────────────────────────────
--
-- The agent tool. `create_cell_dependency` needs a source, a target and a
-- kind; its prose argument is optional. Asked twice for the same edge — a
-- retry, a re-run of a plan, a model connecting two cells it has already
-- connected — the second call is a bare upsert onto the first. Two rows would
-- be a duplicate anybody could see; this leaves one row and two blank fields.
--
-- The panel cannot reach it. `validateDraftDependency` refuses a duplicate
-- before any call is made, and editing an edge in place goes through
-- `update_cell_dependency` (20260909030000), which takes no defaults at all.
-- That is a validation standing between a reader and a defect, which is not
-- the same as the defect not being there.
--
-- What it costs on THIS deployment is more than a blank field.
-- `20260909040000` copied every name that was really a sentence into `note`
-- and left `name` in place, on the stated promise that stage 1 is reversible
-- and stage 2 — the drop — stays a decision somebody makes rather than a
-- consequence of running the backfill. Reversible means the original is still
-- there to go back to. One bare re-run of the agent tool over such an edge
-- takes the copy AND the original in the same statement, and the row that is
-- left cannot say it ever had either.
--
-- ── THE FIX ───────────────────────────────────────────────────────────────
--
--     do update set name = coalesce(excluded.name, cell_dependencies.name),
--                   note = coalesce(excluded.note, cell_dependencies.note)
--
-- An omitted argument means "leave it as it was"; a supplied one still
-- replaces. Nothing else about the function moves.
--
-- BOTH COLUMNS, and the reasoning is not the same twice. It is worth asking of
-- each whether some caller CLEARS by sending null through this function,
-- because for that caller the plain assignment is the correct behaviour and
-- coalescing takes a capability away. Neither column has one:
--
--   name   nothing has written it since `20260909040000` retired it. Every
--          call that reaches this line sends null because the wrapper has
--          stopped sending the argument at all, never to empty the column —
--          and emptying it is precisely what must not happen while stage 1 is
--          still meant to be reversible.
--
--   note   the write that EDITS a note is `update_cell_dependency`, whose
--          arguments are required for exactly this reason: there, an omitted
--          note would be an erase nobody asked for, so it refuses to be
--          omitted and a null means clear. That function keeps the clearing
--          job. This one adds an edge — its recorded inverse is
--          `clear_cell_dependency`, a delete, not a re-set, so no undo replays
--          an earlier null through it either.
--
-- The cost is stated rather than hidden. After this, a null cannot clear
-- either column through this function, and neither can an empty string — the
-- body has always turned `''` into null before the conflict clause, so those
-- two have never been distinguishable here. A caller that must be able to
-- empty a field wants the sibling function, where an omission is a loud
-- "function does not exist" rather than a quiet erase.
--
-- ── WHAT THIS FILE DOES NOT ASSERT ────────────────────────────────────────
--
-- That the previous body cleared. It is provable — it is how the defect was
-- found, and the transcript of that run is in the pull request — but it is a
-- fact about what this repository shipped yesterday, not an invariant of the
-- statement below, and a migration that asserts it refuses to apply to a
-- database that arrived at the fix any other way.
--
-- Nor does it count the rows at risk. Eight is what this table held on one
-- morning; ADR 0009 refuses a census wearing an invariant's clothes, and a
-- file that asserted it could not replay against an empty database. The proof
-- below builds its own edge and is true of every database, forever.

CREATE OR REPLACE FUNCTION public.set_cell_dependency(source_cell_id uuid, target_cell_id uuid, kind text DEFAULT 'leads_to'::text, name text DEFAULT NULL::text, note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  dependency_id uuid;
  source_path uuid;
  target_path uuid;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  if set_cell_dependency.source_cell_id = set_cell_dependency.target_cell_id then
    raise exception 'A cell cannot depend on itself';
  end if;
  if set_cell_dependency.kind not in ('leads_to', 'enables') then
    raise exception 'Unknown dependency kind %', set_cell_dependency.kind;
  end if;

  select c.path_id into source_path from public.cells c
    where c.id = set_cell_dependency.source_cell_id;
  select c.path_id into target_path from public.cells c
    where c.id = set_cell_dependency.target_cell_id;
  if source_path is null or target_path is null then
    raise exception 'Both cells must exist';
  end if;
  -- Arrows are drawn within one path's grid; a cross-path arrow has nowhere to
  -- render and is what validate_ir.py rejects on import.
  if source_path <> target_path then
    raise exception 'Both cells must be in the same path of the journey';
  end if;

  insert into public.cell_dependencies (source_cell_id, target_cell_id, kind, name, note)
  values (set_cell_dependency.source_cell_id, set_cell_dependency.target_cell_id,
          set_cell_dependency.kind,
          nullif(trim(set_cell_dependency.name), ''),
          nullif(trim(set_cell_dependency.note), ''))
  on conflict on constraint cell_dependencies_source_target_kind_unique
    -- An omitted argument leaves the column as it was. Both arguments default
    -- to null, so `excluded.<col>` cannot tell "the caller said nothing" from
    -- "the caller said nothing is there" — and on an edge that already exists,
    -- the first is what every caller means.
    do update set name = coalesce(excluded.name, public.cell_dependencies.name),
                  note = coalesce(excluded.note, public.cell_dependencies.note)
  returning id into dependency_id;

  return dependency_id;
end;
$function$;

-- The grants ride through `create or replace` untouched; a drop would take the
-- ACL with it and the recreate would land on EXECUTE TO PUBLIC. Restated
-- anyway, because they cost nothing and the proof below is run as the role
-- they name — a proof that could not call the function would be reporting on
-- the grant rather than on the body.
revoke all on function public.set_cell_dependency(uuid, uuid, text, text, text) from public;
grant execute on function public.set_cell_dependency(uuid, uuid, text, text, text)
  to authenticated, service_role;

-- ── THE BEHAVIOUR, PERFORMED ──────────────────────────────────────────────
--
-- Three claims, and none of them can be read off the definition above without
-- first believing a reading of `coalesce`:
--
--   1. a call that omits the words leaves them where they were, on the row
--      that was already there — the defect this file exists to close, and the
--      one a future rewrite back onto `excluded.<col>` would reintroduce in
--      silence;
--   2. a call that carries them still replaces them, so the fix did not make
--      the function unable to write the fields it upserts;
--   3. the two columns move independently — the case a reading of `coalesce`
--      that treats the clause as one assignment gets wrong.
--
-- Run under `set local role authenticated` with a service-account JWT, not as
-- the owner. An owner run proves nothing about the grant two statements above,
-- and the restrictive service-account policies on this table match ZERO ROWS
-- SILENTLY under a plain authenticated session — a proof that cannot tell
-- "refused" from "matched nothing" is a proof of nothing. The fixture is built
-- as owner, because building it is not what is being proved.
--
-- The whole block rolls itself back through the sentinel exception, in the
-- shape `20260830180000` established: a migration may prove a thing, and may
-- not leave the rows it proved it with.

do $an_omitted_argument$
declare
  svc uuid;
  phase uuid;
  scen uuid;
  pth uuid;
  stp uuid;
  lane_a uuid;
  lane_b uuid;
  cell_a uuid;
  cell_b uuid;
  dep uuid;
  again uuid;
  rows_now integer;
  v_name text;
  v_note text;
  done boolean := false;
  msg text;
begin
  begin
    insert into public.services (name, slug)
      values ('omitted-argument fixture', 'omitted-argument-fixture') returning id into svc;
    insert into public.phases (service_id, name, position)
      values (svc, 'fixture phase', 0) returning id into phase;
    insert into public.scenarios (phase_id, name, position)
      values (phase, 'fixture scenario', 0) returning id into scen;
    insert into public.paths (scenario_id, name, kind)
      values (scen, 'fixture path', 'happy') returning id into pth;
    insert into public.steps (scenario_id, name)
      values (scen, 'fixture step') returning id into stp;
    insert into public.path_steps (path_id, step_id, position)
      values (pth, stp, 0);
    -- Two lanes rather than two cells in one: `cells_lane_step_slot_unique` is
    -- the grid saying one cell per square.
    insert into public.lanes (path_id, name, position)
      values (pth, 'fixture lane A', 0) returning id into lane_a;
    insert into public.lanes (path_id, name, position)
      values (pth, 'fixture lane B', 1) returning id into lane_b;
    insert into public.cells (path_id, lane_id, step_id, content)
      values (pth, lane_a, stp, 'fixture source') returning id into cell_a;
    insert into public.cells (path_id, lane_id, step_id, content)
      values (pth, lane_b, stp, 'fixture target') returning id into cell_b;

    -- An authenticated session holding the service claim, which is what the
    -- app is. `request.jwt.claims` is what `auth.jwt()` reads and therefore
    -- what `is_service_account()` decides on.
    execute 'set local request.jwt.claims = ' ||
      quote_literal('{"role":"authenticated","app_metadata":{"role":"service"}}');
    execute 'set local role authenticated';

    -- The edge as it stands on the eight rows `20260909040000` touched: a
    -- retired `name` still holding the author's sentence, and the copy of it
    -- in `note` that made the copy reversible.
    dep := public.set_cell_dependency(
      cell_a, cell_b, 'leads_to', 'the sentence as authored', 'the sentence as copied');

    -- 1. THE BARE RE-RUN. Exactly what the agent tool sends when it is asked
    -- for an edge that already exists and given nothing to say about it.
    again := public.set_cell_dependency(cell_a, cell_b, 'leads_to');
    if again <> dep then
      raise exception 'the re-run wrote a different row (% then %)', dep, again;
    end if;
    select count(*) into rows_now
      from public.cell_dependencies where source_cell_id = cell_a;
    if rows_now <> 1 then
      raise exception 'the re-run left % rows, expected 1', rows_now;
    end if;

    select d.name, d.note into v_name, v_note
      from public.cell_dependencies d where d.id = dep;
    if v_name is distinct from 'the sentence as authored' then
      raise exception 'an omitted name erased the retired column (now %)',
        coalesce(v_name, '<null>');
    end if;
    if v_note is distinct from 'the sentence as copied' then
      raise exception 'an omitted note erased the note (now %)',
        coalesce(v_note, '<null>');
    end if;

    -- 2. AND A SUPPLIED ARGUMENT STILL REPLACES. A function that preserved
    -- everything would pass the assertions above and be useless.
    perform public.set_cell_dependency(
      cell_a, cell_b, 'leads_to', 'a second name', 'a second note');
    select d.name, d.note into v_name, v_note
      from public.cell_dependencies d where d.id = dep;
    if v_name is distinct from 'a second name' or v_note is distinct from 'a second note' then
      raise exception 'a supplied argument no longer replaces (%, %)',
        coalesce(v_name, '<null>'), coalesce(v_note, '<null>');
    end if;

    -- 3. ONE AT A TIME. The note moves and the retired column stays put, which
    -- is the shape every call the app now makes actually has.
    perform public.set_cell_dependency(
      cell_a, cell_b, 'leads_to', null, 'a third note');
    select d.name, d.note into v_name, v_note
      from public.cell_dependencies d where d.id = dep;
    if v_name is distinct from 'a second name' or v_note is distinct from 'a third note' then
      raise exception 'one column moved and took the other with it (%, %)',
        coalesce(v_name, '<null>'), coalesce(v_note, '<null>');
    end if;

    execute 'reset role';
    done := true;
    raise exception using errcode = 'P0001',
      message = 'omitted-argument fixture rollback';
  exception when others then
    execute 'reset role';
    get stacked diagnostics msg = message_text;
    if msg <> 'omitted-argument fixture rollback' then raise; end if;
  end;

  if not done then
    raise exception 'the omitted-argument cases never ran';
  end if;
  if exists (select 1 from public.services where slug = 'omitted-argument-fixture') then
    raise exception 'the omitted-argument fixture survived the rollback';
  end if;
end
$an_omitted_argument$;
