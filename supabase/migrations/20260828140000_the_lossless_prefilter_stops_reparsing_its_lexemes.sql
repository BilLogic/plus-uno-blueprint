-- 20260828140000 -- the lossless prefilter stops re-parsing its own lexemes.
--
-- The keyword arm's loosened branch matches on `qor`, an OR over the query's
-- distinct lexemes, and the comment above it calls that prefilter LOSSLESS: a
-- cell with overlap >= qmin has overlap >= 1, so the OR must match it and the
-- prefilter can never drop a row the overlap rule admits.
--
-- The construction did not earn that word. `qor` was built by feeding the
-- lexemes back through to_tsquery, and to_tsquery is not the identity on a
-- lexeme -- it applies the dictionary a second time:
--
--     to_tsquery('english', quote_literal(l))    quote_literal(l)::tsquery
--     ---------------------------------------    -------------------------
--     'call-off'  ->  'call-off' <-> 'call'      'call-off'
--     'i-9'       ->  '-9'                       'i-9'
--     'a*b'       ->  'b'                        'a*b'
--     'x:y'       ->  'x' <-> 'y'                'x:y'
--     'o''brien'  ->  'o' <-> 'brien'            'o''brien'
--
-- Measured on production, not reasoned about. The left column is what the
-- prefilter was actually testing; a cell can carry the lexeme in the right
-- column and fail the query in the left, and then it is dropped despite
-- satisfying the overlap rule the arm is supposed to implement.
--
-- NOTHING IS OBSERVABLY BROKEN TODAY, AND THAT WAS CHECKED BEFORE CHANGING IT.
-- Across all 26 fixture queries plus two synthetic ones built to trigger it,
-- the count of rows the old `qor` dropped is ZERO. The reason is a property of
-- the parser rather than of the rule: to_tsvector emits a compound's parts
-- alongside the compound, so `qlex` holds `9` next to `i-9`, and the surviving
-- alternative catches the cell. This migration is not a bug fix. It removes
-- the dependence on that coincidence, so the comment is true by construction
-- and stays true under a different text search configuration.
--
-- The cast is the whole change. `text::tsquery` goes through the tsquery input
-- function, which parses operators and quoting but performs no dictionary
-- lookup, so a quoted lexeme is stored verbatim.
--
-- BEHAVIOUR IS IDENTICAL ON THIS CORPUS, verified before promotion: a
-- candidate function built from the live definition with only this line
-- changed returns the same id set for all 28 queries at match_count 50, and
-- the same ORDER for the 21 of them that return anything with the vector arm
-- off. plus-uno-blueprint#161.

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
      -- CAST, NOT to_tsquery. `qlex` already holds lexemes -- they came out of
      -- to_tsvector -- and to_tsquery would run the dictionary over them a
      -- second time. That re-parse is not identity: 'call-off' comes back as
      -- the PHRASE 'call-off' <-> 'call', 'i-9' as '-9', 'a*b' as 'b'. The
      -- tsquery input function does no dictionary lookup, so a quoted lexeme
      -- survives verbatim and each alternative is exactly the lexeme the
      -- overlap count is about (#161).
      qor  := array_to_string(array(select quote_literal(u) from unnest(qlex) u), ' | ')::tsquery;
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
    --
    -- That implication needs each alternative in `qor` to BE the lexeme the
    -- overlap counted, which is why `qor` is cast rather than re-parsed --
    -- see the derivation above.
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
-- The migration before this one asserted the branched predicate and the gate.
-- Those assertions still hold and are restated, because this file rewrites the
-- whole body and a rewrite is exactly when a guard gets dropped. The new one
-- is 8: it pins the CONSTRUCTION, not an outcome, since the outcome is
-- identical and no behavioural assertion could tell the two versions apart.
-- ---------------------------------------------------------------------------

do $assert$
declare
  d    text;
  n    integer;
  f    integer;
  role text;
  deriv text;
  lex  text;
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

  -- 2. FROM FOUR LEXEMES UP THE FLOOR NEVER FALLS BELOW 3. Below four the
  -- floor IS the lexeme count and is legitimately 1 or 2 -- collapsing these
  -- two loops into one range makes the bound fire on the short queries case 1
  -- exists to protect, which is how this assertion first failed.
  for n in 4..40 loop
    f := least(n, greatest(3, ceil(n::numeric / 2)::int));
    if f < 3 then
      raise exception 'floor for % lexemes is %, which is below the minimum of 3', n, f;
    end if;
    if f > n then
      raise exception 'floor for % lexemes is %, which no cell could satisfy', n, f;
    end if;
  end loop;

  -- 3. The selectivity gate, and its exemption for unloosened queries.
  if position('z.admitted <= cap' in d) = 0 then
    raise exception 'the selectivity gate is missing: a floor alone regresses BR5';
  end if;
  if position('qmin = qn or' in d) = 0 then
    raise exception 'the gate no longer exempts unloosened (AND) queries';
  end if;

  -- 4. The branched predicate. `qq` on the unloosened branch because an
  -- overlap count inverts `-term` and collapses `or`; `qor` on the loosened
  -- one because without it the array intersection scans every cell in scope.
  if position('s.search_tsv @@ (case when qmin = qn then qq else qor end)' in d) = 0 then
    raise exception 'the branched keyword predicate is gone: -term and or break, or the arm scans every cell';
  end if;

  -- 5. Still exactly one OUT column named `lane`, matched on the exact
  -- function name so a scoring candidate named search_blueprint_* cannot be
  -- counted as a second one.
  select count(*) into n
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace,
       unnest(p.proargnames, p.proargmodes) as arg(nm, md)
  where ns.nspname = 'public' and p.proname = 'search_blueprint'
    and arg.md = 't' and arg.nm = 'lane';
  if n <> 1 then
    raise exception 'expected one OUT column named lane, found %', n;
  end if;

  -- 6. The ACL, which `create or replace` preserves -- which is why asserting
  -- it is worth more than restating the grants.
  if has_function_privilege('public', 'public.search_blueprint(text, vector, integer, text, integer, text, text, text, text, text[], text[])', 'execute') then
    raise exception 'search_blueprint is executable by PUBLIC, and is SECURITY DEFINER';
  end if;
  foreach role in array array['anon', 'authenticated', 'service_role'] loop
    if not has_function_privilege(role, 'public.search_blueprint(text, vector, integer, text, integer, text, text, text, text, text[], text[])', 'execute') then
      raise exception '% lost execute on search_blueprint', role;
    end if;
  end loop;

  -- 7. It still runs. No rows exist on a fresh replay, so this proves the plan
  -- compiles -- not that it ranks well.
  perform * from public.search_blueprint(q => 'who decides whether a call-off is excused',
                                         match_count => 5);
  perform * from public.search_blueprint(q => 'Workday', match_count => 5);
  perform * from public.search_blueprint(match_count => 5);

  -- 8. THE POINT OF THIS MIGRATION. `qor` is derived by casting, not by
  -- re-parsing. Asserted on the source rather than on behaviour because the
  -- two versions are indistinguishable by behaviour on any corpus where
  -- to_tsvector emits a compound's parts -- which is every corpus the english
  -- configuration has produced here. Only the construction can be checked.
  deriv := substring(d from 'qor\s*:=[^;]*;');
  if deriv is null then
    raise exception 'no qor derivation found in search_blueprint';
  end if;
  if position('::tsquery' in deriv) = 0 then
    raise exception 'qor is no longer built by a cast: %', deriv;
  end if;
  if position('to_tsquery' in deriv) > 0 then
    raise exception 'qor re-parses its own lexemes through to_tsquery, so the prefilter is not lossless: %', deriv;
  end if;

  -- And the mechanism itself, so that a future change of text search
  -- configuration cannot quietly make the cast stop being identity.
  foreach lex in array array['call-off', 'i-9', 'a*b', 'x:y'] loop
    if (quote_literal(lex)::tsquery)::text <> quote_literal(lex) then
      raise exception 'casting % to tsquery is not identity: got %',
        quote_literal(lex), (quote_literal(lex)::tsquery)::text;
    end if;
  end loop;
end
$assert$;
