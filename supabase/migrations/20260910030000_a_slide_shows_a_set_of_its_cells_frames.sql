-- A slide shows an ordered set of images, and an untouched one shows its
-- cells' frames.
--
-- Until now a slide showed exactly one thing: the frames of every cell it
-- cites, computed at render time and unchooseable. An author who wanted the
-- second frame alone, or one drawn picture instead of three fragments, or a
-- title slide with no picture at all, had no way to ask. The board was the
-- only vote.
--
-- After this file a slide has a SET, and a flag saying whether the set has
-- been authored yet:
--
--   shows_all_images = true    every cited cell's frame, in the slide's cell
--                              order, tracking the board as it changes. The
--                              default, and what every slide in this database
--                              does the moment this file applies.
--   shows_all_images = false   exactly the rows in `slide_images`, in their
--                              own order — INCLUDING NONE, which is how an
--                              author says "show nothing".
--
-- Those two are why the flag exists at all. An empty set cannot distinguish
-- "nobody has touched this slide" from "somebody emptied it", and the two
-- render as opposites.
--
-- ── NOTHING IS BACKFILLED, AND THAT IS THE FEATURE ────────────────────────
--
-- The column arrives `not null default true`, so every slide already here is
-- untouched and goes on showing its cited cells' frames with no author action
-- and no rows written. A backfill that materialised today's frames into
-- `slide_images` would freeze each slide against the board it was cited from:
-- re-import a scenario, replace a frame, and the slide would go on showing
-- what it was told once. The untouched state is not an unfilled state — it is
-- a live rule, and it is the one nearly every slide wants.
--
-- ── THE SCHEMA IS WRITTEN TWICE, ON PURPOSE ───────────────────────────────
--
-- The template built this feature in its own upstream band and the reading
-- code arrives here through the version pin. The schema does not: this
-- deployment is a separate Postgres with its own series, and none of the
-- template's band has ever run against it. So the same sentence is said again
-- here, in the statements THIS database admits — which are not the template's,
-- as the grant section below records — and with none of the template's
-- `-- @core` / `-- @recipe` markers, which are directives for partitioning ITS
-- series into a portable core and mean nothing in this one.
--
-- The template needed four migrations for this and this file is one of two,
-- because two of those four are about a column this deployment never had.
-- `slice_items.illustration` held ONE image and, when set, REPLACED the strip;
-- `20260830270000` dropped it rather than ship a field that substituted for
-- the frames instead of joining them, and asserted it gone. Upstream had to
-- carry that column forward — first into a pool with a single choice, then
-- into this set. Here there is nothing to carry: the set is created in its
-- final shape, and the fourth file, which upstream spends on saying that an
-- upload JOINS the set rather than replacing it, is a sentence in the comment
-- on `image_url` below. There is no state where it meant anything else.
--
-- ── ONE MEMBER NAMES ONE SOURCE ───────────────────────────────────────────
--
-- A member is either a cited cell's frame or an uploaded image, never both and
-- never neither: `num_nonnulls(cell_id, image_url) = 1`. A cell's frame is
-- named by the CELL and not by the URL it currently resolves to, so replacing
-- the artwork on a cell changes what the slide shows without touching a row
-- here — which is the same reason the untouched default names cells rather
-- than pictures.
--
-- `cell_id` cascades. A deleted cell has no frame to contribute, and a member
-- pointing at it would render nothing while explaining nothing. The other
-- members keep their positions: `position` is an order, not an index, and
-- renumbering the survivors would move images the author did not touch.
--
-- ── THE ONE HARD REFERENCE INTO THE BOARD, AND WHAT IT COSTS ─────────────
--
-- Everything else that is ABOUT the board refers to cells SOFTLY — `slides`,
-- `evidence` and `audit_findings` all carry a bare uuid with no FK — because
-- a scenario re-import deletes and re-inserts cells, and a hard reference
-- would cascade that delete into content a person authored. `cell_keys` is
-- how a slide finds its cells again afterwards.
--
-- This column is a real foreign key, and the cost is exactly that: a
-- re-import takes an authored slide's CELL members with it, leaving its
-- uploads, its order and its `shows_all_images = false`. The slide then shows
-- fewer images than the author chose, or none, and no key path brings them
-- back.
--
-- It is still the right column, for the same reason the template chose it. A
-- soft reference here would keep rows naming cells that no longer exist —
-- members that render nothing, on a slide that has been told it is showing
-- exactly these, with no way for a reader or an author to see why the picture
-- is missing. The hard key at least makes the loss visible in the one place a
-- person is looking: the set is shorter than they left it. What would
-- genuinely fix it is a `cell_key` beside the id, recovered the way a slide's
-- own citations are — and that is a different change, worth making when
-- somebody has actually lost a set to a re-import rather than in advance of
-- it.
--
-- ── THE GRANTS ARE NOT THE TEMPLATE'S, AND THIS IS THE TRAP ───────────────
--
-- Upstream this feature emits `grant update on public.slides to authenticated`
-- — a WHOLE-TABLE update, which is what that deployment's `slides` already
-- carries, so the line costs it nothing.
--
-- **It would cost something here.** `20260830290000` revoked table-level
-- UPDATE from `authenticated` on every base table in `public` and handed back
-- one (table, column) pair per field a panel actually writes; `slides` got
-- none of them, because until today nothing updated a slide in place —
-- `replaceSlides` deletes the slice's rows and inserts the new ones, and
-- `duplicateSlice` only inserts. `20260910020000` asserted that absence one
-- file ago, and `scripts/check-rls-posture.mjs` carries `slides: []`.
--
-- Today one field is written in place, and exactly one: `shows_all_images`.
-- The image field flips it on the SAVED row, whose id every `slide_images`
-- member depends on, so delete-and-reinsert is not available — it would
-- cascade the set away and mint a new id. So this file hands back ONE COLUMN,
-- in the shape `20260830290000` established, and §5 asserts that the table
-- grant is still absent and that `shows_all_images` is the only column of
-- `slides` an authenticated caller may write. Pasting the template's line in
-- makes that guard raise, which is the point of writing it as a list rather
-- than as an absence.
--
-- `slide_images` itself takes no UPDATE surface at all. The set is REPLACED —
-- deleted and re-inserted whole — because position is identity here as it is
-- on `slides`, and reordering by updating positions trips the unique
-- constraint halfway through. INSERT and DELETE are therefore the verbs, and
-- an UPDATE grant nobody uses is a reparent surface (a member's `slide_id` is
-- where it SITS) for free.
--
-- ── THE APPLY ORDER, BECAUSE main IS PRODUCTION ───────────────────────────
--
-- Both files apply BEFORE the branch that reads them is merged, back to back
-- with the merge. Between the apply and the deploy, nothing is broken: every
-- existing slide is untouched, the reading code that predates this file never
-- names the new column, and `select *` on `slides` simply returns one more
-- field. The window this opens is the harmless direction of the one
-- `20260910020000` describes, and the two apply together.
--
-- ── THE ASSERTIONS ARE INVARIANTS, NEVER CENSUSES ─────────────────────────
--
-- Every guard below holds on an empty database as well as on this one
-- (ADR 0009). Nothing counts today's slides, and the write path is performed
-- against rows this file creates and rolls back rather than against anybody's.

