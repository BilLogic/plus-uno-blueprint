-- 20260830160000 — a stakeholder's definition is a summary, not a note.
--
-- EIGHTEEN DEFINITIONS HAVE BEEN WRITTEN INTO A COLUMN NAMED FOR ASIDES.
--
-- `stakeholders.note` is populated on every one of its 18 rows, and not one of
-- those rows is an aside. Read four of them and the column names itself:
--
--   Student        "Who the tutoring is for."
--   Regular Tutor  "The tutor running a session. `Tutor` is the same person,
--                   authored in a second session."
--   CPO            "Act 153 clearances and their verification — what PLUS is
--                   not allowed to verify itself."
--   Dev            "The PLUS app — every servlet, job and integration behind a
--                   tech pill."
--
-- Each is the entity's own one-liner: what this party IS. Under the rule #172
-- fixes — `summary` is the entity's own one-liner, `note` is an author's aside
-- ABOUT it — every one of them is a summary and the column is misnamed.
--
-- WHAT BREAKS WITHOUT THE RENAME is not a query. It is the next eighteen rows.
-- A column called `note` invites an aside, so the next author writes one, and
-- the eighteen definitions become eighteen definitions and some marginalia in
-- one text column with no way to tell them apart. `paths.note` is the shape
-- this file is protecting: that one genuinely IS an aside, it keeps its name,
-- and the two words stop meaning the same thing.
--
-- THE OTHER HALF, WHICH IS NOT IN THIS FILE. Renaming a column nothing reads
-- leaves eighteen invisible rows with a better name. The reader ships in the
-- same change, in `LanePanel` and the owner badge — a stakeholder is
-- service-level and owns many lanes (`Regular Tutor` owns 37 of them), so the
-- definition stays here, once, and a lane displays its owner's rather than
-- carrying a copy that would then have 37 chances to disagree with this row.
--
-- ---------------------------------------------------------------------------
-- WHY THE RENAME SAYS `IF EXISTS`, AND WHY IT IS NOT IN A DO BLOCK.
-- ---------------------------------------------------------------------------
--
-- `20260820170000_stakeholders.sql` creates this table, seeds six rows and
-- asserts six. Against an EMPTY database it seeds zero — its source rows live
-- only in production — so the assertion raises and takes the `create table`
-- down with it. `docs/reference/migration-replay-baseline.json` records that
-- file as failing for exactly that reason, and records four later migrations
-- failing behind it with `relation "public.stakeholders" does not exist`.
--
-- A bare `alter table public.stakeholders rename column …` would be the fifth.
-- The baseline is a ratchet — the failing set may shrink and never grow — and
-- a new entry in it means a migration written against an apply path that does
-- not work. `alter table IF EXISTS` is the whole fix: on production the table
-- is there and the rename runs, and on an empty database Postgres raises a
-- notice and moves on.
--
-- AND IT STAYS AT THE TOP LEVEL rather than moving inside a `do $$ … $$`,
-- which would have handled the same case. `scripts/migration-replay.mjs`
-- models this series statically to answer "what does the repository claim the
-- schema is", and it treats every dollar-quoted body as OPAQUE TEXT. DDL
-- hidden in a DO block is therefore invisible to `check:identifiers` and to
-- every schema-shape guard built on that model — including the one written for
-- this rename, `scripts/tests/stakeholder-summary.test.mjs`, which reported
-- the column still named `note` for exactly as long as this statement was
-- wrapped in one.
--
-- The COMMENT below is the one thing that has to be wrapped, because `comment
-- on` has no `if exists` and would be the new baseline entry on its own. The
-- cost is that the static model does not see it; the alternative was not
-- writing it, and a column whose name carried no statement of what it holds is
-- how this whole defect started.
--
-- NO ROW COUNT IS ASSERTED, and that is deliberate rather than lax. `if count
-- <> 18 then raise` would pass on production and fail on every empty database
-- for the rest of time, which is the precise fault the paragraphs above exist
-- to avoid. The assertions below are vacuously true on an empty table and
-- meaningful on the populated one: the column is named `summary`, nothing is
-- still named `note`, the write grant followed the rename, and no row holds
-- whitespace where a definition should be.

alter table if exists public.stakeholders rename column note to summary;

do $comment$
begin
  if to_regclass('public.stakeholders') is null then
    return;
  end if;
  comment on column public.stakeholders.summary is
    'What this party IS, in one line — a definition, not an aside. The lane panel and the owner badge read it; a lane never copies it, because one stakeholder owns many lanes and 37 copies is 37 chances to disagree.';
end
$comment$;

-- ---------------------------------------------------------------------------
-- Post-conditions. Every one of them holds on an empty table.
-- ---------------------------------------------------------------------------
do $assert$
declare
  blank int;
  grants int;
begin
  if to_regclass('public.stakeholders') is null then
    raise notice 'public.stakeholders is absent — the assertions below have nothing to examine.';
    return;
  end if;

  -- 1. THE COLUMN IS NAMED FOR WHAT IT HOLDS.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stakeholders'
      and column_name = 'summary'
  ) then
    raise exception 'public.stakeholders has no summary column after the rename';
  end if;

  -- 2. AND THE OLD NAME IS GONE. Stated separately from the first: a schema
  -- carrying both would satisfy the check above while leaving every reader to
  -- guess which of the two a definition is in, which is worse than either.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stakeholders'
      and column_name = 'note'
  ) then
    raise exception 'public.stakeholders still has a note column beside its summary';
  end if;

  -- 3. THE WRITE GRANT FOLLOWED THE RENAME. Postgres tracks a column grant by
  -- attribute number, so a rename carries it — but `20260820170000` grants
  -- `update (name, kind, note, aliases)` by NAME, and this is the assertion
  -- that the carried grant is real rather than assumed. Without it the
  -- registry becomes read-only for `authenticated` and every stakeholder edit
  -- fails at the boundary rather than in a test.
  select count(*) into grants
  from information_schema.column_privileges
  where table_schema = 'public'
    and table_name = 'stakeholders'
    and column_name = 'summary'
    and grantee = 'authenticated'
    and privilege_type = 'UPDATE';
  if grants <> 1 then
    raise exception 'authenticated holds % UPDATE grants on stakeholders.summary, expected 1', grants;
  end if;

  -- 4. NO ROW HOLDS WHITESPACE WHERE A DEFINITION SHOULD BE. Zero rows pass
  -- this; eighteen populated rows pass it too. What it refuses is the state
  -- the app's own mutation layer already refuses — `input.summary?.trim() ||
  -- null` — so an empty string here would mean something reached the column
  -- around that boundary.
  select count(*) into blank
  from public.stakeholders
  where summary is not null and btrim(summary) = '';
  if blank <> 0 then
    raise exception '% stakeholders carry a blank summary; a definition is a sentence or it is null', blank;
  end if;
end
$assert$;
