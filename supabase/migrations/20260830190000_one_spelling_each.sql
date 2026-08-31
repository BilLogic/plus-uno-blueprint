-- One spelling each: name, title, summary, kind.
--
-- The same idea is spelled four ways in this schema, and a reader who learns
-- one spelling on one table is wrong on the next. Two rules from #172 settle
-- every case in this file, and both are rules about the READER rather than
-- about the column:
--
--   `name` is for structure a reader navigates. `title` is for authored
--   content a reader reads. That leaves `slices.title` and `evidence.title`
--   exactly where they are — a slice and a piece of evidence are things
--   somebody wrote — and moves only the words that were never either.
--
--   `summary` is the entity's own one-liner. Not an aside about it, not a
--   description of it: the thing itself, said once.
--
-- Under those two rules the prose vocabulary comes out at five words, each
-- meaning one thing: name, title, summary, note, excerpt. A path's `note`
-- survives untouched because a path's note genuinely IS an aside — the "and
-- also" beside its summary — and the two unused ones go, because a column
-- nothing writes and nothing reads is not a word in the vocabulary, it is a
-- word in the way.
--
-- ── The classifiers ride along, and that is deliberate ────────────────────
--
-- `findings` is renamed here AND one of its columns is renamed here. Split
-- across two tickets, whichever landed second would have had to know about
-- the first — which is how a rename series produces the residue this
-- repository has spent a month removing. So the classifier renames are in
-- this file with the prose ones.
--
-- Classifiers settle on `kind`, the word `cell_dependencies` and `evidence`
-- already use. `scenarios.view_type` is NOT a kind — it chooses a layout for
-- the board, which is a display setting — so it becomes `layout` rather than
-- being forced into the shared set.
--
-- ── Two renames that are not what they look like ──────────────────────────
--
-- `slices.origin` is renamed rather than aligned. Every other `origin` in
-- this schema takes `import` or `app` and answers "where did this row come
-- from". A slice's takes `generated`, `customized` or `human` and answers
-- "who wrote it, and may a regeneration overwrite it" — a different question
-- with a different vocabulary, which is why it never fitted. It becomes
-- `authorship`. `services` gains the real `origin` its six sibling tables
-- have, in the same file, so the two concepts stop sharing a word.
--
-- `findings` becomes `audit_findings` because the bare word is too abstract
-- to read cold: a schema full of `cells`, `lanes` and `paths` gives no clue
-- that `findings` is the output of an audit run. The concept keeps its name —
-- a finding is still a finding on screen and in CONTEXT.md — and only the
-- table takes the prefix. Its `check_name` becomes `check_key`, because the
-- value is a roster identifier (`gap-sweep`) and not a name anybody reads.
--
-- `business_model` is pluralised rather than folded into `services`. Folding
-- it in was the other option #177 offers and it is the wrong one here:
-- CONTEXT.md defines this row as the SERVICE'S SPEC ROW, one of four levels
-- of spec, and five columns of spec on `services` would put the service's
-- spec somewhere no other level's is. The only thing wrong with the table was
-- that it was the one singular name in a schema of plurals.
--
-- ── The exception, said out loud ──────────────────────────────────────────
--
-- `cells.content` stays. A cell's text is a sentence somebody wrote in the
-- grid — "Tutor confirms the student's goals for the session" — and none of
-- name, title or summary describes that. It is the one column in the board
-- that keeps a word of its own, and the comment at the foot of this file says
-- so, because an exception that lives only in somebody's head is
-- indistinguishable from an oversight three months later.
--
-- ── What this costs the bot, and why it is paid here ──────────────────────
--
-- uno-bot reads `findings` directly over PostgREST, reads `check_name`,
-- `label` and `note` off the rows it gets back, and sends `filter_path_type`
-- to `search_blueprint`. All four move in this file. That is a coordinated
-- cross-repo change rather than an accident: the vendored copy of
-- `src/lib/blueprintContract.ts` in the bot repo syncs before this migration
-- is applied, which is the mechanism `docs/connectors/plus-uno.md` describes
-- and the reason the contract lists these names at all. The include VALUE
-- `'findings'` on `search_blueprint` does NOT move — it is a word on the wire
-- naming a category of result, not the table, and `searchBlueprintInclude`
-- pins it.
--
-- ── Replaying against an empty database ───────────────────────────────────
--
-- `docs/reference/migration-replay-baseline.json` is explicit that a new
-- failing entry means "a migration written against an apply path that does
-- not work", so every statement here is written for a database that may not
-- have all of this. Three shapes recur:
--
--   Table and column renames are plain `alter table … rename`, because the
--   replay does reach these tables and the static model in
--   `scripts/migration-replay.mjs` reads those statements. `business_model`
--   is the exception: on an empty replay it is still `propositions`, because
--   20260821350000's rename does not survive that path, so its whole section
--   is guarded on the table existing.
--
--   Dependent object names — constraints, indexes, policies, triggers — are
--   renamed inside a guarded block wherever the empty replay's names differ
--   from production's. They do differ: `findings_service_id_fkey` there is
--   still `findings_service_lifecycle_id_fkey`. The three constraint names
--   that carry a retired classifier word are spelled the same in both, so
--   those are written out longhand where the static model can see them.
--
--   Every assertion is an INVARIANT, never a census. `count(*) where note is
--   not null = 0` is vacuously true on an empty table and says something real
--   on production, where it is the evidence that dropping the column loses
--   nothing. A row count would fail every empty replay forever.

