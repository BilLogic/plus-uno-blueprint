-- Nine function bodies still name columns and a constraint that were renamed
-- out from under them. Recreated here from corrected definitions.
--
-- 20260820140000 renamed `paths.service_scenario_id` and
-- `steps.service_scenario_id` to `scenario_id`, and swept the function
-- catalogue afterwards. The sweep selected its victims with
--
--   pg_get_functiondef(p.oid) ~ '\mservice_scenarios?\M'
--
-- and `_` is a word constituent in a Postgres regular expression. There is no
-- word boundary between `service_scenario` and `_id`, so `\M` cannot match
-- there and the pattern only ever finds a body naming the bare TABLE. The
-- replacement two lines below it — `\mservice_scenario_id\M` → `scenario_id` —
-- was written correctly for a case the selection never delivered.
--
-- Seven bodies named the table, seven were rewritten, and the migration closed
-- with `if n <> 7 then raise`. Seven was not a fact about the schema; it was
-- the number of rows the too-narrow regex had returned. The assertion measured
-- the loop against itself and could not have failed.
--
-- Eight bodies name `service_scenario_id` to this day, and a ninth carries an
-- unrelated corpse from the cell_triggers → cell_dependencies rename, which
-- swept with `\mcell_triggers\M` and for the same reason could not see
-- `cell_triggers_source_target_kind_unique`:
--
--   add_lane            where p.service_scenario_id = add_lane.scenario_id
--   add_step            insert into public.steps (service_scenario_id, …)
--   create_path         insert into public.paths (service_scenario_id, …)
--   delete_path         where p.service_scenario_id = (select … )
--   duplicate_path      select p.service_scenario_id into scenario_id
--   remove_lane         where p.service_scenario_id = remove_lane.scenario_id
--   rename_path         select service_scenario_id from public.paths
--   reorder_lanes       and p.service_scenario_id = reorder_lanes.scenario_id
--   set_cell_dependency on conflict on constraint
--                       cell_triggers_source_target_kind_unique
--
-- plpgsql resolves names when a statement runs, not when the function is
-- created, so `create function` accepted all nine and each raises 42703 (or
-- 42704 for the constraint) the first time it is called. This is deterministic:
-- every database that replays the series lands here. Production is not
-- specially broken.
--
-- BLAST RADIUS — dormant, not live, and the reason is the tier guard.
--
-- `src/lib/authoringRpc.ts` is the single owner of the structural write path
-- and it wraps all nine. Seven have live call sites in the app:
--
--   add_step             BlueprintColumnHandles      · agent add_step
--   add_lane             BlueprintLaneHandles        · agent add_lane
--   set_cell_dependency  CellDependencyEditor        · agent set_cell_dependency
--   create_path          CreateVersionDialog         · agent create_path
--   duplicate_path       CreateVersionDialog, StructureRowMenu · agent
--   rename_path          StructureRowMenu            · agent rename_path
--   delete_path          DeleteStructureDialog       · app only
--
-- The remaining two reach no surface at all. `reorder_lanes` and `remove_lane`
-- have no caller outside authoringRpc.ts: `remove_lane` survives only as
-- `add_lane`'s fallback inverse in `deriveRevert`, and that fallback is dead
-- against any database carrying 20260807130000 — add_lane returns ids there,
-- so the identity-keyed `remove_lanes` wins. It is also unreachable in
-- practice for a second reason: add_lane raises before `call()` records
-- anything, so there is no ledger row to revert.
--
-- So why has nobody hit it since 2026-08-20? Because every one of the nine
-- opens with the `is_service_account()` guard that 20260805170000 injected,
-- and 20260731004000 left `authenticated` as the only role holding EXECUTE.
-- The deployed site ships the anon key and has no sign-in, so a visitor is
-- refused with 42501 before a single statement of the body is parsed. The dead
-- column is only reachable by a service-tier writer: a dev server holding
-- VITE_SUPABASE_DEV_SERVICE_KEY or a dev sign-in, or the map skill with the
-- service key. Every commit on this repo since the rename landed has been
-- canvas, tokens, sidebar, settings, arrows and slices — rendering work and
-- one slice rename, which writes through sliceMutations and not through any of
-- these. Nothing has added a column, a lane, an arrow or a version since the
-- day the rename shipped, which is exactly how long the break has been sitting
-- there.
--
-- Dormant, then, and one authoring session away from being a live outage that
-- takes out most of design mode at once. Cell text editing would keep working
-- (upsert_cell was repaired by 20260821370000) while every structural
-- affordance around it raised — which is the confusing shape of failure this
-- fixes before anyone has to diagnose it.
--
-- WHAT THIS MIGRATION DOES NOT DO: sweep. A regex sweep over
-- pg_get_functiondef is what produced the bug, twice. Each of the nine is
-- recreated here from an explicit definition, reconstructed by walking the
-- series forward from its last hand-written form and applying every
-- intervening rewrite: the tier guard (20260805170000), layers → lanes
-- (20260820120000/120100), the position columns (20260820130000/130100),
-- description → summary on paths and cells (20260820080000/090000),
-- cell_triggers → cell_dependencies (20260820100000) and the two kind renames
-- (20260820110000, 20260820180000). Signatures, return types, SECURITY
-- DEFINER, search_path and every guard are preserved exactly, and the block at
-- the end proves it — a changed argument type would create a second overload
-- with Postgres's default PUBLIC grant instead of replacing the broken one,
-- which is a security regression wearing a repair's clothes.
--
-- THREE PLACES WHERE THE RENAME CREATED A NEW AMBIGUITY, and correcting the
-- identifier alone is not enough. `paths` now has a column named exactly what
-- a nearby parameter or variable is named, and plpgsql's default
-- variable_conflict is `error`:
--
--   add_step        `select service_scenario_id … from public.paths` becomes
--                   `select p.scenario_id … from public.paths p`; unqualified
--                   it would now collide with the local `scenario_id`.
--   create_path     `where service_scenario_id = scenario_id` becomes
--                   `where p.scenario_id = create_path.scenario_id`; both
--                   sides were the same word.
--   duplicate_path  the insert's select list took the bare variable; it now
--                   reads `p.scenario_id` from the source row it is already
--                   joined to, which is the same value by construction.
--
-- Unqualified names inside `insert … values (…)` are left alone. The target
-- table's columns are not in scope for a VALUES expression, so the bare name
-- unambiguously means the parameter — the point 20260731005000 established
-- when it fixed the conflict targets and deliberately left the VALUES lists.
--
-- Acceptance: the assertion at the foot of this file. Run it against
-- production BEFORE applying the DDL above it and it names all nine; run it
-- after and it returns silently. It compares every function body against
-- information_schema.columns and pg_constraint — against the schema, which is
-- the one thing a body can be wrong about.

