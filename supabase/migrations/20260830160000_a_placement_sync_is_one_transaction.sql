-- Syncing a cell's placements has to be one transaction, and it was not.
--
-- The client did the diff and then issued a statement per row: a delete per
-- removed name, an update per moved one, an upsert and an insert per added
-- one. PostgREST gives each of those its own transaction, and that breaks a
-- reorder outright.
--
-- `cell_touchpoints_cell_position_unique` is DEFERRABLE INITIALLY DEFERRED,
-- which defers the check to COMMIT — and with a statement per request, commit
-- is the end of that statement. So swapping two positions fails on the first
-- update. Reproduced against this database before writing:
--
--     update ... set position = 2 where name = 'A';
--     ERROR:  duplicate key value violates unique constraint
--     DETAIL:  Key (cell_id, "position")=(..., 2) already exists.
--
-- Production is temporarily immune because no cell holds two touchpoints in
-- an order anyone has changed, but an author typing "A, B" and then "B, A"
-- reaches it immediately. The unit test covering reordering asserted the
-- PLAN, never its application, so it passed throughout.
--
-- Moving the whole diff in here fixes three things at once: the deferred
-- constraint gets the transaction it was always written for, a failure
-- half-way can no longer leave the placements disagreeing with the text the
-- same save just wrote, and the per-row round-trips collapse to one call.
--
-- ── Why it returns the placements it removed ───────────────────────────────
--
-- Deleting a placement destroys its summary, screenshot and url — the
-- per-moment writing this whole ticket exists to protect. The caller records
-- an inverse for the content edit, and until now that inverse restored the
-- TEXT and silently left the writing gone. So the removed rows come back to
-- the caller, which puts them in the revert, and `restore_cell_touchpoints`
-- below puts them back.

create or replace function public.sync_cell_touchpoints(
  p_cell_id uuid,
  p_names   text[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_service_id uuid;
  v_lane_role  text;
  v_bearing    boolean;
  v_removed    jsonb;
  v_wanted     jsonb;
begin
  select ph.service_id, ln.lane_role
    into v_service_id, v_lane_role
    from public.cells c
    join public.lanes ln on ln.id = c.lane_id
    join public.paths p on p.id = c.path_id
    join public.scenarios s on s.id = p.scenario_id
    join public.phases ph on ph.id = s.phase_id
   where c.id = p_cell_id;

  if v_service_id is null then
    raise exception 'cell % is not attached to a service', p_cell_id;
  end if;

  -- Only touchpoint-bearing cells. `cells.content` on an actor lane is a
  -- sentence about what somebody did, and syncing it would file that
  -- sentence in the catalog as a tool.
  select v_lane_role in ('frontstage_touchpoints', 'backstage_touchpoints')
         or exists (select 1 from public.cell_touchpoints where cell_id = p_cell_id)
    into v_bearing;

  if not v_bearing then
    return jsonb_build_object('skipped', true, 'removed', '[]'::jsonb);
  end if;

  -- The names as given, de-duplicated, keeping the first position each took.
  -- A name typed twice is one touchpoint: `unique (cell_id, touchpoint_id)`
  -- would reject the second anyway.
  --
  -- Held as jsonb in a variable rather than a temporary table. A temp table
  -- declared `on commit drop` lives until the TRANSACTION commits, not until
  -- the function returns, so two calls in one transaction — which is exactly
  -- what the reorder proof at the bottom of this file does — collide on the
  -- second `create`.
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'position', position)), '[]'::jsonb)
    into v_wanted
    from (
      select name, min(ord)::int as position
        from unnest(p_names) with ordinality as t(name, ord)
       where btrim(name) <> ''
       group by name
    ) deduped;

  -- Catalog rows for names this service has not seen. `app`, not `import`:
  -- the distinction is which side authored it.
  insert into public.touchpoints (service_id, name, origin)
  select v_service_id, w.name, 'app'
    from jsonb_to_recordset(v_wanted) as w(name text, position int)
  on conflict (service_id, name) do nothing;

  -- Removed rows, captured BEFORE the delete so the caller can restore them.
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', tp.name,
           'position', ct.position,
           'summary', ct.summary,
           'screenshot', ct.screenshot,
           'url', ct.url,
           'prominence', ct.prominence
         )), '[]'::jsonb)
    into v_removed
    from public.cell_touchpoints ct
    join public.touchpoints tp on tp.id = ct.touchpoint_id
   where ct.cell_id = p_cell_id
     and tp.name not in (
       select w.name from jsonb_to_recordset(v_wanted) as w(name text, position int)
     );

  delete from public.cell_touchpoints ct
   using public.touchpoints tp
   where ct.touchpoint_id = tp.id
     and ct.cell_id = p_cell_id
     and tp.name not in (
       select w.name from jsonb_to_recordset(v_wanted) as w(name text, position int)
     );

  -- Kept names are REPOSITIONED, never deleted and re-added, so an author's
  -- writing survives a reorder. This is the statement that needed the
  -- transaction: mid-update the positions collide, and the deferred
  -- constraint only forgives that until commit.
  update public.cell_touchpoints ct
     set position = w.position,
         updated_at = now()
    from public.touchpoints tp,
         jsonb_to_recordset(v_wanted) as w(name text, position int)
   where ct.touchpoint_id = tp.id
     and ct.cell_id = p_cell_id
     and tp.name = w.name
     and ct.position is distinct from w.position;

  insert into public.cell_touchpoints (cell_id, touchpoint_id, position, origin)
  select p_cell_id, tp.id, w.position, 'app'
    from jsonb_to_recordset(v_wanted) as w(name text, position int)
    join public.touchpoints tp
      on tp.service_id = v_service_id and tp.name = w.name
   where not exists (
     select 1 from public.cell_touchpoints ct
      where ct.cell_id = p_cell_id and ct.touchpoint_id = tp.id
   );

  return jsonb_build_object('skipped', false, 'removed', v_removed);
