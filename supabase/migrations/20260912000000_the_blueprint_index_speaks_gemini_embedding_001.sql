-- The switch: the blueprint index IS `gemini-embedding-001`, and the
-- candidate scaffolding goes.
--
-- WHAT THIS DECIDES. The index was built with `text-embedding-005`, reachable
-- only through a Vertex service account. A person searching from the app uses
-- their own browser key, which cannot call that model, so a question asked in
-- the app could never be matched by MEANING against this index — not because
-- of a bug, but because two models are two vector spaces and the database
-- correctly refuses to compare them. `gemini-embedding-001` is reachable
-- through both transports at the same 768 dimensions, which is the property
-- that lets one index serve the bot and a person at once.
--
-- WHAT THE EVIDENCE WAS. The candidate column, index and generated function
-- were scored against the live pair on the bot's 26-case retrieval eval, on
-- the real hosted data. Fused MRR 0.631 -> 0.667, two cases up (rank 4 -> 3
-- and 5 -> 3), no case worse by any position. The fused gap is much smaller
-- than the vector-only arm's (0.478 -> 0.733) because keyword and structural
-- retrieval already carry the exact-term and aggregate questions — which is
-- why the switch was scored through the real function rather than decided on
-- the offline number.
--
-- WHY IT IS ONE TRANSACTION. Between swapping the column and swapping the row
-- that names the model, the index would be in a state no caller can be
-- correct about: whichever model a search declares, it is the wrong one. That
-- window is not seconds if it is two statements and one of them fails.
--
-- WHY THERE IS NO DEPLOY BESIDE IT. The Worker reads the model from
-- `index_meta` rather than from a constant, holds it briefly, and on the
-- database's `embedding model mismatch` forgets what it held and retries
-- once. So the swap is this migration alone: the caller follows the index
-- within one retry instead of needing to change in the same instant.
--
-- THE VECTORS ARE ALREADY HERE. `embedding_001` was filled for every live row
-- by the bot's own backfill before this runs, and the assertion below refuses
-- the swap if that is not true of every row — an index half in one space is
-- worse than an index wholly in the old one, because it still answers.

do $switch$
declare
  missing bigint;
  live_model text;
begin
  -- Refuse rather than degrade. A row whose candidate vector was never filled
  -- would land in the live column as NULL, and the vector arm would go quiet
  -- for that cell forever while the other two arms kept it looking healthy.
  select count(*) into missing
  from semantic_search.corpus_chunks
  where source = 'blueprint' and embedding is not null and embedding_001 is null;

  if missing > 0 then
    raise exception 'the candidate column is short % row(s) — run the backfill for embedding_001 first', missing
      using hint = 'agents/uno-bot/scripts/backfill-semantic-search.mjs --column embedding_001 --model gemini-embedding-001';
  end if;

  -- The candidate row is the source of truth for what the candidate column
  -- holds. If it does not say what this migration is switching to, something
  -- other than this plan has been run.
  select m.model into live_model
  from semantic_search.index_meta m where m.source = 'blueprint_cand001';

  if live_model is distinct from 'gemini-embedding-001' then
    raise exception 'the candidate index names %, not gemini-embedding-001', coalesce(live_model, '<no row>');
  end if;
end
$switch$;

-- The swap itself. The candidate vectors become the live ones and the live
-- index row names the model they were made with, in that order, in one
-- transaction.
update semantic_search.corpus_chunks
set embedding = embedding_001
where source = 'blueprint' and embedding_001 is not null;

update semantic_search.index_meta
set model = 'gemini-embedding-001',
    dims = 768,
    updated_at = now()
where source = 'blueprint';

-- The scaffolding retires here, which was always the plan: the candidate
-- function is a generated copy of the live one and a second body that drifts
-- from the first the moment either is edited.
drop function if exists public.search_blueprint_cand001(text, extensions.vector, integer, text, integer, text, text, text, text, boolean);
drop function if exists public.search_blueprint_cand001;

delete from semantic_search.index_meta where source = 'blueprint_cand001';

drop index if exists semantic_search.corpus_chunks_embedding_001_idx;

alter table semantic_search.corpus_chunks
  drop column if exists embedding_001;

-- INVARIANTS, not a census. Each is a property that must hold for the index
-- to be searchable at all; none of them counts today's rows.
do $assert$
declare
  def text;
begin
  -- The live index names the model its vectors were made with. This is the
  -- pairing every search is checked against, so if it is wrong, every search
  -- is wrong in a way that still returns rows.
  if not exists (
    select 1 from semantic_search.index_meta
    where source = 'blueprint' and model = 'gemini-embedding-001' and dims = 768
  ) then
    raise exception 'the blueprint index does not name gemini-embedding-001 at 768';
  end if;

  -- Nothing still describes an index that no longer exists.
  if exists (select 1 from semantic_search.index_meta where source = 'blueprint_cand001') then
    raise exception 'the candidate metadata row survived the switch';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'search_blueprint_cand001'
  ) then
    raise exception 'the candidate function survived the switch';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'semantic_search'
      and table_name = 'corpus_chunks'
      and column_name = 'embedding_001'
  ) then
    raise exception 'the candidate column survived the switch';
  end if;

  -- The live function still reads the live column. A generated candidate was
  -- the only thing that ever read the other one, and this asserts the live
  -- body was never the copy.
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint';

  if def is null then
    raise exception 'public.search_blueprint is gone';
  end if;
  if def like '%embedding_001%' then
    raise exception 'the live function still reads the candidate column';
  end if;
end
$assert$;

comment on column semantic_search.corpus_chunks.embedding is
  'Blueprint chunk embedding, gemini-embedding-001 @ 768 (RETRIEVAL_DOCUMENT). The model is named by semantic_search.index_meta, which every search is checked against.';