-- ---------------------------------------------------------------------------
-- Capture what must not change.
-- ---------------------------------------------------------------------------

-- Session-scoped, and dropped by hand at the foot of this file rather than
-- `on commit drop`: applied outside an explicit transaction, the commit that
-- ends the CREATE statement would take the table with it and every check
-- below would fail on a missing relation instead of on what it measures.
create temporary table _acl_before as
select p.proname,
       pg_get_function_identity_arguments(p.oid) as ident,
       coalesce(p.proacl::text, '') as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('add_lane','add_step','create_path','delete_path',
                    'duplicate_path','remove_lane','rename_path',
                    'reorder_lanes','set_cell_dependency');

do $do$
declare n int;
begin
  select count(*) into n from _acl_before;
  if n <> 9 then
    raise exception 'expected nine functions to repair, found % — this database is not the one this migration was written against', n;
  end if;
end
$do$;

-- ---------------------------------------------------------------------------
-- Columns (steps)
-- ---------------------------------------------------------------------------

/** Insert a column at `at_position`, shifting everything after it right. */
create or replace function public.add_step(
  path_id uuid,
  name text,
  at_position int default null
)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  scenario_id uuid;
  new_step_id uuid;
  target int;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  select p.scenario_id into scenario_id
  from public.paths p where p.id = add_step.path_id;
  if scenario_id is null then
    raise exception 'Unknown version';
  end if;

  select coalesce(max(position) + 1, 0) into target
  from public.path_steps where path_steps.path_id = add_step.path_id;
  target := coalesce(at_position, target);

  -- Deferred unique constraint makes the shift and the insert one safe step.
  update public.path_steps
    set position = position + 1
    where path_steps.path_id = add_step.path_id and position >= target;

  insert into public.steps (scenario_id, name, origin)
  values (scenario_id, coalesce(nullif(trim(name), ''), 'Untitled step'), 'app')
  returning id into new_step_id;

  insert into public.path_steps (path_id, step_id, position)
  values (add_step.path_id, new_step_id, target);

  return new_step_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lanes — scenario-wide, because lanes rows belong to a path
