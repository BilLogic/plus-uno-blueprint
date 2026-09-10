-- Un-citing a cell drops that cell from the slide's image set.
--
-- A `slide_images` member naming a cell is a choice about a cell THIS SLIDE
-- CITES. Take the cell out of `slides.cell_ids` and the member has nothing
-- left to show: the frame it names belongs to a cell this slide no longer
-- refers to, and drawing it would put a picture on the slide that nothing on
-- the slide accounts for.
--
-- So the member goes with the citation, and three things deliberately do not
-- go with it:
--
--   - THE OTHER MEMBERS' POSITIONS. `position` is an order, not an index.
--     Renumbering the survivors would move images the author never touched.
--   - `shows_all_images`. An authored set that empties out is still authored:
--     un-citing the last cell leaves a slide showing nothing, not a slide
--     back to showing everything. Flipping the flag here would silently
--     re-open the slide to every cell cited afterwards.
--   - THE UPLOADS. An `image_url` member is not about any cell, so nothing
--     about citations reaches it.
--
-- Citing the cell again does not bring the member back. The trigger deletes a
-- row; it keeps no memory of one, and a resurrection would be a third state
-- ("dropped, but still remembered") that nothing else in this schema has.
--
-- ── WHO ACTUALLY REACHES THIS, IN THIS DEPLOYMENT ─────────────────────────
--
-- Not the editor, and that is worth writing down rather than discovering.
-- `authenticated` holds no UPDATE on `slides.cell_ids` here — the only column
-- of that table it may write is `shows_all_images` (`20260910030000`), because
-- the app never edits a slide in place: `replaceSlides` deletes the slice's
-- rows and inserts the new ones. On that path the members are carried forward
-- in TypeScript, by `imageSetCarriedOntoReplacedSlide`, which applies exactly
-- the rule above to a set that is about to be re-inserted under the same slide
-- id. §2 performs that refusal so the claim cannot quietly stop being true.
--
-- What reaches this trigger is the SERVICE KEY: the slice skill, an import, an
-- MCP session — writers that hold a table-level UPDATE and bypass RLS, and
-- that have no TypeScript between them and the row. Before this file they
-- could leave a slide showing the frame of a cell it had stopped citing, and
-- nothing would have said so. That is a small audience and the exact one a
-- database-side rule is for: it is the writer the application code cannot
-- reach.
--
-- ── WHY A TRIGGER AND NOT A CONSTRAINT ────────────────────────────────────
--
-- The rule is "delete the row", and a constraint can only refuse. A foreign
-- key from `slide_images.cell_id` onto the citation would have to reference
-- `slides.cell_ids`, which is an ARRAY — no key to point at — and refusing
-- the citation edit instead would make removing a cell from a slide fail with
-- a message about images.
--
-- `after update of cell_ids` rather than `after update`: a slide is written
-- for many reasons and this is only about one column. The body opens with the
-- same test anyway, because `update of` fires on a statement that MENTIONS the
-- column, not on one that changes it.

-- ---------------------------------------------------------------------------
-- 1. The rule
-- ---------------------------------------------------------------------------

create function public.slide_images_drop_uncited_cells()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
begin
  if new.cell_ids is not distinct from old.cell_ids then
    return new;
  end if;
  delete from public.slide_images
   where slide_id = new.id
     and cell_id is not null
     and not (cell_id = any (coalesce(new.cell_ids, '{}'::uuid[])));
  return new;
end;
$function$;

comment on function public.slide_images_drop_uncited_cells() is
  'When a slide''s cell_ids change, drop the slide_images rows whose cell is '
  'no longer cited. Uploads and the remaining members'' positions are left '
  'exactly as they are, and shows_all_images is not touched.';

create trigger slides_drop_uncited_slide_images
  after update of cell_ids on public.slides
  for each row execute function public.slide_images_drop_uncited_cells();

-- Nobody CALLS this. It is a trigger function, it reads `new` and `old`, and
-- invoked by hand it raises rather than doing anything — which is an argument
-- for leaving the grant alone and not a good one. On this platform a function
-- created in `public` arrives executable by PUBLIC and by `anon`, and `revoke
-- … from public` does not take the `anon` grant away, so the two are named
-- separately. `check:identifiers` refuses an authoring-surface function that
-- writes rows as its caller and is reachable by either.
revoke execute on function public.slide_images_drop_uncited_cells() from public, anon;

-- ---------------------------------------------------------------------------
-- 2. Proof — performed, by the two roles that matter
-- ---------------------------------------------------------------------------
--
-- The cases are the rule's own sentences, run against rows this block creates
-- and rolls back through the sentinel exception (`20260830180000`).
--
-- The citation edits are made AS `service_role`, which is the only writer that
-- can make them, so this is the trigger meeting its actual caller rather than
-- an owner meeting a trigger. The editor's session is here too, for the one
-- case that is about the editor: that it cannot make this edit at all.

do $the_uncite$
declare
  svc uuid;
  ph uuid;
  sc uuid;
  pa uuid;
  ln uuid;
  st uuid;
  c1 uuid;
  c2 uuid;
  c3 uuid;
  slice uuid;
  sld uuid;
  remaining int;
  place int;
  refused boolean;
  done boolean := false;
  msg text;
