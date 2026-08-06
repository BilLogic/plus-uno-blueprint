-- Two SQL-language functions read a column where they meant their parameter.
--
-- In a `language sql` function an unqualified name that matches a column of an
-- in-scope table binds to the **column**, silently. The plpgsql functions in
-- `20260731001000` all qualify their parameters (`add_step.path_id`) and are
-- unaffected; these two do not, and both had a parameter whose name is also a
-- column name somewhere in their own FROM clause.
--
-- `slices_referencing(cell_ids uuid[])` — `slice_items.cell_ids` shadowed it,
-- so `i.cell_ids && cell_ids` compiled as `i.cell_ids && i.cell_ids`: true for
-- every slice with any frame. Measured against this database, the function
-- returned the same seven slices for a real cell set, for an empty array, and
-- for a uuid that does not exist. Every confirm dialog would have named seven
-- unrelated slices as losing frames, and `deletion_impact.affected_slices`
-- carried that into the archive — the exact failure the impact read exists to
-- prevent, dressed as a correct answer.
--
-- `mint_cell_key(path_id, layer_id, step_id)` — `layers.path_id` shadowed the
-- first parameter, so the version segment came from the layer's path rather
-- than the one passed. Harmless where it is called today (the layer is always
-- on that path) but wrong, and wrong in a way the next caller would inherit.
--
-- Fixed with positional references. `$1` cannot resolve to a column, so this
-- class of bug cannot come back through a later rename.

create or replace function public.mint_cell_key(
  path_id uuid,
  layer_id uuid,
  step_id uuid
)
returns text
language sql stable
set search_path = public, pg_catalog, pg_temp
as $fn$
  select concat_ws('/',
    public.key_slug(sl.name),
    public.key_slug(sc.name),
    coalesce(public.key_slug(p.name), public.key_slug(p.path_type)),
    public.key_slug(l.name),
    public.key_slug(s.name)
  )
  from public.paths p
  join public.service_scenarios sc on sc.id = p.service_scenario_id
  join public.phases ph on ph.id = sc.phase_id
  join public.service_lifecycles sl on sl.id = ph.service_lifecycle_id
  join public.layers l on l.id = $2
  join public.steps s on s.id = $3
  where p.id = $1;
$fn$;

create or replace function public.slices_referencing(cell_ids uuid[])
returns jsonb
language sql stable
set search_path = public, pg_catalog, pg_temp
as $fn$
  select coalesce(jsonb_agg(entry), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'slice_id', s.id,
      'title', s.title,
      'cell_keys', (
        select coalesce(jsonb_agg(to_jsonb(c.cell_key)), '[]'::jsonb)
        from public.cells c
        where c.id = any($1)
          and exists (
            select 1 from public.slice_items i2
            where i2.slice_id = s.id and c.id = any(i2.cell_ids)
          )
      )
    ) as entry
    from public.slices s
    where exists (
      select 1 from public.slice_items i
      where i.slice_id = s.id and i.cell_ids && $1
    )
  ) rows;
$fn$;

grant execute on function public.mint_cell_key(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.slices_referencing(uuid[]) to anon, authenticated;
