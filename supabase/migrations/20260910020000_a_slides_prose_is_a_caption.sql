-- A slide's prose is a caption.
--
-- `slides.narrative` named the sentence a reader meets under the frames as
-- if it were a story the slide told. It is not a story. It is the words under
-- the frames, which is a caption, and the slide editor has been calling its
-- own field "Narrative" while every other surface in the app calls the same
-- shape a caption. The column moves and nothing else does: no drop, no add, no
-- behaviour change, no data touched.
--
-- ── THE SCHEMA IS WRITTEN TWICE, ON PURPOSE ───────────────────────────────
--
-- The template made this rename in its own upstream band and the code arrives
-- here through the version pin. The schema does not: this deployment is a
-- separate Postgres with its own series, and none of the template's band has
-- ever run against it. So the same sentence is said again here, against the
-- statements this database actually admits — which are not the template's, as
-- the grant paragraph below records.
--
-- ── THE WORD `caption` COMES BACK, MEANING SOMETHING ELSE ─────────────────
--
-- This table has held a column called `caption` before. `20260729120000`
-- created `slice_items` with `caption text` beside `narrative text`, and
-- `20260830270000` — the migration that made `slice_items` into `slides` —
-- renamed that `caption` to `title`, under the rule that a `name` is what a
-- reader navigates by and a `title` is authored content. That was right about
-- the column it moved: the field held a heading.
--
-- So the word is not being un-retired. It is being attached to the OTHER
-- column, the one whose content was never a heading and never a story. The
-- heading is `title`, the sentence under the frames is `caption`, and after
-- this file the table says both of those things in the words a reader would
-- use. `20260830270000`'s own assertion that no `slides.caption` survives is a
-- statement about the schema on the morning it ran, and it runs before this
-- file in every replay, so it keeps being true when it is asked.
--
-- What does NOT keep being true is the comment that migration left on
-- `slides.title`, which ends "; it was `caption`". That sentence was a piece
-- of history smuggled into a definition, and a reader who meets it beside a
-- live `slides.caption` learns something false. The clause comes off below.
-- Where a column came from belongs in a migration a schema archaeologist
-- reads, not in a comment an agent reads to decide what to write.
--
-- ── NO GRANT MOVES, AND THE TEMPLATE'S BELT-AND-BRACES IS OMITTED ─────────
--
-- Upstream this rename re-emits `grant update on public.slides to
-- authenticated`, because upstream `slides` is granted whole-table UPDATE and
-- naming the grant again after a rename costs nothing there.
--
-- **It would cost something here, and the statement is deliberately absent.**
-- `20260830290000` revoked table-level UPDATE from `authenticated` on every
-- base table in `public` and handed back one (table, column) pair per field a
-- panel actually writes. `slides` got none of them back, because nothing
-- updates a slide in place: `replaceSlides` deletes the slice's rows and
-- inserts the new ones, and `duplicateSlice` only inserts. That posture is
-- asserted by `scripts/check-rls-posture.mjs`, which carries `slides: []` and
-- says why. Copying the template's line would re-open a whole-table write
-- surface this deployment closed on purpose, so §3 below asserts the opposite:
-- that after the rename `authenticated` still holds no UPDATE on this table,
-- neither on the table nor on any column of it.
--
-- What `authenticated` does hold is whole-table SELECT, INSERT and DELETE
-- (`20260730090000`). A rename carries a privilege with the name, so those
-- travel, and §4 performs them rather than assuming them.
--
-- ── NOTHING ELSE DEPENDS ON THE COLUMN ────────────────────────────────────
--
-- Swept against the catalogue rather than assumed. No view selects it — there
-- is no view over `slides` at all. The four indexes are on `id`, `slice_id`,
-- `cell_ids` and `(slice_id, position)`. The seven policies are `using (true)`
-- or `is_service_account()`; none names a column. The trigger stamps
-- `updated_at`. And no function body in `public` names `narrative` — `rename
-- column` says nothing about a plpgsql body, which is why §2 sweeps `pg_proc`
-- as well as `information_schema`.
--
-- ── THE ASSERTIONS ARE INVARIANTS, NEVER CENSUSES ─────────────────────────
--
-- Every guard below is true of an empty database as well as of this one
-- (ADR 0009). A rename cannot strand a value — `alter table … rename column`
-- moves the data with the name — so there is no count of surviving prose to
-- take, and a guard naming today's slide count would make this file unable to
-- run anywhere else.
--
-- ── THE APPLY ORDER, BECAUSE main IS PRODUCTION ───────────────────────────
--
-- This file is applied BEFORE the branch that renames the reading code is
-- merged, and the two happen back to back. Between them the agent's slice read
-- (`slices?select=…,slides(…,narrative,…)`) answers 400 and a slide write
-- inserts a column that is not there. Nothing writes slides without a person
-- watching — no cron, no edge function, no webhook, and uno-bot reads `slices`
-- and never `slides` — so the window is one authoring session wide and closes
-- when the deploy lands.

-- ---------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------

alter table public.slides rename column narrative to caption;

-- What the column IS, and not where it came from: this text is rendered into
-- `docs/agents/blueprint.md`, which an agent reads to decide what to write.
-- The history — that the word was here before, on a different column — is the
-- argument at the top of this file.
comment on column public.slides.caption is
  'The sentence a reader meets under this slide''s frames. Authored '
  'content, not a story the slide tells.';

-- And the neighbour stops citing the name this file just handed to a
-- different column. The rule it states is unchanged; only the history goes.
comment on column public.slides.title is
  'The words at the top of the slide, as somebody wrote them. A title rather '
  'than a name because a slide is authored content a reader reads.';

