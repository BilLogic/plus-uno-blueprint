-- semantic_search.index_health() — counts only, so the index's state is
-- observable without opening GitHub Actions.
--
-- WHY: the nightly backfill's orphan prune 403'd from 2026-08-18 and nothing
-- surfaced it. The failure was invisible in the data because the prune runs
-- AFTER the upsert: embeddings stayed current while chunks for hard-deleted
-- cells accumulated (43 of them), and a bot answer citing one looks exactly
-- like a good answer. uno-bot reads as `anon` and cannot see corpus_chunks
-- (RLS-sealed) or blueprint_chunks_src (service_role only), so it had no way
-- to report its own index's health.
--
-- Returns COUNTS, never content — same security posture as
-- match_corpus_chunks: the table stays sealed and this is a narrow door.
create or replace function semantic_search.index_health()
returns table (
  chunks_total   bigint,
  src_eligible   bigint,
  orphan_chunks  bigint,
  stale_chunks   bigint,
  last_embed_at  timestamptz
)
language sql
stable
security definer
set search_path = semantic_search, public, pg_temp
as $function$
  select
    (select count(*) from semantic_search.corpus_chunks where source = 'blueprint'),
    (select count(*) from semantic_search.blueprint_chunks_src),
    -- Indexed, but the cell behind it no longer qualifies (deleted, or its
    -- content and description both cleared). These are the citable ghosts.
    (select count(*)
       from semantic_search.corpus_chunks c
       where c.source = 'blueprint'
         and not exists (
           select 1 from semantic_search.blueprint_chunks_src s
           where s.source_key = c.source_key)),
    -- Indexed before the cell's last edit: the embedding, and the chunk text
    -- served with it, are behind the blueprint.
    (select count(*)
       from semantic_search.corpus_chunks c
       join semantic_search.blueprint_chunks_src s on s.source_key = c.source_key
       where c.updated_at < s.updated_at),
    (select max(updated_at) from semantic_search.corpus_chunks where source = 'blueprint');
$function$;

grant execute on function semantic_search.index_health() to anon, authenticated, service_role;
