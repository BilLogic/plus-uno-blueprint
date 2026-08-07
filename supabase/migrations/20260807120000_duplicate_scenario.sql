-- Duplicate a blueprint (scenario), whole.
--
-- The sidebar's right-click menu offers Duplicate on every structural row.
-- Paths already had `duplicate_path`; scenarios had nothing, and there is no
-- composition of the existing operations that produces one — `duplicate_path`
-- is scoped to its source's scenario, and `create_scenario` mints empty
-- columns. So this is the fifth create-shaped operation, written to the same
-- rules as the other four:
--
--   * one complete, valid edit in one transaction;
--   * `security definer` with a pinned search_path;
--   * the tier guard first, in the body, because a definer function's owner
--     has rolbypassrls and the RESTRICTIVE policies never run for it
--     (20260805170000);
--   * EXECUTE revoked from PUBLIC/anon and re-granted to `authenticated`
--     only — the deployed site stays read-only (20260731004000).
--
-- What it copies, deliberately matching `duplicate_path` field for field:
-- the scenario's description and view type; its columns (`steps` are
-- scenario-scoped, so they are copied ONCE and every copied path points at
-- the same new set, exactly as the source does); every path with its name,
-- type, description and note; every path's lanes; every cell's content and
-- all its spec fields; and every arrow whose BOTH endpoints live inside the
-- source scenario, remapped onto the copies.
--
-- Two deliberate differences from `duplicate_path`, both fixing drift rather
-- than inheriting it:
--
--   1. `slot_position` is copied, and is part of the arrow remap join. A
--      slot may hold more than one cell; `duplicate_path` neither copies the
--      position nor disambiguates on it, so a multi-cell slot re-points its
--      arrows arbitrarily. Here the join is (path, layer, step, slot), which
--      is the cell's actual identity.
--   2. Lanes carry `owner_team`, `kpis` and `tools` across. A copied lane
--      that forgot its owner reads as an unowned lane, which is a different
--      blueprint.
--
-- What it does NOT copy: `cell_key`. Keys are AUTHORED (see
-- `cell_natural_key`) — they cannot be derived for imported cells, and
-- minting one here would collide wherever a scenario has two steps with the
-- same name, which the seeded data already does. Copies get a null key, the
-- same as every app-created cell and the same as `duplicate_path`'s copies.
-- The consequence is stated once, here: a duplicated cell is not addressable
-- by a slice binding until it is given a key.

