-- `add_lane`'s inverse, keyed by identity instead of by name.
--
-- Every other inverse the ledger captures names the row it undoes: `add_step`
-- inverts to `remove_step(step_id)`, `upsert_cell` to `delete_cell(cell_id)`,
-- `create_path` to `delete_path(path_id)`. `add_lane` was the exception — it
-- returned void, so the only handle available at record time was the name that
-- had just been typed, and its inverse was
-- `remove_lane(scenario_id, lane_name)`.
--
-- That holds in clean LIFO and nowhere else. Rename the lane and the inverse
-- matches nothing; rename a *different* lane into that name — which a session
-- with a reverted-out-of-order rename, or a left-behind entry, can easily do —
-- and the inverse deletes the wrong lane. And `remove_lane` matches by name
-- across every path of the scenario, so the blast radius of a wrong match is
-- the whole blueprint's worth of that lane, cells included.
--
-- Two changes, both mechanical:
--
--   1. `add_lane` returns the ids it created — one `layers` row per path of
--      the scenario, which is why it is an array and not a scalar.
--   2. `remove_lanes` deletes exactly those rows, archiving them the same way
--      `remove_lane` archives its own.
--
-- `remove_lane` stays: it is what the delete dialog calls, where the user is
-- naming a lane and means every version of it. This is the undo path only.

-- A return type change needs a drop; there are no dependent objects.
drop function if exists public.add_lane(uuid, text, text, int);

/**
 * Add a lane to EVERY version of a scenario, at the given row.
 *
 * Returns the created `layers` ids so the caller can invert by identity.
 */
create or replace function public.add_lane(
  scenario_id uuid,
  name text,
  layer_role text default null,
  at_row int default null
)
returns uuid[]
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  target int;
  created uuid[];
begin
  -- Inline rather than injected by 20260805170000's DO block: that migration
  -- has already run and will not revisit a function created after it.
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  if coalesce(trim(name), '') = '' then
    raise exception 'A lane needs a name';
  end if;

  select coalesce(max(l.row_position) + 1, 0) into target
  from public.layers l
  join public.paths p on p.id = l.path_id
  where p.service_scenario_id = add_lane.scenario_id;
  target := coalesce(at_row, target);

  update public.layers l
    set row_position = l.row_position + 1
    from public.paths p
    where p.id = l.path_id
      and p.service_scenario_id = add_lane.scenario_id
      and l.row_position >= target;

  with inserted as (
    insert into public.layers (path_id, name, layer_role, row_position, origin)
    select p.id, add_lane.name, nullif(add_lane.layer_role, ''), target, 'app'
    from public.paths p
    where p.service_scenario_id = add_lane.scenario_id
    returning id
  )
  select coalesce(array_agg(id), array[]::uuid[]) into created from inserted;

  return created;
end;
$$;

/**
 * Delete exactly these lanes, archiving them first.
 *
 * The undo of `add_lane`. Unlike `remove_lane` it matches nothing by name, so
 * a lane renamed since it was added is still the lane this takes back — and a
 * different lane that has since been renamed *into* that name is not.
 */
create or replace function public.remove_lanes(lane_ids uuid[])
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  archive_id uuid;
  affected uuid[];
  payload jsonb;
  label text;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  if lane_ids is null or array_length(lane_ids, 1) is null then
    raise exception 'No lanes named';
  end if;

  -- Zero surviving rows is a real answer, and a hard one: the lane is already
  -- gone, so the caller must not be told its undo succeeded.
  if not exists (select 1 from public.layers where id = any(lane_ids)) then
    raise exception 'Those lanes no longer exist';
  end if;

  select min(l.name) into label
  from public.layers l where l.id = any(lane_ids);

  select coalesce(array_agg(c.id), array[]::uuid[]) into affected
  from public.cells c where c.layer_id = any(lane_ids);

  select jsonb_build_object(
    'lane_ids', to_jsonb(lane_ids),
    'lane_name', label,
    'layers', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
               from public.layers l where l.id = any(lane_ids)),
    'cells', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
              from public.cells c where c.id = any(affected))
  ) into payload;

  insert into public.deleted_structure (kind, label, payload, affected_slices)
  values ('lane', coalesce(label, 'lane'), payload,
          public.slices_referencing(affected))
  returning id into archive_id;

  delete from public.layers where id = any(lane_ids);

  return archive_id;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC at CREATE time, so the revoke is the
-- operative statement in each pair and the grant names the one role that is
-- supposed to hold it. The deployed site stays read-only (20260731004000).
revoke execute on function public.add_lane(uuid, text, text, int) from public, anon;
grant execute on function public.add_lane(uuid, text, text, int) to authenticated;
revoke execute on function public.remove_lanes(uuid[]) from public, anon;
grant execute on function public.remove_lanes(uuid[]) to authenticated;