-- ---------------------------------------------------------------------------

/**
 * Add a lane to EVERY version of a scenario, at the given row.
 *
 * Returns the created `lanes` ids so the caller can invert by identity.
 */
create or replace function public.add_lane(
  scenario_id uuid,
  name text,
  lane_role text default null,
  at_position int default null
)
returns uuid[]
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  target int;
  created uuid[];
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  if coalesce(trim(name), '') = '' then
    raise exception 'A lane needs a name';
  end if;

  select coalesce(max(l.position) + 1, 0) into target
  from public.lanes l
  join public.paths p on p.id = l.path_id
  where p.scenario_id = add_lane.scenario_id;
  target := coalesce(at_position, target);

  update public.lanes l
    set position = l.position + 1
    from public.paths p
    where p.id = l.path_id
      and p.scenario_id = add_lane.scenario_id
      and l.position >= target;

  with inserted as (
    insert into public.lanes (path_id, name, lane_role, position, origin)
    select p.id, add_lane.name, nullif(add_lane.lane_role, ''), target, 'app'
    from public.paths p
    where p.scenario_id = add_lane.scenario_id
    returning id
  )
  select coalesce(array_agg(id), array[]::uuid[]) into created from inserted;

  return created;
end;
$$;

/** Reorder lanes across every version at once; lanes are matched by name. */
create or replace function public.reorder_lanes(scenario_id uuid, lane_names text[])
returns void
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  i int;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  for i in 1 .. array_length(lane_names, 1) loop
    update public.lanes l
      set position = i - 1
      from public.paths p
      where p.id = l.path_id
        and p.scenario_id = reorder_lanes.scenario_id
        and l.name = lane_names[i];
  end loop;
end;
$$;

/** Delete a lane from EVERY version of its scenario. */
create or replace function public.remove_lane(scenario_id uuid, lane_name text)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  archive_id uuid;
  affected uuid[];
  payload jsonb;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  select array_agg(c.id) into affected
  from public.cells c
  join public.lanes l on l.id = c.lane_id
  join public.paths p on p.id = l.path_id
  where p.scenario_id = remove_lane.scenario_id and l.name = lane_name;
  affected := coalesce(affected, array[]::uuid[]);

  select jsonb_build_object(
    'scenario_id', remove_lane.scenario_id,
    'lane_name', lane_name,
    'lanes', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
               from public.lanes l
               join public.paths p on p.id = l.path_id
               where p.scenario_id = remove_lane.scenario_id and l.name = lane_name),
    'cells', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
              from public.cells c where c.id = any(affected))
  ) into payload;

  insert into public.deleted_structure (kind, label, payload, affected_slices)
  values ('lane', lane_name, payload, public.slices_referencing(affected))
  returning id into archive_id;

  delete from public.lanes l
    using public.paths p
    where p.id = l.path_id
      and p.scenario_id = remove_lane.scenario_id
      and l.name = lane_name;

  return archive_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dependencies
-- ---------------------------------------------------------------------------

create or replace function public.set_cell_dependency(
  source_cell_id uuid,
  target_cell_id uuid,
  kind text default 'leads_to',
  label text default null,
  note text default null
)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
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

  insert into public.cell_dependencies (source_cell_id, target_cell_id, kind, label, note)
  values (set_cell_dependency.source_cell_id, set_cell_dependency.target_cell_id,
          set_cell_dependency.kind,
          nullif(trim(set_cell_dependency.label), ''),
          nullif(trim(set_cell_dependency.note), ''))
  on conflict on constraint cell_dependencies_source_target_kind_unique
    do update set label = excluded.label, note = excluded.note
  returning id into dependency_id;

  return dependency_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Versions (paths)
-- ---------------------------------------------------------------------------

/** A new, empty version: lanes and columns copied, no cells. */
create or replace function public.create_path(
  scenario_id uuid,
  name text,
  path_type text default 'alternative',
  lane_source_path_id uuid default null
)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  new_path_id uuid;
  source_path_id uuid;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  source_path_id := coalesce(
    lane_source_path_id,
    (select p.id from public.paths p
      where p.scenario_id = create_path.scenario_id
      order by p.created_at limit 1)
  );

  insert into public.paths (scenario_id, name, path_type, origin)
  values (scenario_id, name, path_type, 'app')
  returning id into new_path_id;

  insert into public.lanes (path_id, name, lane_role, position, origin)
  select new_path_id, l.name, l.lane_role, l.position, 'app'
  from public.lanes l where l.path_id = source_path_id;

  insert into public.path_steps (path_id, step_id, position)
  select new_path_id, ps.step_id, ps.position
  from public.path_steps ps where ps.path_id = source_path_id;

  return new_path_id;