begin
  begin
    insert into public.services (name, slug)
      values ('issue-603 uncite fixture', 'issue-603-uncite-fixture') returning id into svc;
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
    insert into public.cells (path_id, lane_id, step_id, content, position)
      values (pa, ln, st, 'three', 2) returning id into c3;
    insert into public.slices (service_id, kind, title)
      values (svc, 'custom', 'issue-603 uncite fixture slice') returning id into slice;
    insert into public.slides
      (slice_id, position, cell_ids, cell_keys, title, shows_all_images)
      values (slice, 0, array[c1, c2, c3], array['k1', 'k2', 'k3'],
              'issue-603 uncite fixture slide', false)
      returning id into sld;
    insert into public.slide_images (slide_id, position, cell_id, image_url)
      values (sld, 0, c1, null),
             (sld, 1, null, 'https://example.com/upload.png'),
             (sld, 2, c2, null),
             (sld, 3, c3, null);

    -- 0. THE EDITOR CANNOT MAKE THIS EDIT. The reason the app carries the set
    -- forward in TypeScript, asserted rather than asserted-in-a-comment.
    execute 'set local request.jwt.claims = ' ||
      quote_literal('{"role":"authenticated","app_metadata":{"role":"service"}}');
    execute 'set local role authenticated';
    refused := false;
    begin
      -- The same three ids the row already holds, so a database that DID
      -- grant the column would take this write rather than refusing it for
      -- some second reason (`slides_keys_match_ids` counts the two arrays).
      -- What is being asked is whether the privilege is there, and nothing
      -- else.
      update public.slides set cell_ids = array[c1, c2, c3] where id = sld;
    exception when insufficient_privilege then refused := true;
    end;
    execute 'reset role';
    if not refused then
      raise exception
        'authenticated updated slides.cell_ids — this deployment''s slide '
        'writes are delete-and-insert, and the carry-forward in '
        'imageSetCarriedOntoReplacedSlide assumes it';
    end if;

    -- Everything below is the service key, which is who this trigger is for.
    execute 'set local role service_role';

    -- 1. Un-cite the middle cell. Its member goes; the upload and the other
    -- cell member stay, at the positions they already had.
    update public.slides
       set cell_ids = array[c1, c3], cell_keys = array['k1', 'k3']
     where id = sld;

    select count(*) into remaining from public.slide_images where slide_id = sld;
    if remaining <> 3 then
      raise exception 'un-citing one cell left % members, expected 3', remaining;
    end if;
    if exists (select 1 from public.slide_images where slide_id = sld and cell_id = c2) then
      raise exception 'the un-cited cell''s member is still there';
    end if;
    select position into place from public.slide_images
     where slide_id = sld and cell_id = c3;
    if place <> 3 then
      raise exception 'a surviving member was renumbered to %, expected 3', place;
    end if;
    select position into place from public.slide_images
     where slide_id = sld and image_url = 'https://example.com/upload.png';
    if place <> 1 then
      raise exception 'the upload was renumbered to %, expected 1', place;
    end if;

    -- 2. Citing it again does not bring the member back.
    update public.slides
       set cell_ids = array[c1, c2, c3], cell_keys = array['k1', 'k2', 'k3']
     where id = sld;
    if exists (select 1 from public.slide_images where slide_id = sld and cell_id = c2) then
      raise exception 're-citing a cell resurrected its member';
    end if;

    -- 3. An update that does not touch the citations touches nothing.
    update public.slides set title = 'renamed' where id = sld;
    select count(*) into remaining from public.slide_images where slide_id = sld;
    if remaining <> 3 then
      raise exception
        'an unrelated slide edit changed the image set (% members left)', remaining;
    end if;

    -- 4. Un-cite everything. Every cell member goes, the upload stays, and the
    -- slide is still an AUTHORED empty set rather than an untouched one.
    update public.slides
       set cell_ids = '{}'::uuid[], cell_keys = '{}'::text[]
     where id = sld;
    select count(*) into remaining from public.slide_images
     where slide_id = sld and cell_id is not null;
    if remaining <> 0 then
      raise exception 'un-citing every cell left % cell member(s)', remaining;
    end if;
    select count(*) into remaining from public.slide_images where slide_id = sld;
    if remaining <> 1 then
      raise exception 'the upload was dropped with the cells';
    end if;
    if exists (select 1 from public.slides where id = sld and shows_all_images) then
      raise exception 'emptying the set flipped the slide back to untouched';
    end if;

    execute 'reset role';
    done := true;
    raise exception using errcode = 'P0001', message = 'issue-603 uncite rollback';
  exception when others then
    execute 'reset role';
    get stacked diagnostics msg = message_text;
    if msg <> 'issue-603 uncite rollback' then raise; end if;
  end;

  if not done then
    raise exception 'the un-cite cases never ran';
  end if;
  if exists (select 1 from public.services where slug = 'issue-603-uncite-fixture') then
    raise exception 'the issue-603 un-cite fixture survived the rollback';
  end if;
end
$the_uncite$;
