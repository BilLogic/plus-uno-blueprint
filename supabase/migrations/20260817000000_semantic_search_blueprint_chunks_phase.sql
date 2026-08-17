-- semantic_search: blueprint_chunks_src carries the PHASE segment + the spec columns.
--
-- OWNERSHIP — read this before editing anywhere else.
-- The `semantic_search` schema (corpus_chunks, blueprint_chunks_src,
-- match_corpus_chunks) is now OWNED BY THIS REPO. The app owns the database and
-- `supabase db reset` replays only this directory, so this directory is the
-- authoritative definition: anything the bot repo held a second copy of would
-- be silently reverted on the next reset. Those copies
-- (plus-uno `agents/uno-bot/migrations/0001..0004`) have been deleted; the bot
-- is a CONSUMER of this schema, not its author. Change the retrieval DDL by
-- opening a PR here, then re-applying to the hosted project.
--
-- WHAT THIS CARRIES. It supersedes the tail of
-- 20260809000000_semantic_search_vendored.sql (which vendored the bot's 0001 +
-- 0002) by replacing ONLY the source view. That earlier migration is already
-- applied and is left untouched on purpose — rewriting an applied migration
-- desyncs the hosted DB. The table, the index, the RLS posture and the
-- match_corpus_chunks function all still come from it and are unchanged here.
--
-- The view definition below is the merge of the bot's former 0003 and 0004,
-- which both `create or replace` the SAME view (so whichever ran last WAS the
-- view — a file carrying only one of the two changes would un-ship the other):
--
--   * 0003 — spec columns folded into the chunk text: cells.function / form /
--     value_props / owner / perceived_owner and layers.owner_team / layers.kpis.
--     Without them, "who owns this touchpoint" / "what KPI is this lane on"
--     never matched a chunk while the data sat in the database.
--   * 0004 — the `phases` join, so the title and the chunk both open with
--     `Phase: <name>`. The phase is the first segment the navigation guide
--     requires in a citation (`phase › scenario › path — layer × step`), and
--     without it a scenario that exists in two phases gets narrated under the
--     wrong one. `service_scenarios.phase_id` is `not null`
--     (20250603120000_service_blueprint.sql), so the inner join drops no cell
--     that the earlier view indexed.
--
-- Title AND chunk text change for every row, so the next backfill run re-embeds
-- the whole blueprint source (upsert on (source, source_key)) — expected,
-- one-time cost. Old chunks keep the phase-less title until that run; the bot's
-- parseChunkTitle is label-driven and handles both shapes, so retrieval never
-- breaks mid-re-embed.
--
-- Idempotent (create or replace + re-issued grant) and read-only w.r.t. the
-- blueprint: it only SELECTs from public.*.

create or replace view semantic_search.blueprint_chunks_src as
select
  c.id::text as source_key,
  concat_ws(' · ',
    'Phase: ' || ph.name,
    'Scenario: ' || sc.name,
    'Path: ' || p.name || ' (' || p.path_type || ')',
    'Step: ' || st.name,
    'Layer: ' || l.name
  ) as title,
  concat_ws(E'\n',
    concat_ws(' · ',
      'Phase: ' || ph.name,
      'Scenario: ' || sc.name,
      'Path: ' || p.name || ' (' || p.path_type || ')',
      'Step: ' || st.name,
      'Layer: ' || l.name
    ),
    nullif(trim(c.content), ''),
    nullif(trim(c.description), ''),
    'Function: ' || nullif(trim(c.function), ''),
    'Form: ' || nullif(trim(c.form), ''),
    'Value: ' || case when jsonb_typeof(c.value_props) = 'array'
      then nullif(array_to_string(array(select jsonb_array_elements_text(c.value_props)), ', '), '')
      else nullif(trim(both '"' from c.value_props::text), '') end,
    'Owner: ' || nullif(trim(c.owner), ''),
    'Perceived owner: ' || nullif(trim(c.perceived_owner), ''),
    'Lane owner team: ' || nullif(trim(l.owner_team), ''),
    'Lane KPIs: ' || case when jsonb_typeof(l.kpis) = 'array'
      then nullif(array_to_string(array(select jsonb_array_elements_text(l.kpis)), ', '), '')
      else nullif(trim(both '"' from l.kpis::text), '') end
  ) as chunk,
  c.updated_at
from public.cells c
  join public.layers l             on l.id  = c.layer_id
  join public.steps st             on st.id = c.step_id
  join public.paths p              on p.id  = c.path_id
  join public.service_scenarios sc on sc.id = p.service_scenario_id
  join public.phases ph            on ph.id = sc.phase_id
where nullif(trim(c.content), '') is not null
   or nullif(trim(c.description), '') is not null;

-- `create or replace view` preserves grants, but the vendored migration granted
-- this explicitly and so does the definition being carried forward — re-issued
-- so the file stands alone if the view is ever dropped and rebuilt from here.
grant select on semantic_search.blueprint_chunks_src to service_role;