end;
$$;

/**
 * Copy a whole version, cells and arrows included.
 *
 * The arrow remap is the point: a copied version whose `cell_dependencies`
 * still referenced the source's cells would draw arrows leaving its own
 * artboard.
 */
create or replace function public.duplicate_path(
  source_path_id uuid,
  name text,
  path_type text default 'alternative',
  copy_cells boolean default true,
  copy_dependencies boolean default true
)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  scenario_id uuid;
  new_path_id uuid;
  -- old lane id → new lane id, as jsonb rather than a temp table: this runs
  -- inside one PostgREST statement and a temp table would outlive it.
  layer_map jsonb := '{}'::jsonb;
  src_lane record;
  new_lane_id uuid;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  select p.scenario_id into scenario_id
  from public.paths p
  where p.id = duplicate_path.source_path_id;

  if scenario_id is null then
    raise exception 'Unknown version';
  end if;

  insert into public.paths
    (scenario_id, name, path_type, summary, note, origin)
  select p.scenario_id, duplicate_path.name, duplicate_path.path_type,
         p.summary, p.note, 'app'
  from public.paths p
  where p.id = duplicate_path.source_path_id
  returning id into new_path_id;

  -- Lanes first, then path_steps, then cells: the order the
  -- `cells_validate_path_match` trigger requires.
  for src_lane in
    select l.id, l.name, l.lane_role, l.position,
           l.owner_team, l.kpis, l.tools
    from public.lanes l
    where l.path_id = duplicate_path.source_path_id
    order by l.position
  loop
    insert into public.lanes
      (path_id, name, lane_role, position, owner_team, kpis, tools, origin)
    values (new_path_id, src_lane.name, src_lane.lane_role,
            src_lane.position, src_lane.owner_team, src_lane.kpis,
            src_lane.tools, 'app')
    returning id into new_lane_id;
    layer_map := layer_map || jsonb_build_object(src_lane.id::text, new_lane_id);
  end loop;

  -- Columns are scenario-scoped, so the copy points at the very same `steps`
  -- rows in the same order — exactly as the source does, and exactly as
  -- `create_path` did.
  insert into public.path_steps (path_id, step_id, position)
  select new_path_id, ps.step_id, ps.position
  from public.path_steps ps
  where ps.path_id = duplicate_path.source_path_id;

  if copy_cells then
    insert into public.cells
      (path_id, lane_id, step_id, position, content, summary,
       picture, links, function, form, value_props, owner, perceived_owner,
       origin)
    select new_path_id,
           (layer_map ->> c.lane_id::text)::uuid,
           c.step_id, c.position, c.content, c.summary,
           c.picture, c.links, c.function, c.form, c.value_props,
           c.owner, c.perceived_owner, 'app'
    from public.cells c
    where c.path_id = duplicate_path.source_path_id;

    if copy_dependencies then
      -- The join is (path, lane, step, slot). The slot term is what stops a
      -- multi-cell slot from fanning one arrow out into a copy per sibling.
      insert into public.cell_dependencies
        (source_cell_id, target_cell_id, kind, label, note)
      select ns.id, nt.id, t.kind, t.label, t.note
      from public.cell_dependencies t
      join public.cells os
        on os.id = t.source_cell_id
       and os.path_id = duplicate_path.source_path_id
      join public.cells ot
        on ot.id = t.target_cell_id
       and ot.path_id = duplicate_path.source_path_id
      join public.cells ns
        on ns.path_id = new_path_id
       and ns.lane_id = (layer_map ->> os.lane_id::text)::uuid
       and ns.step_id = os.step_id
       and ns.position is not distinct from os.position
      join public.cells nt
        on nt.path_id = new_path_id
       and nt.lane_id = (layer_map ->> ot.lane_id::text)::uuid
       and nt.step_id = ot.step_id
       and nt.position is not distinct from ot.position
      on conflict do nothing;
    end if;
  end if;

  return new_path_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Renames
-- ---------------------------------------------------------------------------

