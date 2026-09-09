-- A dependency can be edited where it sits.
--
-- `set_cell_dependency` upserts on `cell_dependencies_source_target_kind_unique`,
-- which means the things a dependency row shows do NOT edit alike:
--
--     note    the upsert updates it                       — correct
--     kind    a different kind is a different conflict key — INSERTS A SECOND ROW
--     target  a different target is a different key too    — INSERTS A SECOND ROW
--
-- Measured against a from-scratch replay of this series on 2026-09-09, under
-- `set local role authenticated` with a service-account JWT: create one edge,
-- change its note (1 row, same id), change its kind (2 rows), change its
-- target (3 rows). The first row is not updated and not removed — it is
-- orphaned, and the board keeps drawing it.
--
-- The panel is about to let a reader change a row's kind and target where the
-- row already sits, so it needs a write that means "this row, differently".
-- Two calls — clear then set — are not that: they are two transactions, a
-- failure between them destroys the edge, and the ledger gets two entries whose
-- undo only half works.
--
-- WHAT IT RETURNS, and why it is not the id. The row AS IT STOOD, so
-- `authoringRpc` can record an inverse keyed on the dependency's own id: the
-- undo restores THIS row, not a look-alike that happens to join the same two
-- cells. Every identity-keyed inverse in this repository exists for the same
-- reason `add_lane`'s does — a name-keyed one matches whatever wears the name
-- when the undo runs, which is not necessarily what was changed.
--
-- WHY `note` IS AN ARGUMENT AND `name` IS NOT. `note` is the one prose field a
-- dependency has (#550): general purpose, whatever is worth recording about
-- this edge. It has to travel with the kind and the target or a kind change
-- would silently discard it, and it has to come BACK in the returned row or
-- the undo restores an edge with its words missing. `name` is retired by
-- `20260909040000` — it was only ever used as a note, by all eight rows that
-- carried one — so this function neither reads nor writes it. The column
-- survives until stage 2, untouched, which is what makes stage 1 reversible.
--
-- WHY EVERY ARGUMENT IS REQUIRED. On the sibling function every argument
-- defaults to null, and here that would make an omitted argument a silent
-- erase: an `update` that was told nothing about the note would clear it.
-- Required, an omitted argument is a PostgREST "function does not exist" —
-- loud, at the first call, rather than quiet at every one.

CREATE OR REPLACE FUNCTION public.update_cell_dependency(dependency_id uuid, kind text, target_cell_id uuid, note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  previous public.cell_dependencies;
  source_path uuid;
  target_path uuid;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  -- Locked, because every check below is read-then-write: without the lock two
  -- concurrent edits of one row can both pass the uniqueness check and the
  -- second one meets the constraint instead of the message.
  select d.* into previous
    from public.cell_dependencies d
    where d.id = update_cell_dependency.dependency_id
    for update;
  if previous.id is null then
    raise exception 'That connection no longer exists';
  end if;

  -- The same checks `set_cell_dependency` makes, asked of the row's own source
  -- rather than of an argument: this function cannot move an edge's source
  -- end, only where it points and what it is.
  if update_cell_dependency.kind not in ('leads_to', 'enables') then
    raise exception 'Unknown dependency kind %', update_cell_dependency.kind;
  end if;
  if previous.source_cell_id = update_cell_dependency.target_cell_id then
    raise exception 'A cell cannot depend on itself';
  end if;

  select c.path_id into source_path from public.cells c
    where c.id = previous.source_cell_id;
  select c.path_id into target_path from public.cells c
    where c.id = update_cell_dependency.target_cell_id;
  if source_path is null or target_path is null then
    raise exception 'Both cells must exist';
  end if;
  -- Arrows are drawn within one path's grid; a cross-path arrow has nowhere to
  -- render and is what validate_ir.py rejects on import.
  if source_path <> target_path then
    raise exception 'Both cells must be in the same path of the journey';
  end if;

  -- The one check the sibling function does not need, because an upsert
  -- absorbs the collision and this update meets it. Said in the panel's own
  -- words rather than as a constraint name.
  if exists (
    select 1 from public.cell_dependencies d
     where d.source_cell_id = previous.source_cell_id
       and d.target_cell_id = update_cell_dependency.target_cell_id
       and d.kind = update_cell_dependency.kind
       and d.id <> previous.id
  ) then
    raise exception 'That connection already exists';
  end if;

  update public.cell_dependencies d
     set target_cell_id = update_cell_dependency.target_cell_id,
         kind = update_cell_dependency.kind,
         note = nullif(btrim(update_cell_dependency.note), '')
   where d.id = previous.id;

  return jsonb_build_object(
    'id', previous.id,
    'source_cell_id', previous.source_cell_id,
    'target_cell_id', previous.target_cell_id,
    'kind', previous.kind,
    'note', previous.note
  );
end;
$function$;

revoke all on function public.update_cell_dependency(uuid, text, uuid, text) from public;
grant execute on function public.update_cell_dependency(uuid, text, uuid, text)
  to authenticated, service_role;

-- ── THE BEHAVIOUR, PERFORMED ──────────────────────────────────────────────
--
-- Three claims, and none of them can be read off the definition above:
--
--   1. a kind change leaves exactly ONE row, and a target change leaves
--      exactly one — the defect this function exists to fix, and the one a
--      future rewrite back onto the upsert would silently reintroduce;
--   2. `leads_to` and `enables` stay distinguishable ACROSS such a change, so
--      an edge moved between them stops and starts being drawn. `leads_to` is
--      what `BlueprintDependencyArrows` filters on, so this is the data half
--      of the asymmetry the panel renders;
--   3. the returned row is the row AS IT STOOD, which is the only thing that
--      makes the inverse in `authoringRpc` sound — so the undo is performed
--      here, by feeding the return value straight back in.
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

do $edit_in_place$
declare
  svc uuid;
  phase uuid;
  scen uuid;
  pth uuid;
  stp uuid;
  lane_a uuid;
  lane_b uuid;
  lane_c uuid;
  cell_a uuid;
  cell_b uuid;
  cell_c uuid;
  dep uuid;
  before_kind_change jsonb;
  before_target_change jsonb;
  rows_now integer;
  drawn integer;
  final_kind text;
  final_target uuid;
  final_note text;
  done boolean := false;
  msg text;
begin
  begin
    insert into public.services (name, slug)
      values ('issue-550 fixture', 'issue-550-fixture') returning id into svc;
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
    -- Three lanes rather than three cells in one, because a lane and a step
    -- pin a cell's slot: `cells_lane_step_slot_unique` is the grid saying one
    -- cell per square, and the arrows this function edits are drawn BETWEEN
    -- lanes anyway.
    insert into public.lanes (path_id, name, position)
      values (pth, 'fixture lane A', 0) returning id into lane_a;
    insert into public.lanes (path_id, name, position)
      values (pth, 'fixture lane B', 1) returning id into lane_b;
    insert into public.lanes (path_id, name, position)
      values (pth, 'fixture lane C', 2) returning id into lane_c;
    insert into public.cells (path_id, lane_id, step_id, content)
      values (pth, lane_a, stp, 'fixture source') returning id into cell_a;
    insert into public.cells (path_id, lane_id, step_id, content)
      values (pth, lane_b, stp, 'fixture target') returning id into cell_b;
    insert into public.cells (path_id, lane_id, step_id, content)
      values (pth, lane_c, stp, 'fixture other target') returning id into cell_c;

    insert into public.cell_dependencies (source_cell_id, target_cell_id, kind, note)
      values (cell_a, cell_b, 'leads_to', 'the note it arrived with')
      returning id into dep;

    -- An authenticated session holding the service claim, which is what the
    -- app is. `request.jwt.claims` is what `auth.jwt()` reads and therefore
    -- what `is_service_account()` decides on.
    execute 'set local request.jwt.claims = ' ||
      quote_literal('{"role":"authenticated","app_metadata":{"role":"service"}}');
    execute 'set local role authenticated';

    -- 1. A KIND CHANGE. One row before, one row after, the same row.
    before_kind_change :=
      public.update_cell_dependency(dep, 'enables', cell_b, 'the note it arrived with');
    select count(*) into rows_now
      from public.cell_dependencies where source_cell_id = cell_a;
    if rows_now <> 1 then
      raise exception 'a kind change left % rows, expected 1', rows_now;
    end if;

    -- 2. AND THE ASYMMETRY MOVED WITH IT. `leads_to` draws, `enables` does
    -- not; the edge is now the kind that does not draw.
    select count(*) into drawn
      from public.cell_dependencies
     where source_cell_id = cell_a and kind = 'leads_to';
    if drawn <> 0 then
      raise exception 'an edge changed to enables still counts as drawn (% rows)', drawn;
    end if;

    -- 3. A TARGET CHANGE. Still one row, and still the same one.
    before_target_change :=
      public.update_cell_dependency(dep, 'enables', cell_c, 'a different note');
    select count(*) into rows_now
      from public.cell_dependencies where source_cell_id = cell_a;
    if rows_now <> 1 then
      raise exception 'a target change left % rows, expected 1', rows_now;
    end if;
    if not exists (select 1 from public.cell_dependencies where id = dep) then
      raise exception 'the edited row is gone; the edit replaced it rather than changing it';
    end if;

    -- 4. WHAT CAME BACK IS THE ROW AS IT STOOD. Checked on the FIRST call,
    -- because that is the one whose before-state has since been overwritten
    -- twice — a function returning the row as it now stands would agree with
    -- the row on the second call and only disagree here.
    if before_kind_change ->> 'kind' <> 'leads_to'
       or (before_kind_change ->> 'note') <> 'the note it arrived with'
       or (before_kind_change ->> 'id')::uuid <> dep
       or (before_kind_change ->> 'target_cell_id')::uuid <> cell_b then
      raise exception 'the returned row is not the row as it stood: %', before_kind_change;
    end if;

    -- 5. THE UNDO, PERFORMED. The inverse `authoringRpc` records is this
    -- function pointed at the values it returned, so the proof is to feed them
    -- straight back and find the edge where it started — note included, which
    -- is the half a function that did not carry `note` would lose.
    perform public.update_cell_dependency(
      (before_target_change ->> 'id')::uuid,
      before_target_change ->> 'kind',
      (before_target_change ->> 'target_cell_id')::uuid,
      before_target_change ->> 'note');
    perform public.update_cell_dependency(
      (before_kind_change ->> 'id')::uuid,
      before_kind_change ->> 'kind',
      (before_kind_change ->> 'target_cell_id')::uuid,
      before_kind_change ->> 'note');

    select d.kind, d.target_cell_id, d.note
      into final_kind, final_target, final_note
      from public.cell_dependencies d where d.id = dep;
    if final_kind <> 'leads_to' or final_target <> cell_b
       or final_note <> 'the note it arrived with' then
      raise exception
        'undo left the edge as (%, %, %), not where it started', final_kind, final_target, final_note;
    end if;

    select count(*) into drawn
      from public.cell_dependencies
     where source_cell_id = cell_a and kind = 'leads_to';
    if drawn <> 1 then
      raise exception 'after the undo % edges are drawn, expected 1', drawn;
    end if;

    execute 'reset role';
    done := true;
    raise exception using errcode = 'P0001', message = 'issue-550 fixture rollback';
  exception when others then
    execute 'reset role';
    get stacked diagnostics msg = message_text;
    if msg <> 'issue-550 fixture rollback' then raise; end if;
  end;

  if not done then
    raise exception 'the edit-in-place cases never ran';
  end if;
  if exists (select 1 from public.services where slug = 'issue-550-fixture') then
    raise exception 'the issue-550 fixture survived the rollback';
  end if;
end
$edit_in_place$;
