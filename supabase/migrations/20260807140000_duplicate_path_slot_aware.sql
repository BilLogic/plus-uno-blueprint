-- `duplicate_path`, made slot-aware.
--
-- The original (20260731001000) predates `slot_position`
-- (20260804000000_cells_slot_position), and the tech-cell split
-- (20260804001000_split_tech_touchpoints) then put a second cell into a lot of
-- (lane, step) slots. Two defects followed, both of them latent only because a
-- bare `catch {}` upstream was swallowing the error:
--
--   1. The cell copy never selected `slot_position`, so every copied cell
--      landed at the column default 0. A slot holding two cells therefore
--      produced two inserts at slot 0, the second collided with
--      `cells_layer_step_slot_unique`, and the WHOLE duplicate aborted. That
--      is most of the real data: every Goal Setting path, both Warm-Up paths,
--      Reporting an Issue, Discovery.
--
--   2. The arrow remap joined the copies on (layer, step) with no slot term.
--      Where a slot holds N cells that join is N-way ambiguous, so one source
--      arrow fanned out into N copies attached to arbitrary siblings — the
--      "arrows leaving their own artboard" failure the remap exists to
--      prevent, wearing a different face.
--
-- `20260807120000_duplicate_scenario.sql` already got this right, and this is
-- its approach applied to the one-path case: an explicit old-lane-id →
-- new-lane-id map in jsonb, `slot_position` carried across, and
-- (path, layer, step, slot) as the join — which is the cell's actual identity.
--
-- Three consequences of that mirroring, called out rather than smuggled:
--
--   * The lane copy is inlined instead of delegated to `create_path`.
--     `create_path` matches lanes by NAME, which cannot build an id map and
--     is itself ambiguous for a path carrying two same-named lanes. The map
--     is what makes the slot join exact, so the lanes have to be inserted
--     here, one at a time, with their ids retained.
--   * Because the lanes are inserted here, lanes now carry `owner_team`,
--     `kpis` and `tools` to the copy (as they do in `duplicate_scenario`).
--     A copied lane that forgot its owner reads as an unowned lane.
--   * The path's own `description` and `note` are copied too, for the same
--     reason and to the same rule `duplicate_scenario` uses. `create_path`
--     could not carry them — it takes no such arguments — so duplicating a
--     path used to silently drop the prose describing it.
--
-- Unchanged on purpose: `cell_key` is not copied (keys are authored — see
-- `cell_natural_key`), the copy keeps `origin = 'app'`, and both boolean flags
-- keep their meaning and their defaults.
--
-- The tier guard is inline rather than injected by 20260805170000's DO block:
-- that migration has already run and will not revisit a function replaced
-- after it. Without the guard here, replacing the body would silently DROP
-- the assert the enforcement migration installed — a signed-in viewer could
-- then duplicate a path.

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

  select p.service_scenario_id into scenario_id
  from public.paths p
  where p.id = duplicate_path.source_path_id;

  if scenario_id is null then
    raise exception 'Unknown version';
  end if;

  insert into public.paths
    (service_scenario_id, name, path_type, description, note, origin)
  select scenario_id, duplicate_path.name, duplicate_path.path_type,
         p.description, p.note, 'app'
  from public.paths p
  where p.id = duplicate_path.source_path_id
  returning id into new_path_id;

  -- Lanes first, then path_steps, then cells: the order the
  -- `cells_validate_path_match` trigger requires.
  for src_lane in
    select l.id, l.name, l.layer_role, l.row_position,
           l.owner_team, l.kpis, l.tools
    from public.layers l
    where l.path_id = duplicate_path.source_path_id
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

  -- Columns are scenario-scoped, so the copy points at the very same `steps`
  -- rows in the same order — exactly as the source does, and exactly as
  -- `create_path` did.
  insert into public.path_steps (path_id, step_id, column_position)
  select new_path_id, ps.step_id, ps.column_position
  from public.path_steps ps
  where ps.path_id = duplicate_path.source_path_id;

  if copy_cells then
    insert into public.cells
      (path_id, layer_id, step_id, slot_position, content, description,
       picture, links, function, form, value_props, owner, perceived_owner,
       origin)
    select new_path_id,
           (layer_map ->> c.layer_id::text)::uuid,
           c.step_id, c.slot_position, c.content, c.description,
           c.picture, c.links, c.function, c.form, c.value_props,
           c.owner, c.perceived_owner, 'app'
    from public.cells c
    where c.path_id = duplicate_path.source_path_id;

    if copy_dependencies then
      -- The join is (path, layer, step, slot). The slot term is what stops a
      -- multi-cell slot from fanning one arrow out into a copy per sibling.
      insert into public.cell_triggers
        (source_cell_id, target_cell_id, kind, label, note)
      select ns.id, nt.id, t.kind, t.label, t.note
      from public.cell_triggers t
      join public.cells os
        on os.id = t.source_cell_id
       and os.path_id = duplicate_path.source_path_id
      join public.cells ot
        on ot.id = t.target_cell_id
       and ot.path_id = duplicate_path.source_path_id
      join public.cells ns
        on ns.path_id = new_path_id
       and ns.layer_id = (layer_map ->> os.layer_id::text)::uuid
       and ns.step_id = os.step_id
       and ns.slot_position is not distinct from os.slot_position
      join public.cells nt
        on nt.path_id = new_path_id
       and nt.layer_id = (layer_map ->> ot.layer_id::text)::uuid
       and nt.step_id = ot.step_id
       and nt.slot_position is not distinct from ot.slot_position
      on conflict do nothing;
    end if;
  end if;

  return new_path_id;
end;
$$;

-- CREATE OR REPLACE keeps the existing privileges, so against the deployed
-- database these two lines are a no-op — 20260731004000 already revoked
-- PUBLIC/anon here. They are restated so this file is still correct if the
-- function is ever created fresh from it, where the default PUBLIC grant
-- WOULD apply and the deployed site would stop being read-only.
revoke execute on function public.duplicate_path(uuid, text, text, boolean, boolean)
  from public, anon;
grant execute on function public.duplicate_path(uuid, text, text, boolean, boolean)
  to authenticated;
