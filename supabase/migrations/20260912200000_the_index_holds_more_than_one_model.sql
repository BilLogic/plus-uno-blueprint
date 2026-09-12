-- The blueprint index can hold vectors from more than one embedding model, and
-- a search picks the set by the model name it declares.
--
-- WHAT THIS IS FOR. A person using the in-app agent embeds their question with
-- their OWN browser key. A Google key reaches `gemini-embedding-001`, which is
-- what this index was built with, so their question can be matched by meaning.
-- An OpenAI key reaches OpenAI's models and nothing else, and two models are
-- two vector spaces — so today `search_blueprint` correctly REFUSES that
-- pairing (`embedding model mismatch`) and those people are not offered the
-- tool at all. The way to serve them is a second set of vectors built with
-- their model, beside the first. This is the shape that holds one.
--
-- NOTHING IS BUILT HERE. This deployment has no OpenAI key and is not getting
-- one, so no second set exists and none is listed in the app's config. That is
-- deliberate and it is the safe state: a listed index with no vectors behind it
-- makes every meaning search raise, which is precisely the misconfiguration the
-- model check exists to catch. Building a set is a key and a backfill run,
-- whenever anyone wants one — see `docs/engineering/access-and-security.md`.
--
-- ── THE STORAGE SHAPE, AND THE ONE IT IS NOT ─────────────────────────────────
--
-- A ROW PER (chunk, model), in a new table, rather than a COLUMN PER MODEL.
--
-- The column shape is what the `gemini-embedding-001` swap used
-- (`20260911210000`), and it was right there: it was scaffolding for scoring
-- ONE candidate, with a known end two days later. It does not generalise, for a
-- reason that is structural rather than aesthetic. `search_blueprint` is 21 KB
-- of static SQL. A column name is not a runtime value, so choosing between
-- columns by the caller's `embed_model` means either `execute format(...)` —
-- the whole body becomes a string, and nothing can check it — or one hardcoded
-- arm per model, which makes every new model a migration that edits the
-- function. A row shape makes the model a WHERE clause: adding one is data.
--
-- The row shape also carries a property the column shape had to bolt on. A
-- column cannot say which model it holds, so `semantic_search.index_meta` had
-- to say it for each one, and the backfill had to read that row and refuse to
-- write a model the row did not name — because a candidate pass run with a
-- forgotten `--model` fills a column with the wrong model's vectors and every
-- score comes back plausible. A row carries the model name as part of its own
-- key. There is no way to write vectors under the wrong name by forgetting a
-- flag.
--
-- The cost, stated plainly: a shared HNSW index over interleaved models can
-- under-return when the model filter is applied after the scan. At this corpus
-- size that is theoretical — 873 chunks, and this function's vector arm already
-- joins `scoped` before its ORDER BY, so an exact scan is what the planner
-- picks anyway. A deployment that grows enough for it to matter wants a partial
-- index per model, which is a `create index` and no change to this shape.
--
-- ── WHY THE FIRST SET DOES NOT MOVE ──────────────────────────────────────────
--
-- `corpus_chunks.embedding` keeps holding the vectors for the model
-- `index_meta` names — the INDEX'S OWN model — and the new table holds every
-- other one. That asymmetry is on purpose, and it is named rather than
-- accidental: the index's own model is the one every reader shares, and the
-- others are reached by exactly one caller.
--
--   * `semantic_search.match_corpus_chunks()` is the deployed bot's primary
--     semantic retrieval and takes no model argument.
--   * `semantic_search.index_health()` counts that column.
--   * the nightly backfill writes that column.
--   * `search_blueprint` is the only entry point that takes `embed_model` at
--     all, so it is the only one that could ever choose.
--
-- Moving the first set would mean changing all four in lockstep — a signature
-- change on the bot's live retrieval path, and a window between the migration
-- applying and the bot deploying in which the nightly writes a column nothing
-- reads and the index quietly freezes. That is real risk taken on for
-- uniformity, in service of a capability nobody can use today. So this
-- migration is additive: nothing that answers a search today answers it
-- differently afterwards.
--
-- The exchange rate is stated too. Promoting a second model to BE the index's
-- own model is then a data move — one `update … from`, one `index_meta` row —
-- which is exactly the migration `20260912000000` already is.

