-- 20260827200000 — the keyword arm stops going silent on paraphrases.
--
-- BR3 ("who decides whether a call-off is excused") has failed every retrieval
-- eval run since the breadcrumb re-embed. The right cell says "Reviews pending
-- call-off requests and records a decision."; retrieval ranked the "Dev Team"
-- cell in the same step above it.
--
-- THE CAUSE IS `websearch_to_tsquery`, WHICH ANDS EVERY CONTENT WORD. That
-- query yields five lexemes — call, call-off, decid, excus, whether. The right
-- cell carries three of them, "Dev Team" carries two (both from the breadcrumb
-- baked into search_tsv). Neither satisfies the AND, so the keyword arm
-- returned nothing at all and the vector arm decided the case alone. A short
-- cell whose chunk is mostly breadcrumb embeds close to the step name, which is
-- why the wrong one won.
--
-- PLAIN OR WAS TRIED FIRST, IN PRODUCTION, AND WAS WORSE. It fixed BR3 and
-- broke BR1, BR5, BR25 and BR26; overall recall fell 0.962 -> 0.846 and it was
-- rolled back (#154). OR converts "no keyword signal" into "keyword signal for
-- everything": for BR5 it admits 626 of 931 cells, and because RRF weights
-- every arm equally, an arm that ranks two-thirds of the corpus outvotes a
-- vector arm that had the answer at rank 5.
--
-- THE RULE HERE IS A FLOOR PLUS A GATE, and it needs both.
--
--   floor   qmin = least(n, greatest(3, ceil(n/2)))
--
--     A cell is admitted when it carries at least qmin of the query's n
--     distinct lexemes. For n <= 3 that expression IS n, and in that case the
--     original `@@ qq` predicate is used verbatim rather than an equivalent
--     count — see the note on kw_body, since a count is NOT equivalent once
--     the query contains `-term` or `or`. So short queries keep today's
--     admission exactly, which matters most for the exact-term cases, where
--     AND legitimately matches 26 cells and a gate would be wrong. The 3 is
--     what stops a two-word query from admitting a quarter of the corpus, and
--     what keeps both absence cases returning nothing here.
--
--     Ordering within the arm DOES change for short queries: ranking is by
--     ts_rank against qor rather than qq. Three cases reorder inside their
--     top-k as a result and none change outcome. Admission is what is held
--     identical, not order.
--
--   gate    when the floor loosened, the arm counts only if it still
--           narrowed the corpus to at most `match_count` rows
--
--     The floor alone is NOT the fix. Measured on its own it traded BR3 for
--     BR5 — 25/26 before, 25/26 after, a different case red. BR5's own cell
--     shares two lexemes and stays out while 34 unrelated cells get in. An arm
--     admitting more rows than are being returned is not selecting between
--     cells, it is listing them, and that is precisely when it should abstain.
--
-- MEASURED, NOT REASONED. Both halves were built as candidate functions
-- alongside the live one and scored by the full 26-case retrieval eval before
-- anything moved (the `?rpc=` loop, plus-uno#272 and #273 — the ordering
-- mistake #154 records was applying first and spot-checking three cases after).
-- This body is byte-identical to `search_blueprint_minov4`, which scored 26/26
-- with recall 1.000 on two independent runs with identical top-k, against the
-- live function's 25/26 and 0.962. BR3 is the only case whose outcome changes.
-- Median latency 306ms and 385ms across those runs, against 341ms live.
--
-- `create or replace` rather than drop-and-create: no argument or OUT column
-- changes here, and replace preserves the ACL that a drop discards. The grants
-- below are therefore re-stated for the record, not to repair anything.

create or replace function public.search_blueprint(
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
  qlex      text[];
  qor       tsquery;
  qmin      int;
  qn        int;
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

  -- MINIMUM OVERLAP, GATED ON SELECTIVITY.
  --
  -- websearch_to_tsquery ANDs every content word, so a paraphrase sharing
  -- three of five terms with the right cell matches nothing and the keyword
  -- arm goes silent. Plain OR is worse -- it turns "no keyword signal" into
  -- "keyword signal for everything", which fixed one case and broke four
  -- (plus-uno-blueprint#154).
  --
  -- qmin = least(n, greatest(3, ceil(n/2))). For n <= 3 that IS n, so short
  -- queries keep AND admission -- including the exact-term cases, where AND
  -- legitimately matches 26 cells and must not be gated away.
  if qq is not null then
    qlex := array(select unnest(tsvector_to_array(to_tsvector('english', q))) order by 1);
    qn := cardinality(qlex);
    if qn > 0 then
      qmin := least(qn, greatest(3, ceil(qn::numeric / 2)::int));
      qor  := to_tsquery('english',
                array_to_string(array(select quote_literal(u) from unnest(qlex) u), ' | '));
    else
      qq := null;
    end if;
  end if;

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
    -- The gate: when the floor was LOOSENED (qmin < qn), the arm only counts
    -- if it still narrowed the corpus to at most what the caller asked for.
    -- An arm admitting more rows than are being returned is not selecting
    -- between cells, it is listing them -- and RRF weights every arm equally,
    -- so an undifferentiated arm outvotes a vector arm that had the answer.
    --
    -- WHEN THE FLOOR DID NOT LOOSEN, `@@ qq` IS USED VERBATIM rather than the
    -- overlap count. An overlap count is a bag of words, and
    -- websearch_to_tsquery is not: it also understands `-term` (NOT) and
    -- `or`. Counting lexemes inverts the first -- `call-off -excused` would
    -- require a cell to CONTAIN `excus`, returning 8 cells every one of which
    -- the user asked to exclude -- and collapses the second to an AND,
    -- 587 cells down to 273. Both are silent: wrong rows, not no rows.
    --
    -- `@@ qor` on the loosened branch is a LOSSLESS prefilter, there for the
    -- GIN index only: overlap >= qmin implies overlap >= 1 implies the OR
    -- query matches. Without it the array intersection runs against every
    -- cell in scope.
    select z.cell_id, z.rnk
    from (
      select s.cell_id,
             row_number() over (
               order by ov.n desc, ts_rank(s.search_tsv, qor) desc, s.cell_id
             ) as rnk,
             count(*) over () as admitted
      from scoped s
      cross join lateral (
        select cardinality(array(select unnest(qlex)
                                 intersect
                                 select unnest(tsvector_to_array(s.search_tsv)))) as n
      ) ov
      where qq is not null
        and s.search_tsv @@ (case when qmin = qn then qq else qor end)
        and (qmin = qn or ov.n >= qmin)
    ) z
    where qmin = qn or z.admitted <= cap
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

-- The ACL is unchanged by `create or replace`; restated so this file still
-- documents the whole privilege story of the function it defines.
revoke execute on function public.search_blueprint(
  text, vector, integer, text, integer, text, text, text, text, text[], text[]) from public;
grant execute on function public.search_blueprint(
  text, vector, integer, text, integer, text, text, text, text, text[], text[]) to anon;
grant execute on function public.search_blueprint(
  text, vector, integer, text, integer, text, text, text, text, text[], text[]) to authenticated;
grant execute on function public.search_blueprint(
  text, vector, integer, text, integer, text, text, text, text, text[], text[]) to service_role;

-- ---------------------------------------------------------------------------
-- Post-conditions.
--
-- These run at migration time, against a database that has no rows yet, so
-- they cannot assert "BR3 now ranks correctly" — that claim belongs to the
-- retrieval eval and is measured there. What they CAN pin is the arithmetic
-- the design rests on, and the presence of the gate, which is the half that
-- an edit could plausibly drop while leaving something that still looks right.
-- ---------------------------------------------------------------------------

do $assert$
declare
  d    text;
  n    integer;
  f    integer;
  role text;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname = 'search_blueprint';
  if d is null then raise exception 'search_blueprint is gone'; end if;

  -- 1. AND IS PRESERVED FOR SHORT QUERIES. For one, two and three lexemes the
  -- floor must equal the lexeme count, or the exact-term class starts matching
  -- on a single word and both absence cases start returning keyword hits.
  for n in 1..3 loop
    f := least(n, greatest(3, ceil(n::numeric / 2)::int));
    if f <> n then
      raise exception 'floor for % lexemes is %, expected % (AND must be preserved)', n, f, n;
    end if;
  end loop;

  -- 2. THE FLOOR NEVER FALLS BELOW 3. This is what separates this rule from
  -- the OR attempt that was rolled back: at two shared lexemes a long query
  -- would admit hundreds of cells.
  for n in 4..40 loop
    f := least(n, greatest(3, ceil(n::numeric / 2)::int));
    if f < 3 then
      raise exception 'floor for % lexemes is %, which is below the minimum of 3', n, f;
    end if;
    if f > n then
      raise exception 'floor for % lexemes is %, which no cell could satisfy', n, f;
    end if;
  end loop;

  -- 3. THE GATE IS PRESENT. A floor without it is the variant that traded BR3
  -- for BR5 — same pass count, different case red — so its absence would not
  -- show up as a drop in the headline number.
  if position('z.admitted <= cap' in d) = 0 then
    raise exception 'the selectivity gate is missing: a floor alone regresses BR5';
  end if;
  if position('qmin = qn or' in d) = 0 then
    raise exception 'the gate no longer exempts unloosened (AND) queries';
  end if;

  -- 4. THE BRANCHED PREDICATE, asserted as one string because its two halves
  -- fail differently and both silently.
  --
  --   `qq` on the unloosened branch: an overlap count is a bag of words and
  --   websearch_to_tsquery is not — it also understands `-term` (NOT) and
  --   `or`. Counting inverts the first and collapses the second, and neither
  --   raises or returns empty. It returns the wrong rows.
  --
  --   `qor` on the loosened branch: the GIN-indexable prefilter. Lossless,
  --   since overlap >= qmin implies overlap >= 1 implies the OR query
  --   matches. Dropping it leaves the arm correct but scanning every cell.
  if position('s.search_tsv @@ (case when qmin = qn then qq else qor end)' in d) = 0 then
    raise exception 'the branched keyword predicate is gone: -term and or break, or the arm scans every cell';
  end if;

  -- 5. Still one OUT column named `lane` — the finding that outlived four
  -- migrations, re-checked because this file rewrites the whole body.
  --
  -- MATCHED ON THE EXACT NAME, not `like 'search_blueprint%'` as the previous
  -- migration had it. That predicate also matches any sibling — and it did:
  -- scoring this change created candidate functions named
  -- search_blueprint_minov*, each with its own `lane` OUT column, and the
  -- assertion reported five. It would pass on a fresh replay, where only one
  -- function exists, which is exactly what makes the looseness easy to keep.
  select count(*) into n
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace,
       unnest(p.proargnames, p.proargmodes) as arg(nm, md)
  where ns.nspname = 'public' and p.proname = 'search_blueprint'
    and arg.md = 't' and arg.nm = 'lane';
  if n <> 1 then
    raise exception 'expected one OUT column named lane, found %', n;
  end if;

  -- 6. The ACL. `create or replace` preserves it, which is exactly why an
  -- assertion is worth more here than the grants above.
  if has_function_privilege('public', 'public.search_blueprint(text, vector, integer, text, integer, text, text, text, text, text[], text[])', 'execute') then
    raise exception 'search_blueprint is executable by PUBLIC, and is SECURITY DEFINER';
  end if;
  foreach role in array array['anon', 'authenticated', 'service_role'] loop
    if not has_function_privilege(role, 'public.search_blueprint(text, vector, integer, text, integer, text, text, text, text, text[], text[])', 'execute') then
      raise exception '% lost execute on search_blueprint', role;
    end if;
  end loop;

  -- 7. It still runs. No rows exist yet, so this proves the plan compiles and
  -- the new declares resolve — not that it ranks well.
  perform * from public.search_blueprint(q => 'who decides whether a call-off is excused',
                                         match_count => 5);
  perform * from public.search_blueprint(q => 'Workday', match_count => 5);
  perform * from public.search_blueprint(match_count => 5);
end
$assert$;
