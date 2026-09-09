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
-- ── WHY THERE IS NO COUNT ─────────────────────────────────────────────────
--
-- An earlier draft raised unless exactly eight rows moved. That is a census
-- wearing an invariant's clothes, and ADR 0009 refuses it: eight is a property
-- of what this table held on one morning, not of the statement below. It would
-- have made this file unable to replay against an empty database, where the
-- correct number to move is zero, and bought a permanent entry in
-- `migration-replay-baseline.json` for it.
--
-- The hazard the count was reaching for is real — a `where` clause that has
-- drifted past the rows it was written for matches nothing, reports success,
-- and leaves the sentences behind a field the app has stopped reading. But the
-- post-condition below already catches exactly that: a move that matched
-- nothing leaves every one of those rows carrying a name and no note, and the
-- assertion fires. It is true of every database, forever, and vacuous where
-- there is nothing to move.

do $move_names_into_notes$
declare
  stranded integer;
begin
  update public.cell_dependencies
     set note = btrim(name), updated_at = now()
   where nullif(btrim(coalesce(name, '')), '') is not null
     and nullif(btrim(coalesce(note, '')), '') is null;

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