-- ── The table ────────────────────────────────────────────────────────────────
--
-- Keyed by (source, source_key, model) rather than by the chunk's surrogate id.
-- `(source, source_key)` is already the table's unique business key and the
-- only identity the backfill holds — it reads a view of cells, not corpus rows
-- — so keying on it lets a backfill upsert without first looking the chunk up.
--
-- ON DELETE CASCADE is what keeps the orphan prune honest.
-- `semantic_search.prune_orphans()` deletes chunks whose cell no longer
-- qualifies; without the cascade every secondary vector for those chunks would
-- survive the prune and keep answering, which is the exact failure the prune
-- was written for (43 citable ghosts, 2026-08-19).
create table if not exists semantic_search.chunk_embeddings (
  source      text not null,
  source_key  text not null,
  model       text not null,
  embedding   extensions.vector(768) not null,
  updated_at  timestamptz not null default now(),
  primary key (source, source_key, model),
  foreign key (source, source_key)
    references semantic_search.corpus_chunks (source, source_key)
    on update cascade on delete cascade
);

comment on table semantic_search.chunk_embeddings is
  'Blueprint chunk vectors for every embedding model BESIDE the one semantic_search.index_meta names for the source. One row per (chunk, model) at 768 dimensions; the model is part of the key, so a row cannot hold a model it does not claim. public.search_blueprint is the only reader, and it picks the set by the caller''s embed_model.';

-- The existence probe `search_blueprint` runs before it commits to this table.
-- It answers "does this index hold that model at all", which is what separates
-- a servable search from the refusal.
create index if not exists chunk_embeddings_source_model_idx
  on semantic_search.chunk_embeddings (source, model);

-- HNSW with cosine ops, mirroring the live column's index, and cosine for the
-- same reason it was chosen there: these models return an UNNORMALIZED vector
-- whenever a width narrower than their native one is requested, which is every
-- call at 768, and inner product would then rank partly by vector length.
create index if not exists chunk_embeddings_embedding_idx
  on semantic_search.chunk_embeddings using hnsw (embedding extensions.vector_cosine_ops);

-- Deny by default, the same posture as `corpus_chunks`: no policies, so the
-- table is sealed to every API role, and the only read door is the
-- security-definer function. `service_role` bypasses RLS and is the writer.
alter table semantic_search.chunk_embeddings enable row level security;

-- SELECT, INSERT, UPDATE and not DELETE — the same grant `corpus_chunks` holds
-- since `20260819000500`. Removal is the cascade's job, not a caller's: a
-- backfill that could DELETE with any predicate of its choosing is the wide
-- grant that schema spent a migration taking back.
grant select, insert, update on semantic_search.chunk_embeddings to service_role;

-- Nothing outside the definer functions reads this, so anon and authenticated
-- are granted nothing. Stated rather than assumed, because a relation created
-- in `public` would have arrived with those grants already attached.
revoke all on semantic_search.chunk_embeddings from anon, authenticated;