create or replace function public.duplicate_scenario(
  source_scenario_id uuid,
  name text
)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  source_phase_id uuid;
  new_scenario_id uuid;
  next_order int;
  -- old id → new id, as jsonb rather than temp tables: these functions run
  -- inside one PostgREST statement and a temp table would outlive it.
  step_map jsonb := '{}'::jsonb;
  layer_map jsonb := '{}'::jsonb;
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
  from public.service_scenarios sc
  where sc.id = source_scenario_id;

  if source_phase_id is null then
    raise exception 'Unknown blueprint';
  end if;

  -- The copy lands at the end of its phase. Same rule as create_scenario:
  -- inserting mid-sequence is a reorder, and reordering is a different
  -- operation.
  select coalesce(max(sc.order_position), -1) + 1 into next_order
  from public.service_scenarios sc
  where sc.phase_id = source_phase_id;

  insert into public.service_scenarios
    (phase_id, name, description, order_position, view_type, origin)
  select source_phase_id, duplicate_scenario.name, sc.description,
         next_order, sc.view_type, 'app'
  from public.service_scenarios sc
  where sc.id = source_scenario_id
  returning id into new_scenario_id;

  -- Columns first: they belong to the scenario, not to a path, so they are
  -- copied once and every path below points at this one new set.
  for src_step in
    select s.id, s.name
    from public.steps s
    where s.service_scenario_id = source_scenario_id
    order by s.created_at
  loop
    insert into public.steps (service_scenario_id, name, origin)
    values (new_scenario_id, src_step.name, 'app')
    returning id into new_step_id;
    step_map := step_map || jsonb_build_object(src_step.id::text, new_step_id);
  end loop;

  -- Then each path, in the order the `cells_validate_path_match` trigger
  -- requires: lanes → path_steps → cells.
  for src_path in
    select p.id, p.name, p.path_type, p.description, p.note
    from public.paths p
    where p.service_scenario_id = source_scenario_id
    order by p.created_at
  loop
    insert into public.paths
      (service_scenario_id, name, path_type, description, note, origin)
    values (new_scenario_id, src_path.name, src_path.path_type,
            src_path.description, src_path.note, 'app')
    returning id into new_path_id;
    path_map := path_map || jsonb_build_object(src_path.id::text, new_path_id);

    for src_lane in
      select l.id, l.name, l.layer_role, l.row_position,
             l.owner_team, l.kpis, l.tools
      from public.layers l
      where l.path_id = src_path.id
      order by l.row_position
    loop
      insert into public.layers
        (path_id, name, layer_role, row_position, owner_team, kpis, tools, origin)
      values (new_path_id, src_lane.name, src_lane.layer_role,
              src_lane.row_position, src_lane.owner_team, src_lane.kpis,
              src_lane.tools, 'app')
      returning id into new_lane_id;
      layer_map := layer_map || jsonb_build_object(src_lane.id::text, new_lane_id);
    end loop;

    insert into public.path_steps (path_id, step_id, column_position)
    select new_path_id, (step_map ->> ps.step_id::text)::uuid, ps.column_position
    from public.path_steps ps
    where ps.path_id = src_path.id;

    insert into public.cells
      (path_id, layer_id, step_id, slot_position, content, description,
       picture, links, function, form, value_props, owner, perceived_owner,
       origin)
    select new_path_id,
           (layer_map ->> c.layer_id::text)::uuid,
           (step_map ->> c.step_id::text)::uuid,
           c.slot_position, c.content, c.description,
           c.picture, c.links, c.function, c.form, c.value_props,
           c.owner, c.perceived_owner, 'app'
    from public.cells c
    where c.path_id = src_path.id;
  end loop;

  -- Arrows last, once every cell they could point at exists. Only arrows
  -- with BOTH endpoints inside the source scenario are copied: an arrow with
  -- one foot outside would render as a line leaving the blueprint it belongs
  -- to, which is the failure `duplicate_path`'s `copy_dependencies` exists to
  -- prevent. Cross-scenario arrows are left pointing at the original, which
  -- is where they still belong.
  insert into public.cell_triggers (source_cell_id, target_cell_id, kind, label, note)
  select ns.id, nt.id, t.kind, t.label, t.note
  from public.cell_triggers t
  join public.cells os on os.id = t.source_cell_id
  join public.cells ot on ot.id = t.target_cell_id
  join public.cells ns
    on ns.path_id = (path_map ->> os.path_id::text)::uuid
   and ns.layer_id = (layer_map ->> os.layer_id::text)::uuid
   and ns.step_id = (step_map ->> os.step_id::text)::uuid
   and ns.slot_position is not distinct from os.slot_position
  join public.cells nt
    on nt.path_id = (path_map ->> ot.path_id::text)::uuid
   and nt.layer_id = (layer_map ->> ot.layer_id::text)::uuid
   and nt.step_id = (step_map ->> ot.step_id::text)::uuid
   and nt.slot_position is not distinct from ot.slot_position
  where path_map ? os.path_id::text
    and path_map ? ot.path_id::text
  on conflict do nothing;

  return new_scenario_id;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default at CREATE time, so the revoke
-- is the operative statement and the grant merely names the one role that is
-- supposed to have it. Without both lines anyone holding the anon key — which
-- ships in the deployed bundle by design — could duplicate a blueprint.
revoke execute on function public.duplicate_scenario(uuid, text) from public, anon;
grant execute on function public.duplicate_scenario(uuid, text) to authenticated;
