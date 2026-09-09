-- The eight names were always notes.
--
-- `cell_dependencies.name` is documented as "the word on the arrow, as a badge
-- (e.g. a channel name like Email)". Measured on this database on 2026-09-09:
--
--     rows                          434
--     carrying a `name`               8
--     carrying a `note`               0
--
-- Not one of the eight is a badge. Every one is a sentence about why the edge
-- is there:
--
--     All lessons complete → badge claimable
--     Insight points to a training lesson
--     Supervisor edits/reverts session → Reconfirm availability (shipping)
--     Credential issued → public assertion URL to share
--
-- Authors wrote notes into the name field because it was the only prose field
-- the editor offered. `note` — added by `20260908200000` — shipped with a
-- reader and no writer, so the field that was meant for those sentences has
-- never held one.
--
-- ── STAGE 1 OF TWO, AND THIS IS THE REVERSIBLE ONE ────────────────────────
--
-- Expand then contract. This migration copies, it does not drop: after it, the
-- eight sentences are in `note` where they belong AND still in `name` where
-- they were, and the app stops writing `name`. Nothing is lost and nothing is
-- forced.
--
-- Stage 2 — `alter table public.cell_dependencies drop column name`, plus
-- `blueprintContract.ts`, the `set_cell_dependency` signature, the agent tool
-- specs and `BlueprintCellConnection.linkName` — is a separate decision the
-- owner can decline, and it applies and merges back to back the way every drop
-- in this series does. It is deliberately NOT here: a drop hidden inside a
-- backfill is a decision made by whoever ran the backfill.
--
-- ── WHY A COUNT, WHEN A COUNT IS USUALLY A CENSUS ─────────────────────────
--
-- ADR 0009's rule is that a migration asserts INVARIANTS, never censuses —
-- a count of rows somebody else authored is a fact about a moment, and a
-- migration that asserts one fails forever afterwards for reasons that are
-- nobody's fault.
--
-- Eight is different, and the difference is that THIS STATEMENT is what makes
-- it true. The update below is the only thing that moves a name into a note;
-- the number it moves is a property of the update, not of the table it found.
-- The failure it guards is real and silent: a `where` clause that has drifted
-- past the rows it was written for matches nothing, reports success, and
-- leaves eight sentences behind a field the app has stopped reading.
--
-- The cost is honest and is recorded rather than argued away: this file
-- CANNOT replay against an empty database, where the correct number to move is
-- zero, so it joins `docs/reference/migration-replay-baseline.json` as an
-- `assertion` failure. That is the trade the count buys.
--
-- The second assertion is the one that survives a replay and every later
-- database: no row is left carrying a name with no note. It is the actual
-- post-condition, it is vacuously true where there is nothing to move, and it
-- is what a reader should look at first when this file goes red.

do $move_names_into_notes$
declare
  moved_count integer;
  stranded integer;
begin
  with moved as (
    update public.cell_dependencies
       set note = btrim(name), updated_at = now()
     where nullif(btrim(coalesce(name, '')), '') is not null
       and nullif(btrim(coalesce(note, '')), '') is null
    returning 1
  )
  select count(*) into moved_count from moved;

  if moved_count <> 8 then
    raise exception 'expected to move 8 names into note, moved %', moved_count;
  end if;

  select count(*) into stranded
    from public.cell_dependencies
   where nullif(btrim(coalesce(name, '')), '') is not null
     and nullif(btrim(coalesce(note, '')), '') is null;
  if stranded <> 0 then
    raise exception '% rows still carry a name and no note', stranded;
  end if;
end
$move_names_into_notes$;

-- The column keeps its data and loses its job. Said on the column itself,
-- because the next person to meet `name` meets it in `\d cell_dependencies`
-- and not in this file.
comment on column public.cell_dependencies.name is
  'RETIRED (#550), and kept only so stage 1 is reversible. Documented as the word ON the arrow, it was never used as one: all 8 rows that carried it carried a sentence about why the edge exists, and 20260909040000 copied every one of them into note. Nothing writes it any more — not set_cell_dependency''s argument, not the editor, not the agent tool. The dependency row still RENDERS it as a badge, because that row is held byte-identical to the template''s and the change to stop belongs upstream; stage 2 drops the column and that badge together, and is a separate decision.';

comment on column public.cell_dependencies.note is
  'Anything worth knowing about this dependency, in the author''s own words — rendered as the line under the dependency row, revealed on hover. General purpose, not "why this edge exists": the same kind of aside paths.note and scenarios.note carry, and since #550 the ONE prose field an edge has. Null means nothing was recorded, which is not the same as nothing worth recording.';
