-- Three variables and a sentence that still said "layer".
--
-- The lanes were renamed from `layers` in #143. The tables, columns, indexes,
-- policies and triggers all moved with it; four function BODIES did not,
-- because nothing renames text inside a body and nothing was reading bodies
-- yet. `check:identifiers --service-role` reads them now, and reported five —
-- three real, two prose:
--
--   cells_validate_path_match   `layer_path`, the local holding lanes.path_id
--   duplicate_path              `layer_map`, old lane id -> new lane id
--   duplicate_scenario          `layer_map`, the same map
--   deletion_impact             a comment saying "the given layer"
--   sync_cell_resources         `-- for one layer down.` — ordinary English
--
-- None of the five was a defect: a local variable's name is private to its
-- body and `layer_map` mapped lanes correctly. They are a vocabulary debt,
-- which is exactly what that check exists to collect. The fifth is not a
-- finding at all, and the check was narrowed in the same change to stop
-- reading comments — a rule that reads prose fires on how carefully somebody
-- explained themselves.
--
-- Each definition below is the CURRENT one from `pg_get_functiondef`, with
-- those names replaced and nothing else touched. `create or replace` keeps
-- the existing ACL, so no grant is re-issued here and no SECURITY DEFINER
-- function passes through a moment of being open.
--
-- ── Replaying against an empty database ───────────────────────────────────
--
-- The proof at the foot is an INVARIANT: no function in either schema names
-- the retired spelling. It is vacuously true where no function exists yet and
-- says something real on production, which is the shape every assertion in
-- this series has to have to survive an empty replay.

CREATE OR REPLACE FUNCTION public.cells_validate_path_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  lane_path uuid;
  step_on_path boolean;