-- ---------------------------------------------------------------------------
-- 1. The flag
-- ---------------------------------------------------------------------------

alter table public.slides
  add column shows_all_images boolean not null default true;

-- Rendered into `docs/agents/blueprint.md`, which an agent reads to decide
-- what to write. It says what the column IS, and what each of its two values
-- means, because "true" and "false" carry none of it.
comment on column public.slides.shows_all_images is
  'True until an author picks. True means show every cited cell''s frame and '
  'keep doing so as the board changes; false means show exactly the rows in '
  'slide_images, including none.';

-- Two neighbouring comments stop being true in the same moment, and both are
-- rendered into `docs/agents/blueprint.md`. Each said that the cited cells'
-- frames ARE what the slide shows and that the two cannot disagree — which was
-- the whole point while a slide had no say in it, and is now a description of
-- one of two states. An agent that read either would write a slide expecting
-- the board to decide.
comment on table public.slides is
  'One slide of a slice. It shows an ordered set of images — every cited '
  'cell''s frame while shows_all_images is true, and exactly the rows in '
  'slide_images once an author has picked — and carries the words written '
  'over them. Empty cell_ids = a title-only divider slide. The retired table '
  'name is not repeated here: a comment is a swept prose surface, and '
  'CONTEXT.md''s rename map is where the old name is recorded.';