-- ── 1. The entity's own one-liner ─────────────────────────────────────────

alter table public.slices rename column description to summary;

-- ── 2. The two note columns nothing ever wrote ────────────────────────────
--
-- Measured on production, 2026-08-30: `cell_dependencies.note` is null on all
-- 434 rows, `evidence.note` on both. The assertion below is the invariant
-- rather than those counts, so that it means the same thing here and on an
-- empty replay. `cell_dependencies.note` even carries a comment claiming it
-- is "the why-line shown in the cell panel dependencies tab" — a sentence
-- about a surface that reads a column no writer ever filled, which is the
-- shape #172 names as the recurring defect.

do $do$
declare stragglers int;
begin
  if to_regclass('public.cell_dependencies') is not null then
    select count(*) into stragglers from public.cell_dependencies where note is not null;
    if stragglers <> 0 then
      raise exception
        'cell_dependencies.note holds % rows; it was dropped as unused', stragglers;
    end if;
  end if;

  if to_regclass('public.evidence') is not null then
    select count(*) into stragglers from public.evidence where note is not null;
    if stragglers <> 0 then
      raise exception 'evidence.note holds % rows; it was dropped as unused', stragglers;
    end if;
  end if;
end
$do$;

alter table public.cell_dependencies drop column if exists note;
alter table public.evidence          drop column if exists note;

-- ── 3. A dependency's label is a name ─────────────────────────────────────
--
-- Eight of the 434 dependencies carry one, and each is the word on the arrow:
-- the thing a reader navigates by. `label` also stays a live column on
-- `deleted_structure`, where it labels a trash entry rather than naming a
-- board object, so this rename cannot be enforced as a substring — see
-- `scripts/tests/one-spelling-each.test.mjs`.

alter table public.cell_dependencies rename column label to name;

-- ── 4. The classifiers ────────────────────────────────────────────────────

alter table public.paths     rename column path_type  to kind;
alter table public.slices    rename column slice_type to kind;
alter table public.scenarios rename column view_type  to layout;

alter table public.paths     rename constraint paths_path_type_check     to paths_kind_check;
alter table public.slices    rename constraint slices_slice_type_check   to slices_kind_check;
alter table public.scenarios rename constraint scenarios_view_type_check to scenarios_layout_check;

-- ── 5. A slice's origin is a different question ───────────────────────────

alter table public.slices rename column origin to authorship;
alter table public.slices rename constraint slices_origin_check to slices_authorship_check;

