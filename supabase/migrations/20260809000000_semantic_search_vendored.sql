-- Vendored from the uno-bot repo (agents/uno-bot/migrations/0001 + 0002),
-- where this DDL is authored: the bot's semantic retrieval schema lives in
-- the SAME database as the app, and until now existed only as hand-applied
-- SQL — a fresh replay (supabase db reset, branch DBs) silently lost it and
-- the bot degraded to its keyword fallbacks. Both sources are idempotent
-- (if-not-exists / drop-if-exists+create), so re-applying on the hosted
-- project is a no-op. If the bot repo revises its migrations, re-vendor
-- the whole file.

-- Migration 0001 — semantic_search: shared vector retrieval over the blueprint.
--
-- ADDITIVE + READ-ONLY w.r.t. the blueprint. It creates NEW objects in their own
-- schema and only READS public.* (via one view) — it never ALTERs, writes, or
-- drops any existing blueprint table. To fully remove: `drop schema semantic_search
-- cascade;` and the blueprint is byte-for-byte unchanged.
--
-- Shared, not bot-private: the match function is exposed so ANY tool that
-- investigates the blueprint (uno-bot, the in-IDE agent, scripts) can use it.
-- Bot-private state (channel memory) lives in a separate `uno_bot` schema, added
-- later with P1·1.
--
-- MANUAL STEP after applying: add `semantic_search` to the project's API
-- "Exposed schemas" (Supabase Dashboard → Settings → API), so PostgREST can call
-- semantic_search.match_corpus_chunks. This keeps `public` untouched.

-- pgvector into the `extensions` schema (where pgcrypto / uuid-ossp already live),
-- NOT public.
create extension if not exists vector with schema extensions;

create schema if not exists semantic_search;

-- One row per embedded chunk of the corpus.
create table if not exists semantic_search.corpus_chunks (
  id          bigint generated always as identity primary key,
  source      text not null,               -- 'blueprint' | 'ds_component' | 'notion_catalog'
  source_key  text not null,               -- origin row id (a cell uuid) — idempotent re-embed
  title       text,                        -- "Scenario · Path (type) · Step · Layer" — the citation (never a raw UUID)
  ref_url     text,                        -- link back, when one exists
  chunk       text not null,               -- the context-enriched text that was embedded
  embedding   extensions.vector(768),      -- Vertex text-embedding-005
  updated_at  timestamptz not null default now(),
  unique (source, source_key)              -- re-embedding a row UPDATES it, never duplicates
);

-- Approximate-nearest-neighbour index for fast "closest in meaning" lookups.
create index if not exists corpus_chunks_embedding_idx
  on semantic_search.corpus_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- Deny-by-default: nothing reads the table directly. The match function below is
-- the ONLY read door (security definer), and the service-role key (backfill) is
-- the only writer.
alter table semantic_search.corpus_chunks enable row level security;

-- Read-only source view for the backfill: joins each NON-EMPTY cell up its
-- hierarchy into a context-enriched chunk + a human-readable title. This only
-- SELECTs from public.* — it does not modify the blueprint.
create or replace view semantic_search.blueprint_chunks_src as
select
  c.id::text as source_key,
  concat_ws(' · ',
    'Scenario: ' || sc.name,
    'Path: ' || p.name || ' (' || p.path_type || ')',
    'Step: ' || st.name,
    'Layer: ' || l.name
  ) as title,
  concat_ws(E'\n',
    concat_ws(' · ',
      'Scenario: ' || sc.name,
      'Path: ' || p.name || ' (' || p.path_type || ')',
      'Step: ' || st.name,
      'Layer: ' || l.name
    ),
    nullif(trim(c.content), ''),
    nullif(trim(c.description), '')
  ) as chunk,
  c.updated_at
from public.cells c
  join public.layers l            on l.id  = c.layer_id
  join public.steps st            on st.id = c.step_id
  join public.paths p             on p.id  = c.path_id
  join public.service_scenarios sc on sc.id = p.service_scenario_id
where nullif(trim(c.content), '') is not null
   or nullif(trim(c.description), '') is not null;

-- The lookup any tool calls: hand it a 768-dim query embedding, get top-k matches.
-- security definer + pinned search_path → it can read the RLS-locked table on
-- behalf of any caller, while the table itself stays sealed.
create or replace function semantic_search.match_corpus_chunks(
  query_embedding extensions.vector(768),
  match_count int default 6,
  filter_source text default null
) returns table (source text, title text, ref_url text, chunk text, similarity float)
language sql stable security definer set search_path = extensions, semantic_search
as $$
  select c.source, c.title, c.ref_url, c.chunk,
         1 - (c.embedding <=> query_embedding) as similarity
  from semantic_search.corpus_chunks c
  where filter_source is null or c.source = filter_source
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Let the shared tools reach the door (read-only). The backfill uses service_role.
grant usage on schema semantic_search to anon, authenticated, service_role;
grant execute on function semantic_search.match_corpus_chunks(extensions.vector, int, text)
  to anon, authenticated, service_role;
grant select on semantic_search.blueprint_chunks_src to service_role;
grant select, insert, update on semantic_search.corpus_chunks to service_role;

-- Migration 0002 — match_corpus_chunks returns source_key + updated_at.
--
-- WHY: semantic retrieval is the PRIMARY blueprint path, and it was the only
-- one that could not be cited. The match function returned (source, title,
-- ref_url, chunk, similarity) — no row identity — so every semantic hit reached
-- the bot with an empty id: no cell to link to, no date to judge staleness by,
-- nothing to hand back as a shareable URL. `source_key` is already stored on
-- every row (the cell uuid, and the uniqueness key of the table); it was simply
-- never returned.
--
-- Adding a column to a `returns table` signature needs DROP + CREATE, not
-- `create or replace`. Both statements run in one transaction, and `grant
-- execute` is re-issued because DROP takes the grants with it.
--
-- ADDITIVE for callers: existing consumers select by name and ignore the two
-- new columns.

drop function if exists semantic_search.match_corpus_chunks(extensions.vector, int, text);

create function semantic_search.match_corpus_chunks(
  query_embedding extensions.vector(768),
  match_count int default 6,
  filter_source text default null
) returns table (
  source text,
  source_key text,
  title text,
  ref_url text,
  chunk text,
  updated_at timestamptz,
  similarity float
)
language sql stable security definer set search_path = extensions, semantic_search
as $$
  select c.source, c.source_key, c.title, c.ref_url, c.chunk, c.updated_at,
         1 - (c.embedding <=> query_embedding) as similarity
  from semantic_search.corpus_chunks c
  where filter_source is null or c.source = filter_source
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function semantic_search.match_corpus_chunks(extensions.vector, int, text)
  to anon, authenticated, service_role;