-- ── One model, one home ──────────────────────────────────────────────────────
--
-- The index's own model lives in `corpus_chunks.embedding`. A row here naming
-- that same model would be a second home for one vector space: `search_blueprint`
-- would never read it (it resolves the index's own model first), a backfill
-- could keep filling it, and the two could disagree forever with nothing able
-- to tell. This refuses the row instead.
create or replace function semantic_search.chunk_embeddings_model_is_not_the_index_model()
returns trigger
language plpgsql
set search_path = semantic_search, pg_temp
as $trigger$
declare
  own text;
begin
  select m.model into own from semantic_search.index_meta m where m.source = new.source;
  if own is not null and own = new.model then
    raise exception 'model % is the % index''s own model — its vectors live in corpus_chunks.embedding', new.model, new.source
      using hint = 'This table is for the models BESIDE the one index_meta names. To make this the index''s model, move the column and the index_meta row, as 20260912000000 does.';
  end if;
  return new;
end;
$trigger$;

drop trigger if exists chunk_embeddings_not_the_index_model on semantic_search.chunk_embeddings;
create trigger chunk_embeddings_not_the_index_model
  before insert or update of model, source on semantic_search.chunk_embeddings
  for each row execute function semantic_search.chunk_embeddings_model_is_not_the_index_model();

-- ── search_blueprint picks the set ───────────────────────────────────────────
--
-- GENERATED FROM THE CATALOGUE, not retyped, for the reason `20260911210000`
-- gave when it did the same: the live function is 21 KB, and a hand-copy is a
-- second body that drifts from the first the moment either is edited. This
-- changes it in exactly three places, and each substitution is ASSERTED rather
-- than assumed — a `replace` that silently matched nothing would leave the
-- function exactly as it is, and every assertion below it would still pass
-- against a function that never learned to choose.
--
--   1. a `side` flag in the declare block;
--   2. the model check, which now has TWO ways to be satisfied and the same
--      one way to fail, with the same sentence;
--   3. the vector arm, which reads one of two tables depending on the flag.
--
-- The refusal is unchanged on purpose. `embedding model mismatch: caller=%
-- index=%` is what the Worker matches on to forget the model it held and retry
-- (plus-uno#483), and what `src/lib/agent/tools/search.ts` turns into the one
-- message a person sees. Generalising the condition must not move the sentence.
do $generate$
declare
  def text;
  out text;
  anchor text;
  want text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint';

  if def is null then
    raise exception 'public.search_blueprint does not exist — nothing to generalise';
  end if;

  -- IDEMPOTENT, because a migration that cannot be re-applied is a migration
  -- that goes red for the one reason nobody should have to diagnose. Each
  -- substitution below is asserted — a `replace` that matched nothing raises —
  -- and on a second apply NONE of them would match, which would read as
  -- "the function is not the shape this file expects" when the truth is that
  -- it already is the shape this file makes.
  if def like '%chunk_embeddings%' then
    raise notice 'search_blueprint already chooses its set by model — nothing to rewrite';
    return;
  end if;
  out := def;

  -- 1. The flag. Declared false, so a caller that names the index's own model,
  --    or names none at all, takes exactly the path it takes today.
  anchor := E'declare\n  idx_model text;\n';
  want := E'declare\n  idx_model text;\n  side      boolean := false;\n';
  if position(anchor in out) = 0 then
    raise exception 'the declare block is not the shape this migration rewrites';
  end if;
  out := replace(out, anchor, want);

  -- 2. The check. A caller whose model is not the index's own is refused ONLY
  --    when no set was built with it. `exists` and not a count: this asks
  --    whether the index holds the model, not how much of it is filled.
  anchor := E'    if idx_model is not null and idx_model <> embed_model then\n'
         || E'      raise exception ''embedding model mismatch: caller=% index=%'', embed_model, idx_model\n'
         || E'        using hint = ''Re-embed the index or fix the caller; similarity across different models is meaningless.'';\n'
         || E'    end if;\n';
  want := E'    if idx_model is not null and idx_model <> embed_model then\n'
       || E'      side := exists (\n'
       || E'        select 1 from semantic_search.chunk_embeddings ce\n'
       || E'        where ce.source = ''blueprint'' and ce.model = embed_model\n'
       || E'      );\n'
       || E'      if not side then\n'
       || E'        raise exception ''embedding model mismatch: caller=% index=%'', embed_model, idx_model\n'
       || E'          using hint = ''Re-embed the index or fix the caller; similarity across different models is meaningless.'';\n'
       || E'      end if;\n'
       || E'    end if;\n';
  if position(anchor in out) = 0 then
    raise exception 'the model check is not the shape this migration rewrites';
  end if;
  out := replace(out, anchor, want);

  -- 3. The arm. Two sources, one of them switched off by a constant-false
  --    predicate, fused back into the `vec` the rest of the body reads — same
  --    columns, same order, same `limit cap * 4`. `sim` is still `1 - distance`
  --    and `rnk` is still the ranking by that distance ascending, so RRF sees
  --    exactly what it saw.
  anchor := E'  vec as (\n'
         || E'    select s.cell_id,\n'
         || E'           (1 - (cc.embedding <=> query_embedding))::float8 as sim,\n'
         || E'           row_number() over (order by cc.embedding <=> query_embedding) as rnk\n'
         || E'    from semantic_search.corpus_chunks cc\n'
         || E'    join scoped s on s.cell_id::text = cc.source_key\n'
         || E'    where query_embedding is not null and cc.source = ''blueprint''\n'
         || E'    order by cc.embedding <=> query_embedding\n'
         || E'    limit cap * 4\n'
         || E'  ),\n';
  want := E'  vec_own as (\n'
       || E'    select s.cell_id,\n'
       || E'           (cc.embedding <=> query_embedding)::float8 as dist\n'
       || E'    from semantic_search.corpus_chunks cc\n'
       || E'    join scoped s on s.cell_id::text = cc.source_key\n'
       || E'    where query_embedding is not null and not side and cc.source = ''blueprint''\n'
       || E'    order by cc.embedding <=> query_embedding\n'
       || E'    limit cap * 4\n'
       || E'  ),\n'
       || E'  vec_side as (\n'
       || E'    select s.cell_id,\n'
       || E'           (ce.embedding <=> query_embedding)::float8 as dist\n'
       || E'    from semantic_search.chunk_embeddings ce\n'
       || E'    join scoped s on s.cell_id::text = ce.source_key\n'
       || E'    where query_embedding is not null and side and ce.source = ''blueprint''\n'
       || E'      and ce.model = embed_model\n'
       || E'    order by ce.embedding <=> query_embedding\n'
       || E'    limit cap * 4\n'
       || E'  ),\n'
       || E'  vec as (\n'
       || E'    select v.cell_id,\n'
       || E'           (1 - v.dist)::float8 as sim,\n'
       || E'           row_number() over (order by v.dist) as rnk\n'
       || E'    from (select * from vec_own union all select * from vec_side) v\n'
       || E'  ),\n';
  if position(anchor in out) = 0 then
    raise exception 'the vector arm is not the shape this migration rewrites';
  end if;
  out := replace(out, anchor, want);

  execute out;
end
$generate$;

-- ── Prove it ─────────────────────────────────────────────────────────────────
--
-- Invariants, not a census. Every one is vacuously satisfiable on an empty
-- database and says something real against production; none of them counts
-- today's rows.
do $assert$
declare
  def text;
  fn  oid;
begin
  if to_regclass('semantic_search.chunk_embeddings') is null then
    raise exception 'the second-model table was not created';
  end if;

  -- The model is part of the key. This is the property that replaces the
  -- metadata row the column shape needed: a row cannot hold a model other than
  -- the one it names, because the name is how it is addressed.
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'semantic_search' and t.relname = 'chunk_embeddings'
      and c.contype = 'p'
      and (select array_agg(a.attname::text order by a.attname)
             from unnest(c.conkey) k join pg_attribute a
               on a.attrelid = c.conrelid and a.attnum = k)
          = array['model','source','source_key']
  ) then
    raise exception 'chunk_embeddings is not keyed by (source, source_key, model)';
  end if;

  -- Without the cascade, prune_orphans() would leave every secondary vector for
  -- a removed chunk behind, still answering searches for a cell that is gone.
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'semantic_search' and t.relname = 'chunk_embeddings'
      and c.contype = 'f' and c.confdeltype = 'c'
  ) then
    raise exception 'chunk_embeddings does not cascade when its chunk is pruned';
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'semantic_search' and c.relname = 'chunk_embeddings' and c.relrowsecurity
  ) then
    raise exception 'chunk_embeddings is not RLS-sealed';
  end if;

  -- Sealed means sealed. A grant to anon or authenticated here would be a
  -- second door into a table whose only door is a definer function.
  if has_table_privilege('anon', 'semantic_search.chunk_embeddings', 'select')
     or has_table_privilege('authenticated', 'semantic_search.chunk_embeddings', 'select') then
    raise exception 'chunk_embeddings is readable by an API role directly';
  end if;

  -- The three substitutions, read back off the function the database will
  -- actually run. A `replace` that matched nothing would have raised above;
  -- this is the half that says the executed definition is the rewritten one.
  select p.oid, pg_get_functiondef(p.oid) into fn, def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint';

  if def is null then
    raise exception 'public.search_blueprint is gone';
  end if;
  if def not like '%chunk_embeddings%' then
    raise exception 'search_blueprint cannot reach the second-model table';
  end if;
  if def not like '%corpus_chunks%' then
    raise exception 'search_blueprint lost the index''s own vector column';
  end if;
  if def not like '%embedding model mismatch%' then
    raise exception 'search_blueprint no longer refuses a model it holds no index for';
  end if;

  -- `create or replace` keeps grants, and this says so rather than trusting it:
  -- a function the app cannot execute is a search that fails for everyone.
  if not has_function_privilege('anon', fn, 'execute')
     or not has_function_privilege('authenticated', fn, 'execute') then
    raise exception 'search_blueprint lost its execute grant';
  end if;
