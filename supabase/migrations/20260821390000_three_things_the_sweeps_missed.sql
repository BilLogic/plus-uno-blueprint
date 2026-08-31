-- Three factual corrections the earlier sweeps could not reach. Each is a
-- statement the board makes that is not true; none is a matter of taste.
--
-- 1. Pencil, again.
--    20260821160000 retired Pencil by rewriting the literal pair 'Zoom/Pencil'
--    across content, summary, picture, steps, paths, scenarios and phases. It
--    never listed cells."function" — that column was filled by the Warm-Up
--    pilot pass, and its prose names Pencil on its own rather than as half of
--    the pill:
--      "Carry the session: Zoom hosts the room, Pencil carries the shared
--       math surface."
--    A pattern sweep finds the pattern it was given. Free prose about the same
--    retired tool reads as current fact to anyone opening that cell, and the
--    cell's own content says only "Zoom", so the sentence is not even grounded
--    in the row it describes — which house style forbids independently.
--
-- 2. A path whose status contradicts its own summary.
--    Standard Scheduling › "Created in the app" is status = 'built', while its
--    summary opens "Captures planned / unshipped behavior ... as of 2026-08-08"
--    and closes "design intent or dev-branch code, not observed production
--    behavior". Its five unshipped siblings — Supervisor-registered clearance,
--    Swap offered instead, Redesigned reflection, Soft-conflict gate, Lead
--    works from a dashboard — are all 'proposed'. This is the only outlier,
--    and it is the field a reader trusts to tell them what is real.
--
-- 3. 'lifecycle' survives in one sentence.
--    20260821340000 retired the word as a level of the model. Program
--    Administration's summary still says the phase "Runs continuously
--    alongside the session lifecycle", naming a level that no longer exists.

begin;

update public.cells
set "function" = 'Carry the session: Zoom hosts the video room the breakout runs in.'
where id = 'a0000000-0000-4000-8000-000000040106';

update public.paths
set status = 'proposed'
where id = 'f0000000-0000-4000-8000-000000000806';

update public.phases
set summary = replace(
  summary,
  'Runs continuously alongside the session lifecycle rather than at a single point in it.',
  'Runs continuously alongside every other phase rather than at a single point in the tutor''s journey.')
where id = 'f1000000-0000-4000-8000-000000000001';

do $do$
declare n int;
begin
  -- No retired tool named anywhere, in any text column, including the two the
  -- 2026-08-21 spec pass filled after the original sweep ran.
  --
  -- AMENDED 2026-08-31. `coalesce(value_props,'')` was here. `value_props` is
  -- `jsonb`, so `''` is resolved as a json literal and Postgres refuses it with
  -- `invalid input syntax for type json` before it looks at a single row. THIS
  -- STATEMENT HAS NEVER RUN ANYWHERE — the ledger holds
  -- `20260821235940 three_things_the_sweeps_missed`, so whatever was applied to
  -- production over MCP was not this text, which is #148's defect exactly.
  -- Nothing found it until today because `20260821240000`'s census rolled back
  -- `paths.status`, and this file failed three lines earlier on the missing
  -- column and never reached the json.
  --
  -- Precedent is #157, "The three migration files Postgres would have refused":
  -- a file that cannot parse or cannot coerce its own literals is repaired at
  -- source, because leaving it means the series can never be replayed and the
  -- error is not a fact about production. `::text` is what the search meant —
  -- the other four arms are text columns and this one is the JSON spelled out.
  select count(*) into n from public.cells
  where content ilike '%pencil%' or coalesce(summary,'') ilike '%pencil%'
     or coalesce("function",'') ilike '%pencil%' or coalesce(form,'') ilike '%pencil%'
     or coalesce(value_props::text,'') ilike '%pencil%';
  if n <> 0 then raise exception 'Pencil still named on % cells', n; end if;

  -- Every unshipped path says so in its status, not only in its prose.
  select count(*) into n from public.paths
  where status = 'live' and summary ilike '%unshipped%';
  if n <> 0 then raise exception '% paths read live but describe unshipped work', n; end if;

  -- AMENDED. This asserted the row EXISTS and is proposed, which is a census
  -- of one: on an empty database the count is 0, the exception fires, and the
  -- whole file rolls back — including the two sweeps above it, which is why
  -- this file could never replay. Same repair as `20260821340000`.
  --
  -- Turned around, it says what it meant: that path must not be left in any
  -- status but `proposed`. Vacuously true where the row is absent, and exactly
  -- as strong where it is present, since the only way to satisfy it is the
  -- update this file performs.
  select count(*) into n from public.paths
  where id = 'f0000000-0000-4000-8000-000000000806'
    and status is distinct from 'proposed';
  if n <> 0 then raise exception 'the Standard Scheduling roadmap path did not move to proposed'; end if;

  -- The retired level is not named as a level anywhere in the spec text.
  select count(*) into n from public.phases where summary ilike '%lifecycle%';
  if n <> 0 then raise exception 'lifecycle survives in % phase summaries', n; end if;
end
$do$;

commit;
