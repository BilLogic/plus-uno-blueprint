-- semantic_search.prune_orphans() — the narrow door for the one delete the
-- backfill actually needs.
--
-- WHY A FUNCTION RATHER THAN THE TABLE GRANT
--
-- 20260819000000 granted service_role DELETE on semantic_search.corpus_chunks
-- so the nightly backfill could remove chunks whose cell no longer exists.
-- The need is real: corpus_chunks is a DERIVED index, and INSERT/UPDATE can
-- keep an existing cell current but can never remove the row for one that was
-- hard-deleted. Those rows keep valid embeddings and keep matching searches,
-- so the bot cites a cell that is gone and links a ?cell= URL resolving to
-- nothing. Measured 2026-08-19: 43 orphans, and 10% of 40 sampled searches
-- surfaced one in their top-15.
--
-- But a table-level grant answers a much broader question than the one asked.
-- It permits `delete from semantic_search.corpus_chunks` with ANY predicate,
-- or none — the whole index, in one statement. This function permits exactly
-- the orphan set and nothing else: the WHERE lives inside the definer, so the
-- caller chooses no rows. That is the same shape this schema already uses for
-- reads, where the table is RLS-sealed and match_corpus_chunks is the only
-- door. Reads got a narrow door; writes should not get a wide one.
--
-- What is at stake is availability, not secrecy: the index is rebuildable by
-- re-running the backfill (at the cost of re-embedding). Note also that
-- service_role already holds INSERT/UPDATE here, so a leaked key can already
-- rewrite the corpus with text the bot will quote as authoritative — an
-- integrity problem strictly worse than deletion. This does not fix that; it
-- declines to add a second one.
--
-- Returns the number of rows removed, so the caller can log a real figure and
-- an unexpected count is visible rather than silent.
create or replace function semantic_search.prune_orphans()
returns bigint
language plpgsql
volatile
security definer
set search_path = semantic_search, public, pg_temp
as $function$
declare
  removed bigint;
begin
  with gone as (
    delete from semantic_search.corpus_chunks c
    where c.source = 'blueprint'
      and not exists (
        select 1
        from semantic_search.blueprint_chunks_src s
        where s.source_key = c.source_key
      )
    returning 1
  )
  select count(*) into removed from gone;

  return removed;
end;
$function$;

-- service_role only. anon/authenticated must never reach a mutating function:
-- unlike index_health(), this one changes the corpus.
revoke all on function semantic_search.prune_orphans() from public;
grant execute on function semantic_search.prune_orphans() to service_role;

-- NOT REVOKING THE TABLE GRANT HERE, ON PURPOSE.
--
-- uno-bot's backfill still issues its own DELETE
-- (agents/uno-bot/scripts/backfill-semantic-search.mjs, deleteOrphans).
-- Revoking in the same migration that introduces the replacement would break
-- the nightly prune between deploying this and deploying the bot — the exact
-- silent failure this whole thread is about, reintroduced from the other side.
--
-- Sequence:
--   1. this migration                                    (additive, safe)
--   2. bot switches deleteOrphans to rpc('prune_orphans') (BilLogic/plus-uno)
--   3. then, and only then:
--        revoke delete on semantic_search.corpus_chunks from service_role;
