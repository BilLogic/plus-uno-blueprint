-- The last place the board still says "Layer" to a reader: the breadcrumb.
--
-- plus-uno-blueprint#144 part 3. Parts 1 and 2 landed in 20260826120000 — the
-- search portal now accepts `granularity => 'lane'` and tags the rung `'lane'`.
-- That migration deliberately left the breadcrumb label alone and installed a
-- guard that FAILS it if the literal moves, because moving the label is not a
-- text change. The label is inside the *stored* chunk title, the stored title
-- is part of the EMBEDDED text, and flipping it without re-embedding strands
-- every vector in the index against a title no query will ever match.
--
-- So this migration is one half of a two-part change, and the other half is not
-- SQL:
--
--   1. this file        — the view and the RPC both emit `Lane: `
--   2. a FULL re-embed  — BilLogic/plus-uno → Actions → "uno-bot — embed
--                         blueprint (semantic_search)" → Run workflow with
--                         full: true
--
-- Step 2 is not optional and the nightly pass will not do it. The nightly is
-- incremental and keys on `cells.updated_at`; changing the TEXT of a chunk does
-- not touch a cell's timestamp, so an incremental run after this migration
-- skips all 784 rows and reports success. That silence is the failure mode.
-- `docs/engineering/access-and-security.md` states the same rule for any change
-- to `blueprint_chunks_src`.
--
-- WHY THE ORDER IS THIS WAY ROUND. Between this migration and the re-embed, the
-- view and the RPC say `Lane: ` while the stored titles still say `Layer: `.
-- Nothing breaks in that window: uno-bot's `parseChunkTitle` accepts both
-- labels through the contract's `breadcrumb.aliases`, which exists for exactly
-- this crossing. The alias is what makes the window survivable, so it is
-- removed from `src/lib/blueprintContract.ts` in the same commit as the
-- re-embed and not before.
--
-- WHAT THIS DOES NOT DO. It does not drop `'layer'` as an accepted
-- `granularity` VALUE. That is the other follow-up on #144 and it is gated on
-- something else entirely — uno-bot's vendored copy of the contract having
-- synced, since the bot deploys on its own cadence and a hard flip breaks every
-- bot search in the gap. Two follow-ups, two different gates; bundling them is
-- what let this one sit.
--
-- The function body is taken from the live definition and edited, not retyped,
-- for the reason 20260826120000 gives: every sweep since v5 lives in that body
-- and a retype loses the ones nobody remembers. The view IS retyped, because
-- 20260826000000 already put its full authored shape into the series and a
-- second-hand copy of a file we own is worse than the file.
--
-- Acceptance, run after this AND after the re-embed:
--   select count(*) from semantic_search.corpus_chunks where title like '%Lane: %';
--   -- expect: every row. `Layer: ` expects zero.

/* ------------------------------------------------- 1. the RPC's breadcrumb */

do $do$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint';
  if d is null then raise exception 'search_blueprint not found'; end if;

  -- Parts 1 and 2 first. A body that still rejects `lane` is pre-20260826120000,
  -- and flipping the label on top of that leaves a function whose breadcrumb
  -- says one word and whose guard clause refuses it.
  if d !~ $$'lane','layer'$$ then
    raise exception
      'search_blueprint does not accept granularity lane yet — apply 20260826120000 first';
  end if;

  -- The label, and the alignment with it. `'Layer: '    ||` and
  -- `'Lane: '     ||` are both thirteen characters wide, which is what keeps
  -- the five segments in one column the way every other line of this CTE is.
  --
  -- AND THAT IS WHY THIS GUARD IS NOT THE ONE 20260826120000 USES. Every
  -- replacement in that migration changed the body's length, so `length(d)`
  -- before and after was a sound witness that the fragment matched. Here the
  -- two strings are the same width by design, so a length comparison reads
  -- IDENTICAL whether the replace landed or missed entirely — it fails a
  -- correct migration and, in the mirror case, would pass a missed one. The
  -- subject is asserted present first and absent after instead.
  if position($$'Layer: '    || s.lane) as ttl,$$ in d) = 0 then
    raise exception
      'search_blueprint: the breadcrumb label is not the aligned fragment this expects';
  end if;
  d := replace(d,
    $$'Layer: '    || s.lane) as ttl,$$,
    $$'Lane: '     || s.lane) as ttl,$$);
  if d ~ $$'Layer: '$$ then
    raise exception 'search_blueprint: a Layer breadcrumb label survived the replace';
  end if;

  execute d;
end
$do$;

-- The post-state, stated as text rather than inferred.
--
-- Two jobs in one literal. It fails this migration if the cell branch came back
-- in a shape nobody expected, and it is the text
-- `scripts/tests/blueprintContract.test.mjs` parses to learn what labels the
-- RPC builds — that test reads the last migration naming `'cell'::text as knd`
-- and would otherwise still be reading the pre-rename branch in 20260820060000.
-- A guard and a declaration are the same sentence here on purpose; two copies
-- of it would be one copy and one lie.
do $do$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint';

  if position($$      'cell'::text as knd,
      s.cell_id as rid,
      concat_ws(' · ',
        'Phase: '    || s.ph_name,
        'Scenario: ' || s.scen,
        'Path: '     || s.path_name || ' (' || s.ptype || ')',
        'Step: '     || s.step_name,
        'Lane: '     || s.lane) as ttl,$$ in d) = 0 then
    raise exception
      'search_blueprint''s cell breadcrumb is not the five Lane-labelled segments the contract declares';
  end if;
end
$do$;