-- ── 6. …so `services` can have the real one ───────────────────────────────
--
-- `phases`, `scenarios`, `steps`, `paths`, `lanes` and `cells` all carry it
-- and `services` never did, which made "was this service imported or made in
-- the app" the one question the origin columns could not answer. Default
-- `import`, matching every sibling: the row that exists today came from the
-- import pipeline.

alter table public.services add column if not exists origin text not null default 'import';
alter table public.services drop constraint if exists services_origin_check;
alter table public.services add  constraint services_origin_check
  check (origin in ('import', 'app'));

-- ── 7. Findings gets a prefix, and its check column a key ─────────────────

alter table public.findings rename column check_name to check_key;
alter table public.findings rename column note       to summary;
alter table public.findings rename to audit_findings;

-- The dependent object names, which `alter table … rename` does not move.
-- Guarded and dynamic because the empty replay's names are not production's:
-- there, the foreign key and the index are still `*_service_lifecycle_id_*`
-- from before 20260820140000. A longhand `rename constraint` would abort on
-- the first one that is spelled differently, and an aborted file is a new
-- entry in the replay baseline.

do $do$
declare
  pair text[];
begin
  if to_regclass('public.audit_findings') is null then
    return;
  end if;

  foreach pair slice 1 in array array[
    array['findings_pkey',                     'audit_findings_pkey'],
    array['findings_keys_match_ids',           'audit_findings_keys_match_ids'],
    array['findings_severity_check',           'audit_findings_severity_check'],
    array['findings_source_check',             'audit_findings_source_check'],
    array['findings_status_check',             'audit_findings_status_check'],
    array['findings_service_id_fkey',          'audit_findings_service_id_fkey'],
    array['findings_service_lifecycle_id_fkey', 'audit_findings_service_id_fkey']
  ]
  loop
    if exists (
      select 1 from pg_constraint c
      join pg_class rel on rel.oid = c.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public' and rel.relname = 'audit_findings' and c.conname = pair[1]
    ) then
      execute format('alter table public.audit_findings rename constraint %I to %I',
                     pair[1], pair[2]);
    end if;
  end loop;

  foreach pair slice 1 in array array[
    array['findings_cell_ids_idx',             'audit_findings_cell_ids_idx'],
    array['findings_open_fingerprint_idx',     'audit_findings_open_fingerprint_idx'],
    array['findings_service_id_idx',           'audit_findings_service_id_idx'],
    array['findings_service_lifecycle_id_idx', 'audit_findings_service_id_idx']
  ]
  loop
    if to_regclass('public.' || quote_ident(pair[1])) is not null then
      execute format('alter index public.%I rename to %I', pair[1], pair[2]);
    end if;
  end loop;

  foreach pair slice 1 in array array[
    array['findings_select',              'audit_findings_select'],
    array['findings_insert_auth',         'audit_findings_insert_auth'],
    array['findings_update_auth',         'audit_findings_update_auth'],
    array['findings_insert_service_only', 'audit_findings_insert_service_only'],
    array['findings_update_service_only', 'audit_findings_update_service_only'],
    array['findings_delete_service_only', 'audit_findings_delete_service_only']
  ]
  loop
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'audit_findings' and policyname = pair[1]
    ) then
      execute format('alter policy %I on public.audit_findings rename to %I',
                     pair[1], pair[2]);
    end if;
  end loop;

  if exists (
    select 1 from pg_trigger t
    join pg_class rel on rel.oid = t.tgrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public' and rel.relname = 'audit_findings'
      and t.tgname = 'set_findings_updated_at' and not t.tgisinternal
  ) then
    execute 'alter trigger set_findings_updated_at on public.audit_findings '
         || 'rename to set_audit_findings_updated_at';
  end if;
end
$do$;

