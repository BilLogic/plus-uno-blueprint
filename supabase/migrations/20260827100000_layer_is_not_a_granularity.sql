-- 20260827100000 — `layer` stops being an accepted granularity.
--
-- The follow-up #144 named and #150 gated. `search_blueprint` has accepted
-- `granularity => 'layer'` alongside `'lane'` since 20260826120000, which added
-- `'lane'` and kept `'layer'` on purpose: uno-bot vendors the contract and
-- deploys on its own cadence, so a hard flip could have broken every bot search
-- in the window between the two deploys.
--
-- THE GATE WAS SMALLER THAN IT WAS WRITTEN, and both callers were checked
-- rather than assumed. The reasoning was inherited from 20260820120100, which
-- renamed the PARAMETER `filter_layer_role` — PostgREST binds RPC arguments by
-- name, so a parameter rename really can break a caller mid-deploy. It does not
-- transfer to an accepted VALUE:
--
--   uno-bot never sends `granularity` at all. `tryHybrid` posts q,
--   query_embedding, match_count, embed_model and optionally include; the RPC
--   falls back to its own default, array['cell'].
--
--   This app's agent only knows `lane`. GRANULARITY_LEVELS in
--   src/lib/agent/tools/read.ts has no `layer`, and rejects an unknown level
--   client-side before the RPC is reached.
--
-- The sync happened anyway — plus-uno#257 is deployed and /health/blueprint
-- reports r74-2026-08-26 — so the vendored copy carries the current contract
-- regardless.
--
-- WHY THE WHOLE FUNCTION IS RETYPED, rather than patched like its predecessors.
-- Those patched the LIVE definition with textual `replace` on
-- pg_get_functiondef, which scripts/migration-replay.mjs cannot apply. So the
-- file series still declares what the last full CREATE said — including the OUT
-- column `layer`, renamed to `lane` on production by 20260820120100 and never in
-- a file since. check:identifiers carries a standing exemption for exactly that,
-- whose `until` is this issue. Retyping is what ends it: the files and the
-- database say the same thing again, and the next reader can read the function
-- without replaying four patches in their head.
--
-- The body below is production's, byte for byte (md5 68b9717e…), with four
-- edits and nothing else: the guard list, the hint, and the two
-- `('layer' = any(gran) or 'lane' = any(gran))` predicates.
--
-- DROP AND CREATE, NOT CREATE OR REPLACE. The file series declares the OUT
-- column as `layer` and this declares it `lane`; `create or replace` cannot
-- change a return column's name and would raise on any from-scratch bootstrap.
-- It would pass CI, which has no Postgres to raise it — so this file has to be
-- right without a machine to check it.
--
-- Dropping discards the ACL. 20260820120100 rebuilt grants from a captured ACL
-- and did NOT revoke EXECUTE from PUBLIC, which a fresh `create function` grants
-- by default; 20260820120200 exists solely to clean that up. Both lessons are
-- applied below, written out rather than captured, because the correct ACL is
-- known and a literal is auditable in a way a loop is not.

drop function if exists public.search_blueprint(
  text, vector, integer, text, integer, text, text, text, text, text[], text[]);

create function public.search_blueprint(
  q                text    default null,
  query_embedding  vector  default null,
  match_count      integer default 15,
  embed_model      text    default null,
  rrf_k            integer default 60,
  filter_phase     text    default null,
  filter_scenario  text    default null,
  filter_path_type text    default null,
  filter_lane_role text    default null,
  granularity      text[]  default array['cell'::text],
  include          text[]  default '{}'::text[]
)
returns table (
  kind          text,
  id            uuid,
  title         text,
  snippet       text,
  description   text,
  lane          text,
  step          text,
  scenario      text,
  phase         text,
  path          text,
  links         jsonb,
  updated_at    timestamptz,
  similarity    double precision,
  rrf_score     double precision,
  matched_by    text,
  total_matched bigint
)
language plpgsql
stable
security definer
set search_path to 'public', 'extensions', 'semantic_search', 'pg_temp'
as $function$
declare
  idx_model text;
  qq        tsquery;
  cap       int := greatest(coalesce(match_count, 15), 1);
  gran      text[] := coalesce(nullif(granularity, '{}'), array['cell']);
  inc       text[] := coalesce(include, '{}');
  bad       text;
  total     bigint;