-- ---------------------------------------------------------------------------
-- 2. Proof — the shape, as the owner sees it
-- ---------------------------------------------------------------------------

do $the_shape$
declare
  bodies int;
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'slides'
       and column_name = 'narrative'
  ) then
    raise exception 'slides still carries narrative';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'slides'
       and column_name = 'caption'
  ) then
    raise exception 'slides has no caption — the prose landed nowhere';
  end if;

  -- Two columns, and neither comment may name the other's word. A
  -- `slides.title` comment still ending "it was `caption`" is the exact
  -- ambiguity this file exists to remove.
  if col_description('public.slides'::regclass,
       (select attnum from pg_attribute
         where attrelid = 'public.slides'::regclass and attname = 'title')
     ) ~ 'caption' then
    raise exception 'the slides.title comment still names caption';
  end if;

  -- `rename column` renames the column and NOTHING inside a function body. A
  -- body that read the old name would raise 42703 the next time somebody
  -- called it; this is where it says so instead. The word is taken bare
  -- because it appears nowhere else in this schema's identifiers.
  select count(*) into bodies
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind in ('f', 'p')
     and p.prosrc ~ '\mnarrative\M';
  if bodies <> 0 then
    raise exception '% function(s) still name slides.narrative', bodies;
  end if;
end
$the_shape$;

-- ---------------------------------------------------------------------------
-- 3. Proof — the write surface did not widen
-- ---------------------------------------------------------------------------
--
-- A rename cannot grant anything, so this guard can only ever fail if someone
-- adds the template's `grant update` line to this file. That is exactly the
-- mistake worth catching: it is one plausible line, it would pass every other
-- check here, and `slides` having no UPDATE surface is the reason the undo
-- ledger can invert `replace_slides` by restoring rows rather than by patching
-- them.

do $the_write_surface$
declare
  widened text;
begin
  select string_agg(coalesce(column_name, '<table>'), ', ' order by column_name)
    into widened
    from (
      select null::text as column_name
        from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'slides'
         and grantee = 'authenticated' and privilege_type = 'UPDATE'
      union all
      select column_name
        from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'slides'
         and grantee = 'authenticated' and privilege_type = 'UPDATE'
    ) held;

  if widened is not null then
    raise exception
      'authenticated holds UPDATE on slides (%). 20260830290000 took that away '
      'and scripts/check-rls-posture.mjs records slides as having no update '
      'surface; a rename must not hand it back.', widened;
  end if;
end
$the_write_surface$;

-- ---------------------------------------------------------------------------
-- 4. Proof — the write path, performed as the app
-- ---------------------------------------------------------------------------
--
-- One claim, and it is the one an owner run cannot see: `authenticated` can
-- still write prose into the renamed column, through the INSERT privilege that
-- had to travel with the name and past the restrictive service-account
-- policies on this table. Those policies match ZERO ROWS SILENTLY under a
-- plain authenticated session, so the block holds a service claim in
-- `request.jwt.claims` — which is what `auth.jwt()` reads and therefore what
-- `is_service_account()` decides on. Without it every statement below would
-- pass by writing nowhere.
--
-- The DELETE is performed too, because `replaceSlides` is a delete followed by
-- an insert and a rename that stranded either half would strand the whole
-- authoring path.
--
-- The block rolls itself back through the sentinel exception, in the shape
-- `20260830180000` established: a migration may prove a thing, and may not
-- leave the rows it proved it with.

do $the_write_path$
declare
  svc uuid;
  slice uuid;
  row_id uuid;
  stored text;
  remaining int;
  done boolean := false;
  msg text;
begin
  begin
    insert into public.services (name, slug)
      values ('issue-602 fixture', 'issue-602-fixture') returning id into svc;
    insert into public.slices (service_id, kind, title)
      values (svc, 'custom', 'issue-602 fixture slice') returning id into slice;

    execute 'set local request.jwt.claims = ' ||
      quote_literal('{"role":"authenticated","app_metadata":{"role":"service"}}');
    execute 'set local role authenticated';

    -- 1. THE INSERT. Prose goes into the renamed column through the grant it
    -- inherited.
    insert into public.slides (slice_id, position, cell_ids, cell_keys, title, caption)
      values (slice, 0, '{}', '{}', 'issue-602 fixture slide',
              'The sentence a reader meets under the frames')
      returning id into row_id;
    if row_id is null then
      raise exception 'authenticated could not insert a slide — the insert grant did not survive the rename';
    end if;

    select s.caption into stored from public.slides s where s.id = row_id;
    if stored is null or stored not like '%under the frames%' then
      raise exception 'the caption did not come back: %', coalesce(stored, '<null>');
    end if;

    -- 2. THE DELETE, which is the first half of every slide edit this app
    -- performs.
    delete from public.slides where slice_id = slice;
    select count(*) into remaining from public.slides where slice_id = slice;
    if remaining <> 0 then
      raise exception '% slide(s) survived the delete', remaining;
    end if;

    execute 'reset role';
    done := true;
    raise exception using errcode = 'P0001', message = 'issue-602 fixture rollback';
  exception when others then
    execute 'reset role';
    get stacked diagnostics msg = message_text;
    if msg <> 'issue-602 fixture rollback' then raise; end if;
  end;

  if not done then
    raise exception 'the write-path cases never ran';
  end if;
  if exists (select 1 from public.services where slug = 'issue-602-fixture') then
    raise exception 'the issue-602 fixture survived the rollback';
  end if;
end
$the_write_path$;