create or replace function public.rename_path(path_id uuid, new_name text)
returns void
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  if coalesce(trim(new_name), '') = '' then
    raise exception 'A path needs a name';
  end if;

  if exists (
    select 1 from public.paths p
    where p.scenario_id = (
        select scenario_id from public.paths where id = path_id
      )
      and p.id <> path_id
      and lower(trim(p.name)) = lower(trim(new_name))
  ) then
    raise exception 'This scenario already has a path called %', trim(new_name);
  end if;

  update public.paths set name = trim(new_name) where id = path_id;
  if not found then
    raise exception 'Unknown path';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Deletion — archive first, always
-- ---------------------------------------------------------------------------

/** Delete one version of a journey, archiving it first. */
create or replace function public.delete_path(path_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  archive_id uuid;
  impact jsonb;
  payload jsonb;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  if (select count(*) from public.paths p
      where p.scenario_id =
        (select scenario_id from public.paths where id = path_id)) <= 1 then
    raise exception 'A blueprint needs at least one version — delete the blueprint instead';
  end if;

  impact := public.deletion_impact('path', path_id);

  select jsonb_build_object(
    'path', to_jsonb(p),
    'lanes', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
               from public.lanes l where l.path_id = p.id),
    'path_steps', (select coalesce(jsonb_agg(to_jsonb(ps)), '[]'::jsonb)
                   from public.path_steps ps where ps.path_id = p.id),
    'cells', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
              from public.cells c where c.path_id = p.id),
    'dependencies', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                     from public.cell_dependencies t
                     join public.cells c on c.id = t.source_cell_id
                     where c.path_id = p.id)
  ) into payload
  from public.paths p where p.id = path_id;

  insert into public.deleted_structure (kind, label, payload, affected_slices)
  values ('path', impact ->> 'label', payload, impact -> 'affected_slices')
  returning id into archive_id;

  delete from public.paths where id = path_id;
  return archive_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nothing was dropped, so nothing was re-granted. Prove it.
--
-- CREATE OR REPLACE keeps a function's ACL only while the argument TYPES are
-- unchanged; get one wrong and Postgres creates a second overload with its
-- default EXECUTE to PUBLIC and leaves the broken original in place. That is a
-- widened write surface and an ambiguous PostgREST route, both silent. The
-- identity arguments and the ACL are compared against what they were before
-- the DDL above ran.
-- ---------------------------------------------------------------------------

do $do$
declare drift text;
begin
  select string_agg(format('%s(%s)', b.proname, b.ident), '; ')
    into drift
  from _acl_before b
  left join (
    select p.proname,
           pg_get_function_identity_arguments(p.oid) as ident,
           coalesce(p.proacl::text, '') as acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  ) a on a.proname = b.proname and a.ident = b.ident and a.acl = b.acl
  where a.proname is null;

  if drift is not null then
    raise exception 'a repaired function changed its signature or its grants: %', drift;
  end if;

  -- And no overload was minted alongside the one that was replaced.
  select string_agg(format('%s ×%s', proname, n), ', ') into drift
  from (
    select p.proname, count(*) as n
    from pg_proc p join pg_namespace nsp on nsp.oid = p.pronamespace
    where nsp.nspname = 'public'
      and p.proname in (select proname from _acl_before)
    group by p.proname having count(*) <> 1
  ) dup;

  if drift is not null then
    raise exception 'a repair created an overload instead of replacing: %', drift;
  end if;
end
$do$;

-- ---------------------------------------------------------------------------
-- The assertion, measured against the schema.
--
-- The 20260820140000 sweep asserted `n <> 7`, where 7 was the number of rows
-- its own SELECT had returned. A loop compared to itself agrees with itself.
-- What a function body can be WRONG about is the catalogue, so the catalogue
-- is what it is checked against here. Three rules, over every function in
-- `public` and `semantic_search`, this migration's nine included:
--
--   1. A column reference qualified by an alias that the body itself binds to
--      a schema-qualified `public.<table>` must name a column of that table,
--      per information_schema.columns. The alias→table binding is read out of
--      the body, so nothing is assumed about which tables a function touches.
--      Aliases that are also introduced by a CTE, a subquery, or a relation
--      outside `public` are dropped from the map rather than guessed at — a
--      false accusation here would be as bad as a miss.
--   2. Every name in an `insert into public.<table> (…)` column list must be a
--      column of that table. This is the rule that catches `add_step` and
--      `create_path`, whose dead references are unqualified.
--   3. Every `on conflict on constraint <name>` must name a constraint that
--      exists in pg_constraint. This is the rule that catches
--      `set_cell_dependency`, and the one 20260820120100's sweep could have
--      run and did not.
--
-- Run this block on its own against production BEFORE applying the DDL above
-- and it raises, naming all nine. That is the red half of the proof; the green
-- half is that it passes here.
-- ---------------------------------------------------------------------------

