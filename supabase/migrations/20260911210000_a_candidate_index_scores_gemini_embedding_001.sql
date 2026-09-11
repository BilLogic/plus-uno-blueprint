-- A candidate index and a candidate search function, so a new embedding model
-- can be SCORED before it is switched to.
--
-- WHY THIS EXISTS AT ALL. The blueprint index is built with
-- `text-embedding-005`, which is reachable only through a Vertex service
-- account. The in-app agent runs on a person's own browser key, which cannot
-- call that model — so a question asked in the app can never be matched by
-- meaning against this index, whatever else is fixed. `gemini-embedding-001`
-- is reachable through both transports and outputs the 768 dimensions this
-- column already holds, which is why it is the candidate.
--
-- An offline head-to-head already says it is better on this corpus: same
-- recall (90%) and a markedly better MRR (0.478 -> 0.733) over the ten
-- fixture cases a vector ranking can be judged on, equal or better on every
-- one of them. What that measurement CANNOT see is the fused behaviour — this
-- function ranks three arms with RRF, and the keyword and structural arms
-- decide the structural, aggregate and absence cases the offline run skips.
-- Scoring that needs the real function over a real index, which is what this
-- migration builds.
--
-- NOTHING LIVE CHANGES HERE, and that is the design. A new column, a new
-- index, a new metadata row, and a copy of the search function that reads
-- them. `public.search_blueprint` and `corpus_chunks.embedding` are untouched,
-- so the bot and the app keep answering exactly as they do now while the
-- candidate is measured beside them.
--
-- HOW THE COPY IS MADE, and why it is generated rather than typed. The live
-- function is 21.6 KB of SQL. A hand-copied candidate is a second body that
-- drifts from the first the moment either is edited, and the whole point of a
-- candidate is that it differs in ONE respect. So the copy is taken from the
-- catalogue at apply time and rewritten in exactly three places:
--
--   1. its name, so it can sit beside the live one;
--   2. `cc.embedding` -> `cc.embedding_001`, so it reads the candidate column;
--   3. the `index_meta` row it checks the caller's model against.
--
-- Each substitution is asserted rather than assumed: a replace that silently
-- matched nothing would leave a candidate that is a duplicate of the live
-- function, and it would score identically and mean nothing.
--
-- RETIRING IT. This is scaffolding with a known end. When the switch lands,
-- the candidate function, the candidate metadata row and — after the live
-- column is swapped — this column all go in one migration. Until then the only
-- caller is the retrieval eval, through the Worker's debug route, which
-- allow-lists `search_blueprint_<suffix>` by name.

alter table semantic_search.corpus_chunks
  add column if not exists embedding_001 vector(768);

comment on column semantic_search.corpus_chunks.embedding_001 is
  'Candidate embedding for gemini-embedding-001 @ 768, scored beside the live column. Temporary: it goes when the switch lands or the candidate is rejected.';

-- HNSW with cosine ops, mirroring the live column's index. Cosine is not
-- interchangeable with inner product here: the model returns an UNNORMALIZED
-- vector whenever a size smaller than its native width is requested, which is
-- every call at 768, and inner product would then rank partly by vector length.
create index if not exists corpus_chunks_embedding_001_idx
  on semantic_search.corpus_chunks using hnsw (embedding_001 vector_cosine_ops);

-- The candidate's own metadata row. The function refuses a caller whose model
-- does not match the index it is reading, and that refusal is the thing that
-- stops one vector space being scored against another — so the candidate needs
-- its own row rather than borrowing the live one.
insert into semantic_search.index_meta (source, model, dims)
values ('blueprint_cand001', 'gemini-embedding-001', 768)
on conflict (source) do update
  set model = excluded.model,
      dims = excluded.dims,
      updated_at = now();

do $candidate$
declare
  def text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint';

  if def is null then
    raise exception 'public.search_blueprint does not exist — nothing to take a candidate from';
  end if;

  def := replace(def, 'FUNCTION public.search_blueprint(', 'FUNCTION public.search_blueprint_cand001(');
  def := replace(def, 'cc.embedding', 'cc.embedding_001');
  def := replace(def, 'where m.source = ''blueprint''', 'where m.source = ''blueprint_cand001''');

  -- Each substitution asserted. A replace that matched nothing would produce a
  -- candidate identical to the live function, which would score the same and
  -- prove nothing — the worst failure available here, because it looks like a
  -- result.
  if def not like '%FUNCTION public.search_blueprint_cand001(%' then
    raise exception 'the candidate name was not substituted';
  end if;
  if def like '%cc.embedding <%' or def like '%cc.embedding)%' then
    raise exception 'a cc.embedding reference survived the substitution';
  end if;
  if def not like '%m.source = ''blueprint_cand001''%' then
    raise exception 'the index_meta source was not substituted';
  end if;

  execute def;
end
$candidate$;

-- The bot calls with the anon key, so the candidate has to be callable by the
-- same roles the live function is. An owner-only candidate would answer every
-- rehearsal and refuse the eval.
grant execute on function public.search_blueprint_cand001 to anon, authenticated, service_role;

comment on function public.search_blueprint_cand001 is
  'Candidate copy of search_blueprint reading corpus_chunks.embedding_001, for scoring gemini-embedding-001. Temporary; retired with the switch. Only the retrieval eval calls it.';

-- INVARIANTS, not a census. Each of these is a property the candidate must
-- have for a score taken from it to mean anything; none of them counts rows,
-- which would pin today's data into a migration.
do $assert$
declare
  live_args text;
  cand_args text;
begin
  -- The eval calls the candidate with the arguments it sends the live one. A
  -- candidate with a different signature would fail or, worse, silently take
  -- defaults for the filters the eval is measuring.
  select pg_get_function_identity_arguments(p.oid) into live_args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint';

  select pg_get_function_identity_arguments(p.oid) into cand_args
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint_cand001';

  if cand_args is distinct from live_args then
    raise exception 'the candidate takes different arguments from the live function: % vs %', cand_args, live_args;
  end if;

  -- It reads the candidate column, and the live function still does not.
  if pg_get_functiondef((
        select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'search_blueprint_cand001'
      )) not like '%embedding_001%' then
    raise exception 'the candidate does not read embedding_001';
  end if;
  if pg_get_functiondef((
        select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'search_blueprint'
      )) like '%embedding_001%' then
    raise exception 'the LIVE function now reads embedding_001 — this migration must not touch it';
  end if;

  -- The live index still names the live model. If this ever fails, the switch
  -- happened somewhere else and this scaffolding is describing a world that
  -- has moved on.
  if (select model from semantic_search.index_meta where source = 'blueprint')
       <> 'text-embedding-005' then
    raise exception 'the live index no longer names text-embedding-005';
  end if;
end
$assert$;