-- A body-only replace should disturb neither the signature nor the grants, and
-- an unasserted one is how a search outage ships looking like a rename.
do $do$
declare sig text; acl text;
begin
  select pg_get_function_identity_arguments(p.oid),
         array_to_string(coalesce(p.proacl::text[], '{}'::text[]), ' ')
  into sig, acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint';

  if sig is null then raise exception 'search_blueprint did not survive the replace'; end if;
  if sig not like '%filter_lane_role text%'
     or sig not like '%granularity text[]%'
     or sig not like '%include text[]%' then
    raise exception 'search_blueprint signature drifted: %', sig;
  end if;

  if acl !~ 'anon=X' or acl !~ 'authenticated=X' or acl !~ 'service_role=X' then
    raise exception 'search_blueprint lost a grant — every caller now gets 42501: %', acl;
  end if;
  if acl ~ '(^| )=X' then
    raise exception 'search_blueprint came back executable by PUBLIC: %', acl;
  end if;
end
$do$;

/* --------------------------------------- 2. the breadcrumb that gets embedded */

-- Verbatim 20260826000000 with one word changed in two places — the title and
-- the copy of the title that opens the chunk body. Both are embedded; changing
-- only the title would leave the label the reader sees disagreeing with the
-- label the vector was built from.
create or replace view semantic_search.blueprint_chunks_src as
select
  c.id::text as source_key,
  concat_ws(' · ',
    'Phase: ' || ph.name,
    'Scenario: ' || sc.name,
    'Path: ' || p.name || ' (' || p.path_type || ')',
    'Step: ' || st.name,
    'Lane: ' || l.name
  ) as title,
  concat_ws(E'\n',
    concat_ws(' · ',
      'Phase: ' || ph.name,
      'Scenario: ' || sc.name,
      'Path: ' || p.name || ' (' || p.path_type || ')',
      'Step: ' || st.name,
      'Lane: ' || l.name
    ),
    nullif(trim(c.content), ''),
    nullif(trim(c.summary), ''),
    'Function: ' || nullif(trim(c."function"), ''),
    'Form: ' || nullif(trim(c.form), ''),
    -- value_props and kpis are jsonb and are authored either way round: a real
    -- array, or a bare scalar someone typed into a json column. Reading only
    -- the array case would drop the scalar rows out of the corpus silently.
    'Value: ' || case
      when jsonb_typeof(c.value_props) = 'array'
        then nullif(array_to_string(array(select jsonb_array_elements_text(c.value_props)), ', '), '')
      else nullif(trim(both '"' from c.value_props::text), '')
    end,
    'Owner: ' || nullif(trim(c.owner), ''),
    'Perceived owner: ' || nullif(trim(c.perceived_owner), ''),
    'Lane owner team: ' || nullif(trim(l.owner_team), ''),
    'Lane KPIs: ' || case
      when jsonb_typeof(l.kpis) = 'array'
        then nullif(array_to_string(array(select jsonb_array_elements_text(l.kpis)), ', '), '')
      else nullif(trim(both '"' from l.kpis::text), '')
    end
  ) as chunk,
  c.updated_at
from public.cells c
  join public.lanes l     on l.id  = c.lane_id
  join public.steps st    on st.id = c.step_id
  join public.paths p     on p.id  = c.path_id
  join public.scenarios sc on sc.id = p.scenario_id
  join public.phases ph   on ph.id = sc.phase_id
where nullif(trim(c.content), '') is not null
   or nullif(trim(c.summary), '') is not null;

/* ------------------------------------------------------------ 3. assertions */

do $do$
declare def text; acl text; sample text;
begin
  select pg_get_viewdef(c.oid),
         array_to_string(coalesce(c.relacl::text[], '{}'::text[]), ' ')
  into def, acl
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'semantic_search' and c.relname = 'blueprint_chunks_src';

  if def is null then raise exception 'blueprint_chunks_src did not survive the replace'; end if;
  if def ~ 'Layer: ' then
    raise exception 'blueprint_chunks_src still labels a segment Layer';
  end if;
  if (select count(*) from regexp_matches(def, 'Lane: ', 'g')) <> 2 then
    raise exception
      'blueprint_chunks_src should say "Lane: " exactly twice — the title and the copy of it that opens the chunk';
  end if;

  -- The backfill reads this view as service_role. A create-or-replace keeps the
  -- ACL, and a view the embedder cannot select from fails the job it feeds
  -- rather than this migration, which is a worse place to find out.
  if acl !~ 'service_role=r' then
    raise exception 'blueprint_chunks_src is no longer readable by service_role: %', acl;
  end if;

  -- Five segments, and the fifth is the one that moved.
  select title into sample from semantic_search.blueprint_chunks_src limit 1;
  if sample is not null then
    if array_length(string_to_array(sample, ' · '), 1) <> 5 then
      raise exception 'blueprint_chunks_src emits % breadcrumb segments, not 5: %',
        array_length(string_to_array(sample, ' · '), 1), sample;
    end if;
    if (string_to_array(sample, ' · '))[5] !~ '^Lane: ' then
      raise exception 'the fifth breadcrumb segment is not a Lane: %', sample;
    end if;
  end if;
end
$do$;

-- And the standing reminder, as a notice rather than a failure: the index is
-- now behind the view, and only a full run of the embed workflow moves it.
do $do$
declare stale bigint;
begin
  select count(*) into stale
  from semantic_search.corpus_chunks
  where source = 'blueprint' and title like '%Layer: %';
  if stale > 0 then
    raise notice
      '% stored chunk titles still say "Layer: ". Run BilLogic/plus-uno → Actions → "uno-bot — embed blueprint (semantic_search)" with full: true. The nightly pass will NOT pick this up.',
      stale;
  end if;
end
$do$;