-- ── 8. The one singular table name in a schema of plurals ─────────────────
--
-- Guarded throughout: on an empty replay this table is still `propositions`,
-- because 20260821350000 does not survive that path. Nothing here is allowed
-- to abort a replay over a table the replay never built.
--
-- The table rename itself is written longhand with `if exists` rather than
-- inside the block below, because `scripts/migration-replay.mjs` reads
-- `alter table` statements and does not interpret DDL executed dynamically.
-- A rename it cannot see is a rename the identifier checks cannot see either,
-- and this file's own guard — `scripts/tests/one-spelling-each.test.mjs` —
-- reads exactly that model.

alter table if exists public.business_model rename to business_models;

-- The dependent object names, which the rename above does not move. Keyed on
-- the NEW name: by the time this runs the old one resolves to nothing, so a
-- guard on `business_model` would skip the very work it is guarding.

do $do$
declare
  pair text[];
begin
  if to_regclass('public.business_models') is null then
    return;
  end if;

  foreach pair slice 1 in array array[
    array['business_model_pkey',            'business_models_pkey'],
    array['business_model_service_id_fkey', 'business_models_service_id_fkey']
  ]
  loop
    if exists (
      select 1 from pg_constraint c
      join pg_class rel on rel.oid = c.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
      where n.nspname = 'public' and rel.relname = 'business_models' and c.conname = pair[1]
    ) then
      execute format('alter table public.business_models rename constraint %I to %I',
                     pair[1], pair[2]);
    end if;
  end loop;

  if to_regclass('public.business_model_pkey') is not null then
    execute 'alter index public.business_model_pkey rename to business_models_pkey';
  end if;

  foreach pair slice 1 in array array[
    array['business_model_select_auth',         'business_models_select_auth'],
    array['business_model_insert_auth',         'business_models_insert_auth'],
    array['business_model_update_auth',         'business_models_update_auth'],
    array['business_model_insert_service_only', 'business_models_insert_service_only'],
    array['business_model_update_service_only', 'business_models_update_service_only'],
    array['business_model_delete_service_only', 'business_models_delete_service_only']
  ]
  loop
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'business_models' and policyname = pair[1]
    ) then
      execute format('alter policy %I on public.business_models rename to %I',
                     pair[1], pair[2]);
    end if;
  end loop;

  if exists (
    select 1 from pg_trigger t
    join pg_class rel on rel.oid = t.tgrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public' and rel.relname = 'business_models'
      and t.tgname = 'set_business_model_updated_at' and not t.tgisinternal
  ) then
    execute 'alter trigger set_business_model_updated_at on public.business_models '
         || 'rename to set_business_models_updated_at';
  end if;
end
$do$;

-- ── 9. Say what the words mean, where the schema keeps its prose ──────────
--
-- A column comment is part of the schema and travels with it, which is why
-- `check-retired-identifiers.mjs` treats `pg_description` as a trusted prose
-- surface. Leaving a comment describing a column by its retired name would be
-- the same defect this file exists to fix, one layer down — 20260830120000
-- says the same thing about the lane-role comment, which was the fourth list
-- of roles and the one nobody checked.
--
-- The views need no such repair. Postgres stores a view as a parse tree with
-- column references by attribute number, so renaming a column rewrites every
-- view that reads it — `semantic_search.blueprint_chunks_src` picks up
-- `p.kind` on its own, and the breadcrumb text it emits is unchanged because
-- the VALUE (`happy`, `variant`, `exception`) never moved. No re-embed.
-- Function bodies are text and get no such help, which is section 10.

comment on column public.cell_dependencies.name is
  'The word on the arrow, e.g. a channel tag like "Email". A name because it '
  'is what a reader navigates the dependency by; it was `label`, which said '
  'how it renders rather than what it is.';

comment on column public.paths.kind is
  'How this route relates to the scenario''s main one: happy (it IS the main '
  'route), variant (equally normal, chosen by condition), exception (a rule '
  'or a failure diverts it). How far along the route is does not belong here: '
  'paths.status carries that, on the entity_status domain — proposed, '
  'planned, built, live, at_risk, deprecated.';

comment on column public.scenarios.layout is
  'How the board is drawn: single path, or the paths stacked for comparison. '
  'A display setting rather than a kind, which is why it is `layout` and not '
  '`kind` — merged is chosen per session in the compare control and is never '
  'stored.';

