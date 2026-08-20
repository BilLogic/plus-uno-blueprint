-- public.search_blueprint v5 — include fidelity.
--
-- v4 shipped `include` and it works, but two of its three branches are not
-- yet a drop-in for the caller they exist to retire. Audited against uno-bot
-- (plus-uno · agents/uno-bot/src/integrations/blueprint.ts) before the switch:
--
-- EDGES carried ids, not text. The RPC emitted
--   "8f2c…-… --trigger--> 41ab…-…"
-- while the bot's own fetchEdges resolves both ends through
--   source:cells!cell_triggers_source_cell_id_fkey(content)
-- and hands the model
--   "Enters the breakout room --trigger--> Greets the student".
-- Switching as-is would have replaced citable prose with uuids. Both ends now
-- join public.cells; the 120-char cap matches the bot's own `text()` helper.
--
-- FINDINGS ignored triage. The bot filters `status=eq.open` deliberately —
-- "the app's triage invariant is 'dismissed stays dismissed'; re-surfacing
-- closed findings in Slack re-litigates a call the team already made in-app."
-- All five findings are open today, which is exactly why this had to be fixed
-- before the first dismissal rather than after it.
--
-- SLICES are unchanged and stay unchanged. `include => slices` returns slices
-- whose frames reference the returned cells; the bot's fetchSlices runs a
-- title/actor ILIKE on the QUERY TEXT plus a rows-free head-count so that
-- "how many slices are there" is not answered with a filtered count. Two
-- different questions. The bot keeps its own call.
--
-- Additive: `include` still defaults to '{}', so every caller that does not
-- ask for includes is byte-identical.

drop function if exists public.search_blueprint(text, extensions.vector, int, text, int, text, text, text, text, text[]);