comment on column public.slides.cell_ids is
  'SOFT refs to cells (no FK — must survive scenario re-import). Same order '
  'as cell_keys. Their frames are what an untouched slide shows, and the pool '
  'a picked one chooses from.';

-- ---------------------------------------------------------------------------
-- 2. The set
-- ---------------------------------------------------------------------------

create table public.slide_images (
  id        uuid primary key default gen_random_uuid(),
  slide_id  uuid not null references public.slides (id) on delete cascade,
  position  integer not null,
  cell_id   uuid references public.cells (id) on delete cascade,
  image_url text,
  constraint slide_images_one_source
    check (num_nonnulls(cell_id, image_url) = 1),
  constraint slide_images_position_unique unique (slide_id, position)
);

-- No `created_at`, no `updated_at`, and no author column. A member is never
-- edited and never separately authored: the set is written whole, by the same
-- gesture and the same person that the slide's own timestamps already record.
-- Columns that would only ever restate the parent's are a second thing to keep
-- true.
--
-- No index beyond the two the constraints already build. `slide_images_
-- position_unique` indexes `(slide_id, position)`, which serves every read the
-- app makes — the set of one slide, in order. `cell_id` is unindexed on
-- purpose: its only scan is the cascade from a deleted cell, over a table
-- holding a handful of rows per slide, and an index maintained on every
-- set replacement to speed up a re-import is the wrong trade.

comment on table public.slide_images is
  'The ordered set of images a slide shows once an author has picked. Empty '
  'with slides.shows_all_images false means show nothing; the untouched '
  'default stores no rows at all.';
comment on column public.slide_images.position is
  'The order a reader meets the images in. An order, not an index: dropping a '
  'member leaves the others where they were.';
comment on column public.slide_images.cell_id is
  'Show this cited cell''s frame, whatever that frame later becomes. Cascades '
  'away with the cell.';
comment on column public.slide_images.image_url is
  'Show this uploaded image. It JOINS the slide''s set; it never replaces the '
  'cited cells'' frames.';

-- ---------------------------------------------------------------------------
-- 3. Access
-- ---------------------------------------------------------------------------
--
-- The shape every table added since the service-account tier has: anybody may
-- read, and a write is admitted only for a session carrying the service claim.
-- Anon reads because the blueprint is anon-readable and a slide whose images
-- were invisible to a reader without a session would show its title alone.
--
-- The gate is stated in the permissive policy itself rather than as a
-- RESTRICTIVE companion. Both spellings are gates and `scripts/check-rls-
-- posture.mjs` accepts either; this is the one `resources` and
-- `unplaced_touchpoint_details` were created with, and one permissive policy
-- that says the whole rule is easier to read than two that say half each.

alter table public.slide_images enable row level security;

create policy slide_images_select_anon on public.slide_images
  for select to anon using (true);
create policy slide_images_select_auth on public.slide_images
  for select to authenticated using (true);
create policy slide_images_insert_service_only on public.slide_images
  for insert to authenticated
  with check (public.is_service_account());
create policy slide_images_delete_service_only on public.slide_images
  for delete to authenticated
  using (public.is_service_account());

grant select on public.slide_images to anon, authenticated;
grant insert, delete on public.slide_images to authenticated;

