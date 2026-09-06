-- A scenario says what runs beside it.
--
-- Three of this deployment's in-session scenarios can run at the same time as
-- each other, and the board says so in a sentence: "This scenario can run in
-- parallel with the Goal Setting and Help Request scenarios." The sentence
-- lives in `src/lib/scenarioParallelInfo.ts`, in a `Record<string, string>`
-- keyed on three hardcoded PLUS scenario UUIDs, and it is read twice — once
-- onto the blueprint fallbacks, once as a sidebar tooltip.
--
-- It is a per-scenario display value written in code, which is the other half
-- of what Decision D4 moves out (#326: "the tech/touchpoint vocabulary and the
-- per-scenario display flags move OUT of code into data"). A deployment whose
-- scenarios do not overlap gets three sentences about tutoring; a deployment
-- that adds a fourth overlapping scenario has to ship a TypeScript change to
-- say so.
--
-- ── The note is a scenario's, and today it is written onto its paths ────
--
-- `paths.note` already exists, and its own comment names this exact use:
-- "optional path note shown alongside path metadata (e.g. parallel scenario
-- context)". So the sentence has a home — the wrong one. Parallelism is a fact
-- about the SCENARIO, and the code copies the same string onto every path of
-- it: the Warm-Up happy path and the Warm-Up alternate path both carry the
-- identical sentence, and so does every Goal Setting path. Two rows that must
-- agree and nothing making them, which is the shape a single column fixes.
--
-- `paths.note` is untouched. A path keeps its own note for what is true of that
-- route and not of its siblings; this column is for what is true of all of
-- them. Which of the two a reader shows, and whether a path note that merely
-- repeats its scenario's is worth keeping, is S6's question.
--
-- ── Why `note` and not a flag ───────────────────────────────────────────
--
-- The obvious alternative was a structured one — `parallel_with uuid[]`, and
-- let the renderer compose the sentence. It is the better model and it is not
-- this ticket. Composing that sentence means owning its grammar in every
-- language a deployment authors in ("with the Goal Setting and Help Request
-- scenarios" is an English list with an English conjunction), and the board's
-- names are already free-form and any language (see `lanes.name`,
-- `20260830120000`). A note the author writes is a note the author can write
-- correctly. The column is prose because the value is prose.
--
-- Naming it `note` rather than inventing a word is the rule `20260830190000`
-- settled: `summary` is the thing's own description, `note` is the aside beside
-- it, and `phases`, `paths` and `cells` already spell it that way. A scenario's
-- `summary` is what the scenario IS; this is what a reader should know about it
-- besides.
--
-- ── The reader is deliberately not in this file ─────────────────────────
--
-- `scenarioParallelInfo.ts` is untouched and no sentence is copied into the
-- column. S2 is columns; S6 is the read side. Moving the values is a data
-- write against three named rows and belongs with the reader that would prove
-- it landed.
--
-- ── No new grant ────────────────────────────────────────────────────────
--
-- `scenarios` already grants SELECT to anon and to authenticated at the table
-- level, so a new column is readable the moment it exists. No UPDATE grant:
-- `authenticated` holds no table-level UPDATE anywhere, and a panel column is a
-- `PANEL_COLUMNS` line plus a migration of its own, written when the editing
-- surface arrives — the split `20260902210000` and `20260902220000` drew.
--
-- ── Replaying against an empty database ─────────────────────────────────
--
-- One additive column, nullable, no default beyond NULL, `if not exists` so a
-- re-run is a no-op. It replays clean against an empty database and does not
-- join `docs/reference/migration-replay-baseline.json`.
--
-- The proof is an INVARIANT, never a census (ADR 0009): the column exists and
-- is nullable. Asserting that any scenario CARRIES a note would be a census —
-- true of production on the day and false of every empty replay — and ADR 0009
-- is explicit that such an assertion rolls back its own file and everything
-- after it.

alter table public.scenarios
  add column if not exists note text;

comment on column public.scenarios.note is
  'An aside about the scenario, beside the summary that says what it is: most often what else may be running at the same time ("this scenario can run in parallel with Goal Setting and Help Request"). Blueprint data, not app configuration — it replaces a Record keyed on hardcoded scenario ids in src/lib/scenarioParallelInfo.ts (#326 S2, Decision D4). A scenario''s fact, held once, rather than the same sentence copied onto each of its paths through paths.note. Free prose in the author''s own language rather than a structured flag the renderer would have to compose a sentence from.';

do $proof$
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'scenarios'
       and column_name = 'note'
  ) then
    raise exception
      'proof: scenarios.note did not take';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'scenarios'
       and column_name = 'note'
       and is_nullable = 'NO'
  ) then
    raise exception
      'proof: scenarios.note must be nullable — most scenarios have nothing to say beside their summary';
  end if;
end
$proof$;