comment on column public.slices.kind is
  'How the cut was made: journey (experience closure for an actor) | step '
  '(one column) | lane (one lane across the whole service) | cell '
  '(single-cell spec) | custom.';

comment on column public.slices.authorship is
  'Who wrote this slice, and whether a regeneration may overwrite it: '
  'generated = safe to regenerate; customized = human-edited, regeneration '
  'must confirm; human = authored outright. Deliberately NOT called origin: '
  'every origin column in this schema answers "import or app", which is a '
  'different question with a different vocabulary.';

comment on column public.services.origin is
  'Where this service came from: import (the pipeline) or app (created in '
  'the canvas). The same two values its six sibling tables carry.';

comment on column public.audit_findings.check_key is
  'Roster check identifier, e.g. "gap-sweep". A key rather than a name '
  'because nobody reads it as prose — it is what a fingerprint is built from '
  'and what a run is grouped by.';

comment on column public.audit_findings.summary is
  'The finding itself, in one line. It was `note`, which read as an aside '
  'about a finding rather than as the finding.';

comment on column public.audit_findings.fingerprint is
  'check_key + sorted cell_keys hash. Dedupe/reopen identity across runs.';

comment on table public.audit_findings is
  'Audit / whatif / import-sweep outputs. Written by skills (IDE service key '
  'or canvas authenticated agent); humans triage by status. Prefixed on '
  '2026-08-30 because the bare word `findings` gave a reader no clue which '
  'process produces the rows; the CONCEPT is still a finding everywhere else.';

-- ── The one deliberate exception ──────────────────────────────────────────
--
-- Everything above moves a column onto one of five words. This one does not,
-- and the reason is worth carrying in the schema rather than in a ticket.

-- The opening literal carries the whole argument on purpose. Postgres
-- concatenates adjacent string literals, but `scripts/migration-replay.mjs`
-- models only the first of them — so anything said in a continuation line is
-- invisible to the retired-word sweep and to the guard that reads this comment
-- back. Whatever a comment most needs to say goes in its first literal.

comment on column public.cells.content is
  'THE ONE DELIBERATE EXCEPTION to the name/title/summary vocabulary (#177): a cell''s text is a sentence somebody wrote about a moment, not a name for the cell and not a one-line summary of something longer. '
  'It is the cell''s own words, as typed into the grid. Renaming it to any of '
  'the three would have described the column less well than the word it '
  'already had.';

-- ── 10. The function bodies, which no rename reaches ──────────────────────
--
-- `alter table … rename column` moves the column and nothing inside a plpgsql
-- body: names there resolve when the statement runs, so a function keeps
-- being CREATED successfully and raises 42703 the first time it is called.
-- 20260826100000 is the standing proof — nine bodies sat broken for six days
-- because a sweep's selection regex could not match what its replacement was
-- written for, and that file's conclusion is the rule followed here: RECREATE
-- FROM AN EXPLICIT DEFINITION, DO NOT SWEEP.
--
-- Each definition below was read from production with `pg_get_functiondef`
-- and edited, so nothing is reconstructed from memory. Four need a DROP
-- first, because a parameter name is part of the signature and CREATE OR
-- REPLACE refuses to change one; the other three are replaced in place and
-- keep their grants. Every dropped function has its grants re-issued
-- immediately below it — #147 is what happens when they are not: a drop takes
-- the ACL with it and the recreate lands on Postgres's default, EXECUTE TO
-- PUBLIC, which for a SECURITY DEFINER function hands the service-account
-- guard to anybody holding the anon key.

-- create_path — `path_type` becomes `kind`, parameter and column.
--
-- The insert's VALUES list is qualified with `create_path.` here. It did not
-- need to be while the parameter was `path_type`, and it does now: `kind` is
-- also the name of the column being inserted into, and plpgsql's default
-- variable_conflict is `error`.

drop function if exists public.create_path(uuid, text, text, uuid);