-- The two grants above are additions to a table that ALREADY ARRIVED WIDE.
-- The platform grants the API roles table-level privileges on every relation
-- created in `public` — that is the mechanism `20260830290000` swept up after
-- and the one `check:new-table-grants` collects the anon half of — so what
-- makes this table's surface narrow is the revoke, not the grant.
--
-- `anon` loses every write. Nothing anonymous writes anywhere in this schema.
revoke insert, update, delete, truncate on public.slide_images from anon;
-- `authenticated` loses UPDATE, because the set is replaced rather than
-- patched and a member's `slide_id` is where it SITS; and TRUNCATE, which is
-- the one write privilege that bypasses RLS outright, so on this table the
-- grant would be the only gate. Nine older tables still carry that TRUNCATE
-- and `scripts/check-rls-posture.mjs` names the debt as deliberately
-- unasserted; a table created today need not join them, and nothing this app
-- does would notice — PostgREST cannot issue the statement at all.
revoke update, truncate on public.slide_images from authenticated;

-- And the one column of `slides` a panel now writes in place. Not the
-- template's whole-table grant: see THE GRANTS ARE NOT THE TEMPLATE'S above,
-- and §5, which fails if that line is ever pasted in beside this one.
grant update (shows_all_images) on public.slides to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Proof — the shape, as the owner sees it
-- ---------------------------------------------------------------------------

do $the_shape$
declare
  missing text;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'slides'
       and column_name = 'shows_all_images'
       and is_nullable = 'NO' and column_default = 'true'
  ) then
    raise exception
      'slides.shows_all_images is missing, nullable, or does not default to '
      'true — an existing slide would stop showing its cited frames';
  end if;

  -- Both constraints by name, because each is a rule the reading code relies
  -- on rather than a formality. Without the first a member could name two
  -- sources or none; without the second two members could claim one position
  -- and the order a reader meets them in would be whatever the planner felt
  -- like.
  select string_agg(wanted, ', ' order by wanted) into missing
    from (values ('slide_images_one_source'), ('slide_images_position_unique')) as w(wanted)
   where not exists (
     select 1 from pg_constraint
      where conrelid = 'public.slide_images'::regclass and conname = w.wanted
   );
  if missing is not null then
    raise exception 'slide_images is missing constraint(s): %', missing;
  end if;

  -- The cascade is the whole of what a deleted cell does to a slide. A member
  -- left behind by `no action` would block the delete; one left by `set null`
  -- would violate the one-source check.
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.slide_images'::regclass
       and contype = 'f' and confdeltype = 'c'
       and conkey = array[
         (select attnum from pg_attribute
           where attrelid = 'public.slide_images'::regclass and attname = 'cell_id')
       ]::smallint[]
  ) then
    raise exception 'slide_images.cell_id does not cascade when its cell goes';
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'slide_images' and c.relrowsecurity
  ) then
    raise exception 'slide_images is running without row level security';
  end if;
end
$the_shape$;

-- ---------------------------------------------------------------------------
-- 5. Proof — the write surface widened by exactly one column
-- ---------------------------------------------------------------------------
--
-- The guard this file exists to carry. Three ways to get the grants wrong are
-- each one plausible line, each would pass every other check here, and each
-- re-opens a surface this deployment closed on purpose.

do $the_write_surface$
declare
  wide text;
  columns text;
  images text;
  loose text;
