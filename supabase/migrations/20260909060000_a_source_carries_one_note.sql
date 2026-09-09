-- A source carries one note.
--
-- The add-a-source form asked four questions and drew a rule between the third
-- and the fourth, arguing that what a source IS and what a source SAYS are
-- different questions. Measured on this database on 2026-09-09:
--
--     evidence rows                  66
--     carrying a `title`             66
--     carrying an `excerpt`           2
--     carrying a `ref`                0
--
-- Not one row used the locator. The titles say where the locators went
-- instead — "PR #1151", "Card 2266", "Metabase, 2026-08-08" — and zero rows
-- means UNUSED rather than unreachable: `create_evidence` could write `ref`
-- the whole time and never did, so the count is evidence about the field and
-- not about the surface that offers it.
--
-- And the quote field is not holding quotes. One of its two values is "Team
-- agreed every warm-up must state that help is available on demand", which is
-- a note about a meeting sitting in a field labelled "Quote from the source"
-- whose placeholder read "Their words, not a summary of them".
--
-- So a source keeps one general-purpose prose column. A quotation is one thing
-- an author might write in it, an observation is another, and a URL is a third
-- — a URL written inside the note renders as a link wherever the source is
-- displayed, which is the whole job `ref` was carrying for the rows that never
-- used it.
--
-- ── WHY THIS IS A RENAME AND THE TEMPLATE'S IS A FOLD ─────────────────────
--
-- Upstream, `evidence` carries `ref`, `excerpt` AND `note`, so its version of
-- this change copies every excerpt into the note beside it and drops two
-- columns. Here there are only two: `20260830190000` dropped `evidence.note`
-- as unused, having asserted first that it held nothing on every row. There is
-- nothing to fold into, so the prose column is RENAMED and the locator column
-- is dropped — the same end state, reached by the statement this deployment's
-- schema actually admits.
--
-- A rename is also the reason there is no guard over the prose. `alter table
-- … rename column` moves the values with the name; it cannot strand one, so an
-- assertion that the two excerpts survived would be asserting a property of
-- Postgres. What CAN be lost is the locator, and that is guarded below.
--
-- ── THE WORD `note` COMES BACK, DELIBERATELY ──────────────────────────────
--
-- `20260830190000` set one spelling per meaning — a `name` is navigated by, a
-- `title` is authored, a `summary` is the thing's own sentence, a `note` is an
-- aside — and dropped `evidence.note` in the same pass because it held nothing
-- on all of its rows. That drop was right on the morning it ran. What three
-- months of authoring then showed is that the field beside it, the one that
-- claimed to carry the source's own content, was not carrying it either: two
-- values in 66 rows, one of them a summary.
--
-- So the word returns attached to the field that turned out to hold that
-- content, and the doctrine survives with one honest exception: on `evidence`
-- the note IS the prose, because the column that claimed to be turned out
-- never to be. That is a fold, not a licence — `audit_findings.summary` is
-- still a summary, and the next column whose job is a thing's own sentence
-- still gets that word. `scripts/tests/one-spelling-each.test.mjs` owns the
-- invariant and is updated by the same change, from "evidence does not carry
-- `note`" to "`evidence.excerpt` became `evidence.note`, and `evidence.ref`
-- is gone".
--
-- ── THE ASSERTIONS ARE INVARIANTS, NEVER CENSUSES ─────────────────────────
--
-- "No reference is destroyed" is true of every database this file will ever
-- meet, including an empty one, which is the only kind of assertion that can
-- replay (ADR 0009). A guard naming 66, or 2, or 0 would be true of this
-- database on this morning and would make the file unable to run anywhere
-- else. On an empty replay there is no evidence at all, so the guard is
-- vacuous and the columns move regardless — which is exactly right.
--
-- ── NO GRANT MOVES, AND NOTHING DEPENDS ON EITHER COLUMN ──────────────────
--
-- `evidence` is granted whole-table (20260729120000, 20260730090000), never
-- column by column, so a rename carries every privilege with the name and the
-- drop removes nothing anybody was given. Measured on the catalogue rather
-- than assumed: `anon`, `authenticated`, `service_role` and `postgres` hold
-- the same privileges on `title` as on `ref` and `excerpt`.
--
-- `evidence_counts` is the one view over this table and it selects `cell_id`
-- alone, so `drop column` has nothing to refuse. The three indexes are on
-- `id`, `service_id` and `cell_id`. No function body in `public` names either
-- column — `drop column` says nothing about a function body, which is why the
-- proof below sweeps `pg_proc` as well as `information_schema`. And no
-- function's arity changes here, so no other body's call sites need reading.
--
-- The write path is proved the way every write path in this series is: under
-- `set local role authenticated` holding a service-account JWT, because an
-- owner run cannot see a grant that failed to travel and the restrictive
-- service-account policies on this table match ZERO ROWS SILENTLY under a
-- plain authenticated session.

-- ---------------------------------------------------------------------------
-- 1. No reference is destroyed
-- ---------------------------------------------------------------------------

do $no_reference_is_destroyed$
declare
  located bigint;
begin
  select count(*) into located
    from public.evidence
   where nullif(btrim(ref), '') is not null;
  if located <> 0 then
    raise exception '% evidence row(s) carry a reference. A locator is not prose and this migration will not invent a sentence around one — fold each into the row''s note, then run it again.', located;
  end if;
end
$no_reference_is_destroyed$;

-- ---------------------------------------------------------------------------
-- 2. The columns
-- ---------------------------------------------------------------------------