CREATE OR REPLACE FUNCTION public.create_path(scenario_id uuid, name text, kind text DEFAULT 'alternative'::text, lane_source_path_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  new_path_id uuid;
  source_path_id uuid;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  source_path_id := coalesce(
    lane_source_path_id,
    (select p.id from public.paths p
      where p.scenario_id = create_path.scenario_id
      order by p.created_at limit 1)
  );

  insert into public.paths (scenario_id, name, kind, origin)
  values (create_path.scenario_id, create_path.name, create_path.kind, 'app')
  returning id into new_path_id;

  insert into public.lanes (path_id, name, lane_role, position, origin)
  select new_path_id, l.name, l.lane_role, l.position, 'app'
  from public.lanes l where l.path_id = source_path_id;

  insert into public.path_steps (path_id, step_id, position)
  select new_path_id, ps.step_id, ps.position
  from public.path_steps ps where ps.path_id = source_path_id;

  return new_path_id;
end;
$function$;

revoke all on function public.create_path(uuid, text, text, uuid) from public;
grant execute on function public.create_path(uuid, text, text, uuid)
  to authenticated, service_role;

-- duplicate_path — `path_type` becomes `kind`; the dependency copy loses
-- `note` and calls the label a name.

drop function if exists public.duplicate_path(uuid, text, text, boolean, boolean);

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
       picture, links, function, form, value_props, owner, perceived_owner,
       origin)
    select new_path_id,
           (layer_map ->> c.lane_id::text)::uuid,
           c.step_id, c.position, c.content, c.summary,
           c.picture, c.links, c.function, c.form, c.value_props,
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

revoke all on function public.duplicate_path(uuid, text, text, boolean, boolean) from public;
grant execute on function public.duplicate_path(uuid, text, text, boolean, boolean)
  to authenticated, service_role;

-- create_scenario — `view_type` becomes `layout`, and the path it seeds is
-- inserted into `kind`. The two guard clauses move with it: the message a
-- caller sees now names the column it is talking about.

drop function if exists public.create_scenario(uuid, text, text, uuid, jsonb, integer, text);

