-- public.blueprint_hybrid_search — one call, three retrievers, fused by rank.
--
-- THE MEASUREMENT THAT MOTIVATES THIS (uno-bot retrieval baseline, 2026-08-19,
-- docs/evals/runs/2026-08-19-retrieval-baseline.json in the plus-uno repo):
--
--   paraphrase       100% (6/6)
--   exact-term       100% (5/5)
--   structural-name    0% (0/10)     <-- every case, zero rows
--   overall          14/26
--
-- The structural failures were NOT a ranking problem. Every one of the ten
-- returned 15 rows on 2 subrequests: the vector pass and nothing else. The
-- bot's client-side ladder short-circuits whenever the vector pass returns 3+
-- hits above SEMANTIC_MIN_SIMILARITY, that floor (0.5) sits BELOW the corpus's
-- own minimum pairwise similarity (0.586), so it always short-circuits, so the
-- keyword pass -- the only one that can match a path by NAME -- never ran.
-- search_blueprint finds those paths perfectly when asked directly (4-5 rows
-- each). The rows were never ranked low; they were never fetched.
--
-- AND THE FLOOR CANNOT BE TUNED TO FIX IT. Measured top scores:
--   keep  (paraphrase + exact-term)   0.565 - 0.740
--   fall through (structural-name)    0.653 - 0.808
-- The ranges overlap completely, so no threshold both keeps the good semantic
-- hits and lets structural queries reach the keyword pass.
--
-- Hence rank fusion rather than a better threshold. RRF never asks "is this
-- similar enough" -- an unanswerable question in an embedding space where two
-- unrelated chunks average 0.759 cosine. It asks "what did several independent
-- retrievers each rank highly", and scores by POSITION, which is the only thing
-- comparable across a cosine distance and a ts_rank.
--
-- THREE LISTS, because the failure above is precisely a missing third:
--   vec     - cosine over semantic_search.corpus_chunks   (paraphrase)
--   kw_body - ts_rank over cells.search_tsv                (exact terms in prose)
--   kw_name - ts_rank over the joined breadcrumb names     (structural names)
-- A cell appearing in more than one rises; `matched_by` reports which.
--
-- SECURITY. security definer + pinned search_path, mirroring
-- match_corpus_chunks: corpus_chunks is RLS-sealed and this is a door onto it.
-- It exposes nothing anon cannot already read -- every chunk is derived from
-- public-read cells -- and it is `stable`, so it cannot write.

-- Which model built the index. A wrong-DIMENSION vector is already rejected by
-- the signature; this catches the live gap the signature cannot see:
-- vertex/embed.ts prefers text-embedding-005 (Vertex SA) and falls back to
-- text-embedding-004 (AI Studio) when no SA is configured, and BOTH are
-- 768-dim. A deployment missing the SA would sail past every type check and
-- quietly return degraded similarities forever.
create table if not exists semantic_search.index_meta (
  source     text primary key,
  model      text not null,
  dims       int  not null,
  updated_at timestamptz not null default now()
);

insert into semantic_search.index_meta (source, model, dims)
values ('blueprint', 'text-embedding-005', 768)
on conflict (source) do nothing;

grant select on semantic_search.index_meta to anon, authenticated, service_role;