end
$function$;

-- Putting back what a removed placement was carrying.
--
-- Restores detail onto placements that already exist, which is the state the
-- caller is in after replaying a content edit: the names are back because
-- the text is back, and only the writing is missing.

create or replace function public.restore_cell_touchpoints(
  p_cell_id uuid,
  p_rows    jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $function$
begin
  update public.cell_touchpoints ct
     set summary    = r.summary,
         screenshot = r.screenshot,
         url        = r.url,
         prominence = r.prominence,
         updated_at = now()
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
           as r(name text, summary text, screenshot text, url text, prominence text),
         public.touchpoints tp
   where ct.touchpoint_id = tp.id
     and ct.cell_id = p_cell_id
     and tp.name = r.name;
end
$function$;

grant execute on function public.sync_cell_touchpoints(uuid, text[]) to authenticated;
grant execute on function public.restore_cell_touchpoints(uuid, jsonb) to authenticated;

-- ── Prove the reorder that used to fail ───────────────────────────────────
--
-- The bug was invisible to a unit test because the plan it produced was
-- right; only applying it failed. So it is exercised here, against the real
-- constraint, on rows this block creates and removes. Vacuous on an empty
-- database in the sense that matters — it builds everything it needs — and
-- it fails loudly if the deferred constraint stops covering the swap.

do $do$
declare
  v_cell uuid;
  v_first text;
begin
  select c.id into v_cell
    from public.cells c
    join public.lanes ln on ln.id = c.lane_id
   where ln.lane_role in ('frontstage_touchpoints', 'backstage_touchpoints',
                          'frontstage_tech', 'backstage_tech')
   limit 1;

  if v_cell is null then
    raise notice 'no touchpoint cell exists, so the reorder proof has nothing to run against';
    return;
  end if;

  perform public.sync_cell_touchpoints(v_cell, array['ZZ Probe A', 'ZZ Probe B']);
  -- The swap. Before this function existed, this raised 23505.
  perform public.sync_cell_touchpoints(v_cell, array['ZZ Probe B', 'ZZ Probe A']);

  select tp.name into v_first
    from public.cell_touchpoints ct
    join public.touchpoints tp on tp.id = ct.touchpoint_id
   where ct.cell_id = v_cell and ct.position = 1;

  if v_first <> 'ZZ Probe B' then
    raise exception 'reorder did not take: position 1 holds %', v_first;
  end if;

  delete from public.cell_touchpoints ct
   using public.touchpoints tp
   where ct.touchpoint_id = tp.id
     and ct.cell_id = v_cell
     and tp.name like 'ZZ Probe %';
  delete from public.touchpoints where name like 'ZZ Probe %';
end
$do$;

-- ── Prove an ordinary cell is left alone ──────────────────────────────────
--
-- The gate used to live in TypeScript, where a test could watch it. It lives
-- in the function now, so this is the only place that can still show it
-- holds — and it is worth showing, because the first version of the gate was
-- missing and the client tests caught it: `cells.content` on an actor lane is
-- a sentence about what somebody did, and syncing it would file that
-- sentence in the catalog as a tool.

do $do$
declare
  v_cell uuid;
  v_result jsonb;
  v_leaked int;
begin
  select c.id into v_cell
    from public.cells c
    join public.lanes ln on ln.id = c.lane_id
   where coalesce(ln.lane_role, '') not in
         ('frontstage_touchpoints', 'backstage_touchpoints',
          'frontstage_tech', 'backstage_tech')
     and not exists (select 1 from public.cell_touchpoints where cell_id = c.id)
   limit 1;

  if v_cell is null then
    raise notice 'no ordinary cell exists, so the skip proof has nothing to run against';
    return;
  end if;

  v_result := public.sync_cell_touchpoints(
    v_cell, array['The tutor greets the student and checks the goal list']);

  if (v_result ->> 'skipped') <> 'true' then
    raise exception 'an ordinary cell was synced instead of skipped';
  end if;

  select count(*) into v_leaked
    from public.touchpoints
   where name = 'The tutor greets the student and checks the goal list';
  if v_leaked <> 0 then
    raise exception 'a sentence was filed in the touchpoint catalog';
  end if;
end
$do$;
