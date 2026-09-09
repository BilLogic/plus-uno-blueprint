-- An upsert says which half it took, and its undo stops guessing.
--
-- `set_cell_dependency` upserts. Landing on a pair that is already connected
-- it UPDATES that row and hands back its id — the same id, in the same shape,
-- as the one it returns when it inserts. Nothing downstream can tell the two
-- apart, and one thing downstream has to: the ledger derives this write's
-- inverse from the operation's NAME, and the name says "connected two cells",
-- so the inverse it records is a delete.
--
-- On the insert half that is exact. On the update half it is destruction
-- dressed as an undo: the edge was there before the write, the write only
-- changed its words, and taking the write back removes the edge entirely.
-- Pressing undo leaves the author worse off than not pressing it.
--
-- ── WHO REACHES IT ────────────────────────────────────────────────────────
--
-- The agent tool. `create_cell_dependency` on a pair the blueprint already
-- connects is a bare upsert onto an existing row — a retry, a re-run of a
-- plan, a model connecting two cells it has connected already. The panel
-- cannot: its add form refuses a duplicate before any call is made, and its
-- edits go through `update_cell_dependency`, which is addressed by row and has
-- carried a working inverse since it was written. So this is an agent-only
-- path, which is the worst kind. The write is made by a machine, in a batch,
-- on rows a person has often already read, and the undo that follows is a
-- person's.
--
-- It compounds with how the undo picks its target. The session sheet offers
-- the newest entry that captured an inverse, so a person reaching for "take
-- back what the agent just did" can reach past their own last edit and delete
-- an edge neither they nor the agent created in that session.
--
-- ── THE FIX, AND WHY IT IS HERE AND NOT IN THE TOOL ───────────────────────
--
-- The inverse must depend on what the write DID, not on what it is called. So
-- the write says what it did.
--
-- The cheaper fix is to narrow the tool — refuse to upsert onto an existing
-- edge and point at the update instead. That is what the cell upsert's tool
-- does, and the reason not to repeat it here is visible in that guard: it is a
-- read followed by a write, so it is a race; it defends one caller, so the
-- next caller has to remember it; and it leaves the ledger deriving a delete
-- from a name, which is the thing that is actually wrong. A guard standing
-- between a caller and a defect is not the same as the defect not being there.
--
-- ── WHAT THE FUNCTION NOW RETURNS ─────────────────────────────────────────
--
--     { "id": uuid, "inserted": boolean, "previous": {…} | null }
--
--   id         the row written, either half. What every existing caller read
--              off the old `uuid` return, now under a name.
--   inserted   which half the upsert took, read from the written row's `xmax`
--              — zero exactly when this statement inserted it.
--   previous   the row AS IT STOOD, captured before the write and locked, or
--              null when there was nothing there. Keyed on the row's own id,
--              for the same reason `update_cell_dependency` returns what it
--              returns: an inverse keyed on (source, target, kind) restores
--              *a* row joining those two cells, which after a second write is
--              not the same thing.
--
-- `previous` is null whenever `inserted` is true, and it can ALSO be null when
-- `inserted` is false: another session inserting the row between the capture
-- and the upsert leaves this call updating a row it never saw. That is a state
-- the caller must be able to see, because the honest answer to it is to offer
-- no undo at all rather than an approximate one — which is what the ledger
-- already does with the deletes.
--
-- ── WHY THE RETURN TYPE MOVES, AND WHAT THAT COSTS ────────────────────────
--
-- A `uuid` cannot carry two more facts, and Postgres will not let `create or
-- replace` change a return type. So the function is dropped and recreated,
-- which takes its ACL with it — the thing `20260909050000` was careful to
-- avoid, and the reason the grants below are not a restatement this time but a
-- repair. The anon revoke is restated too, and has to be: on this platform a
-- freshly created function picks up the default privileges, which include
-- `anon`, so `revoke … from public` alone would leave the anonymous reader
-- holding EXECUTE on a write.
--
-- The signature is byte-identical, so every caller's ARGUMENTS are unaffected
-- — over PostgREST too, which resolves by argument name. What changes is what
-- comes back, and the two readers of that are the panel's add form, which
-- ignores it, and the agent tool, which quotes the id.
--
-- ── THE OTHER HALF: A ROW CAN BE PUT BACK ─────────────────────────────────
--
-- Knowing the upsert updated is only half an undo; the other half needs an
-- operation that restores what the update overwrote. `restore_cell_dependency`
-- is that operation and nothing else.
--
-- It is not `update_cell_dependency` wearing another name, and the difference
-- is the job. That one is the panel's EDIT: it moves an edge's kind and its
-- target, so it revalidates the pair, takes a lock, and refuses a change that
-- would collide with an edge that already exists. This one is an UNDO: it puts
-- two prose columns back on one row that is already where it was, so there is
-- nothing to revalidate — the state it writes is a state the row itself held.
-- It also writes `name`, which `update_cell_dependency` deliberately does not,
-- and has to: `set_cell_dependency` still declares that argument, so the half
-- being undone can still have changed it.
--
-- It ASSIGNS rather than coalescing, which is the whole point: the case the
-- agent actually causes is an edge that had no note being given one, and an
-- inverse that cannot write a null cannot undo that. `20260909050000` made the
-- forward function coalesce, deliberately, so an omitted argument is not an
-- erasure — the two rules are opposite because the two jobs are. One is told
-- what to add; the other is told what was there.
--
-- And it does not trim. Every other write into these columns trims on the way
-- in, so a value that reaches this function has already been trimmed by
-- whatever wrote it — except an imported row, which the pipeline writes
-- directly. A restore that trimmed would quietly rewrite such a row on the way
-- back rather than putting it back.
--
-- A zero-row update is a failure and says so. There is no state in which the
-- undo of an edit to a row that still exists matches nothing, so matching
-- nothing means the row is gone and the caller is owed the sentence.