begin
  select g into bad from unnest(gran) g
  where g not in ('phase','scenario','path','step','lane','cell') limit 1;
  if bad is not null then
    raise exception 'unknown granularity: %', bad
      using hint = 'One or more of: phase, scenario, path, step, lane, cell.';
  end if;

  select g into bad from unnest(inc) g
  where g not in ('edges','findings','slices') limit 1;
  if bad is not null then
    raise exception 'unknown include: %', bad
      using hint = 'One or more of: edges, findings, slices.';
  end if;

  if embed_model is not null then
    select m.model into idx_model from semantic_search.index_meta m where m.source = 'blueprint';
    if idx_model is not null and idx_model <> embed_model then
      raise exception 'embedding model mismatch: caller=% index=%', embed_model, idx_model
        using hint = 'Re-embed the index or fix the caller; similarity across different models is meaningless.';
    end if;
  end if;

  qq := case when nullif(trim(coalesce(q,'')),'') is null then null
             else websearch_to_tsquery('english', q) end;
  if qq is not null and qq::text = '' then qq := null; end if;

  select
    coalesce((
      select count(*)
      from public.cells c
      join public.lanes l              on l.id  = c.lane_id
      join public.paths p               on p.id  = c.path_id
      join public.scenarios sc  on sc.id = p.scenario_id
      join public.phases ph             on ph.id = sc.phase_id
      left join public.steps st         on st.id = c.step_id
      where 'cell' = any(gran)
        and (filter_phase      is null or lower(ph.name) = lower(filter_phase))
        and (filter_scenario   is null or lower(sc.name) = lower(filter_scenario))
        and (filter_path_type  is null or p.path_type    = filter_path_type)
        and (filter_lane_role is null or l.lane_role   = filter_lane_role)
        and (qq is null
             or c.search_tsv @@ qq
             or to_tsvector('english',
                  concat_ws(' ', ph.name, sc.name, p.name, st.name, l.name)) @@ qq)
    ), 0)
    +
    coalesce((
      select count(*) from (
        select ph.name as nm from public.phases ph
        where 'phase' = any(gran)
          and (filter_phase is null or lower(ph.name) = lower(filter_phase))
          and filter_scenario is null and filter_path_type is null
          and filter_lane_role is null
        union all
        select sc.name from public.scenarios sc
        join public.phases ph on ph.id = sc.phase_id
        where 'scenario' = any(gran)
          and (filter_phase    is null or lower(ph.name) = lower(filter_phase))
          and (filter_scenario is null or lower(sc.name) = lower(filter_scenario))
          and filter_path_type is null and filter_lane_role is null
        union all
        select p.name from public.paths p
        join public.scenarios sc on sc.id = p.scenario_id
        join public.phases ph            on ph.id = sc.phase_id
        where 'path' = any(gran)
          and (filter_phase     is null or lower(ph.name) = lower(filter_phase))
          and (filter_scenario  is null or lower(sc.name) = lower(filter_scenario))
          and (filter_path_type is null or p.path_type    = filter_path_type)
          and filter_lane_role is null
        union all
        select st.nm from (
          select distinct on (st2.id) st2.id, st2.name as nm, sc2.name as scn,
                 ph2.name as phn, p2.path_type as pt
          from public.steps st2
          join public.scenarios sc2 on sc2.id = st2.scenario_id
          join public.phases ph2            on ph2.id = sc2.phase_id
          left join public.path_steps ps2   on ps2.step_id = st2.id
          left join public.paths p2         on p2.id = ps2.path_id
        ) st
        where 'step' = any(gran)
          and (filter_phase     is null or lower(st.phn) = lower(filter_phase))
          and (filter_scenario  is null or lower(st.scn) = lower(filter_scenario))
          and (filter_path_type is null or st.pt         = filter_path_type)
          and filter_lane_role is null
        union all
        select l.name from public.lanes l
        join public.paths p              on p.id  = l.path_id
        join public.scenarios sc on sc.id = p.scenario_id
        join public.phases ph            on ph.id = sc.phase_id
        where 'lane' = any(gran)
          and (filter_phase      is null or lower(ph.name) = lower(filter_phase))
          and (filter_scenario   is null or lower(sc.name) = lower(filter_scenario))
          and (filter_path_type  is null or p.path_type    = filter_path_type)
          and (filter_lane_role is null or l.lane_role   = filter_lane_role)
      ) s
      where qq is null or to_tsvector('english', coalesce(s.nm,'')) @@ qq
    ), 0)
  into total;

  return query
  with scoped as (
    select c.id as cell_id, c.content, c.summary as descr, c.links as lnk,
           c.updated_at as upd,
           l.name as lane, st.name as step_name, sc.name as scen, ph.name as ph_name,
           p.name as path_name, p.path_type as ptype,
           ph.position as ph_ord, sc.position as sc_ord,
           c.position as slot, l.position as lrow,
           c.search_tsv,
           concat_ws(' ', ph.name, sc.name, p.name, st.name, l.name) as crumb
    from public.cells c
    join public.lanes l              on l.id  = c.lane_id
    join public.paths p               on p.id  = c.path_id
    join public.scenarios sc  on sc.id = p.scenario_id
    join public.phases ph             on ph.id = sc.phase_id
    left join public.steps st         on st.id = c.step_id
    where 'cell' = any(gran)
      and (filter_phase      is null or lower(ph.name) = lower(filter_phase))
      and (filter_scenario   is null or lower(sc.name) = lower(filter_scenario))
      and (filter_path_type  is null or p.path_type    = filter_path_type)
      and (filter_lane_role is null or l.lane_role   = filter_lane_role)
  ),
  structural as (
    select 'phase'::text as knd, ph.id, ph.name as nm, ph.summary as descr,
           ph.updated_at as upd,
           ph.name as ph_name, null::text as scen, null::text as path_name,
           null::text as ptype, null::text as step_name, null::text as lane,
           ph.position as ph_ord, -1 as sc_ord, -1 as slot, -1 as lrow
    from public.phases ph
    where 'phase' = any(gran)
      and (filter_phase is null or lower(ph.name) = lower(filter_phase))
      and filter_scenario is null and filter_path_type is null
      and filter_lane_role is null
    union all
    select 'scenario', sc.id, sc.name, sc.summary, sc.updated_at,
           ph.name, sc.name, null, null, null, null,
           ph.position, sc.position, -1, -1
    from public.scenarios sc
    join public.phases ph on ph.id = sc.phase_id
    where 'scenario' = any(gran)
      and (filter_phase    is null or lower(ph.name) = lower(filter_phase))
      and (filter_scenario is null or lower(sc.name) = lower(filter_scenario))
      and filter_path_type is null and filter_lane_role is null
    union all
    select 'path', p.id, p.name, p.summary, p.updated_at,
           ph.name, sc.name, p.name, p.path_type, null, null,
           ph.position, sc.position, -1, -1
    from public.paths p
    join public.scenarios sc on sc.id = p.scenario_id
    join public.phases ph            on ph.id = sc.phase_id
    where 'path' = any(gran)
      and (filter_phase     is null or lower(ph.name) = lower(filter_phase))
      and (filter_scenario  is null or lower(sc.name) = lower(filter_scenario))
      and (filter_path_type is null or p.path_type    = filter_path_type)
      and filter_lane_role is null
    union all
    select 'step', t.id, t.nm, null, t.upd,
           t.phn, t.scn, t.pnm, t.pt, t.nm, null,
           t.ph_ord, t.sc_ord, t.col, -1
    from (
      select distinct on (st.id)
             st.id, st.name as nm, st.updated_at as upd,
             ph.name as phn, sc.name as scn, p.name as pnm, p.path_type as pt,
             ph.position as ph_ord, sc.position as sc_ord,
             coalesce(ps.position, -1) as col
      from public.steps st
      join public.scenarios sc on sc.id = st.scenario_id
      join public.phases ph            on ph.id = sc.phase_id
      left join public.path_steps ps   on ps.step_id = st.id
      left join public.paths p         on p.id = ps.path_id
      where 'step' = any(gran)
        and (filter_phase     is null or lower(ph.name) = lower(filter_phase))
        and (filter_scenario  is null or lower(sc.name) = lower(filter_scenario))
        and (filter_path_type is null or p.path_type    = filter_path_type)
        and filter_lane_role is null
      order by st.id, ps.position nulls last
    ) t
    union all
    select 'lane', l.id, l.name, l.lane_role, l.updated_at,
           ph.name, sc.name, p.name, p.path_type, null, l.name,
           ph.position, sc.position, -1, l.position
    from public.lanes l
    join public.paths p              on p.id  = l.path_id
    join public.scenarios sc on sc.id = p.scenario_id
    join public.phases ph            on ph.id = sc.phase_id
    where 'lane' = any(gran)
      and (filter_phase      is null or lower(ph.name) = lower(filter_phase))
      and (filter_scenario   is null or lower(sc.name) = lower(filter_scenario))
      and (filter_path_type  is null or p.path_type    = filter_path_type)
      and (filter_lane_role is null or l.lane_role   = filter_lane_role)
  ),
  vec as (
    select s.cell_id,
           (1 - (cc.embedding <=> query_embedding))::float8 as sim,
           row_number() over (order by cc.embedding <=> query_embedding) as rnk
    from semantic_search.corpus_chunks cc
    join scoped s on s.cell_id::text = cc.source_key
    where query_embedding is not null and cc.source = 'blueprint'
    order by cc.embedding <=> query_embedding
    limit cap * 4
  ),
  kw_body as (
    select s.cell_id,
           row_number() over (order by ts_rank(s.search_tsv, qq) desc, s.cell_id) as rnk
    from scoped s
    where qq is not null and s.search_tsv @@ qq
    limit cap * 4
  ),
  kw_name as (
    select s.cell_id,
           row_number() over (
             order by ts_rank(to_tsvector('english', s.crumb), qq) desc,
                      length(coalesce(s.content,'')) desc, s.cell_id
           ) as rnk
    from scoped s
    where qq is not null and to_tsvector('english', s.crumb) @@ qq
    limit cap * 4
  ),
  fused as (
    select
      coalesce(v.cell_id, b.cell_id, n.cell_id) as cell_id,
        coalesce(1.0::float8 / (rrf_k + v.rnk), 0.0)
      + coalesce(1.0::float8 / (rrf_k + b.rnk), 0.0)
      + coalesce(1.0::float8 / (rrf_k + n.rnk), 0.0) as score,
      v.sim,
      concat_ws('+',
        case when v.cell_id is not null then 'vector'     end,
        case when b.cell_id is not null then 'keyword'    end,
        case when n.cell_id is not null then 'structural' end) as how
    from vec v
      full outer join kw_body b on b.cell_id = v.cell_id
      full outer join kw_name n on n.cell_id = coalesce(v.cell_id, b.cell_id)
  ),
  picked as (
    select f.cell_id, f.score, f.sim, f.how, null::bigint as ord
    from fused f
    where qq is not null or query_embedding is not null
    union all
    select s.cell_id, null, null, 'filter',
           row_number() over (order by s.ph_ord, s.sc_ord, s.path_name, s.slot, s.lrow)
    from scoped s
    where qq is null and query_embedding is null
  ),
  cell_rows as (
    select
      'cell'::text as knd,
      s.cell_id as rid,
      concat_ws(' · ',
        'Phase: '    || s.ph_name,
        'Scenario: ' || s.scen,
        'Path: '     || s.path_name || ' (' || s.ptype || ')',
        'Step: '     || s.step_name,
        'Lane: '     || s.lane) as ttl,
      coalesce(cc.chunk, s.content) as snip,
      s.descr, s.lane, s.step_name, s.scen, s.ph_name, s.path_name,
      s.lnk, s.upd, k.sim, k.score, k.how, k.ord,
      s.ph_ord, s.sc_ord, s.slot, s.lrow
    from picked k
    join scoped s on s.cell_id = k.cell_id
    left join semantic_search.corpus_chunks cc
           on cc.source_key = s.cell_id::text and cc.source = 'blueprint'
  ),
  structural_rows as (
    select
      x.knd, x.id as rid,
      concat_ws(' · ',
        'Phase: '    || x.ph_name,
        'Scenario: ' || x.scen,
        'Path: '     || x.path_name) as ttl,
      x.nm as snip,
      x.descr, x.lane, x.step_name, x.scen, x.ph_name, x.path_name,
      null::jsonb as lnk, x.upd,
      null::float8 as sim,
      case when qq is null then null else 1.0::float8 / (rrf_k + 1) end as score,
      case when qq is null then 'filter' else 'structural' end as how,
      null::bigint as ord,
      x.ph_ord, x.sc_ord, x.slot, x.lrow
    from structural x
    where qq is null
       or to_tsvector('english', coalesce(x.nm,'')) @@ qq
  ),
  everything as (
    select * from cell_rows
    union all
    select * from structural_rows
  ),
  -- The result the caller asked for, ranked and capped. Everything below
  -- describes THIS set, so it has to be materialised before the includes.
  picked_rows as (
    select e.*,
           row_number() over (
             order by e.score desc nulls last, e.ord nulls last,
                      e.ph_ord, e.sc_ord, e.path_name nulls first,
                      e.slot, e.lrow, e.rid) as rn
    from everything e
    order by e.score desc nulls last, e.ord nulls last,
             e.ph_ord, e.sc_ord, e.path_name nulls first,
             e.slot, e.lrow, e.rid
    limit cap
  ),
  hit_cells as (select pr.rid from picked_rows pr where pr.knd = 'cell'),
  -- Includes do NOT count against match_count: they are context about the
  -- rows already returned, not more results. A caller asking for 15 cells
  -- with edges gets 15 cells.
  inc_rows as (
    select 'edge'::text as knd, t.id as rid,
           'Edge · ' || coalesce(t.kind,'leads_to') as ttl,
           left(coalesce(sc.content, '(empty cell)'), 120) ||
             ' --' || coalesce(t.kind,'leads_to') || '--> ' ||
             left(coalesce(tc.content, '(empty cell)'), 120) ||
             coalesce(' "' || t.label || '"', '') as snip,
           t.note as descr,
           null::text as lane, null::text as step_name, null::text as scen,
           null::text as ph_name, null::text as path_name,
           jsonb_build_object('source_cell_id', t.source_cell_id,
                              'target_cell_id', t.target_cell_id,
                              'source_content', left(sc.content, 120),
                              'target_content', left(tc.content, 120),
                              'kind', coalesce(t.kind,'leads_to'),
                              'label', t.label) as lnk,
           t.updated_at as upd, null::float8 as sim, null::float8 as score,
           'include:edges'::text as how, 1 as seq
    from public.cell_dependencies t
    join public.cells sc on sc.id = t.source_cell_id
    join public.cells tc on tc.id = t.target_cell_id
    where 'edges' = any(inc)
      and (t.source_cell_id in (select rid from hit_cells)
        or t.target_cell_id in (select rid from hit_cells))

    union all
    select 'finding', f.id,
           'Finding · ' || f.check_name || ' (' || f.severity || ', ' || f.status || ')',
           coalesce(f.note, f.check_name),
           null, null, null, null, null, null,
           jsonb_build_object('cell_ids', to_jsonb(f.cell_ids),
                              'check_name', f.check_name,
                              'severity', f.severity,
                              'status', f.status,
                              'source', f.source),
           f.updated_at, null, null, 'include:findings', 2
    from public.findings f
    where 'findings' = any(inc)
      and f.status = 'open'
      and f.cell_ids && array(select rid from hit_cells)

    union all
    select 'slice', sl.id,
           'Slice · ' || sl.slice_type || coalesce(' · ' || sl.actor, ''),
           sl.title, sl.description,
           null, null, null, null, null,
           jsonb_build_object('slice_type', sl.slice_type, 'actor', sl.actor),
           sl.updated_at, null, null, 'include:slices', 3
    from public.slices sl
    where 'slices' = any(inc)
      and exists (
        select 1 from public.slice_items si
        where si.slice_id = sl.id
          and si.cell_ids && array(select rid from hit_cells)
      )
  )
  select r.knd, r.rid, r.ttl, r.snip, r.descr, r.lane, r.step_name,
         r.scen, r.ph_name, r.path_name, r.lnk, r.upd, r.sim, r.score, r.how,
         total
  from (
    select pr.knd, pr.rid, pr.ttl, pr.snip, pr.descr, pr.lane, pr.step_name,
           pr.scen, pr.ph_name, pr.path_name, pr.lnk, pr.upd, pr.sim, pr.score,
           pr.how, 0 as seq, pr.rn
    from picked_rows pr
    union all
    select ir.knd, ir.rid, ir.ttl, ir.snip, ir.descr, ir.lane, ir.step_name,
           ir.scen, ir.ph_name, ir.path_name, ir.lnk, ir.upd, ir.sim, ir.score,
           ir.how, ir.seq, 0::bigint
    from inc_rows ir
  ) r
  order by r.seq, r.rn, r.rid;
