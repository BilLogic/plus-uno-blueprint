-- service_scenarios → scenarios, and service_scenario_id → scenario_id.
--
-- Every sibling in the tree is unprefixed: phases, paths, steps, lanes, cells,
-- slices, findings, evidence. `service_scenarios` was the only prefixed member,
-- left over from when everything hung off a `service_` root.
--
-- Plan 002 kept it, justified as "once service_lifecycles becomes services, the
-- family is services → service_scenarios — two members, both real". That
-- justification was WRONG about the relationship: a scenario's FK is phase_id.
-- It does not belong to a service directly at all, so the prefix named a parent
-- that is not there.
--
-- The product says "scenario" and the agent surface already exposes it as one
-- (`filter_scenario`). This makes the table agree with both.
--
-- No RPC parameter is named service_scenario_id, so nothing here needs a drop
-- and recreate — and therefore none of the ACL repair the layers→lanes rename
-- required. Verified before writing this: zero rows from
--   select … from pg_proc where pg_get_function_arguments(oid) ~ 'service_scenario_id'
--
-- ⚠️ Cross-repo: uno-bot embeds `scenario:service_scenarios(name)` in its
-- /health probe and its fallback table search, and lists the table in the
-- contract. Ships in the same window as the other couplings.

alter table public.service_scenarios rename to scenarios;
alter table public.paths rename column service_scenario_id to scenario_id;
alter table public.steps rename column service_scenario_id to scenario_id;

alter table public.scenarios rename constraint service_scenarios_pkey            to scenarios_pkey;
alter table public.scenarios rename constraint service_scenarios_phase_id_fkey   to scenarios_phase_id_fkey;
alter table public.scenarios rename constraint service_scenarios_origin_check    to scenarios_origin_check;
alter table public.scenarios rename constraint service_scenarios_view_type_check to scenarios_view_type_check;
alter table public.paths     rename constraint paths_service_scenario_id_fkey    to paths_scenario_id_fkey;
alter table public.steps     rename constraint steps_service_scenario_id_fkey    to steps_scenario_id_fkey;

alter index public.service_scenarios_phase_id_idx    rename to scenarios_phase_id_idx;
alter index public.service_scenarios_phase_order_idx rename to scenarios_phase_position_idx;
alter index public.paths_service_scenario_id_idx     rename to paths_scenario_id_idx;
alter index public.steps_service_scenario_id_idx     rename to steps_scenario_id_idx;

alter policy service_scenarios_select              on public.scenarios rename to scenarios_select;
alter policy service_scenarios_insert_service_only on public.scenarios rename to scenarios_insert_service_only;
alter policy service_scenarios_update_service_only on public.scenarios rename to scenarios_update_service_only;
alter policy service_scenarios_update_auth         on public.scenarios rename to scenarios_update_auth;
alter policy service_scenarios_delete_service_only on public.scenarios rename to scenarios_delete_service_only;

alter trigger set_service_scenarios_updated_at on public.scenarios rename to set_scenarios_updated_at;

do $do$
declare r record; d text; n int := 0;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p join pg_namespace nsp on nsp.oid = p.pronamespace
    where nsp.nspname in ('public','semantic_search') and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~ '\mservice_scenarios?\M'
  loop
    d := pg_get_functiondef(r.oid);
    d := regexp_replace(d, '\mservice_scenario_id\M', 'scenario_id', 'g');
    d := regexp_replace(d, '\mservice_scenarios\M',   'scenarios',   'g');
    execute d;
    n := n + 1;
  end loop;
  if n <> 7 then
    raise exception 'expected 7 function bodies naming service_scenarios, rewrote %', n;
  end if;
end
$do$;
