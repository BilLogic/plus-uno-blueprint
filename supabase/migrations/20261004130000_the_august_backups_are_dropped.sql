-- The August backups are dropped.
--
-- Authored 2026-10-04.
--
-- `20260820040000` moved nine backup_* tables, a 2026-08-08 snapshot and two
-- 2026-08-17 relabel and orphan-chunk copies, out of `public` into `archive`,
-- and kept them rather than dropping them so the data stayed queryable while
-- anyone still needed it. Nothing has read them since: no migration, script
-- or check names an `archive` table, and the schema is not exposed over the
-- API.
--
-- The rows that existed only there, 33 cells, 33 cell_triggers, 9 layers,
-- 1 step and 1 path, are kept in docs/archive/2026-08-08-backup-orphan-rows.json,
-- which stays tracked; that export is what makes this drop safe. Everything
-- else in these tables was a copy of rows the live tables still hold or that
-- were re-authored on purpose.
--
-- The empty `archive` schema goes with them. `drop schema` without cascade
-- refuses a schema that still holds anything, so a table added there since
-- stops this file rather than vanishing with it.

drop table if exists archive.backup_20260808_cells;
drop table if exists archive.backup_20260808_cell_triggers;
drop table if exists archive.backup_20260808_layers;
drop table if exists archive.backup_20260808_path_steps;
drop table if exists archive.backup_20260808_steps;
drop table if exists archive.backup_20260808_paths;
drop table if exists archive.backup_20260817_orphan_chunks;
drop table if exists archive.backup_20260817_cells_relabel;
drop table if exists archive.backup_20260817_paths_relabel;

drop schema if exists archive;

do $proof$
begin
  if exists (select 1 from pg_namespace where nspname = 'archive') then
    raise exception 'proof: the archive schema is still there';
  end if;
end
$proof$;