CREATE OR REPLACE FUNCTION public.create_scenario(phase_id uuid, name text, layout text DEFAULT 'single'::text, lane_source_path_id uuid DEFAULT NULL::uuid, lane_set jsonb DEFAULT '[]'::jsonb, step_count integer DEFAULT 5, path_name text DEFAULT 'Happy Path'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  scenario_id uuid;
  new_path_id uuid;
  next_order int;
  lane jsonb;
  step_id uuid;
  i int;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint' using errcode = '42501';
  end if;
  if coalesce(trim(name), '') = '' then
    raise exception 'A blueprint needs a name';
  end if;
  if layout = 'merged' then
    raise exception 'layout ''merged'' is a display state, not a stored one'
      using hint = 'Store ''stacked''; merged is chosen per session in the compare control.';
  end if;
  if layout not in ('single', 'stacked') then
    raise exception 'Unknown layout %', layout
      using hint = 'One of: single, stacked.';
  end if;

  select coalesce(max(position), -1) + 1 into next_order
  from public.scenarios where scenarios.phase_id = create_scenario.phase_id;

  insert into public.scenarios (phase_id, name, position, layout, origin)
  values (create_scenario.phase_id, create_scenario.name, next_order, create_scenario.layout, 'app')
  returning id into scenario_id;

  insert into public.paths (scenario_id, name, kind, origin)
  values (scenario_id, path_name, 'happy', 'app')
  returning id into new_path_id;

  if lane_source_path_id is not null then
    insert into public.lanes (path_id, name, lane_role, position, origin)
    select new_path_id, l.name, l.lane_role, l.position, 'app'
    from public.lanes l where l.path_id = lane_source_path_id;
  else
    for lane in select * from jsonb_array_elements(lane_set) loop
      insert into public.lanes (path_id, name, lane_role, position, origin)
      values (
        new_path_id,
        lane ->> 'name',
        nullif(lane ->> 'lane_role', ''),
        coalesce((lane ->> 'position')::int, 0),
        'app'
      );
    end loop;
  end if;

  for i in 0 .. greatest(step_count, 1) - 1 loop
    insert into public.steps (scenario_id, name, origin)
    values (scenario_id, 'Step ' || (i + 1), 'app')
    returning id into step_id;
    insert into public.path_steps (path_id, step_id, position)
    values (new_path_id, step_id, i);
  end loop;

  return jsonb_build_object('scenario_id', scenario_id, 'path_id', new_path_id);
end;
$function$;

revoke all on function public.create_scenario(uuid, text, text, uuid, jsonb, integer, text) from public;
grant execute on function public.create_scenario(uuid, text, text, uuid, jsonb, integer, text)
  to authenticated, service_role;

-- set_cell_dependency — `label` becomes `name` and `note` goes, so this is
-- the one signature that gets SHORTER. The four-argument form replaces the
-- five-argument one; the old one is dropped by its exact signature rather
-- than left as an overload, because an overload with a dead column in its
-- body is a live call away from a 42703.

drop function if exists public.set_cell_dependency(uuid, uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.set_cell_dependency(source_cell_id uuid, target_cell_id uuid, kind text DEFAULT 'leads_to'::text, name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
declare
  dependency_id uuid;
  source_path uuid;
  target_path uuid;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint'
      using errcode = '42501';
  end if;

  if set_cell_dependency.source_cell_id = set_cell_dependency.target_cell_id then
    raise exception 'A cell cannot depend on itself';
  end if;
  if set_cell_dependency.kind not in ('leads_to', 'enables') then
    raise exception 'Unknown dependency kind %', set_cell_dependency.kind;
  end if;

  select c.path_id into source_path from public.cells c
    where c.id = set_cell_dependency.source_cell_id;
  select c.path_id into target_path from public.cells c
    where c.id = set_cell_dependency.target_cell_id;
  if source_path is null or target_path is null then
    raise exception 'Both cells must exist';
  end if;
  -- Arrows are drawn within one path's grid; a cross-path arrow has nowhere to
  -- render and is what validate_ir.py rejects on import.
  if source_path <> target_path then
    raise exception 'Both cells must be in the same path of the journey';
  end if;

  insert into public.cell_dependencies (source_cell_id, target_cell_id, kind, name)
  values (set_cell_dependency.source_cell_id, set_cell_dependency.target_cell_id,
          set_cell_dependency.kind,
          nullif(trim(set_cell_dependency.name), ''))
  on conflict on constraint cell_dependencies_source_target_kind_unique
    do update set name = excluded.name
  returning id into dependency_id;

  return dependency_id;
end;
$function$;

revoke all on function public.set_cell_dependency(uuid, uuid, text, text) from public;
grant execute on function public.set_cell_dependency(uuid, uuid, text, text)
  to authenticated, service_role;

-- duplicate_scenario — body only, so CREATE OR REPLACE and the grants stay.

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
       picture, links, function, form, value_props, owner, perceived_owner,
       origin)
    select new_path_id,
           (layer_map ->> c.lane_id::text)::uuid,
           (step_map ->> c.step_id::text)::uuid,
           c.position, c.content, c.summary,
           c.picture, c.links, c.function, c.form, c.value_props,
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

-- mint_cell_key — body only. It falls back to the path's kind when a path has
-- no name, which is the one place a cell key can contain `happy`.
--
-- The only `language sql` function in this file, and the only one Postgres
-- validates as it is created. Its body reads `ph.service_id`, which is what
-- production has — but on an empty replay `phases` is still carrying
-- `service_lifecycle_id`, because 20260820140000's rename does not survive
-- that path either. The replay would refuse the correct definition on the
-- strength of a column name the repository fixed six migrations ago.
--
-- So body checking is off for this one statement. It is not a shortcut around
-- a broken definition: this exact text is what production runs today, and the
-- assertion at the foot of the file still reads the body back and fails if
-- `path_type` survived in it. `set local` scopes the change to the
-- transaction Supabase wraps each migration in, and it is set back on
-- immediately so that nothing after it is admitted unchecked.

set local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.mint_cell_key(path_id uuid, lane_id uuid, step_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
  select concat_ws('/',
    public.key_slug(sl.name),
    public.key_slug(sc.name),
    coalesce(public.key_slug(p.name), public.key_slug(p.kind)),
    public.key_slug(l.name),
    public.key_slug(s.name)
  )
  from public.paths p
  join public.scenarios sc on sc.id = p.scenario_id
  join public.phases ph on ph.id = sc.phase_id
  join public.services sl on sl.id = ph.service_id
  join public.lanes l on l.id = $2
  join public.steps s on s.id = $3
  where p.id = $1;
$function$;

set local check_function_bodies = on;

-- search_blueprint — the widest change in the file, and the only one uno-bot
-- can see. `filter_path_type` becomes `filter_path_kind` because a parameter
-- named after a column that no longer exists is precisely the residue this
-- batch of work exists to end, and `blueprintContract.ts` declares parameter
-- names so that a rename shows up as contract drift rather than as a filter
-- that silently stops filtering.
--
-- The `links` payload keys move with their columns — `label` → `name`,
-- `check_name` → `check_key`, `slice_type` → `kind` — for the same reason.
-- The include VALUE `'findings'` does not: it names a category of result on
-- the wire, the contract pins it, and the RPC's guard clause is where that
-- vocabulary is defined.
--
-- One projection loses its source. The edge rows selected
-- `t.note as descr`, and `cell_dependencies.note` is gone, so the column is
-- `null::text` now. It was null on all 434 rows, so no reader loses anything
-- it was ever given; the output column stays because it is one arm of a
-- UNION ALL and the contract declares it.

drop function if exists public.search_blueprint(text, vector, integer, text, integer, text, text, text, text, text[], text[]);

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
        select 1 from public.slice_items si
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

revoke all on function public.search_blueprint(text, vector, integer, text, integer, text, text, text, text, text[], text[]) from public;
grant execute on function public.search_blueprint(text, vector, integer, text, integer, text, text, text, text, text[], text[])
  to anon, authenticated, service_role;

-- ── 11. Prove it ──────────────────────────────────────────────────────────
--
-- Not a census. Every assertion below is vacuously true against an empty
-- database and says something real against production, which is the only
-- shape that can live in a file the replay harness runs.
--
-- The renames themselves need no assertion: `alter table … rename column`
-- raises if the column is not there, so this file has already failed by here
-- if any of them missed. What DOES need one is the class those statements
-- cannot fail on — a body still naming a column that moved, and a payload
-- still keyed by one.

do $do$
declare
  broken text;
begin
  select string_agg(p.proname || ' names ' || w.word, ', ' order by p.proname)
    into broken
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join (values ('path_type'), ('view_type'), ('slice_type'), ('check_name'))
      as w(word) on p.prosrc like '%' || w.word || '%'
   where n.nspname in ('public', 'semantic_search');

  if broken is not null then
    raise exception
      'a function body still names a column this migration renamed: %', broken;
  end if;
end
$do$;

do $do$
declare
  survivors text;
begin
  select string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name)
    into survivors
    from information_schema.columns
   where table_schema = 'public'
     and (
       (table_name = 'slices'            and column_name in ('description', 'slice_type', 'origin'))
       or (table_name = 'paths'          and column_name = 'path_type')
       or (table_name = 'scenarios'      and column_name = 'view_type')
       or (table_name = 'cell_dependencies' and column_name in ('label', 'note'))
       or (table_name = 'evidence'       and column_name = 'note')
       or (table_name = 'audit_findings' and column_name in ('check_name', 'note'))
     );

  if survivors is not null then
    raise exception 'a retired spelling is still a column: %', survivors;
  end if;

  if to_regclass('public.findings') is not null then
    raise exception 'public.findings still exists; it is public.audit_findings now';
  end if;
end
$do$;
