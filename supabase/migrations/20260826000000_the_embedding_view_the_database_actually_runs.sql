-- The view whose titles are actually embedded has never been in the migration
-- series in the shape the database runs it. Recorded in
-- docs/connectors/plus-uno.md and filed as plus-uno-blueprint#130; this is the
-- migration that closes it.
--
-- WHAT WAS ACTUALLY WRONG. The issue described the drift as three things: the
-- `Phase` breadcrumb segment, the lanes/scenarios renames, and cells.summary.
-- Only the first of those is real. A view stores its dependencies as column
-- numbers on table OIDs, not as text, so the renames in 20260820090000 and
-- 20260820120000 rewrote themselves through the view for free — a replay of
-- the series already produces `lanes`, `scenarios` and `c.summary`. What a
-- replay does NOT produce, because no migration has ever contained it, is
-- everything below that a grep of this repository cannot find:
--
--   the `Phase: ` segment and the join to public.phases that feeds it,
--   and seven fields appended to the chunk body — Function, Form, Value,
--   Owner, Perceived owner, Lane owner team, Lane KPIs.
--
-- Those were added straight to the database. `'Perceived owner: '` and
-- `'Lane KPIs: '` appear nowhere in supabase/, scripts/, src/ or docs/ — this
-- file is the first time they enter git.
--
-- WHY IT MATTERS. Nothing here fails loudly. A `supabase db reset`, a branch
-- database, or any environment rebuilt from the series gets a *silently
-- different corpus*: five-segment breadcrumbs collapse to four, and every
-- chunk loses the seven fields that carry ownership and value. The embeddings
-- built on top would be wrong in a way nothing announces. The 2026-08-17
-- incident that motivated the whole contract effort was exactly this shape —
-- a view changed with no migration, found two days later by a human running
-- `pg_get_viewdef` by hand.
--
-- WHAT THIS DOES NOT DO. It does not change the hosted database. The
-- definition below was checked against `pg_get_viewdef` on the live project
-- and reproduces it, so applying it there is a no-op. That matters
-- operationally: docs/engineering/access-and-security.md requires a FULL
-- RE-EMBED whenever `blueprint_chunks_src` changes, because altering chunk
-- text does not touch `cells.updated_at` and the nightly pass is incremental.
-- No re-embed is needed for this migration. A rebuilt environment starts with
-- an empty index and embeds everything anyway.
--
-- The check that would have caught this within a day rather than within two is
-- plus-uno-blueprint#127, which is still gated off. Fixing the view without
-- that check leaves the same gap open; turning that check on without this fix
-- would have pointed a working guard at a known-divergent target.

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
    nullif(trim(c.summary), ''),
    'Function: ' || nullif(trim(c."function"), ''),
    'Form: ' || nullif(trim(c.form), ''),
    -- value_props and kpis are jsonb and are authored either way round: a real
    -- array, or a bare scalar someone typed into a json column. Reading only
    -- the array case would drop the scalar rows out of the corpus silently,
    -- which is the failure mode this whole file is about.
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
