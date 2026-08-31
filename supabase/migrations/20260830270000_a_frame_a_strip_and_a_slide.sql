-- A frame, a strip, and a slide.
--
-- "Frame" meant two things and "storyboard" meant two more, so nobody could
-- say which picture they meant. The data settles it rather than a preference:
-- the Storyboard lane's cells are all empty, the images sit on the actor
-- lanes, and a storyboard cell draws what its neighbours carry. A slide
-- already shows the pictures of the cells it references, and its own image
-- column overrode that rather than adding to it — and no row ever used it.
--
-- So, one word each:
--
--   storyboard  the LANE. A row of the board, like any other lane, and now a
--               role rather than a medium.
--   frame       ONE image on ONE cell. A cell outside the storyboard holds at
--               most one.
--   strip       a step's frames across the lanes — the script for that
--               moment. The storyboard cell's face IS the strip.
--   slide       one screen of a slice. The frames on it are a strip again:
--               the same word for the same thing, at a step and at a slide.
--
-- ── Why the slide's own image goes ────────────────────────────────────────
--
-- `slice_items.illustration` was a second source for a picture a slide
-- already had. When set it REPLACED the strip rather than joining it, so a
-- slide could show something its own cells did not, with nothing reporting
-- the disagreement. No row has ever set it. Dropping it makes a slide's
-- picture BE its strip, which is the property the vocabulary above is for.
--
-- If a slide should later carry a picture that is no cell's frame, it appends
-- to the strip rather than suppressing it. That is a different change, and it
-- starts from a column that never lied.
--
-- The `slice-illustrations` bucket is NOT dropped here. It may hold objects
-- uploaded under the older `frame-<n>.png` naming, and deleting storage is a
-- destructive act this change did not need: no code writes to it after this
-- migration, and `docs/adr/0007-three-advisor-warnings-that-must-stay.md`
-- records that the reader is gone.
--
-- ── Why the slide table is renamed ────────────────────────────────────────
--
-- `slice_items` named a slide by its relationship to its parent rather than
-- by what it is, which is the shape `layers` had before it was `lanes`. And
-- its `caption` becomes a `title` under #177's rule: `name` is for structure
-- a reader navigates, `title` is for authored content a reader reads. A slide
-- is something somebody wrote, like the slice above it and the evidence
-- beside it, so it carries a title.
--
-- ── Replaying against an empty database ───────────────────────────────────
--
-- Every assertion below is an INVARIANT, never a census. "147 storyboard
-- cells, every one empty" is a measurement of today; asserted here it would
-- fail every empty replay forever. What is asserted instead is that nothing
-- was left wearing a retired spelling, which is vacuously true on an empty
-- database and says something real on production.
--
-- Four function bodies name a column or a table this file moves. A body is
-- text: `alter table … rename` does not reach inside one, so a function keeps
-- being created successfully and raises 42703 or 42P01 the first time it is
-- called. 20260826100000 is the standing proof — nine bodies sat broken for
-- six days. Each definition below is the current one with the moved names
-- changed and nothing else, per that file's rule: RECREATE FROM AN EXPLICIT
-- DEFINITION, DO NOT SWEEP. None changes a signature, so every one is a plain
-- CREATE OR REPLACE and keeps its grants — #147 is what a needless DROP costs.

-- ── 1. The lane is a storyboard, which is a role and not a medium ─────────
--
-- `visual` named the MEDIUM: it said the row holds pictures. Every other role
-- in the vocabulary names what the row IS FOR — customer actions, support
-- actions, frontstage touchpoints — and this one is a lane of the storyboard
-- in exactly that sense. The medium was already the least interesting thing
-- about it, since a lane that holds pictures is what "storyboard" means.
--
-- The constraint is dropped before the rows move, because the constraint that
-- is on the table at that moment is the one that admits `visual` and refuses
-- `storyboard`. 20260830150000 does the same thing for the same reason.

alter table public.lanes drop constraint if exists lanes_lane_role_check;

update public.lanes set lane_role = 'storyboard' where lane_role = 'visual';

alter table public.lanes
  add constraint lanes_lane_role_check
  check (
    lane_role is null
    or lane_role in (
      'customer_actions',
      'frontstage_actions',
      'backstage_actions',
      'partner_actions',
      'frontstage_touchpoints',
      'backstage_touchpoints',
      'support_actions',
      'storyboard'
    )
  );

comment on column public.lanes.lane_role is
  'Semantic role key that drives rendering (pill cells, storyboard rows, divider anchoring), deliberately separate from the free-form display name. Canonical values: customer_actions, '
  'frontstage_actions, backstage_actions, partner_actions, '
  'frontstage_touchpoints, backstage_touchpoints, support_actions, storyboard. '
  'Null = generic swimlane (e.g. actor lanes), and is permitted on purpose. '
  'Constrained by lanes_lane_role_check — a custom role is no longer allowed, '
  'because an unconstrained column is how 36 support lanes went unclassified.';

-- ── 2. A cell's image is a frame ──────────────────────────────────────────
--
-- `picture` is the medium again, one level down. The column holds one image
-- for one cell, and a step's frames read across the lanes as a strip — which
-- is the sentence the old name could not say, because "the pictures of a
-- step" is a phrase and not a word.
--
-- Its comment was "Optional image URL or storage reference", which described
-- the value's FORM and never once said what the thing is. A comment on a
-- column is part of the schema and travels with it, so it is rewritten here
-- rather than left to follow the rename saying the old thing.

alter table public.cells rename column picture to frame;

