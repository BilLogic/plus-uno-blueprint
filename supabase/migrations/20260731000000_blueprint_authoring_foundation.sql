-- Blueprint authoring, part 1 of 2: provenance, delete-safety, constraints.
--
-- Part 2 adds the RPCs that are the only sanctioned write path for structure.
-- Nothing here grants table-level INSERT or DELETE: the functions in part 2
-- are `security definer`, so the app gets operations rather than tables.

-- ---------------------------------------------------------------------------
-- Provenance. Without it nothing can tell an app-created row from an imported
-- one, and therefore nothing can protect either appropriately.
-- ---------------------------------------------------------------------------
alter table public.service_scenarios
  add column if not exists origin text not null default 'import'
    constraint service_scenarios_origin_check check (origin in ('import', 'app'));
alter table public.paths
  add column if not exists origin text not null default 'import'
    constraint paths_origin_check check (origin in ('import', 'app'));
alter table public.steps
  add column if not exists origin text not null default 'import'
    constraint steps_origin_check check (origin in ('import', 'app'));
alter table public.layers
  add column if not exists origin text not null default 'import'
    constraint layers_origin_check check (origin in ('import', 'app'));
alter table public.cells
  add column if not exists origin text not null default 'import'
    constraint cells_origin_check check (origin in ('import', 'app'));

-- ---------------------------------------------------------------------------
-- The cell's authored key, stored rather than derived.
--
-- Slices bind to cells through `slice_items.cell_keys` because a scenario
-- re-import deletes and recreates every `cells` row — the id changes, the key
-- does not. That only works if the key can actually be recovered from a cell,
-- and until now it could not: the key is *authored* in the IR
-- (`lifecycle/scenario/path/layer/step`, per `slice_tools.py:cell_key`), not
-- computed from display names, so no SQL function can reconstruct it. A cell
-- had no way to say what its own key was.
--
-- Nullable on purpose. Imported rows are backfilled by the import pipeline,
-- which is the only thing that knows the authored keys; app-created rows get
-- one minted by `upsert_cell`. A null key means "this cell predates the
-- column" — visible, rather than silently wrong.
--
-- Current data, for the record: of 36 stored `cell_keys`, 17 are raw UUIDs
-- (no recovery value at all) and 19 are keys in two different abbreviation
-- styles (`warm-up/happy/rt/s4` and `warm-up/happy/regular-tutor/step-5`),
-- neither matching what `slice_tools.py` produces today. Recovery is not
-- functional until those are backfilled through one convention.
-- ---------------------------------------------------------------------------
alter table public.cells add column if not exists cell_key text;

create unique index if not exists cells_cell_key_unique
  on public.cells (cell_key) where cell_key is not null;

comment on column public.cells.cell_key is
  'Authored key: lifecycle/scenario/path/layer/step. Written by the import pipeline for origin=import, minted by upsert_cell for origin=app. Survives re-import; slice_items.cell_keys matches against it.';

-- ---------------------------------------------------------------------------
-- Column ordering. `slice_items` was built DEFERRABLE INITIALLY DEFERRED so
-- its editor could renumber in one batch; path_steps was not, which makes any
-- multi-row shift collide with itself midway. The RPCs do the shifting in one
-- transaction, and a deferrable constraint makes that safe rather than lucky.
-- ---------------------------------------------------------------------------
alter table public.path_steps
  drop constraint if exists path_steps_path_column_unique;
alter table public.path_steps
  add constraint path_steps_path_column_unique
    unique (path_id, column_position) deferrable initially deferred;

-- ---------------------------------------------------------------------------
-- Delete safety. Nothing is destroyed until its payload is archived, in the
-- same transaction as the cascade that destroys it.
-- ---------------------------------------------------------------------------
create table if not exists public.deleted_structure (
  id uuid primary key default gen_random_uuid(),
  deleted_at timestamptz not null default now(),
  deleted_by uuid default auth.uid(),
  kind text not null check (kind in ('scenario', 'path', 'lane', 'step', 'cell')),
  -- Human name, for the undo toast and the recovery list.
  label text not null,
  -- Every deleted row, natural-keyed and in dependency order, so restore can
  -- replay it through the ordinary create path.
  payload jsonb not null,
  -- [{slice_id, title, cell_keys:[…]}] — which slices lost frames to this.
  affected_slices jsonb not null default '[]'::jsonb
);

create index if not exists deleted_structure_deleted_at_idx
  on public.deleted_structure (deleted_at desc);

alter table public.deleted_structure enable row level security;

-- Readable by anyone who can read the blueprint (the recovery list is part of
-- the editor); written only by the delete functions, which run as definer.
drop policy if exists "deleted_structure_select" on public.deleted_structure;
create policy "deleted_structure_select" on public.deleted_structure
  for select using (true);

grant select on public.deleted_structure to anon, authenticated;
revoke insert, update, delete, truncate on public.deleted_structure
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ordinary column writes the panel does directly (no function needed): the
-- blueprint's own text, and the resource links. Structural shape stays behind
-- the RPCs.
-- ---------------------------------------------------------------------------
grant update (content, description, links) on public.cells to authenticated;
grant update (name, layer_role) on public.layers to authenticated;
grant update (name) on public.steps to authenticated;
grant update (name, description, note, path_type) on public.paths to authenticated;
grant update (name, description, view_type) on public.service_scenarios to authenticated;

drop policy if exists "steps_update_auth" on public.steps;
create policy "steps_update_auth" on public.steps
  for update to authenticated using (true) with check (true);
drop policy if exists "paths_update_auth" on public.paths;
create policy "paths_update_auth" on public.paths
  for update to authenticated using (true) with check (true);
drop policy if exists "service_scenarios_update_auth" on public.service_scenarios;
create policy "service_scenarios_update_auth" on public.service_scenarios
  for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Storyboard uploads: people drop JPEGs and WebPs, and a mime rejection reads
-- like a bug rather than a rule.
-- ---------------------------------------------------------------------------
update storage.buckets
  set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
  where id = 'slice-illustrations';

-- The bucket's write policies name the *only* paths that may be written, and
-- the pattern from `20260729120000` accepts none of the paths the app builds.
-- Two disagreements, both fatal:
--
--   1. It hard-codes `\.png$`, so widening the mime types above would have
--      changed nothing — a JPEG would clear the bucket check and then be
--      refused by the policy.
--   2. It keys a frame's image by *position* (`frame-3.png`). Positions move:
--      splitting or reordering frames renumbers them, so every image would
--      silently repoint at a different frame. The app keys by `slice_items.id`
--      instead, which is stable across every edit that is not a delete.
--
-- The old names stay accepted so anything already uploaded keeps resolving.
do $$
begin
  drop policy if exists "slice_illustrations_insert" on storage.objects;
  drop policy if exists "slice_illustrations_update" on storage.objects;

  create policy "slice_illustrations_insert" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'slice-illustrations'
      and name ~ '^slices/[0-9a-f-]{36}/([0-9a-f-]{36}|frame-[0-9]+|character-ref)\.(png|jpg|webp)$'
    );
  create policy "slice_illustrations_update" on storage.objects
    for update to authenticated
    using (bucket_id = 'slice-illustrations')
    with check (
      bucket_id = 'slice-illustrations'
      and name ~ '^slices/[0-9a-f-]{36}/([0-9a-f-]{36}|frame-[0-9]+|character-ref)\.(png|jpg|webp)$'
    );
exception
  when insufficient_privilege then
    raise notice 'storage.objects policies skipped (not owner): bucket writes stay service-key only until these are added via the dashboard.';
end $$;