begin
  -- 1. The template's line. `grant update on public.slides to authenticated`
  -- covers every column there is, `slice_id` included, and a column list
  -- beside it is decoration — a column grant widens an empty privilege, it
  -- does not narrow a held one.
  select string_agg(table_name, ', ' order by table_name) into wide
    from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and privilege_type = 'UPDATE' and table_name in ('slides', 'slide_images');
  if wide is not null then
    raise exception
      'authenticated holds a TABLE-level UPDATE on: %. 20260830290000 took '
      'that away and this file hands back one column, not a table.', wide;
  end if;

  -- 2. The column list itself. `shows_all_images` and nothing else — a second
  -- entry here is a panel that grew without anybody saying so.
  select string_agg(column_name, ', ' order by column_name) into columns
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'slides'
     and grantee = 'authenticated' and privilege_type = 'UPDATE';
  if columns is distinct from 'shows_all_images' then
    raise exception
      'authenticated may UPDATE these columns of slides: %. Exactly one is '
      'intended, and it is shows_all_images.', coalesce(columns, '<none>');
  end if;

  -- 3. `slide_images` takes no UPDATE at all, on the table or on a column of
  -- it. The set is replaced, never patched.
  select string_agg(coalesce(column_name, '<table>'), ', ' order by column_name)
    into images
    from (
      select null::text as column_name
        from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'slide_images'
         and grantee = 'authenticated' and privilege_type = 'UPDATE'
      union all
      select column_name
        from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'slide_images'
         and grantee = 'authenticated' and privilege_type = 'UPDATE'
    ) held;
  if images is not null then
    raise exception
      'authenticated may UPDATE slide_images (%). The set is deleted and '
      're-inserted; an update surface here only reparents members.', images;
  end if;

  -- 4. And nothing anonymous writes anywhere near it.
  select string_agg(privilege_type, ', ' order by privilege_type) into loose
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'slide_images'
     and grantee = 'anon'
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  if loose is not null then
    raise exception 'anon still holds % on slide_images', loose;
  end if;
end
$the_write_surface$;

-- ---------------------------------------------------------------------------
-- 6. Proof — the write path, performed as the app
-- ---------------------------------------------------------------------------
--
-- An owner runs this file, and an owner meets no policy and needs no grant, so
-- everything above could be true of a database where the editor cannot write a
-- single image. This block is the editor's own session: `authenticated`, with
-- the service claim in `request.jwt.claims` — which is what `auth.jwt()` reads
-- and therefore what `is_service_account()` decides on. Without the claim the
-- restrictive gate matches ZERO ROWS SILENTLY, so every insert below would
-- "pass" by writing nowhere, which is exactly the failure the last case makes
-- explicit.
--
-- The scaffolding is built as the owner first. It is this block's own — a
-- service, one path's worth of structure, two cells, a slice and a slide — and
-- the whole block rolls itself back through the sentinel exception, in the
-- shape `20260830180000` established: a migration may prove a thing, and may
-- not leave the rows it proved it with.

do $the_write_path$
declare
  svc uuid;
  ph uuid;
  sc uuid;
  pa uuid;
  ln uuid;
  st uuid;
  c1 uuid;
  c2 uuid;
  slice uuid;
  sld uuid;
  written int;
  remaining int;
  refused boolean;
  done boolean := false;
  msg text;
