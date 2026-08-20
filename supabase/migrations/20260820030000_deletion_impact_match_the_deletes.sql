-- deletion_impact: make every count TRUE of the delete that follows.
--
-- Two kinds were answerable but wrong, in opposite directions, and
-- deletionSafety.ts made them unrepresentable in TypeScript rather than fix
-- the SQL ("the correction cannot be verified without a migration apply").
-- Measured on production before this change:
--
--   lane  deletion_impact('lane', <a Goal Setting "Front Stage Tech" layer>)
--         reported 11. remove_lane(scenario_id, lane_name) deletes every
--         same-named lane across every path of the scenario — 93 cells.
--         An 8.5x UNDERCOUNT in a dialog whose entire job is the number.
--
--   step  deletion_impact('step', id) counted that step across EVERY path
--         (12); remove_step(path_id, step_id) deletes only the cells on the
--         path it is given (5). An OVERCOUNT.
--
-- The cause is identity, not arithmetic: a lane delete is addressed by
-- (scenario, name) and a step delete by (path, step), but the function took
-- a single uuid. `scope_id` supplies the missing half. scenario and path are
-- untouched and ignore it, so existing callers are unaffected.

drop function if exists public.deletion_impact(text, uuid);

create or replace function public.deletion_impact(
  kind      text,
  target_id uuid,
  scope_id  uuid default null
)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_catalog', 'pg_temp'
as $function$
declare
  affected uuid[];
  label    text;
begin
  if kind = 'scenario' then
    select array_agg(c.id), max(sc.name) into affected, label
    from public.cells c
    join public.paths p on p.id = c.path_id
    join public.service_scenarios sc on sc.id = p.service_scenario_id
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
    -- scenario. Resolve the given layer to its (scenario, name) and count
    -- every lane the delete would actually take.
    select array_agg(c.id), max(l.name) into affected, label
    from public.cells c
    join public.layers l on l.id = c.layer_id
    join public.paths  p on p.id = l.path_id
    where p.service_scenario_id = (
            select p2.service_scenario_id
            from public.layers l2
            join public.paths p2 on p2.id = l2.path_id
            where l2.id = target_id
          )
      and l.name = (select l3.name from public.layers l3 where l3.id = target_id);

  else
    raise exception 'Unknown kind %', kind;
  end if;

  affected := coalesce(affected, array[]::uuid[]);

  return jsonb_build_object(
    'label', coalesce(label, ''),
    'cell_count', cardinality(affected),
    'dependency_count', (
      select count(*) from public.cell_triggers t
      where t.source_cell_id = any(affected) or t.target_cell_id = any(affected)
    ),
    'affected_slices', public.slices_referencing(affected)
  );
end;
$function$;

grant execute on function public.deletion_impact(text, uuid, uuid) to anon, authenticated;
