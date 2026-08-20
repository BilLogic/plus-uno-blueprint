-- public.search_blueprint v2 — THE search portal for the blueprint.
--
-- The good function inherits the good name: the old search_blueprint(q text)
-- (ilike hit-counting, ranking by raw hit count) is gone, and the fused
-- retriever previously deployed as blueprint_hybrid_search takes its name,
-- gaining what every consumer was missing:
--
--   * scope filters (filter_phase / filter_scenario / filter_path_type /
--     filter_layer_role) — exact predicates applied to ALL retrievers, so
--     "customer-facing lanes only" or "this scenario only" is the database's
--     job, not the caller's
--   * filter-only mode — q and embedding both null returns the COMPLETE
--     matching set in structural order (phase, scenario, path, step, lane):
--     a predicate select, not a ranking
--   * total_matched on every row — the corpus-wide count of cells matching
--     the filters (+ FTS terms when q is given), so a consumer can honestly
--     say "113 cells mention Zoom, here are the top 15"
--
-- One contract for uno-bot (Slack), the in-app canvas agent, and CLI/IDE
-- readers — the 2026-08-07 proposal's open question 3 ("who owns fusion?")
-- answered: the database, so every consumer gets the same relevance.
--
-- Row shape is IDENTICAL to blueprint_hybrid_search's (that is the consumer
-- contract; uno-bot maps rows.scenario / rows.phase), which is why the filter
-- params carry the filter_ prefix — plpgsql forbids a RETURNS TABLE column
-- and a parameter sharing a name.
--
-- blueprint_hybrid_search remains as-is until the deployed bot is repointed;
-- dropped in the follow-up migration.
drop function if exists public.search_blueprint(text, extensions.vector, int, text, int, text, text, text, text);

create or replace function public.search_blueprint(
  q                 text default null,
  query_embedding   extensions.vector(768) default null,
  match_count       int  default 15,
  embed_model       text default null,
  rrf_k             int  default 60,
  filter_phase      text default null,
  filter_scenario   text default null,
  filter_path_type  text default null,
  filter_layer_role text default null
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
  total     bigint;
begin
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

  -- The honest count: cells passing the filters (and the FTS terms when q is
  -- given — body OR breadcrumb). Semantic similarity has no meaningful
  -- "total", so it does not participate here.
  select count(*) into total
  from public.cells c
  join public.layers l              on l.id  = c.layer_id
  join public.paths p               on p.id  = c.path_id
  join public.service_scenarios sc  on sc.id = p.service_scenario_id
  join public.phases ph             on ph.id = sc.phase_id
  left join public.steps st         on st.id = c.step_id
  where (filter_phase      is null or lower(ph.name) = lower(filter_phase))
    and (filter_scenario   is null or lower(sc.name) = lower(filter_scenario))
    and (filter_path_type  is null or p.path_type    = filter_path_type)
    and (filter_layer_role is null or l.layer_role   = filter_layer_role)
    and (qq is null
         or c.search_tsv @@ qq
         or to_tsvector('english',
              concat_ws(' ', ph.name, sc.name, p.name, st.name, l.name)) @@ qq);

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
    where (filter_phase      is null or lower(ph.name) = lower(filter_phase))
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
    -- Ranked mode: the fused candidates. Filter-only mode: the whole scoped
    -- set in structural order (phase, scenario, path, step column, lane row).
    select f.cell_id, f.score, f.sim, f.how, null::bigint as ord
    from fused f
    where qq is not null or query_embedding is not null
    union all
    select s.cell_id, null, null, 'filter',
           row_number() over (order by s.ph_ord, s.sc_ord, s.path_name, s.slot, s.lrow)
    from scoped s
    where qq is null and query_embedding is null
  )
  select
    'cell'::text,
    s.cell_id,
    concat_ws(' · ',
      'Phase: '    || s.ph_name,
      'Scenario: ' || s.scen,
      'Path: '     || s.path_name || ' (' || s.ptype || ')',
      'Step: '     || s.step_name,
      'Layer: '    || s.lane),
    coalesce(cc.chunk, s.content),
    s.descr,
    s.lane, s.step_name, s.scen, s.ph_name, s.path_name,
    s.lnk, s.upd,
    k.sim, k.score, k.how,
    total
  from picked k
  join scoped s on s.cell_id = k.cell_id
  left join semantic_search.corpus_chunks cc
         on cc.source_key = s.cell_id::text and cc.source = 'blueprint'
  order by k.score desc nulls last, k.ord nulls last, s.cell_id
  limit cap;
end;
$function$;

revoke all on function public.search_blueprint(text, extensions.vector, int, text, int, text, text, text, text) from public;
grant execute on function public.search_blueprint(text, extensions.vector, int, text, int, text, text, text, text)
  to anon, authenticated, service_role;