alter table public.evidence rename column excerpt to note;

alter table public.evidence drop column ref;

-- What the column IS, and not where it came from: this text is rendered into
-- `docs/agents/blueprint.md`, which an agent reads to decide what to write.
-- The history — why the word came back, and what `ref` was doing — is the
-- argument at the top of this file, where a schema archaeologist will look for
-- it and a model will not have to read it.
comment on column public.evidence.note is
  'The one thing worth keeping about this source, in the author''s own words: '
  'a quotation, an observation, or a link. A URL written here renders as a '
  'link wherever the source is displayed.';

comment on table public.evidence is
  'Provenance rows for cells and proposition questions. A cell with zero rows '
  'is an ASSUMPTION (derived, never stored). Restricted SELECT: a note may '
  'hold interview content.';

-- ---------------------------------------------------------------------------
-- 3. Proof — the shape, as the owner sees it
-- ---------------------------------------------------------------------------

do $the_shape$
declare
  bodies int;
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'evidence'
       and column_name in ('ref', 'excerpt')
  ) then
    raise exception 'evidence still carries ref or excerpt';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'evidence'
       and column_name = 'note'
  ) then
    raise exception 'evidence has no note — the prose landed nowhere';
  end if;

  -- `drop column` refuses when a view or an index depends on the column and
  -- says NOTHING about a function body, which is what makes this the sweep
  -- worth running rather than the one the DDL already did. A body added later
  -- that reads either column would raise 42703 when somebody called it; this
  -- is where it says so instead.
  --
  -- `excerpt` is taken bare, because the word appears nowhere else in this
  -- schema. `ref` cannot be — it is a fragment of half the identifiers in
  -- Postgres — so it is taken only inside a body that also names `evidence`,
  -- which is as narrow as a text sweep can honestly be.
  select count(*) into bodies
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind in ('f', 'p')
     and (p.prosrc ~ '\mexcerpt\M'
          or (p.prosrc ~ '\mevidence\M' and p.prosrc ~ '\mref\M'));
  if bodies <> 0 then
    raise exception '% function(s) still read evidence.ref or evidence.excerpt', bodies;
  end if;
end
$the_shape$;

-- ---------------------------------------------------------------------------
-- 4. Proof — the write path, performed as the app
-- ---------------------------------------------------------------------------
--
-- Two claims, neither of which can be read off the statements above:
--
--   1. `authenticated` can still INSERT a source and can still write prose
--      into the renamed column — the privilege that had to travel with the
--      name, and the one an owner run cannot see;
--   2. it can still UPDATE that prose, which is the panel's edit path and the
--      agent's `update_evidence`.
--
-- That `ref` is gone is left to `$the_shape$` above: the catalogue already
-- says so, and a second demonstration through a failing write would only be
-- the same fact wearing a savepoint.
--
-- The fixture attaches to a proposition question rather than to a cell, so it
-- needs one `services` row and nothing else: `evidence_exactly_one_target`
-- takes either target, and building a whole board would be building something
-- this file is not proving anything about. The block rolls itself back through
-- the sentinel exception, in the shape `20260830180000` established — a
-- migration may prove a thing, and may not leave the rows it proved it with.

do $the_write_path$
declare
  svc uuid;
  row_id uuid;
  stored text;
  done boolean := false;
  msg text;
begin
  begin
    insert into public.services (name, slug)
      values ('issue-553 fixture', 'issue-553-fixture') returning id into svc;

    -- An authenticated session holding the service claim, which is what the
    -- app is. `request.jwt.claims` is what `auth.jwt()` reads and therefore
    -- what `is_service_account()` decides on; without it the restrictive
    -- policies match nothing and every statement below would pass by writing
    -- nowhere.
    execute 'set local request.jwt.claims = ' ||
      quote_literal('{"role":"authenticated","app_metadata":{"role":"service"}}');
    execute 'set local role authenticated';

    -- 1. THE INSERT. Prose goes into the renamed column through the grant it
    -- inherited.
    insert into public.evidence (service_id, proposition_question_key, kind, title, note)
      values (svc, 'understand', 'meeting', 'issue-553 fixture source',
              'Team agreed every warm-up must state that help is available on demand. See https://example.invalid/notes')
      returning id into row_id;
    if row_id is null then
      raise exception 'authenticated could not insert a source — the insert grant did not survive the rename';
    end if;

    select e.note into stored from public.evidence e where e.id = row_id;
    if stored is null or stored not like '%help is available on demand%' then
      raise exception 'the note did not come back: %', coalesce(stored, '<null>');
    end if;

    -- 2. THE EDIT. The panel and `update_evidence` both write this column in
    -- place; a privilege that arrived for INSERT and not for UPDATE would show
    -- here and nowhere else.
    update public.evidence set note = 'a second sentence, written in place'
     where id = row_id;
    select e.note into stored from public.evidence e where e.id = row_id;
    if stored <> 'a second sentence, written in place' then
      raise exception 'the edit did not take: %', coalesce(stored, '<null>');
    end if;

    execute 'reset role';
    done := true;
    raise exception using errcode = 'P0001', message = 'issue-553 fixture rollback';
  exception when others then
    execute 'reset role';
    get stacked diagnostics msg = message_text;
    if msg <> 'issue-553 fixture rollback' then raise; end if;
  end;

  if not done then
    raise exception 'the write-path cases never ran';
  end if;
  if exists (select 1 from public.services where slug = 'issue-553-fixture') then
    raise exception 'the issue-553 fixture survived the rollback';
  end if;
end
$the_write_path$;