comment on column public.cells.frame is
  'One image for one cell — the frame. A step''s frames across the lanes are its STRIP, and the storyboard cell in that step draws the strip rather than an image of its own. A cell outside the storyboard holds at most one frame. '
  'Holds a URL or a storage reference. The retired name is not repeated here '
  'on purpose: a comment is a swept prose surface, so naming the old word '
  'would leave the residue this file removes.';

-- ── 3. A slide is a slide, and it carries a title ─────────────────────────
--
-- The drop is asserted first, and the assertion is the invariant rather than
-- the count: 0 rows carry an illustration, so nothing is lost. Written as
-- "none is set" it is true on an empty replay and evidence on production;
-- written as "there are 0 of 41" it would be a census that ages badly.

do $do$
declare stragglers int;
begin
  if to_regclass('public.slice_items') is not null then
    select count(*) into stragglers
      from public.slice_items where illustration is not null;
    if stragglers <> 0 then
      raise exception
        'slice_items.illustration holds % rows; it was dropped because a slide''s '
        'image is its strip, and this one would override the strip instead',
        stragglers;
    end if;
  end if;
end
$do$;

alter table public.slice_items drop column illustration;
alter table public.slice_items rename column caption to title;
alter table public.slice_items rename to slides;

-- The dependent object names, which `alter table … rename` does not move.
--
-- LONGHAND, NOT A GUARDED `execute format` LOOP, and the difference decides
-- whether this rename is ever checked again. `scripts/migration-replay.mjs`
-- reads `alter … rename` statements and does not interpret DDL executed
-- dynamically, so a name moved inside a `do` block is a name
-- `check:identifiers` cannot see — and a retired word it cannot see is a
-- retired word nothing forbids. 20260830190000 had to accept that for
-- `findings_*`, whose empty-replay names differ from production's. These
-- fourteen do not differ: every one of them was minted by 20260729120000 and
-- 20260805150000, both of which replay, and neither has ever been renamed. So
-- they are written where the model can read them, and `slice_item` goes into
-- the enforced map as a fragment that will keep being enforced.

alter table public.slides rename constraint slice_items_pkey            to slides_pkey;
alter table public.slides rename constraint slice_items_slice_id_fkey   to slides_slice_id_fkey;
alter table public.slides rename constraint slice_items_position_unique to slides_position_unique;
alter table public.slides rename constraint slice_items_keys_match_ids  to slides_keys_match_ids;

-- The primary-key and unique constraints carry an index of the same name, and
-- renaming the constraint renamed it. These two are the plain indexes, which
-- nothing renames for them.
alter index public.slice_items_slice_id_idx rename to slides_slice_id_idx;
alter index public.slice_items_cell_ids_idx rename to slides_cell_ids_idx;

alter policy "slice_items_select"              on public.slides rename to "slides_select";
alter policy "slice_items_insert_auth"         on public.slides rename to "slides_insert_auth";
alter policy "slice_items_update_auth"         on public.slides rename to "slides_update_auth";
alter policy "slice_items_delete_auth"         on public.slides rename to "slides_delete_auth";
alter policy "slice_items_insert_service_only" on public.slides rename to "slides_insert_service_only";
alter policy "slice_items_update_service_only" on public.slides rename to "slides_update_service_only";
alter policy "slice_items_delete_service_only" on public.slides rename to "slides_delete_service_only";

alter trigger set_slice_items_updated_at on public.slides
  rename to set_slides_updated_at;

-- The comments the rename carries across unchanged, and which are the reason
-- this file exists. The table's said "Frames: consecutive slice cells
-- grouped… Empty cell_ids = title-only divider frame" — the word "frame"
-- used for a slide, in the schema's own prose, which is where the collision
-- was hiding in the first place. `cells.cell_key`'s comment names the table
-- its keys are matched against, and that name moved too.

comment on table public.slides is
  'One slide of a slice. It shows the FRAMES of the cells it references — that strip is what the slide shows, so the two cannot disagree — and carries the words written over them. Empty cell_ids = a title-only divider slide. '
  'The retired table name is not repeated here: a comment is a swept prose '
  'surface, and CONTEXT.md''s rename map is where the old name is recorded.';

comment on column public.slides.title is
  'The words at the top of the slide, as somebody wrote them. A title rather '
  'than a name because a slide is authored content a reader reads, which is '
  'the rule #177 settled; it was `caption`.';

comment on column public.slides.cell_ids is
  'SOFT refs to cells (no FK — must survive scenario re-import). Same order as cell_keys. Their frames are this slide''s strip.';

comment on column public.slides.cell_keys is
  'IR key-paths paired with cell_ids for orphan recovery after key renames.';

-- Two comments on other tables name something this file moved. Both are
-- rewritten in full rather than patched, because a comment is stored as one
-- string and there is nothing to patch.

comment on column public.cells.cell_key is
  'THE STATEMENT OF RECORD for the cell-key format. Five slugified segments, service/scenario/path/lane/step — e.g. plus-application/before-students-join/happy-path/back-stage-actions/open-session. A phase is NOT a segment. Written by the import pipeline for origin=import, minted by upsert_cell for origin=app. Survives re-import; slides.cell_keys matches against it.';

-- `steps.summary` said it is "shown as the caption on the storyboard frame",
-- which is the collision this file exists to end: a step has no frame of its
-- own — it has a STRIP, made of the frames of its cells, and the sentence
-- captions that. The word `caption` stays, because a caption is what text
-- under an image is called and no column claims that word any more.

comment on column public.steps.summary is
  'What this moment is, across every lane — the one sentence that makes the column legible without reading five cells. Shown as the caption under the step''s strip, which is the frames of its cells read across the lanes.';

