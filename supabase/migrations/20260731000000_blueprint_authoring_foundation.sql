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