end
$assert$;

-- ── The three answers, proved from the seat that asks ────────────────────────
--
-- Run under `set local role authenticated` holding an app JWT, not as the
-- migration's owner. An owner run cannot tell a missing grant from a present
-- one — `search_blueprint` is `security definer`, so it reads the sealed table
-- either way, and what is actually in question is whether the role the browser
-- arrives as may EXECUTE it. #277 is the precedent: an owner rehearsal passed
-- while `authenticated` held nothing.
--
-- The block writes a fixture and rolls itself back through a sentinel
-- exception, the shape `20260830180000` established. Nothing it inserts
-- survives the file, and it counts nothing: it asks for three OUTCOMES.
--
--   1. the index's own model answers, as it does today;
--   2. a model the index holds no vectors for is REFUSED, with the sentence;
--   3. a model it does hold a set for answers.
--
-- (3) is the whole ticket, and it is the only one that could not be asked
-- before this file. The fixture is a corpus row and one vector under a second
-- model name — no cells, because the question is which SET the function
-- consults, not what it ranks. A search with no matching cells returns no rows
-- and raises nothing, and "raised nothing" is the assertion.
do $rehearse$
declare
  -- A probe that is not all zeros: cosine distance against the zero vector is
  -- NaN, and a rehearsal must not hand the ranking an undefined number.
  probe extensions.vector(768) := array_fill(0.1::real, array[768])::extensions.vector;
  own  text;
  n    int;
  msg  text;