-- ── 4. The function bodies, which no rename reaches ───────────────────────
--
-- `duplicate_path` and `duplicate_scenario` copy `cells.picture`;
-- `slices_referencing` and `search_blueprint` read `slice_items`. Each is the
-- definition this repository last wrote, with the moved names changed and
-- nothing else.

-- duplicate_path — the cell copy carries the frame.
CREATE OR REPLACE FUNCTION public.duplicate_path(source_path_id uuid, name text, kind text DEFAULT 'alternative'::text, copy_cells boolean DEFAULT true, copy_dependencies boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  scenario_id uuid;
  new_path_id uuid;
  -- old lane id → new lane id, as jsonb rather than a temp table: this runs
  -- inside one PostgREST statement and a temp table would outlive it.
  layer_map jsonb := '{}'::jsonb;
  src_lane record;
  new_lane_id uuid;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  select p.scenario_id into scenario_id
  from public.paths p
  where p.id = duplicate_path.source_path_id;

  if scenario_id is null then
    raise exception 'Unknown version';
  end if;

  insert into public.paths
    (scenario_id, name, kind, summary, note, origin)
  select p.scenario_id, duplicate_path.name, duplicate_path.kind,
         p.summary, p.note, 'app'
  from public.paths p
  where p.id = duplicate_path.source_path_id
  returning id into new_path_id;

  -- Lanes first, then path_steps, then cells: the order the
  -- `cells_validate_path_match` trigger requires.
  for src_lane in
    select l.id, l.name, l.lane_role, l.position,
           l.owner_team, l.kpis, l.tools
    from public.lanes l
    where l.path_id = duplicate_path.source_path_id
    order by l.position
  loop
    insert into public.lanes
      (path_id, name, lane_role, position, owner_team, kpis, tools, origin)
    values (new_path_id, src_lane.name, src_lane.lane_role,
            src_lane.position, src_lane.owner_team, src_lane.kpis,
            src_lane.tools, 'app')
    returning id into new_lane_id;
    layer_map := layer_map || jsonb_build_object(src_lane.id::text, new_lane_id);
  end loop;

  -- Columns are scenario-scoped, so the copy points at the very same `steps`
  -- rows in the same order — exactly as the source does, and exactly as
  -- `create_path` did.
  insert into public.path_steps (path_id, step_id, position)
  select new_path_id, ps.step_id, ps.position
  from public.path_steps ps
  where ps.path_id = duplicate_path.source_path_id;

  if copy_cells then
    insert into public.cells
      (path_id, lane_id, step_id, position, content, summary,
       frame, links, function, form, value_props, owner, perceived_owner,
       origin)
    select new_path_id,
           (layer_map ->> c.lane_id::text)::uuid,
           c.step_id, c.position, c.content, c.summary,
           c.frame, c.links, c.function, c.form, c.value_props,
           c.owner, c.perceived_owner, 'app'
    from public.cells c
    where c.path_id = duplicate_path.source_path_id;

    if copy_dependencies then
      -- The join is (path, lane, step, slot). The slot term is what stops a
      -- multi-cell slot from fanning one arrow out into a copy per sibling.
      insert into public.cell_dependencies
        (source_cell_id, target_cell_id, kind, name)
      select ns.id, nt.id, t.kind, t.name
      from public.cell_dependencies t
      join public.cells os
        on os.id = t.source_cell_id
       and os.path_id = duplicate_path.source_path_id
      join public.cells ot
        on ot.id = t.target_cell_id
       and ot.path_id = duplicate_path.source_path_id
      join public.cells ns
        on ns.path_id = new_path_id
       and ns.lane_id = (layer_map ->> os.lane_id::text)::uuid
       and ns.step_id = os.step_id
       and ns.position is not distinct from os.position
      join public.cells nt
        on nt.path_id = new_path_id
       and nt.lane_id = (layer_map ->> ot.lane_id::text)::uuid
       and nt.step_id = ot.step_id
       and nt.position is not distinct from ot.position
      on conflict do nothing;
    end if;
  end if;

  return new_path_id;
end;
$function$;

-- duplicate_scenario — the same copy, one level up.
CREATE OR REPLACE FUNCTION public.duplicate_scenario(source_scenario_id uuid, name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  source_phase_id uuid;
  new_scenario_id uuid;
  next_order int;
  step_map jsonb := '{}'::jsonb;
  layer_map jsonb := '{}'::jsonb;
  path_map jsonb := '{}'::jsonb;
  src_step record;
  src_path record;
  src_lane record;
  new_step_id uuid;
  new_path_id uuid;
  new_lane_id uuid;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  if coalesce(trim(name), '') = '' then
    raise exception 'A blueprint needs a name';
  end if;

  select sc.phase_id into source_phase_id
  from public.scenarios sc
  where sc.id = source_scenario_id;

  if source_phase_id is null then
    raise exception 'Unknown blueprint';
  end if;

  select coalesce(max(sc.position), -1) + 1 into next_order
  from public.scenarios sc
  where sc.phase_id = source_phase_id;

  insert into public.scenarios
    (phase_id, name, summary, position, layout, origin)
  select source_phase_id, duplicate_scenario.name, sc.summary,
         next_order, sc.layout, 'app'
  from public.scenarios sc
  where sc.id = source_scenario_id
  returning id into new_scenario_id;

  for src_step in
    select s.id, s.name
    from public.steps s
    where s.scenario_id = source_scenario_id
    order by s.created_at
  loop
    insert into public.steps (scenario_id, name, origin)
    values (new_scenario_id, src_step.name, 'app')
    returning id into new_step_id;
    step_map := step_map || jsonb_build_object(src_step.id::text, new_step_id);
  end loop;

  for src_path in
    select p.id, p.name, p.kind, p.summary, p.note
    from public.paths p
    where p.scenario_id = source_scenario_id
    order by p.created_at
  loop
    insert into public.paths
      (scenario_id, name, kind, summary, note, origin)
    values (new_scenario_id, src_path.name, src_path.kind,
            src_path.summary, src_path.note, 'app')
    returning id into new_path_id;
    path_map := path_map || jsonb_build_object(src_path.id::text, new_path_id);

    for src_lane in
      select l.id, l.name, l.lane_role, l.position,
             l.owner_team, l.kpis, l.tools
      from public.lanes l
      where l.path_id = src_path.id
      order by l.position
    loop
      insert into public.lanes
        (path_id, name, lane_role, position, owner_team, kpis, tools, origin)
      values (new_path_id, src_lane.name, src_lane.lane_role,
              src_lane.position, src_lane.owner_team, src_lane.kpis,
              src_lane.tools, 'app')
      returning id into new_lane_id;
      layer_map := layer_map || jsonb_build_object(src_lane.id::text, new_lane_id);
    end loop;

    insert into public.path_steps (path_id, step_id, position)
    select new_path_id, (step_map ->> ps.step_id::text)::uuid, ps.position
    from public.path_steps ps
    where ps.path_id = src_path.id;

    insert into public.cells
      (path_id, lane_id, step_id, position, content, summary,
       frame, links, function, form, value_props, owner, perceived_owner,
       origin)
    select new_path_id,
           (layer_map ->> c.lane_id::text)::uuid,
           (step_map ->> c.step_id::text)::uuid,
           c.position, c.content, c.summary,
           c.frame, c.links, c.function, c.form, c.value_props,
           c.owner, c.perceived_owner, 'app'
    from public.cells c
    where c.path_id = src_path.id;
  end loop;

  insert into public.cell_dependencies (source_cell_id, target_cell_id, kind, name)
  select ns.id, nt.id, t.kind, t.name
  from public.cell_dependencies t
  join public.cells os on os.id = t.source_cell_id
  join public.cells ot on ot.id = t.target_cell_id
  join public.cells ns
    on ns.path_id = (path_map ->> os.path_id::text)::uuid
   and ns.lane_id = (layer_map ->> os.lane_id::text)::uuid
   and ns.step_id = (step_map ->> os.step_id::text)::uuid
   and ns.position is not distinct from os.position
  join public.cells nt
    on nt.path_id = (path_map ->> ot.path_id::text)::uuid
   and nt.lane_id = (layer_map ->> ot.lane_id::text)::uuid
   and nt.step_id = (step_map ->> ot.step_id::text)::uuid
   and nt.position is not distinct from ot.position
  where path_map ? os.path_id::text
    and path_map ? ot.path_id::text
  on conflict do nothing;

  return new_scenario_id;
end;
$function$;

-- slices_referencing — reads the slides of every slice that cites a cell.
-- Behind every "this delete costs you N slices" confirmation, so a body
-- naming a table that no longer exists would turn the impact read into a
-- 42P01 at the moment somebody is deleting something.
create or replace function public.slices_referencing(cell_ids uuid[])
returns jsonb
language sql stable
set search_path = public, pg_catalog, pg_temp
as $fn$
  select coalesce(jsonb_agg(entry), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'slice_id', s.id,
      'title', s.title,
      'cell_keys', (
        select coalesce(jsonb_agg(to_jsonb(c.cell_key)), '[]'::jsonb)
        from public.cells c
        where c.id = any($1)
          and exists (
            select 1 from public.slides i2
            where i2.slice_id = s.id and c.id = any(i2.cell_ids)
          )
      )
    ) as entry
    from public.slices s
    where exists (
      select 1 from public.slides i
      where i.slice_id = s.id and i.cell_ids && $1
    )
  ) rows;
$fn$;

-- search_blueprint — the only one of the four uno-bot can see, and the
-- change it sees is nothing: the wire signature, the include VALUES and the
-- payload keys are all unchanged, because `slides` is read INSIDE an
-- exists() and never named on the wire. The vendored contract copy still
-- syncs, because `publicReadTables` names the table.
CREATE OR REPLACE FUNCTION public.search_blueprint(q text DEFAULT NULL::text, query_embedding vector DEFAULT NULL::vector, match_count integer DEFAULT 15, embed_model text DEFAULT NULL::text, rrf_k integer DEFAULT 60, filter_phase text DEFAULT NULL::text, filter_scenario text DEFAULT NULL::text, filter_path_kind text DEFAULT NULL::text, filter_lane_role text DEFAULT NULL::text, granularity text[] DEFAULT ARRAY['cell'::text], include text[] DEFAULT '{}'::text[])
 RETURNS TABLE(kind text, id uuid, title text, snippet text, description text, lane text, step text, scenario text, phase text, path text, links jsonb, updated_at timestamp with time zone, similarity double precision, rrf_score double precision, matched_by text, total_matched bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'semantic_search', 'pg_temp'
AS $function$
declare
  idx_model text;
  qq        tsquery;
  cap       int := greatest(coalesce(match_count, 15), 1);
  gran      text[] := coalesce(nullif(granularity, '{}'), array['cell']);
  inc       text[] := coalesce(include, '{}');
  bad       text;
  total     bigint;
  qlex      text[];
  qor       tsquery;
  qmin      int;
  qn        int;
begin
  select g into bad from unnest(gran) g
  where g not in ('phase','scenario','path','step','lane','cell') limit 1;
  if bad is not null then
    raise exception 'unknown granularity: %', bad
      using hint = 'One or more of: phase, scenario, path, step, lane, cell.';
  end if;

  select g into bad from unnest(inc) g
  where g not in ('edges','findings','slices') limit 1;
  if bad is not null then
    raise exception 'unknown include: %', bad
      using hint = 'One or more of: edges, findings, slices.';
  end if;

  if embed_model is not null then
    select m.model into idx_model from semantic_search.index_meta m where m.source = 'blueprint';
    if idx_model is not null and idx_model <> embed_model then
      raise exception 'embedding model mismatch: caller=% index=%', embed_model, idx_model
        using hint = 'Re-embed the index or fix the caller; similarity across different models is meaningless.';
    end if;
  end if;

  qq := case when nullif(trim(coalesce(q,'')),'') is null then null
             else websearch_to_tsquery('english', q) end;
  if qq is not null and qq::text = '' then qq := null; end if;

  -- MINIMUM OVERLAP, GATED ON SELECTIVITY.
  --
  -- websearch_to_tsquery ANDs every content word, so a paraphrase sharing
  -- three of five terms with the right cell matches nothing and the keyword
  -- arm goes silent. Plain OR is worse -- it turns "no keyword signal" into
  -- "keyword signal for everything", which fixed one case and broke four
  -- (plus-uno-blueprint#154).
  --
  -- qmin = least(n, greatest(3, ceil(n/2))). For n <= 3 that IS n, so short
  -- queries keep AND admission -- including the exact-term cases, where AND
  -- legitimately matches 26 cells and must not be gated away.
  if qq is not null then
    qlex := array(select unnest(tsvector_to_array(to_tsvector('english', q))) order by 1);
    qn := cardinality(qlex);
    if qn > 0 then
      qmin := least(qn, greatest(3, ceil(qn::numeric / 2)::int));
      -- CAST, NOT to_tsquery. `qlex` already holds lexemes -- they came out of
      -- to_tsvector -- and to_tsquery would run the dictionary over them a
      -- second time. That re-parse is not identity: 'call-off' comes back as
      -- the PHRASE 'call-off' <-> 'call', 'i-9' as '-9', 'a*b' as 'b'. The
      -- tsquery input function does no dictionary lookup, so a quoted lexeme
      -- survives verbatim and each alternative is exactly the lexeme the
      -- overlap count is about (#161).
      qor  := array_to_string(array(select quote_literal(u) from unnest(qlex) u), ' | ')::tsquery;
    else
      qq := null;
    end if;
  end if;

  select
    coalesce((
      select count(*)
      from public.cells c
      join public.lanes l              on l.id  = c.lane_id
      join public.paths p               on p.id  = c.path_id
      join public.scenarios sc  on sc.id = p.scenario_id
      join public.phases ph             on ph.id = sc.phase_id
      left join public.steps st         on st.id = c.step_id
      where 'cell' = any(gran)
        and (filter_phase      is null or lower(ph.name) = lower(filter_phase))
        and (filter_scenario   is null or lower(sc.name) = lower(filter_scenario))
        and (filter_path_kind  is null or p.kind    = filter_path_kind)
        and (filter_lane_role is null or l.lane_role   = filter_lane_role)
        and (qq is null
             or c.search_tsv @@ qq
             or to_tsvector('english',
                  concat_ws(' ', ph.name, sc.name, p.name, st.name, l.name)) @@ qq)
    ), 0)
    +
    coalesce((
      select count(*) from (
        select ph.name as nm from public.phases ph
        where 'phase' = any(gran)
          and (filter_phase is null or lower(ph.name) = lower(filter_phase))
          and filter_scenario is null and filter_path_kind is null
          and filter_lane_role is null
        union all
        select sc.name from public.scenarios sc
        join public.phases ph on ph.id = sc.phase_id
        where 'scenario' = any(gran)
          and (filter_phase    is null or lower(ph.name) = lower(filter_phase))
          and (filter_scenario is null or lower(sc.name) = lower(filter_scenario))
          and filter_path_kind is null and filter_lane_role is null
        union all
        select p.name from public.paths p
        join public.scenarios sc on sc.id = p.scenario_id
        join public.phases ph            on ph.id = sc.phase_id
        where 'path' = any(gran)
          and (filter_phase     is null or lower(ph.name) = lower(filter_phase))
          and (filter_scenario  is null or lower(sc.name) = lower(filter_scenario))
          and (filter_path_kind is null or p.kind    = filter_path_kind)
          and filter_lane_role is null
        union all
        select st.nm from (
          select distinct on (st2.id) st2.id, st2.name as nm, sc2.name as scn,
                 ph2.name as phn, p2.kind as pt
          from public.steps st2
          join public.scenarios sc2 on sc2.id = st2.scenario_id
          join public.phases ph2            on ph2.id = sc2.phase_id
          left join public.path_steps ps2   on ps2.step_id = st2.id
          left join public.paths p2         on p2.id = ps2.path_id
        ) st
        where 'step' = any(gran)
          and (filter_phase     is null or lower(st.phn) = lower(filter_phase))
          and (filter_scenario  is null or lower(st.scn) = lower(filter_scenario))
          and (filter_path_kind is null or st.pt         = filter_path_kind)
          and filter_lane_role is null
        union all
        select l.name from public.lanes l
        join public.paths p              on p.id  = l.path_id
        join public.scenarios sc on sc.id = p.scenario_id
        join public.phases ph            on ph.id = sc.phase_id
        where 'lane' = any(gran)
          and (filter_phase      is null or lower(ph.name) = lower(filter_phase))
          and (filter_scenario   is null or lower(sc.name) = lower(filter_scenario))
          and (filter_path_kind  is null or p.kind    = filter_path_kind)
          and (filter_lane_role is null or l.lane_role   = filter_lane_role)
      ) s
      where qq is null or to_tsvector('english', coalesce(s.nm,'')) @@ qq
    ), 0)
  into total;

  return query
  with scoped as (
    select c.id as cell_id, c.content, c.summary as descr, c.links as lnk,
           c.updated_at as upd,
           l.name as lane, st.name as step_name, sc.name as scen, ph.name as ph_name,
           p.name as path_name, p.kind as ptype,
           ph.position as ph_ord, sc.position as sc_ord,
           c.position as slot, l.position as lrow,
           c.search_tsv,
           concat_ws(' ', ph.name, sc.name, p.name, st.name, l.name) as crumb
    from public.cells c
    join public.lanes l              on l.id  = c.lane_id
    join public.paths p               on p.id  = c.path_id
    join public.scenarios sc  on sc.id = p.scenario_id
    join public.phases ph             on ph.id = sc.phase_id
    left join public.steps st         on st.id = c.step_id
    where 'cell' = any(gran)
      and (filter_phase      is null or lower(ph.name) = lower(filter_phase))
      and (filter_scenario   is null or lower(sc.name) = lower(filter_scenario))
      and (filter_path_kind  is null or p.kind    = filter_path_kind)
      and (filter_lane_role is null or l.lane_role   = filter_lane_role)
  ),
  structural as (
    select 'phase'::text as knd, ph.id, ph.name as nm, ph.summary as descr,
           ph.updated_at as upd,
           ph.name as ph_name, null::text as scen, null::text as path_name,
           null::text as ptype, null::text as step_name, null::text as lane,
           ph.position as ph_ord, -1 as sc_ord, -1 as slot, -1 as lrow
    from public.phases ph
    where 'phase' = any(gran)
      and (filter_phase is null or lower(ph.name) = lower(filter_phase))
      and filter_scenario is null and filter_path_kind is null
      and filter_lane_role is null
    union all
    select 'scenario', sc.id, sc.name, sc.summary, sc.updated_at,
           ph.name, sc.name, null, null, null, null,
           ph.position, sc.position, -1, -1
    from public.scenarios sc
    join public.phases ph on ph.id = sc.phase_id
    where 'scenario' = any(gran)
      and (filter_phase    is null or lower(ph.name) = lower(filter_phase))
      and (filter_scenario is null or lower(sc.name) = lower(filter_scenario))
      and filter_path_kind is null and filter_lane_role is null
    union all
    select 'path', p.id, p.name, p.summary, p.updated_at,
           ph.name, sc.name, p.name, p.kind, null, null,
           ph.position, sc.position, -1, -1
    from public.paths p
    join public.scenarios sc on sc.id = p.scenario_id
    join public.phases ph            on ph.id = sc.phase_id
    where 'path' = any(gran)
      and (filter_phase     is null or lower(ph.name) = lower(filter_phase))
      and (filter_scenario  is null or lower(sc.name) = lower(filter_scenario))
      and (filter_path_kind is null or p.kind    = filter_path_kind)
      and filter_lane_role is null
    union all
    select 'step', t.id, t.nm, null, t.upd,
           t.phn, t.scn, t.pnm, t.pt, t.nm, null,
           t.ph_ord, t.sc_ord, t.col, -1
    from (
      select distinct on (st.id)
             st.id, st.name as nm, st.updated_at as upd,
             ph.name as phn, sc.name as scn, p.name as pnm, p.kind as pt,
             ph.position as ph_ord, sc.position as sc_ord,
             coalesce(ps.position, -1) as col
      from public.steps st
      join public.scenarios sc on sc.id = st.scenario_id
      join public.phases ph            on ph.id = sc.phase_id
      left join public.path_steps ps   on ps.step_id = st.id
      left join public.paths p         on p.id = ps.path_id
      where 'step' = any(gran)
        and (filter_phase     is null or lower(ph.name) = lower(filter_phase))
        and (filter_scenario  is null or lower(sc.name) = lower(filter_scenario))
        and (filter_path_kind is null or p.kind    = filter_path_kind)
        and filter_lane_role is null
      order by st.id, ps.position nulls last
    ) t
    union all
    select 'lane', l.id, l.name, l.lane_role, l.updated_at,
           ph.name, sc.name, p.name, p.kind, null, l.name,
           ph.position, sc.position, -1, l.position
    from public.lanes l
    join public.paths p              on p.id  = l.path_id
    join public.scenarios sc on sc.id = p.scenario_id
    join public.phases ph            on ph.id = sc.phase_id
    where 'lane' = any(gran)
      and (filter_phase      is null or lower(ph.name) = lower(filter_phase))
      and (filter_scenario   is null or lower(sc.name) = lower(filter_scenario))
      and (filter_path_kind  is null or p.kind    = filter_path_kind)
      and (filter_lane_role is null or l.lane_role   = filter_lane_role)
  ),
  vec as (
    select s.cell_id,
           (1 - (cc.embedding <=> query_embedding))::float8 as sim,
           row_number() over (order by cc.embedding <=> query_embedding) as rnk
    from semantic_search.corpus_chunks cc
    join scoped s on s.cell_id::text = cc.source_key
    where query_embedding is not null and cc.source = 'blueprint'
    order by cc.embedding <=> query_embedding
    limit cap * 4
  ),
  kw_body as (
    -- The gate: when the floor was LOOSENED (qmin < qn), the arm only counts
    -- if it still narrowed the corpus to at most what the caller asked for.
    -- An arm admitting more rows than are being returned is not selecting
    -- between cells, it is listing them -- and RRF weights every arm equally,
    -- so an undifferentiated arm outvotes a vector arm that had the answer.
    --
    -- WHEN THE FLOOR DID NOT LOOSEN, `@@ qq` IS USED VERBATIM rather than the
    -- overlap count. An overlap count is a bag of words, and
    -- websearch_to_tsquery is not: it also understands `-term` (NOT) and
    -- `or`. Counting lexemes inverts the first -- `call-off -excused` would
    -- require a cell to CONTAIN `excus`, returning 8 cells every one of which
    -- the user asked to exclude -- and collapses the second to an AND,
    -- 587 cells down to 273. Both are silent: wrong rows, not no rows.
    --
    -- `@@ qor` on the loosened branch is a LOSSLESS prefilter, there for the
    -- GIN index only: overlap >= qmin implies overlap >= 1 implies the OR
    -- query matches. Without it the array intersection runs against every
    -- cell in scope.
    --
    -- That implication needs each alternative in `qor` to BE the lexeme the
    -- overlap counted, which is why `qor` is cast rather than re-parsed --
    -- see the derivation above.
    select z.cell_id, z.rnk
    from (
      select s.cell_id,
             row_number() over (
               order by ov.n desc, ts_rank(s.search_tsv, qor) desc, s.cell_id
             ) as rnk,
             count(*) over () as admitted
      from scoped s
      cross join lateral (
        select cardinality(array(select unnest(qlex)
                                 intersect
                                 select unnest(tsvector_to_array(s.search_tsv)))) as n
      ) ov
      where qq is not null
        and s.search_tsv @@ (case when qmin = qn then qq else qor end)
        and (qmin = qn or ov.n >= qmin)
    ) z
    where qmin = qn or z.admitted <= cap
    limit cap * 4
  ),
  kw_name as (
    select s.cell_id,
           row_number() over (
             order by ts_rank(to_tsvector('english', s.crumb), qq) desc,
                      length(coalesce(s.content,'')) desc, s.cell_id
           ) as rnk
    from scoped s
    where qq is not null and to_tsvector('english', s.crumb) @@ qq
    limit cap * 4
  ),
  fused as (
    select
      coalesce(v.cell_id, b.cell_id, n.cell_id) as cell_id,
        coalesce(1.0::float8 / (rrf_k + v.rnk), 0.0)
      + coalesce(1.0::float8 / (rrf_k + b.rnk), 0.0)
      + coalesce(1.0::float8 / (rrf_k + n.rnk), 0.0) as score,
      v.sim,
      concat_ws('+',
        case when v.cell_id is not null then 'vector'     end,
        case when b.cell_id is not null then 'keyword'    end,
        case when n.cell_id is not null then 'structural' end) as how
    from vec v
      full outer join kw_body b on b.cell_id = v.cell_id
      full outer join kw_name n on n.cell_id = coalesce(v.cell_id, b.cell_id)
  ),
  picked as (
    select f.cell_id, f.score, f.sim, f.how, null::bigint as ord
    from fused f
    where qq is not null or query_embedding is not null
    union all
    select s.cell_id, null, null, 'filter',
           row_number() over (order by s.ph_ord, s.sc_ord, s.path_name, s.slot, s.lrow)
    from scoped s
    where qq is null and query_embedding is null
  ),
  cell_rows as (
    select
      'cell'::text as knd,
      s.cell_id as rid,
      concat_ws(' · ',
        'Phase: '    || s.ph_name,
        'Scenario: ' || s.scen,
        'Path: '     || s.path_name || ' (' || s.ptype || ')',
        'Step: '     || s.step_name,
        'Lane: '     || s.lane) as ttl,
      coalesce(cc.chunk, s.content) as snip,
      s.descr, s.lane, s.step_name, s.scen, s.ph_name, s.path_name,
      s.lnk, s.upd, k.sim, k.score, k.how, k.ord,
      s.ph_ord, s.sc_ord, s.slot, s.lrow
    from picked k
    join scoped s on s.cell_id = k.cell_id
    left join semantic_search.corpus_chunks cc
           on cc.source_key = s.cell_id::text and cc.source = 'blueprint'
  ),
  structural_rows as (
    select
      x.knd, x.id as rid,
      concat_ws(' · ',
        'Phase: '    || x.ph_name,
        'Scenario: ' || x.scen,
        'Path: '     || x.path_name) as ttl,
      x.nm as snip,
      x.descr, x.lane, x.step_name, x.scen, x.ph_name, x.path_name,
      null::jsonb as lnk, x.upd,
      null::float8 as sim,
      case when qq is null then null else 1.0::float8 / (rrf_k + 1) end as score,
      case when qq is null then 'filter' else 'structural' end as how,
      null::bigint as ord,
      x.ph_ord, x.sc_ord, x.slot, x.lrow
    from structural x
    where qq is null
       or to_tsvector('english', coalesce(x.nm,'')) @@ qq
  ),
  everything as (
    select * from cell_rows
    union all
    select * from structural_rows
  ),
  -- The result the caller asked for, ranked and capped. Everything below
  -- describes THIS set, so it has to be materialised before the includes.
  picked_rows as (
    select e.*,
           row_number() over (
             order by e.score desc nulls last, e.ord nulls last,
                      e.ph_ord, e.sc_ord, e.path_name nulls first,
                      e.slot, e.lrow, e.rid) as rn
    from everything e
    order by e.score desc nulls last, e.ord nulls last,
             e.ph_ord, e.sc_ord, e.path_name nulls first,
             e.slot, e.lrow, e.rid
    limit cap
  ),
  hit_cells as (select pr.rid from picked_rows pr where pr.knd = 'cell'),
  -- Includes do NOT count against match_count: they are context about the
  -- rows already returned, not more results. A caller asking for 15 cells
  -- with edges gets 15 cells.
  inc_rows as (
    select 'edge'::text as knd, t.id as rid,
           'Edge · ' || coalesce(t.kind,'leads_to') as ttl,
           left(coalesce(sc.content, '(empty cell)'), 120) ||
             ' --' || coalesce(t.kind,'leads_to') || '--> ' ||
             left(coalesce(tc.content, '(empty cell)'), 120) ||
             coalesce(' "' || t.name || '"', '') as snip,
           null::text as descr,
           null::text as lane, null::text as step_name, null::text as scen,
           null::text as ph_name, null::text as path_name,
           jsonb_build_object('source_cell_id', t.source_cell_id,
                              'target_cell_id', t.target_cell_id,
                              'source_content', left(sc.content, 120),
                              'target_content', left(tc.content, 120),
                              'kind', coalesce(t.kind,'leads_to'),
                              'name', t.name) as lnk,
           t.updated_at as upd, null::float8 as sim, null::float8 as score,
           'include:edges'::text as how, 1 as seq
    from public.cell_dependencies t
    join public.cells sc on sc.id = t.source_cell_id
    join public.cells tc on tc.id = t.target_cell_id
    where 'edges' = any(inc)
      and (t.source_cell_id in (select rid from hit_cells)
        or t.target_cell_id in (select rid from hit_cells))

    union all
    select 'finding', f.id,
           'Finding · ' || f.check_key || ' (' || f.severity || ', ' || f.status || ')',
           coalesce(f.summary, f.check_key),
           null, null, null, null, null, null,
           jsonb_build_object('cell_ids', to_jsonb(f.cell_ids),
                              'check_key', f.check_key,
                              'severity', f.severity,
                              'status', f.status,
                              'source', f.source),
           f.updated_at, null, null, 'include:findings', 2
    from public.audit_findings f
    where 'findings' = any(inc)
      and f.status = 'open'
      and f.cell_ids && array(select rid from hit_cells)

    union all
    select 'slice', sl.id,
           'Slice · ' || sl.kind || coalesce(' · ' || sl.actor, ''),
           sl.title, sl.summary,
           null, null, null, null, null,
           jsonb_build_object('kind', sl.kind, 'actor', sl.actor),
           sl.updated_at, null, null, 'include:slices', 3
    from public.slices sl
    where 'slices' = any(inc)
      and exists (
        select 1 from public.slides si
        where si.slice_id = sl.id
          and si.cell_ids && array(select rid from hit_cells)
      )
  )
  select r.knd, r.rid, r.ttl, r.snip, r.descr, r.lane, r.step_name,
         r.scen, r.ph_name, r.path_name, r.lnk, r.upd, r.sim, r.score, r.how,
         total
  from (
    select pr.knd, pr.rid, pr.ttl, pr.snip, pr.descr, pr.lane, pr.step_name,
           pr.scen, pr.ph_name, pr.path_name, pr.lnk, pr.upd, pr.sim, pr.score,
           pr.how, 0 as seq, pr.rn
    from picked_rows pr
    union all
    select ir.knd, ir.rid, ir.ttl, ir.snip, ir.descr, ir.lane, ir.step_name,
           ir.scen, ir.ph_name, ir.path_name, ir.lnk, ir.upd, ir.sim, ir.score,
           ir.how, ir.seq, 0::bigint
    from inc_rows ir
  ) r
  order by r.seq, r.rn, r.rid;
end;
$function$;

-- ── 5. Prove it ───────────────────────────────────────────────────────────
--
-- Not a census. Every assertion here is vacuously true against an empty
-- database and says something real against production, which is the only
-- shape that can live in a file the replay harness runs.
--
-- The renames themselves need no assertion: `alter table … rename column`
-- raises if the column is not there, so this file has already failed by here
-- if any of them missed. What needs one is the class those statements cannot
-- fail on — a body still naming a name that moved, a row still wearing a role
-- that was retired, and a column that should have gone with it.

do $do$
declare
  broken text;
begin
  select string_agg(p.proname || ' names ' || w.word, ', ' order by p.proname)
    into broken
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join (values ('slice_items'), ('picture'), ('''visual'''))
      as w(word) on p.prosrc like '%' || w.word || '%'
   where n.nspname in ('public', 'semantic_search');

  if broken is not null then
    raise exception
      'a function body still names something this migration moved: %', broken;
  end if;
end
$do$;

do $do$
declare
  survivors text;
  strays int;
begin
  select string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name)
    into survivors
    from information_schema.columns
   where table_schema = 'public'
     and (
       (table_name = 'cells'  and column_name = 'picture')
       or (table_name = 'slides' and column_name in ('caption', 'illustration'))
     );

  if survivors is not null then
    raise exception 'a retired spelling is still a column: %', survivors;
  end if;

  if to_regclass('public.slice_items') is not null then
    raise exception 'public.slice_items still exists; it is public.slides now';
  end if;

  select count(*) into strays from public.lanes where lane_role = 'visual';
  if strays <> 0 then
    raise exception
      '% lanes still carry the retired `visual` role; the lane is a storyboard', strays;
  end if;
end
$do$;