create or replace function public.search_blueprint(
  q                 text default null,
  query_embedding   extensions.vector(768) default null,
  match_count       int  default 15,
  embed_model       text default null,
  rrf_k             int  default 60,
  filter_phase      text default null,
  filter_scenario   text default null,
  filter_path_type  text default null,
  filter_layer_role text default null,
  granularity       text[] default array['cell'],
  include           text[] default '{}'
)
returns table (
  kind          text,
  id            uuid,
  title         text,
  snippet       text,
  description   text,
  layer         text,
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
set search_path = public, extensions, semantic_search, pg_temp
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
  -- Fail loudly on a granularity that does not name a rung. Silently
  -- returning zero rows for a typo would read as "the blueprint has none".
  select g into bad from unnest(gran) g
  where g not in ('phase','scenario','path','step','layer','cell') limit 1;
  if bad is not null then
    raise exception 'unknown granularity: %', bad
      using hint = 'One or more of: phase, scenario, path, step, layer, cell.';
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

  -- Empty/blank q behaves as null (filter-only), never as a no-op tsquery.
  qq := case when nullif(trim(coalesce(q,'')),'') is null then null
             else websearch_to_tsquery('english', q) end;
  if qq is not null and qq::text = '' then qq := null; end if;

  -- The honest count, CORPUS-WIDE. It has to be computed here rather than
  -- off the returned set: the retriever arms are capped at cap*4, so
  -- counting what comes back would report the candidate pool and call it
  -- the total. Semantic similarity has no meaningful "total", so the vector
  -- arm does not participate — this counts what the filters and the FTS
  -- terms match, at the requested granularities.
  select
    coalesce((
      select count(*)
      from public.cells c
      join public.layers l              on l.id  = c.layer_id
      join public.paths p               on p.id  = c.path_id
      join public.service_scenarios sc  on sc.id = p.service_scenario_id
      join public.phases ph             on ph.id = sc.phase_id
      left join public.steps st         on st.id = c.step_id
      where 'cell' = any(gran)
        and (filter_phase      is null or lower(ph.name) = lower(filter_phase))
        and (filter_scenario   is null or lower(sc.name) = lower(filter_scenario))
        and (filter_path_type  is null or p.path_type    = filter_path_type)
        and (filter_layer_role is null or l.layer_role   = filter_layer_role)
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
          and filter_layer_role is null
        union all
        select sc.name from public.service_scenarios sc
        join public.phases ph on ph.id = sc.phase_id
        where 'scenario' = any(gran)
          and (filter_phase    is null or lower(ph.name) = lower(filter_phase))
          and (filter_scenario is null or lower(sc.name) = lower(filter_scenario))
          and filter_path_type is null and filter_layer_role is null
        union all
        select p.name from public.paths p
        join public.service_scenarios sc on sc.id = p.service_scenario_id
        join public.phases ph            on ph.id = sc.phase_id
        where 'path' = any(gran)
          and (filter_phase     is null or lower(ph.name) = lower(filter_phase))
          and (filter_scenario  is null or lower(sc.name) = lower(filter_scenario))
          and (filter_path_type is null or p.path_type    = filter_path_type)
          and filter_layer_role is null
        union all
        select st.name from (
          select distinct on (st2.id) st2.id, st2.name, sc2.name as scn, ph2.name as phn,
                 p2.path_type as pt
          from public.steps st2
          join public.service_scenarios sc2 on sc2.id = st2.service_scenario_id
          join public.phases ph2            on ph2.id = sc2.phase_id
          left join public.path_steps ps2   on ps2.step_id = st2.id
          left join public.paths p2         on p2.id = ps2.path_id
        ) st
        where 'step' = any(gran)
          and (filter_phase     is null or lower(st.phn) = lower(filter_phase))
          and (filter_scenario  is null or lower(st.scn) = lower(filter_scenario))
          and (filter_path_type is null or st.pt         = filter_path_type)
          and filter_layer_role is null
        union all
        select l.name from public.layers l
        join public.paths p              on p.id  = l.path_id
        join public.service_scenarios sc on sc.id = p.service_scenario_id
        join public.phases ph            on ph.id = sc.phase_id
        where 'layer' = any(gran)
          and (filter_phase      is null or lower(ph.name) = lower(filter_phase))
          and (filter_scenario   is null or lower(sc.name) = lower(filter_scenario))
          and (filter_path_type  is null or p.path_type    = filter_path_type)
          and (filter_layer_role is null or l.layer_role   = filter_layer_role)
      ) s
      where qq is null or to_tsvector('english', coalesce(s.nm,'')) @@ qq
    ), 0)
  into total;

  return query
  with scoped as (
    select c.id as cell_id, c.content, c.description as descr, c.links as lnk,
           c.updated_at as upd,
           l.name as lane, st.name as step_name, sc.name as scen, ph.name as ph_name,
           p.name as path_name, p.path_type as ptype,
           ph.order_position as ph_ord, sc.order_position as sc_ord,
           c.slot_position as slot, l.row_position as lrow,
           c.search_tsv,
           concat_ws(' ', ph.name, sc.name, p.name, st.name, l.name) as crumb
    from public.cells c
    join public.layers l              on l.id  = c.layer_id
    join public.paths p               on p.id  = c.path_id
    join public.service_scenarios sc  on sc.id = p.service_scenario_id
    join public.phases ph             on ph.id = sc.phase_id
    left join public.steps st         on st.id = c.step_id
    where 'cell' = any(gran)
      and (filter_phase      is null or lower(ph.name) = lower(filter_phase))
      and (filter_scenario   is null or lower(sc.name) = lower(filter_scenario))
      and (filter_path_type  is null or p.path_type    = filter_path_type)
      and (filter_layer_role is null or l.layer_role   = filter_layer_role)
  ),
  -- Every non-cell rung, flattened to one shape. Each row carries the
  -- breadcrumb it sits under so the caller reads a phase row and a cell row
  -- the same way.
  structural as (
    select 'phase'::text as knd, ph.id, ph.name as nm, ph.description as descr,
           ph.updated_at as upd,
           ph.name as ph_name, null::text as scen, null::text as path_name,
           null::text as ptype, null::text as step_name, null::text as lane,
           ph.order_position as ph_ord, -1 as sc_ord, -1 as slot, -1 as lrow
    from public.phases ph
    where 'phase' = any(gran)
      and (filter_phase is null or lower(ph.name) = lower(filter_phase))
      and filter_scenario is null and filter_path_type is null
      and filter_layer_role is null

    union all
    select 'scenario', sc.id, sc.name, sc.description, sc.updated_at,
           ph.name, sc.name, null, null, null, null,
           ph.order_position, sc.order_position, -1, -1
    from public.service_scenarios sc
    join public.phases ph on ph.id = sc.phase_id
    where 'scenario' = any(gran)
      and (filter_phase    is null or lower(ph.name) = lower(filter_phase))
      and (filter_scenario is null or lower(sc.name) = lower(filter_scenario))
      and filter_path_type is null and filter_layer_role is null

    union all
    select 'path', p.id, p.name, p.description, p.updated_at,
           ph.name, sc.name, p.name, p.path_type, null, null,
           ph.order_position, sc.order_position, -1, -1
    from public.paths p
    join public.service_scenarios sc on sc.id = p.service_scenario_id
    join public.phases ph            on ph.id = sc.phase_id
    where 'path' = any(gran)
      and (filter_phase     is null or lower(ph.name) = lower(filter_phase))
      and (filter_scenario  is null or lower(sc.name) = lower(filter_scenario))
      and (filter_path_type is null or p.path_type    = filter_path_type)
      and filter_layer_role is null

    union all
    -- A step belongs to a scenario but is POSITIONED per path, so its column
    -- comes from path_steps. One row per STEP, not one per path that uses
    -- it — hence the distinct on, which needs its own subquery because a
    -- union branch cannot carry an order by.
    select 'step', t.id, t.nm, null, t.upd,
           t.phn, t.scn, t.pnm, t.pt, t.nm, null,
           t.ph_ord, t.sc_ord, t.col, -1
    from (
      select distinct on (st.id)
             st.id, st.name as nm, st.updated_at as upd,
             ph.name as phn, sc.name as scn, p.name as pnm, p.path_type as pt,
             ph.order_position as ph_ord, sc.order_position as sc_ord,
             coalesce(ps.column_position, -1) as col
      from public.steps st
      join public.service_scenarios sc on sc.id = st.service_scenario_id
      join public.phases ph            on ph.id = sc.phase_id
      left join public.path_steps ps   on ps.step_id = st.id
      left join public.paths p         on p.id = ps.path_id
      where 'step' = any(gran)
        and (filter_phase     is null or lower(ph.name) = lower(filter_phase))
        and (filter_scenario  is null or lower(sc.name) = lower(filter_scenario))
        and (filter_path_type is null or p.path_type    = filter_path_type)
        and filter_layer_role is null
      order by st.id, ps.column_position nulls last
    ) t

    union all
    select 'layer', l.id, l.name, l.layer_role, l.updated_at,
           ph.name, sc.name, p.name, p.path_type, null, l.name,
           ph.order_position, sc.order_position, -1, l.row_position
    from public.layers l
    join public.paths p              on p.id  = l.path_id
    join public.service_scenarios sc on sc.id = p.service_scenario_id
    join public.phases ph            on ph.id = sc.phase_id
    where 'layer' = any(gran)
      and (filter_phase      is null or lower(ph.name) = lower(filter_phase))
      and (filter_scenario   is null or lower(sc.name) = lower(filter_scenario))
      and (filter_path_type  is null or p.path_type    = filter_path_type)
      and (filter_layer_role is null or l.layer_role   = filter_layer_role)
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
        'Layer: '    || s.lane) as ttl,
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
      -- Ranked mode scores structural rows on their NAME, on the same RRF
      -- scale as the cell arms so one ordered list is meaningful.
      case when qq is null then null
           else 1.0::float8 / (rrf_k + 1) end as score,
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
  )
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
  -- rows already returned, not more results. Ask for 15 cells with edges
  -- and you get 15 cells.
  inc_rows as (
    -- Both ends joined, so an edge row is readable on its own. A uuid pair is
    -- not something a model can cite, and citation is the whole job.
    select 'edge'::text as knd, t.id as rid,
           'Edge · ' || coalesce(t.kind,'trigger') as ttl,
           left(coalesce(sc.content, '(empty cell)'), 120) ||
             ' --' || coalesce(t.kind,'trigger') || '--> ' ||
             left(coalesce(tc.content, '(empty cell)'), 120) ||
             coalesce(' "' || t.label || '"', '') as snip,
           t.note as descr,
           null::text as lane, null::text as step_name, null::text as scen,
           null::text as ph_name, null::text as path_name,
           jsonb_build_object('source_cell_id', t.source_cell_id,
                              'target_cell_id', t.target_cell_id,
                              'source_content', left(sc.content, 120),
                              'target_content', left(tc.content, 120),
                              'kind', coalesce(t.kind,'trigger'),
                              'label', t.label) as lnk,
           t.updated_at as upd, null::float8 as sim, null::float8 as score,
           'include:edges'::text as how, 1 as seq
    from public.cell_triggers t
    -- INNER joins: an edge whose endpoint no longer exists cannot be rendered
    -- and should not be reported. The FK makes this unreachable in practice.
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
                              'severity', f.severity,
                              'status', f.status,
                              'source', f.source),
           f.updated_at, null, null, 'include:findings', 2
    from public.findings f
    where 'findings' = any(inc)
      -- Open only. Dismissed stays dismissed: a closed finding re-surfacing
      -- in Slack re-litigates a triage call the team already made in-app.
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

revoke all on function public.search_blueprint(text, extensions.vector, int, text, int, text, text, text, text, text[], text[]) from public;
grant execute on function public.search_blueprint(text, extensions.vector, int, text, int, text, text, text, text, text[], text[])
  to anon, authenticated, service_role;