create or replace function public.blueprint_hybrid_search(
  q               text,
  query_embedding extensions.vector(768) default null,
  match_count     int  default 15,
  embed_model     text default null,
  rrf_k           int  default 60
)
returns table (
  kind        text,
  id          uuid,
  title       text,
  snippet     text,
  description text,
  layer       text,
  step        text,
  scenario    text,
  phase       text,
  path        text,
  links       jsonb,
  updated_at  timestamptz,
  similarity  double precision,
  rrf_score   double precision,
  matched_by  text
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
begin
  if embed_model is not null then
    select m.model into idx_model
      from semantic_search.index_meta m
     where m.source = 'blueprint';
    if idx_model is not null and idx_model <> embed_model then
      raise exception 'embedding model mismatch: caller=% index=%', embed_model, idx_model
        using hint = 'Re-embed the index or fix the caller; similarity across different models is meaningless.';
    end if;
  end if;

  -- websearch_to_tsquery never raises on user input, unlike to_tsquery. A
  -- search box must not be able to throw a syntax error.
  qq := websearch_to_tsquery('english', coalesce(q, ''));

  return query
  with
  vec as (
    select cc.source_key::uuid as cell_id,
           1 - (cc.embedding <=> query_embedding) as sim,
           row_number() over (order by cc.embedding <=> query_embedding) as rnk
    from semantic_search.corpus_chunks cc
    where query_embedding is not null
      and cc.source = 'blueprint'
    order by cc.embedding <=> query_embedding
    limit cap * 4
  ),
  kw_body as (
    select c.id as cell_id,
           row_number() over (order by ts_rank(c.search_tsv, qq) desc, c.id) as rnk
    from public.cells c
    where qq is not null and c.search_tsv @@ qq
    limit cap * 4
  ),
  kw_name as (
    -- Structural names live in joined tables, so they cannot be in the cell's
    -- generated tsvector; this is the list whose absence made structural-name
    -- 0/10. Cells on a matched path all share one breadcrumb and therefore one
    -- rank, so the tie-break prefers the cell with the most prose: 13.5% of
    -- cells are bare touchpoint markers ("Zoom/Pencil"), and surfacing those
    -- as the answer to "Prototype: Swap instead of call-off" would be useless.
    select c.id as cell_id,
           row_number() over (
             order by ts_rank(to_tsvector('english', bc.crumb), qq) desc,
                      length(coalesce(c.content, '')) desc,
                      c.id
           ) as rnk
    from public.cells c
    join public.paths p              on p.id  = c.path_id
    join public.service_scenarios sc on sc.id = p.service_scenario_id
    join public.phases ph            on ph.id = sc.phase_id
    join public.layers l             on l.id  = c.layer_id
    left join public.steps st        on st.id = c.step_id
    cross join lateral (
      select concat_ws(' ', ph.name, sc.name, p.name, st.name, l.name) as crumb
    ) bc
    where qq is not null
      and to_tsvector('english', bc.crumb) @@ qq
    limit cap * 4
  ),
  fused as (
    select
      coalesce(v.cell_id, b.cell_id, n.cell_id) as cell_id,
      -- ::float8 throughout: `1.0 / int` is numeric in Postgres, and the
      -- RETURNS TABLE declares double precision, which is a hard type error
      -- rather than a coercion.
        coalesce(1.0::float8 / (rrf_k + v.rnk), 0.0)
      + coalesce(1.0::float8 / (rrf_k + b.rnk), 0.0)
      + coalesce(1.0::float8 / (rrf_k + n.rnk), 0.0) as score,
      v.sim,
      concat_ws('+',
        case when v.cell_id is not null then 'vector'     end,
        case when b.cell_id is not null then 'keyword'    end,
        case when n.cell_id is not null then 'structural' end
      ) as how
    from vec v
      full outer join kw_body b on b.cell_id = v.cell_id
      full outer join kw_name n on n.cell_id = coalesce(v.cell_id, b.cell_id)
  )
  select
    'cell'::text,
    c.id,
    concat_ws(' · ',
      'Phase: '    || ph.name,
      'Scenario: ' || sc.name,
      'Path: '     || p.name || ' (' || p.path_type || ')',
      'Step: '     || st.name,
      'Layer: '    || l.name
    ),
    -- The corpus chunk carries the context-enriched text (spec columns, lane
    -- owner, KPIs) the vector pass already returns today; falling back to raw
    -- content would quietly regress what the model receives.
    coalesce(cc.chunk, c.content),
    c.description,
    l.name, st.name, sc.name, ph.name,
    p.name,
    c.links,
    c.updated_at,
    f.sim,
    f.score,
    f.how
  from fused f
  join public.cells c              on c.id  = f.cell_id
  join public.layers l             on l.id  = c.layer_id
  join public.paths p              on p.id  = c.path_id
  join public.service_scenarios sc on sc.id = p.service_scenario_id
  join public.phases ph            on ph.id = sc.phase_id
  left join public.steps st        on st.id = c.step_id
  left join semantic_search.corpus_chunks cc
         on cc.source_key = c.id::text and cc.source = 'blueprint'
  order by f.score desc, c.id
  limit cap;
end;
$function$;

revoke all on function public.blueprint_hybrid_search(text, extensions.vector, int, text, int) from public;
grant execute on function public.blueprint_hybrid_search(text, extensions.vector, int, text, int)
  to anon, authenticated, service_role;