begin
  select path_id into lane_path from public.lanes where id = new.lane_id;

  select exists (
    select 1
    from public.path_steps ps
    where ps.path_id = new.path_id
      and ps.step_id = new.step_id
  ) into step_on_path;

  if lane_path is null then
    raise exception 'cells: lane_id does not exist';
  end if;

  if lane_path <> new.path_id then
    raise exception 'cells.path_id must match lanes.path_id';
  end if;

  if not step_on_path then
    raise exception 'cells.step_id must be linked to cells.path_id in path_steps';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.duplicate_path(source_path_id uuid, name text, kind text DEFAULT 'alternative'::text, copy_cells boolean DEFAULT true, copy_dependencies boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  scenario_id uuid;
  new_path_id uuid;
  -- old lane id → new lane id, as jsonb rather than a temp table: this runs
  -- inside one PostgREST statement and a temp table would outlive it.
  lane_map jsonb := '{}'::jsonb;
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
    (scenario_id, name, kind, summary, note, origin)
  select p.scenario_id, duplicate_path.name, duplicate_path.kind,
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
    lane_map := lane_map || jsonb_build_object(src_lane.id::text, new_lane_id);
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
       frame, function, form, value_props, owner, perceived_owner,
       origin)
    select new_path_id,
           (lane_map ->> c.lane_id::text)::uuid,
           c.step_id, c.position, c.content, c.summary,
           c.frame, c.function, c.form, c.value_props,
           c.owner, c.perceived_owner, 'app'
    from public.cells c
    where c.path_id = duplicate_path.source_path_id;

    if copy_dependencies then
      -- The join is (path, lane, step, slot). The slot term is what stops a
      -- multi-cell slot from fanning one arrow out into a copy per sibling.
      insert into public.cell_dependencies
        (source_cell_id, target_cell_id, kind, name)
      select ns.id, nt.id, t.kind, t.name
      from public.cell_dependencies t
      join public.cells os
        on os.id = t.source_cell_id
       and os.path_id = duplicate_path.source_path_id
      join public.cells ot
        on ot.id = t.target_cell_id
       and ot.path_id = duplicate_path.source_path_id
      join public.cells ns
        on ns.path_id = new_path_id
       and ns.lane_id = (lane_map ->> os.lane_id::text)::uuid
       and ns.step_id = os.step_id
       and ns.position is not distinct from os.position
      join public.cells nt
        on nt.path_id = new_path_id
       and nt.lane_id = (lane_map ->> ot.lane_id::text)::uuid
       and nt.step_id = ot.step_id
       and nt.position is not distinct from ot.position
      on conflict do nothing;
    end if;
  end if;

  return new_path_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.duplicate_scenario(source_scenario_id uuid, name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  source_phase_id uuid;
  new_scenario_id uuid;
  next_order int;
  step_map jsonb := '{}'::jsonb;
  lane_map jsonb := '{}'::jsonb;
  path_map jsonb := '{}'::jsonb;
  src_step record;
  src_path record;
  src_lane record;
  new_step_id uuid;
  new_path_id uuid;
  new_lane_id uuid;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  if coalesce(trim(name), '') = '' then
    raise exception 'A blueprint needs a name';
  end if;

  select sc.phase_id into source_phase_id
  from public.scenarios sc
  where sc.id = source_scenario_id;

  if source_phase_id is null then
    raise exception 'Unknown blueprint';
  end if;

  select coalesce(max(sc.position), -1) + 1 into next_order
  from public.scenarios sc
  where sc.phase_id = source_phase_id;

  insert into public.scenarios
    (phase_id, name, summary, position, layout, origin)
  select source_phase_id, duplicate_scenario.name, sc.summary,
         next_order, sc.layout, 'app'
  from public.scenarios sc
  where sc.id = source_scenario_id
  returning id into new_scenario_id;

  for src_step in
    select s.id, s.name
    from public.steps s
    where s.scenario_id = source_scenario_id
    order by s.created_at
  loop
    insert into public.steps (scenario_id, name, origin)
    values (new_scenario_id, src_step.name, 'app')
    returning id into new_step_id;
    step_map := step_map || jsonb_build_object(src_step.id::text, new_step_id);
  end loop;

  for src_path in
    select p.id, p.name, p.kind, p.summary, p.note
    from public.paths p
    where p.scenario_id = source_scenario_id
    order by p.created_at
  loop
    insert into public.paths
      (scenario_id, name, kind, summary, note, origin)
    values (new_scenario_id, src_path.name, src_path.kind,
            src_path.summary, src_path.note, 'app')
    returning id into new_path_id;
    path_map := path_map || jsonb_build_object(src_path.id::text, new_path_id);

    for src_lane in
      select l.id, l.name, l.lane_role, l.position,
             l.owner_team, l.kpis, l.tools
      from public.lanes l
      where l.path_id = src_path.id
      order by l.position
    loop
      insert into public.lanes
        (path_id, name, lane_role, position, owner_team, kpis, tools, origin)
      values (new_path_id, src_lane.name, src_lane.lane_role,
              src_lane.position, src_lane.owner_team, src_lane.kpis,
              src_lane.tools, 'app')
      returning id into new_lane_id;
      lane_map := lane_map || jsonb_build_object(src_lane.id::text, new_lane_id);
    end loop;

    insert into public.path_steps (path_id, step_id, position)
    select new_path_id, (step_map ->> ps.step_id::text)::uuid, ps.position
    from public.path_steps ps
    where ps.path_id = src_path.id;

    insert into public.cells
      (path_id, lane_id, step_id, position, content, summary,
       frame, function, form, value_props, owner, perceived_owner,
       origin)
    select new_path_id,
           (lane_map ->> c.lane_id::text)::uuid,
           (step_map ->> c.step_id::text)::uuid,
           c.position, c.content, c.summary,
           c.frame, c.function, c.form, c.value_props,
           c.owner, c.perceived_owner, 'app'
    from public.cells c
    where c.path_id = src_path.id;
  end loop;

  insert into public.cell_dependencies (source_cell_id, target_cell_id, kind, name)
  select ns.id, nt.id, t.kind, t.name
  from public.cell_dependencies t
  join public.cells os on os.id = t.source_cell_id
  join public.cells ot on ot.id = t.target_cell_id
  join public.cells ns
    on ns.path_id = (path_map ->> os.path_id::text)::uuid
   and ns.lane_id = (lane_map ->> os.lane_id::text)::uuid
   and ns.step_id = (step_map ->> os.step_id::text)::uuid
   and ns.position is not distinct from os.position
  join public.cells nt
    on nt.path_id = (path_map ->> ot.path_id::text)::uuid
   and nt.lane_id = (lane_map ->> ot.lane_id::text)::uuid
   and nt.step_id = (step_map ->> ot.step_id::text)::uuid
   and nt.position is not distinct from ot.position
  where path_map ? os.path_id::text
    and path_map ? ot.path_id::text
  on conflict do nothing;

  return new_scenario_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.deletion_impact(kind text, target_id uuid, scope_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  affected uuid[];
  label    text;
begin
  if kind = 'scenario' then
    select array_agg(c.id), max(sc.name) into affected, label
    from public.cells c
    join public.paths p on p.id = c.path_id
    join public.scenarios sc on sc.id = p.scenario_id
    where sc.id = target_id;

  elsif kind = 'path' then
    select array_agg(c.id), max(p.name) into affected, label
    from public.cells c join public.paths p on p.id = c.path_id
    where p.id = target_id;

  elsif kind = 'step' then
    -- remove_step(path_id, step_id) is path-scoped, so this must be too.
    -- Refuse rather than guess: counting across every path would overcount,
    -- and an overcount here reads as "this delete is bigger than it is".
    if scope_id is null then
      raise exception 'deletion_impact(''step'', ...) needs scope_id = the path_id'
        using hint = 'remove_step deletes only the cells on one path; without the path there is no true count.';
    end if;
    select array_agg(c.id), max(s.name) into affected, label
    from public.cells c join public.steps s on s.id = c.step_id
    where c.step_id = target_id and c.path_id = scope_id;

  elsif kind = 'lane' then
    -- remove_lane(scenario_id, lane_name) deletes by NAME across the whole
    -- scenario. Resolve the given lane to its (scenario, name) and count
    -- every lane the delete would actually take.
    select array_agg(c.id), max(l.name) into affected, label
    from public.cells c
    join public.lanes l on l.id = c.lane_id
    join public.paths  p on p.id = l.path_id
    where p.scenario_id = (
            select p2.scenario_id
            from public.lanes l2
            join public.paths p2 on p2.id = l2.path_id
            where l2.id = target_id
          )
      and l.name = (select l3.name from public.lanes l3 where l3.id = target_id);

  else
    raise exception 'Unknown kind %', kind;
  end if;

  affected := coalesce(affected, array[]::uuid[]);

  return jsonb_build_object(
    'label', coalesce(label, ''),
    'cell_count', cardinality(affected),
    'dependency_count', (
      select count(*) from public.cell_dependencies t
      where t.source_cell_id = any(affected) or t.target_cell_id = any(affected)
    ),
    'affected_slices', public.slices_referencing(affected)
  );
end;
$function$
;

do $$
declare
  v_left text;
begin
  select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname)
    into v_left
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'semantic_search')
     -- `prosrc` rather than `pg_get_functiondef`, which raises on an
     -- aggregate. The body is what this file rewrote, and it is what a
     -- retired name would survive in.
     and p.prokind in ('f', 'p')
     and p.prosrc ~ '\mlayer_(map|path)\M';

  if v_left is not null then
    raise exception
      'a function body still names the retired lane spelling: %. The rename '
      'moved every relation in #143; a body is text and moves only when '
      'somebody rewrites it.', v_left;
  end if;
end
$$;