begin
  begin
    select m.model into own from semantic_search.index_meta m where m.source = 'blueprint';
    if own is null then
      raise exception 'no blueprint index row to rehearse against';
    end if;

    -- The fixture is written as the owner. The grants under test are the ones
    -- the SEARCHES need, and those come after the role change below.
    insert into semantic_search.corpus_chunks (source, source_key, title, chunk)
    values ('blueprint', '00000000-0000-0000-0000-000000000623',
            'issue-623 rehearsal', 'issue-623 rehearsal chunk')
    on conflict (source, source_key) do nothing;

    insert into semantic_search.chunk_embeddings (source, source_key, model, embedding)
    values ('blueprint', '00000000-0000-0000-0000-000000000623',
            'text-embedding-3-small', probe);

    -- One home per model, enforced. Writing the index's own model in here would
    -- be a second copy of one vector space that nothing could reconcile.
    begin
      insert into semantic_search.chunk_embeddings (source, source_key, model, embedding)
      values ('blueprint', '00000000-0000-0000-0000-000000000623', own, probe);
      -- Worded so it cannot satisfy the match below. A sentinel the handler
      -- would accept as the trigger's own refusal turns a failed assertion
      -- into a pass.
      raise exception 'REHEARSAL DID NOT REFUSE a duplicate home for the index model';
    exception when others then
      get stacked diagnostics msg = message_text;
      if msg not like '%vectors live in corpus_chunks.embedding%' then raise; end if;
    end;

    -- An authenticated session holding an app JWT — what a browser arrives as.
    execute 'set local request.jwt.claims = ' ||
      quote_literal('{"role":"authenticated","app_metadata":{"role":"service"}}');
    execute 'set local role authenticated';

    -- 1. The index's own model. Unchanged behaviour, asserted because a
    --    rewrite of this arm could have broken the path everybody uses.
    select count(*) into n from public.search_blueprint(
      q => 'rehearsal', query_embedding => probe, embed_model => own);

    -- 2. A model this index holds nothing for. The refusal, and the sentence
    --    the Worker and the app both match on.
    begin
      perform 1 from public.search_blueprint(
        q => 'rehearsal', query_embedding => probe, embed_model => 'no-such-embedding-model');
      raise exception 'a model the index holds no set for was not refused';
    exception when others then
      get stacked diagnostics msg = message_text;
      if msg not like 'embedding model mismatch%' then raise; end if;
    end;

    -- 3. A model it DOES hold a set for. This is the capability: the caller
    --    declares a model that is not the index's own, and is served rather
    --    than refused.
    select count(*) into n from public.search_blueprint(
      q => 'rehearsal', query_embedding => probe, embed_model => 'text-embedding-3-small');

    raise exception 'issue-623 rehearsal complete';
  exception
    when others then
      get stacked diagnostics msg = message_text;
      if msg <> 'issue-623 rehearsal complete' then
        raise exception 'issue-623 rehearsal failed: %', msg;
      end if;
  end;
end
$rehearse$;
