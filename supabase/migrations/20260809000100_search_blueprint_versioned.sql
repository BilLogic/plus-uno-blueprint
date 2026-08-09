-- search_blueprint, versioned at last. The function has served the uno-bot's
-- primary keyword-search path since it shipped, but its CREATE lived only in
-- the hosted database — no repo carried it, and 20260806180000's ALTER
-- (search_path pinning) assumed it existed, so a fresh migration replay
-- failed there and a rebuilt environment silently lost the RPC (the bot then
-- degrades to a 5-subrequest table fan-out). This is the live definition,
-- captured verbatim (search_path pinning already folded in); idempotent on
-- the hosted project.
--
-- Grants: EXECUTE for anon/authenticated is intentional — STABLE, read-only,
-- and the tables it reads are public-read by policy.

create or replace function public.search_blueprint(q text)
 returns table(kind text, id uuid, title text, snippet text, layer text, step text, scenario text, phase text)
 language sql
 stable
 set search_path to 'public', 'pg_catalog', 'pg_temp'
as $function$
with terms as (
  select array_remove(string_to_array(lower(q), ' '), '') as w
),
cell_hits as (
  select c.id as id, l.name as layer, c.content as content, s.name as step, sc.name as scenario,
         (select count(*)::int from unnest(terms.w) t
           where length(t) >= 3 and (c.content ilike '%'||t||'%' or l.name ilike '%'||t||'%'
             or sc.name ilike '%'||t||'%' or coalesce(s.name,'') ilike '%'||t||'%')) as score
  from cells c
  join layers l on l.id = c.layer_id
  join paths pa on pa.id = c.path_id
  join service_scenarios sc on sc.id = pa.service_scenario_id
  left join steps s on s.id = c.step_id
  cross join terms
  where coalesce(c.content, '') <> ''
)
select * from (
  select 'cell'::text as kind, ch.id, ch.layer as title, ch.content as snippet,
         ch.layer, ch.step, ch.scenario, null::text as phase
  from cell_hits ch where ch.score >= 1
  order by ch.score desc
  limit 25
) cells_top
union all
select * from (
  select 'step'::text, st.id, st.name, null::text, null::text, st.name, sc.name, null::text
  from steps st join service_scenarios sc on sc.id = st.service_scenario_id cross join terms
  where exists (select 1 from unnest(terms.w) t where length(t) >= 3 and st.name ilike '%'||t||'%')
  limit 5
) steps_top
union all
select * from (
  select 'path'::text, pa.id, pa.name, pa.description, null::text, null::text, sc.name, null::text
  from paths pa join service_scenarios sc on sc.id = pa.service_scenario_id cross join terms
  where exists (select 1 from unnest(terms.w) t where length(t) >= 3 and (pa.name ilike '%'||t||'%' or coalesce(pa.description,'') ilike '%'||t||'%'))
  limit 5
) paths_top
union all
select * from (
  select 'scenario'::text, sc.id, sc.name, sc.description, null::text, null::text, sc.name, ph.name
  from service_scenarios sc join phases ph on ph.id = sc.phase_id cross join terms
  where exists (select 1 from unnest(terms.w) t where length(t) >= 3 and (sc.name ilike '%'||t||'%' or coalesce(sc.description,'') ilike '%'||t||'%'))
  limit 5
) scen_top
union all
select * from (
  select 'phase'::text, p.id, p.name, p.description, null::text, null::text, null::text, p.name
  from phases p cross join terms
  where exists (select 1 from unnest(terms.w) t where length(t) >= 3 and (p.name ilike '%'||t||'%' or coalesce(p.description,'') ilike '%'||t||'%'))
  limit 4
) phase_top;
$function$;
