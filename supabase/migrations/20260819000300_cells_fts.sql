-- Real full-text search over cell prose, replacing substring matching.
--
-- WHY: search_blueprint scores by counting `ilike '%term%'` hits. That has no
-- stemming ("marks" does not match "mark"), no relevance ranking beyond a raw
-- hit count, and cannot use an index because the pattern is leading-wildcard.
-- At 955 cells the speed is fine; the RANKING is what fails, and ranking is
-- exactly what the hybrid RPC needs from its keyword half — reciprocal-rank
-- fusion is only as good as the orderings it fuses.
--
-- A STORED GENERATED column, deliberately:
--   * it cannot be written, so it does not touch the wrapper write path
--     (authoringRpc / cellContentMutations) or the session ledger;
--   * it needs no trigger, so it cannot drift from the row it summarises;
--   * it changes no RLS policy — readers see it exactly where they already see
--     content and description.
-- It does rewrite the table on creation. 955 rows; negligible.
--
-- Structural names (path / scenario / step / layer) are NOT in here and cannot
-- be: a generated column may only reference its own row, and those live in
-- joined tables. blueprint_hybrid_search handles them as a separate ranked
-- list — see 20260819000400.
alter table public.cells
  add column if not exists search_tsv tsvector
  generated always as (
    to_tsvector(
      'english',
      coalesce(content, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(function, '') || ' ' ||
      coalesce(form, '') || ' ' ||
      coalesce(owner, '') || ' ' ||
      coalesce(perceived_owner, '')
    )
  ) stored;

create index if not exists cells_search_tsv_idx on public.cells using gin (search_tsv);

comment on column public.cells.search_tsv is
  'Generated FTS vector over the cell''s own prose (content, description, and the spec columns). Read-only by construction. Consumed by public.blueprint_hybrid_search; structural names are matched separately there.';