drop function if exists public.set_cell_dependency(uuid, uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.set_cell_dependency(source_cell_id uuid, target_cell_id uuid, kind text DEFAULT 'leads_to'::text, name text DEFAULT NULL::text, note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  previous public.cell_dependencies;
  dependency_id uuid;
  was_inserted boolean;
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

  -- BEFORE the write, and locked. The lock is what stops a concurrent edit of
  -- the same edge from landing between this read and the upsert and leaving
  -- the caller holding a `previous` that was never true.
  select d.* into previous
    from public.cell_dependencies d
   where d.source_cell_id = set_cell_dependency.source_cell_id
     and d.target_cell_id = set_cell_dependency.target_cell_id
     and d.kind = set_cell_dependency.kind
   for update;

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
  -- `xmax` is zero on a row this statement inserted and the updating
  -- transaction's id on a row it updated. It is the write's own account of
  -- which half it took, which is the one account nothing else can second-guess
  -- after the fact.
  returning id, (xmax = 0) into dependency_id, was_inserted;

  return jsonb_build_object(
    'id', dependency_id,
    'inserted', was_inserted,
    'previous',
    case
      when was_inserted or previous.id is null then null
      else jsonb_build_object(
        'id', previous.id,
        'source_cell_id', previous.source_cell_id,
        'target_cell_id', previous.target_cell_id,
        'kind', previous.kind,
        'name', previous.name,
        'note', previous.note)
    end);
end;
$function$;

CREATE OR REPLACE FUNCTION public.restore_cell_dependency(dependency_id uuid, name text, note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  update public.cell_dependencies d
     set name = restore_cell_dependency.name,
         note = restore_cell_dependency.note
   where d.id = restore_cell_dependency.dependency_id;

  if not found then
    raise exception 'That connection no longer exists';
  end if;
end;
$function$;

-- The recreate above landed on this platform's default privileges, which grant
-- EXECUTE to PUBLIC and to `anon`. Both are taken away and the two roles that
-- may call an authoring write are named, which is what the drop cost and what
-- `20260731004000` established for every function on this surface.
revoke all on function public.set_cell_dependency(uuid, uuid, text, text, text) from public;
revoke execute on function public.set_cell_dependency(uuid, uuid, text, text, text) from anon;
grant execute on function public.set_cell_dependency(uuid, uuid, text, text, text)
  to authenticated, service_role;

revoke all on function public.restore_cell_dependency(uuid, text, text) from public;
revoke execute on function public.restore_cell_dependency(uuid, text, text) from anon;
grant execute on function public.restore_cell_dependency(uuid, text, text)
  to authenticated, service_role;

-- ── THE BEHAVIOUR, PERFORMED ──────────────────────────────────────────────
--
-- Four claims, none of them readable off the definitions above:
--
--   1. the first call INSERTS and says so, and offers no previous — the half
--      whose inverse has always been a delete, and still is;
--   2. the second call on the same pair UPDATES and says so, and hands back
--      the row as it stood — the half whose inverse was a delete and is now a
--      restore;
--   3. the previous it hands back is the row BEFORE this write, not after:
--      checked on a call that overwrites a note, where a function returning
--      the row as it now stands would agree with the row and only disagree
--      here;
--   4. the undo, performed. Feeding that previous back through
--      `restore_cell_dependency` puts the words back, INCLUDING back to null
--      — the case an inverse built out of the forward function cannot express,
--      and the case the agent actually causes.
--
-- And the edge is counted throughout, because the defect this file closes is
-- an edge that stops existing: one row before the undo, one row after.
--
-- Run under `set local role authenticated` with a service-account JWT, not as
-- the owner. An owner run proves nothing about the grants above, and the
-- restrictive service-account policies on this table match ZERO ROWS SILENTLY
-- under a plain authenticated session — a proof that cannot tell "refused"
-- from "matched nothing" is a proof of nothing. The fixture is built as owner,
-- because building it is not what is being proved.
--
-- The whole block rolls itself back through the sentinel exception, in the
-- shape `20260830180000` established: a migration may prove a thing, and may
-- not leave the rows it proved it with. Nothing here touches a row it did not
-- create.

do $which_half$
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
  first_write jsonb;
  second_write jsonb;
  dep uuid;
  rows_now integer;
  v_name text;
  v_note text;
  done boolean := false;
  msg text;
begin
  begin
    insert into public.services (name, slug)
      values ('which-half fixture', 'which-half-fixture') returning id into svc;
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
    -- the grid saying one cell per square, and the arrows this function writes
    -- are drawn BETWEEN lanes anyway.
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

    -- 1. THE INSERT HALF. An edge that did not exist, added with no words on
    -- it — which is the state the agent's second call then overwrites.
    first_write := public.set_cell_dependency(cell_a, cell_b, 'leads_to');
    if (first_write ->> 'inserted') is distinct from 'true' then
      raise exception 'the first call did not report an insert: %', first_write;
    end if;
    if first_write -> 'previous' <> 'null'::jsonb then
      raise exception 'the insert half reported a previous row: %', first_write;
    end if;
    dep := (first_write ->> 'id')::uuid;

    -- 2. THE UPDATE HALF. The agent's `create_cell_dependency` on a pair that
    -- is already connected, carrying a label.
    second_write := public.set_cell_dependency(
      cell_a, cell_b, 'leads_to', null, 'the sentence the agent wrote');
    if (second_write ->> 'inserted') is distinct from 'false' then
      raise exception 'the second call did not report an update: %', second_write;
    end if;
    if (second_write ->> 'id')::uuid <> dep then
      raise exception 'the second call wrote a different row (% then %)',
        dep, second_write ->> 'id';
    end if;
    select count(*) into rows_now
      from public.cell_dependencies where source_cell_id = cell_a;
    if rows_now <> 1 then
      raise exception 'the second call left % rows, expected 1', rows_now;
    end if;

    -- 3. AND WHAT IT HANDED BACK IS THE ROW AS IT STOOD. The note is null
    -- there and is not null on the row now, which is the disagreement a
    -- function returning the row as it NOW stands could not produce.
    if (second_write -> 'previous' ->> 'id')::uuid <> dep then
      raise exception 'the previous row is not the row that was written: %', second_write;
    end if;
    if second_write -> 'previous' ->> 'note' is not null then
      raise exception 'the previous row carries a note it never had: %', second_write;
    end if;
    select d.note into v_note from public.cell_dependencies d where d.id = dep;
    if v_note is distinct from 'the sentence the agent wrote' then
      raise exception 'the write did not land (note is now %)', coalesce(v_note, '<null>');
    end if;

    -- 4. THE UNDO, PERFORMED — as the ledger performs it, by feeding the
    -- previous row straight into the restore. Back to null, which is the
    -- assignment the forward function's coalesce cannot express.
    perform public.restore_cell_dependency(
      (second_write -> 'previous' ->> 'id')::uuid,
      second_write -> 'previous' ->> 'name',
      second_write -> 'previous' ->> 'note');
    select d.name, d.note into v_name, v_note
      from public.cell_dependencies d where d.id = dep;
    if v_name is not null or v_note is not null then
      raise exception 'the undo left words behind (%, %)',
        coalesce(v_name, '<null>'), coalesce(v_note, '<null>');
    end if;

    -- THE WHOLE POINT. The edge the agent found is the edge the author still
    -- has. Under the derivation this file replaces, the undo above was a
    -- delete and this count was zero.
    select count(*) into rows_now
      from public.cell_dependencies where source_cell_id = cell_a;
    if rows_now <> 1 then
      raise exception 'after the undo % edges remain, expected 1', rows_now;
    end if;

    -- 5. AND A RESTORE OF A ROW THAT IS GONE SAYS SO. A zero-row write is a
    -- failure here, not a quiet success, which is what lets the caller tell an
    -- undo that worked from one that matched nothing.
    begin
      perform public.restore_cell_dependency(
        gen_random_uuid(), null, 'never written');
      raise exception 'restoring a row that does not exist was accepted';
    exception when others then
      get stacked diagnostics msg = message_text;
      if msg <> 'That connection no longer exists' then raise; end if;
    end;

    execute 'reset role';
    done := true;
    raise exception using errcode = 'P0001',
      message = 'which-half fixture rollback';
  exception when others then
    execute 'reset role';
    get stacked diagnostics msg = message_text;
    if msg <> 'which-half fixture rollback' then raise; end if;
  end;

  if not done then
    raise exception 'the which-half cases never ran';
  end if;
  if exists (select 1 from public.services where slug = 'which-half-fixture') then
    raise exception 'the which-half fixture survived the rollback';
  end if;
end
$which_half$;