do $assert$
declare
  fn record;
  m text[];
  body text;
  bound jsonb;
  poisoned text[];
  problems text[] := array[]::text[];
  col text;
  keywords constant text[] := array[
    'where','on','set','using','order','group','limit','offset','left','right',
    'inner','outer','cross','full','join','returning','select','values','and',
    'or','as','for','union','all','having','into','from','loop','then','do',
    'when','with','not','exists','case','if','is','natural','lateral'];
begin
  for fn in
    select n.nspname, p.proname, lower(p.prosrc) as src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','semantic_search') and p.prokind = 'f'
  loop
    body := fn.src;
    bound := '{}'::jsonb;
    poisoned := array[]::text[];

    -- Bindings: `from|join|update|into <schema>.<relation> [as] <alias>`.
    for m in
      select regexp_matches(
        body,
        '\m(?:from|join|update|into)\s+([a-z_][a-z0-9_$]*)\.([a-z_][a-z0-9_$]*)\s+(?:as\s+)?([a-z_][a-z0-9_$]*)',
        'g')
    loop
      if m[3] = any(keywords) then
        continue;
      end if;
      if m[1] <> 'public'
         or not exists (
              select 1 from information_schema.columns c
              where c.table_schema = 'public' and c.table_name = m[2])
         or (bound ? m[3] and bound ->> m[3] <> m[2]) then
        poisoned := poisoned || m[3];
      else
        bound := bound || jsonb_build_object(m[3], m[2]);
      end if;
    end loop;

    -- An alias a CTE or a subquery also introduces is not trustworthy.
    for m in
      select regexp_matches(body, '\)\s+(?:as\s+)?([a-z_][a-z0-9_$]*)', 'g')
    loop
      poisoned := poisoned || m[1];
    end loop;
    for m in
      select regexp_matches(body, '\m(?:with|,)\s+([a-z_][a-z0-9_$]*)\s+as\s*\(', 'g')
    loop
      poisoned := poisoned || m[1];
    end loop;

    -- Rule 1 — alias-qualified column references.
    for m in
      select regexp_matches(body, '\m([a-z_][a-z0-9_$]*)\.([a-z_][a-z0-9_$]*)\M', 'g')
    loop
      if (bound ? m[1]) and not (m[1] = any(poisoned)) then
        if not exists (
          select 1 from information_schema.columns c
          where c.table_schema = 'public'
            and c.table_name = bound ->> m[1]
            and c.column_name = m[2]
        ) then
          problems := problems || format(
            '%s.%s: %s.%s — public.%s has no column %s',
            fn.nspname, fn.proname, m[1], m[2], bound ->> m[1], m[2]);
        end if;
      end if;
    end loop;

    -- Rule 2 — insert column lists.
    for m in
      select regexp_matches(
        body,
        'insert\s+into\s+public\.([a-z_][a-z0-9_$]*)\s*\(([^)]*)\)',
        'g')
    loop
      if exists (select 1 from information_schema.columns c
                 where c.table_schema = 'public' and c.table_name = m[1]) then
        for col in
          select btrim(part, ' ' || chr(9) || chr(10) || chr(13) || '"')
          from regexp_split_to_table(m[2], ',') as part
        loop
          if col <> '' and col ~ '^[a-z_][a-z0-9_$]*$'
             and not exists (
               select 1 from information_schema.columns c
               where c.table_schema = 'public'
                 and c.table_name = m[1]
                 and c.column_name = col
             ) then
            problems := problems || format(
              '%s.%s: insert into public.%s (… %s …) — no such column',
              fn.nspname, fn.proname, m[1], col);
          end if;
        end loop;
      end if;
    end loop;

    -- Rule 3 — named conflict targets.
    for m in
      select regexp_matches(
        body, 'on\s+conflict\s+on\s+constraint\s+([a-z_][a-z0-9_$]*)', 'g')
    loop
      if not exists (select 1 from pg_constraint where conname = m[1]) then
        problems := problems || format(
          '%s.%s: on conflict on constraint %s — no such constraint',
          fn.nspname, fn.proname, m[1]);
      end if;
    end loop;
  end loop;

  if array_length(problems, 1) is not null then
    raise exception E'function bodies name things the schema does not have:\n%',
      array_to_string(problems, E'\n');
  end if;
end
$assert$;

drop table _acl_before;
