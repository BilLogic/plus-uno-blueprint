-- Nine backup_* tables were sitting in the PUBLIC schema, which means
-- PostgREST exposed them, every table listing showed them, and ~1,850 rows
-- of a 2026-08-08 snapshot read as live schema.
--
-- They are not redundant copies: 33 cells, 33 cell_triggers, 9 layers, 1 step
-- and 1 path exist only there. Checked before touching them — those rows did
-- NOT go through the app's delete path (deleted_structure records deletes on
-- 08-07 and 08-17, nothing around 08-08), so they disappeared through the
-- importer's scenario-scoped delete-and-reinsert. That is a re-authoring, not
-- data loss. The 77 orphan rows are also exported to
-- docs/archive/2026-08-08-backup-orphan-rows.json.
--
-- MOVED, not dropped. The public schema gets clean and PostgREST stops
-- serving them, while the data stays queryable and a hard drop stays one
-- command away. `archive` is not in PostgREST's exposed schemas, so nothing
-- reaches it over the API.

create schema if not exists archive;
revoke all on schema archive from anon, authenticated;

alter table if exists public.backup_20260808_cells          set schema archive;
alter table if exists public.backup_20260808_cell_triggers  set schema archive;
alter table if exists public.backup_20260808_layers         set schema archive;
alter table if exists public.backup_20260808_path_steps     set schema archive;
alter table if exists public.backup_20260808_steps          set schema archive;
alter table if exists public.backup_20260808_paths          set schema archive;
alter table if exists public.backup_20260817_orphan_chunks  set schema archive;
alter table if exists public.backup_20260817_cells_relabel  set schema archive;
alter table if exists public.backup_20260817_paths_relabel  set schema archive;

comment on schema archive is 'Retired snapshots. Not exposed to PostgREST, no anon/authenticated grants. Safe to drop once someone confirms the 2026-08-08 orphans (see docs/archive/2026-08-08-backup-orphan-rows.json) are genuinely superseded.';