begin
  begin
    insert into public.services (name, slug)
      values ('issue-603 fixture', 'issue-603-fixture') returning id into svc;
    insert into public.phases (service_id, name, position)
      values (svc, 'fixture phase', 0) returning id into ph;
    insert into public.scenarios (phase_id, name, position)
      values (ph, 'fixture scenario', 0) returning id into sc;
    insert into public.paths (scenario_id, name, kind)
      values (sc, 'happy path', 'happy') returning id into pa;
    insert into public.lanes (path_id, name, position)
      values (pa, 'fixture lane', 0) returning id into ln;
    insert into public.steps (scenario_id, name)
      values (sc, 'fixture step') returning id into st;
    insert into public.path_steps (path_id, step_id, position) values (pa, st, 0);
    insert into public.cells (path_id, lane_id, step_id, content, position)
      values (pa, ln, st, 'one', 0) returning id into c1;
    insert into public.cells (path_id, lane_id, step_id, content, position)
      values (pa, ln, st, 'two', 1) returning id into c2;
    insert into public.slices (service_id, kind, title)
      values (svc, 'custom', 'issue-603 fixture slice') returning id into slice;
    insert into public.slides (slice_id, position, cell_ids, cell_keys, title)
      values (slice, 0, array[c1, c2], array['k1', 'k2'], 'issue-603 fixture slide')
      returning id into sld;

    -- A slide arrives untouched, without anybody saying so.
    if not exists (select 1 from public.slides where id = sld and shows_all_images) then
      raise exception 'a new slide did not arrive showing its cited frames';
    end if;

    execute 'set local request.jwt.claims = ' ||
      quote_literal('{"role":"authenticated","app_metadata":{"role":"service"}}');
    execute 'set local role authenticated';

    -- 1. THE FLIP. The one column this file granted, written in place on the
    -- saved row — which is the write `slides` had no surface for an hour ago.
    update public.slides set shows_all_images = false where id = sld;
    get diagnostics written = row_count;
    if written <> 1 then
      raise exception
        'an author could not turn a slide''s images off (% row(s) written)', written;
    end if;

    -- 2. AND NOTHING ELSE. The grant is one column wide, so a neighbouring
    -- column is refused by the privilege system rather than by a policy.
    refused := false;
    begin
      update public.slides set title = 'reparented' where id = sld;
    exception when insufficient_privilege then refused := true;
    end;
    if not refused then
      raise exception 'authenticated updated slides.title — the grant is not one column wide';
    end if;

    -- 3. THE SET. A cited cell's frame and an uploaded image in one set, which
    -- is the whole of what "an upload joins the set" means.
    insert into public.slide_images (slide_id, position, cell_id, image_url)
      values (sld, 0, c1, null),
             (sld, 1, null, 'https://example.com/one.png');
    get diagnostics written = row_count;
    if written <> 2 then
      raise exception 'an author wrote % member(s) of an image set, expected 2', written;
    end if;

    -- 4. A member names ONE source.
    refused := false;
    begin
      insert into public.slide_images (slide_id, position, cell_id, image_url)
        values (sld, 2, c2, 'https://example.com/two.png');
    exception when check_violation then refused := true;
    end;
    if not refused then
      raise exception 'a member naming two sources was accepted';
    end if;

    refused := false;
    begin
      insert into public.slide_images (slide_id, position, cell_id, image_url)
        values (sld, 3, null, null);
    exception when check_violation then refused := true;
    end;
    if not refused then
      raise exception 'a member naming no source was accepted';
    end if;

    -- 5. Two members cannot claim one place in the order.
    refused := false;
    begin
      insert into public.slide_images (slide_id, position, cell_id)
        values (sld, 0, c2);
    exception when unique_violation then refused := true;
    end;
    if not refused then
      raise exception 'two members took the same position';
    end if;

    -- 6. THE DELETE, which is the first half of every set replacement.
    delete from public.slide_images where slide_id = sld;
    select count(*) into remaining from public.slide_images where slide_id = sld;
    if remaining <> 0 then
      raise exception '% member(s) survived the delete', remaining;
    end if;

    -- 7. THE GATE IS REAL, and it refuses in two different ways. The same
    -- two statements from a signed-in session with NO service claim: the
    -- insert is admitted by the grant and refused by the policy, which for an
    -- INSERT raises; the update is refused by matching no rows, which is
    -- silent. Both matter — a proof that only knew the loud one would pass on
    -- a database where every author's flip wrote nowhere.
    execute 'set local request.jwt.claims = ' ||
      quote_literal('{"role":"authenticated"}');

    refused := false;
    begin
      insert into public.slide_images (slide_id, position, cell_id)
        values (sld, 0, c1);
    exception when insufficient_privilege then refused := true;
    end;
    if not refused then
      raise exception
        'a session with no service claim wrote an image member';
    end if;

    update public.slides set shows_all_images = true where id = sld;
    get diagnostics written = row_count;
    if written <> 0 then
      raise exception
        'a session with no service claim flipped % slide(s)', written;
    end if;

    execute 'reset role';
    done := true;
    raise exception using errcode = 'P0001', message = 'issue-603 fixture rollback';
  exception when others then
    execute 'reset role';
    get stacked diagnostics msg = message_text;
    if msg <> 'issue-603 fixture rollback' then raise; end if;
  end;

  if not done then
    raise exception 'the write-path cases never ran';
  end if;
  if exists (select 1 from public.services where slug = 'issue-603-fixture') then
    raise exception 'the issue-603 fixture survived the rollback';
  end if;
end
$the_write_path$;
