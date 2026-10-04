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
-- Every row of all nine tables, 1,852 in all, is exported first to
-- docs/archive/2026-10-04-archive-schema-backups.json, which stays tracked;
-- that export is what makes this drop safe. The 2026-08-08 orphan export
-- beside it covers only the rows that were absent from the live tables when
-- it was written, and some rows were missing from it: 36 cell_triggers whose
-- cells are still live but whose links are not, and the 8 path_steps of the
-- one exported path. The full export holds those too, so nothing here exists
-- only in the database when it goes.
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