end;
$function$;

-- The ACL the drop discarded, restored exactly. `revoke ... from public` is the
-- half 20260820120100 forgot: SECURITY DEFINER plus the PUBLIC default is how a
-- definer function becomes callable by anyone who can reach the database.
revoke execute on function public.search_blueprint(
  text, vector, integer, text, integer, text, text, text, text, text[], text[]) from public;
grant execute on function public.search_blueprint(
  text, vector, integer, text, integer, text, text, text, text, text[], text[]) to anon;
grant execute on function public.search_blueprint(
  text, vector, integer, text, integer, text, text, text, text, text[], text[]) to authenticated;
grant execute on function public.search_blueprint(
  text, vector, integer, text, integer, text, text, text, text, text[], text[]) to service_role;

-- ---------------------------------------------------------------------------
-- Post-conditions. A retype is a large edit for a small change, so what the
-- change was meant to do is asserted rather than eyeballed.
-- ---------------------------------------------------------------------------

do $assert$
declare
  d    text;
  n    integer;
  role text;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname = 'search_blueprint';
  if d is null then raise exception 'search_blueprint is gone'; end if;

  -- 1. The retired spelling is nowhere in it: guard, hint, predicates, OUT
  -- column, comments. The whole point of the migration.
  if d ~ 'layer' then
    raise exception 'search_blueprint still names "layer" somewhere in its definition';
  end if;

  -- 2. The lane rung still exists. A predicate DELETED rather than narrowed
  -- would satisfy the check above too, and would silently stop returning lanes.
  if position('''lane'' = any(gran)' in d) = 0 then
    raise exception 'search_blueprint no longer selects lanes by granularity';
  end if;

  -- 3. The OUT column is `lane` — the finding that outlived four migrations.
  select count(*) into n
  from information_schema.parameters
  where specific_schema = 'public'
    and specific_name like 'search_blueprint%'
    and parameter_mode = 'OUT' and parameter_name = 'lane';
  if n <> 1 then
    raise exception 'expected one OUT column named lane, found %', n;
  end if;

  -- 4. The ACL, which a drop discards silently.
  if has_function_privilege('public', 'public.search_blueprint(text, vector, integer, text, integer, text, text, text, text, text[], text[])', 'execute') then
    raise exception 'search_blueprint is executable by PUBLIC, and is SECURITY DEFINER';
  end if;
  foreach role in array array['anon', 'authenticated', 'service_role'] loop
    if not has_function_privilege(role, 'public.search_blueprint(text, vector, integer, text, integer, text, text, text, text, text[], text[])', 'execute') then
      raise exception '% lost execute on search_blueprint', role;
    end if;
  end loop;
end
$assert$;
