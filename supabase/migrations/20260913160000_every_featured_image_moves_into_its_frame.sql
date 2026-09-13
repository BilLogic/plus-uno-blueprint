-- Every cell's featured image moves into its frame.
--
-- Authored 2026-09-13.
--
-- `20260913150000` made a cell's featured image its frame: the panel draws
-- `cells.frame` and nothing else. An attachment flagged `featured` no longer
-- leads the panel, and a touchpoint's logo is inherited from the registry
-- rather than copied onto the cell. This file puts the data this deployment
-- already holds into that shape, so that no cell loses the picture it leads
-- with on the day the release is taken.
--
-- It is a data migration and runs as the owner. `authenticated` holds no
-- UPDATE on `cells.frame` or `touchpoints.icon_url`, and nothing here is meant
-- to be reachable by an author.
--
-- ── THE STOCK LOGOS ARE BUCKET OBJECTS ───────────────────────────────────
--
-- `cells_frame_absolute` refuses a frame that starts with `/`, and it stays.
-- So a logo a cell leads with has to be an address, and the six touchpoints
-- that carry one still name `/touchpoint-logos/…`. Each of those files is
-- already in the `cell-attachments` bucket, byte for byte: an upload a person
-- made of it onto some cell. The object each touchpoint now points at is named
-- below with the MD5 of the stock file, and `storage.objects` is asked for its
-- eTag before anything is written. A missing object or a different eTag stops
-- the file.
--
-- ── WHAT MOVES, IN THIS ORDER ────────────────────────────────────────────
--
--   a. Each of the six touchpoints' `icon_url` becomes its bucket object's
--      public address.
--   b. A cell with a featured attachment and no frame: the frame becomes its
--      first featured attachment by position.
--   c. A cell whose frame is a copy of the logo of a touchpoint it is placed
--      on — the same eTag as that logo's object — gets that touchpoint's
--      `icon_url` as its frame. Most already hold exactly that address; the
--      ones that change are the copies step b has just put in frames.
--   d. A cell placed on a touchpoint with a logo and still without a frame:
--      the frame becomes that logo, from its first such placement by
--      position.
--   e. `featured` is cleared on every attachment. Its meaning now lives in
--      the frame. Links keep `featured`, which is the panel's buttons.
--   f. A slide that shows every cited cell's frame must not change what it
--      shows. What each slide resolves to is recorded before step a; a slide
--      whose pictures changed is made explicit (`shows_all_images = false`)
--      with `slide_images` rows naming the cells it showed, in the order it
--      showed them.
--
-- A cell with a featured attachment and a different frame is not written:
-- the frame is its featured image.
--
-- ── WHAT "RESOLVES TO" MEANS HERE ────────────────────────────────────────
--
-- The template's `imagesThisSlideShows`, mirrored:
--
--   - an untouched slide shows each cited cell's frame, in citation order,
--     skipping a cell whose frame is empty or is the storyboard placeholder
--     (`/step-visual-placeholder.svg`);
--   - an explicit slide shows its rows by position: a cell row shows that
--     cell's frame under the same rule, and an upload row shows its address
--     when it is `https://…` or a path on this site.
--
-- Two addresses of the same bucket file are the same picture, so an image is
-- compared by the eTag of the object it names, and by its address only when
-- it names no object in the bucket.
--
-- ── GUARDS ───────────────────────────────────────────────────────────────
--
-- The counts below were measured on production on 2026-09-13 and are the
-- premise of every step. If any has moved, this raises before writing
-- anything; a second apply fails on the touchpoints, which no longer name
-- `/touchpoint-logos/…`, rather than moving data twice.
--
-- A database that holds no cells at all is an empty replay of the series
-- (ADR 0009): there is nothing to move, so the file says so and returns
-- rather than failing the replay on a census.

do $featured_image_moves$
declare
  bucket_base constant text :=
    'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/';

  logo_copies_expected constant int := 76;
  featured_no_frame_expected constant int := 54;
  logo_no_frame_expected constant int := 45;
  featured_cells_expected constant int := 99;
  featured_other_frame_expected constant int := 40;
  featured_same_frame_expected constant int := 5;
  featured_many_expected constant int := 7;
  slides_expected constant int := 55;

  measured int;
  step_a int;
  step_b int;
  step_c_matched int;
  step_c int;
  step_d int;
  step_e int;
  frozen int;
  mismatched int;
begin
  if not exists (select 1 from public.cells) then
    raise notice 'featured images: this database holds no cells, so there is nothing to move';
    return;
  end if;

  -- -------------------------------------------------------------------------
  -- The six logos, verified against the bucket
  -- -------------------------------------------------------------------------

  create temp table stock_logo (
    touchpoint text primary key,
    stock_path text not null,
    object_name text not null,
    md5 text not null
  ) on commit drop;

  insert into stock_logo (touchpoint, stock_path, object_name, md5) values
    ('Zoom',    '/touchpoint-logos/zoom-logo.png',
     'cells/a0000000-0000-4000-8000-000000040106/36ccc1f1-b3bb-3314-2647-5e481ccd1845.png',
     'f3efbc5aa0d25893f0ace5e41daa64a3'),
    ('Email',   '/touchpoint-logos/email-logo.png',
     'cells/a0000000-0000-4000-8000-000000090206/b69f74c2-1a83-e916-497a-a2aed9f14eb4.png',
     '50abd3059d2ecd747b468837518f83fc'),
    ('Notion',  '/touchpoint-logos/notion-logo.png',
     'cells/a0000000-0000-4000-8000-000000090308/19e60568-ae56-7fb2-6711-afba55dc45ea.png',
     '67977fa18e469dea041bc0fd6afd764b'),
    ('Slack',   '/touchpoint-logos/slack-logo.png',
     'cells/a0000000-0000-4000-8000-000000100706/21a81bb9-8af4-9dc8-5879-b4fa64946bd7.png',
     '9f60dd01f123b5b5df8b3df430f1f325'),
    ('Workday', '/touchpoint-logos/workday-logo.png',
     'cells/a0000000-0000-4000-8000-000000100406/f0133eb7-e0c4-7e7d-bedf-a3ac37b455be.png',
     'ba239e13398a1801dc4de0a9fe31881d'),
    ('Figma',   '/touchpoint-logos/figma-logo.png',
     'cells/a0000000-0000-4000-8000-000000070208/8b26b46a-6ba3-963f-fd8d-f413a1bb1e83.png',
     '9a72cebf3a3e0ed3eb9858f533bedf13');

  select count(*) into measured
    from stock_logo s
   where (select count(*) from storage.objects o
           where o.bucket_id = 'cell-attachments'
             and o.name = s.object_name
             and btrim(o.metadata ->> 'eTag', '"') = s.md5) = 1;
  if measured <> 6 then
    raise exception 'featured images: % of the 6 stock logos are in the bucket with their eTag',
      measured;
  end if;

  if (select count(*) from public.touchpoints where nullif(btrim(icon_url), '') is not null) <> 6
     or exists (
       select 1 from stock_logo s
        where not exists (
          select 1 from public.touchpoints tp
           where tp.name = s.touchpoint and btrim(tp.icon_url) = s.stock_path
        )
     ) then
    raise exception 'featured images: the touchpoints with a logo are no longer the six naming /touchpoint-logos/';
  end if;

  -- -------------------------------------------------------------------------
  -- A picture, and what a slide shows
  -- -------------------------------------------------------------------------

  -- The eTag of the bucket object an address names, or the address itself.
  create function pg_temp.picture(address text)
  returns text
  language sql
  stable
  as $picture$
    select coalesce(
      (select 'etag:' || btrim(o.metadata ->> 'eTag', '"')
         from storage.objects o
        where o.bucket_id = 'cell-attachments'
          and address like 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/%'
          and o.name = substr(address, length('https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/') + 1)
        limit 1),
      address
    )
  $picture$;

  create function pg_temp.slide_images_shown()
  returns table (slide_id uuid, ord bigint, cell_id uuid, src text)
  language sql
  stable
  as $shown$
    with real_frame as (
      select c.id,
             btrim(c.frame, E' \t\n\r\f\v') as src
        from public.cells c
       where nullif(btrim(c.frame, E' \t\n\r\f\v'), '') is not null
         and btrim(c.frame, E' \t\n\r\f\v') <> '/step-visual-placeholder.svg'
    ),
    shown as (
      select s.id as slide_id, u.ord::numeric as sort_key, u.cell_id, f.src
        from public.slides s
        cross join lateral unnest(s.cell_ids) with ordinality as u(cell_id, ord)
        join real_frame f on f.id = u.cell_id
       where s.shows_all_images
      union all
      select s.id, m.position::numeric, m.cell_id, f.src
        from public.slides s
        join public.slide_images m on m.slide_id = s.id
        join real_frame f on f.id = m.cell_id
       where not s.shows_all_images
      union all
      select s.id, m.position::numeric, null::uuid, btrim(m.image_url, E' \t\n\r\f\v')
        from public.slides s
        join public.slide_images m on m.slide_id = s.id
       where not s.shows_all_images
         and m.cell_id is null
         and btrim(m.image_url, E' \t\n\r\f\v') ~ '^(https://|/($|[^/\\]))'
    )
    select slide_id,
           row_number() over (partition by slide_id order by sort_key),
           cell_id,
           src
      from shown
  $shown$;

  create temp table shown_before on commit drop as
  select b.slide_id, b.ord, b.cell_id, b.src, pg_temp.picture(b.src) as picture
    from pg_temp.slide_images_shown() b;

  -- -------------------------------------------------------------------------
  -- Guards: the measured premise still holds
  -- -------------------------------------------------------------------------

  create temp table featured_attachment on commit drop as
  select r.cell_id,
         count(*)::int as how_many,
         (array_agg(btrim(r.url) order by r.position, r.id))[1] as first_url
    from public.resources r
   where r.kind = 'attachment'
     and r.featured
   group by r.cell_id;

  -- Every placement of a cell on one of the six, with that logo's eTag.
  create temp table logo_placement on commit drop as
  select ct.cell_id, ct.position, ct.id as placement_id, tp.name as touchpoint,
         tp.id as touchpoint_id, 'etag:' || s.md5 as picture
    from public.cell_touchpoints ct
    join public.touchpoints tp on tp.id = ct.touchpoint_id
    join stock_logo s on s.touchpoint = tp.name;

  select count(distinct c.id) into measured
    from public.cells c
    join logo_placement l on l.cell_id = c.id
   where nullif(btrim(c.frame), '') is not null
     and pg_temp.picture(btrim(c.frame)) = l.picture;
  if measured <> logo_copies_expected then
    raise exception 'featured images: % cells frame a copy of their touchpoint''s logo, not %',
      measured, logo_copies_expected;
  end if;

  select count(*) into measured from featured_attachment;
  if measured <> featured_cells_expected then
    raise exception 'featured images: % cells have a featured attachment, not %',
      measured, featured_cells_expected;
  end if;

  select count(*) into measured
    from featured_attachment f
    join public.cells c on c.id = f.cell_id
   where nullif(btrim(c.frame), '') is null;
  if measured <> featured_no_frame_expected then
    raise exception 'featured images: % cells have a featured attachment and no frame, not %',
      measured, featured_no_frame_expected;
  end if;

  select count(*) into measured
    from featured_attachment f
    join public.cells c on c.id = f.cell_id
   where nullif(btrim(c.frame), '') is not null
     and btrim(c.frame) <> f.first_url;
  if measured <> featured_other_frame_expected then
    raise exception 'featured images: % cells have a featured attachment and a different frame, not %',
      measured, featured_other_frame_expected;
  end if;

  select count(*) into measured
    from featured_attachment f
    join public.cells c on c.id = f.cell_id
   where btrim(c.frame) = f.first_url;
  if measured <> featured_same_frame_expected then
    raise exception 'featured images: % cells have a frame equal to their featured attachment, not %',
      measured, featured_same_frame_expected;
  end if;

  select count(*) into measured from featured_attachment where how_many > 1;
  if measured <> featured_many_expected then
    raise exception 'featured images: % cells have more than one featured attachment, not %',
      measured, featured_many_expected;
  end if;

  select count(distinct c.id) into measured
    from logo_placement l
    join public.cells c on c.id = l.cell_id
   where nullif(btrim(c.frame), '') is null;
  if measured <> logo_no_frame_expected then
    raise exception 'featured images: % cells on a touchpoint with a logo have no frame, not %',
      measured, logo_no_frame_expected;
  end if;

  if (select count(*) from public.slides) <> slides_expected
     or exists (select 1 from public.slides where not shows_all_images) then
    raise exception 'featured images: there are no longer % slides, all untouched', slides_expected;
  end if;

  if exists (
    select 1
      from public.slides s
      cross join lateral unnest(s.cell_ids) as u(cell_id)
      join logo_placement l on l.cell_id = u.cell_id
      join public.cells c on c.id = u.cell_id
     where nullif(btrim(c.frame), '') is null
  ) then
    raise exception 'featured images: a slide cites a cell on a touchpoint with a logo and no frame';
  end if;

  -- -------------------------------------------------------------------------
  -- a. The six touchpoints point at their bucket objects
  -- -------------------------------------------------------------------------

  update public.touchpoints tp
     set icon_url = bucket_base || s.object_name
    from stock_logo s
   where tp.name = s.touchpoint
     and btrim(tp.icon_url) = s.stock_path;
  get diagnostics step_a = row_count;
  if step_a <> 6 then
    raise exception 'featured images: step a pointed % touchpoints at the bucket, not 6', step_a;
  end if;

  -- -------------------------------------------------------------------------
  -- b. Featured attachment, no frame
  -- -------------------------------------------------------------------------

  update public.cells c
     set frame = f.first_url
    from featured_attachment f
   where c.id = f.cell_id
     and nullif(btrim(c.frame), '') is null;
  get diagnostics step_b = row_count;

  -- -------------------------------------------------------------------------
  -- c. A copy of a placed touchpoint's logo becomes that touchpoint's logo
  -- -------------------------------------------------------------------------

  create temp table logo_copy on commit drop as
  select distinct on (c.id)
         c.id as cell_id,
         btrim(c.frame) as frame,
         btrim(tp.icon_url) as icon_url
    from public.cells c
    join logo_placement l on l.cell_id = c.id
    join public.touchpoints tp on tp.id = l.touchpoint_id
   where nullif(btrim(c.frame), '') is not null
     and pg_temp.picture(btrim(c.frame)) = l.picture
   order by c.id, l.position, l.placement_id;
  get diagnostics step_c_matched = row_count;

  update public.cells c
     set frame = lc.icon_url
    from logo_copy lc
   where c.id = lc.cell_id
     and lc.frame is distinct from lc.icon_url;
  get diagnostics step_c = row_count;

  -- -------------------------------------------------------------------------
  -- d. A cell on a touchpoint with a logo, still without a frame
  -- -------------------------------------------------------------------------

  update public.cells c
     set frame = first_logo.icon_url
    from (
      select distinct on (l.cell_id) l.cell_id, btrim(tp.icon_url) as icon_url
        from logo_placement l
        join public.touchpoints tp on tp.id = l.touchpoint_id
       order by l.cell_id, l.position, l.placement_id
    ) first_logo
   where c.id = first_logo.cell_id
     and nullif(btrim(c.frame), '') is null;
  get diagnostics step_d = row_count;
  if step_d > logo_no_frame_expected then
    raise exception 'featured images: step d filled % frames, more than %', step_d, logo_no_frame_expected;
  end if;

  -- -------------------------------------------------------------------------
  -- e. Attachments are no longer featured
  -- -------------------------------------------------------------------------

  update public.resources
     set featured = false
   where kind = 'attachment'
     and featured;
  get diagnostics step_e = row_count;

  -- -------------------------------------------------------------------------
  -- f. A slide whose pictures changed is made explicit with what it showed
  -- -------------------------------------------------------------------------

  create temp table changed_slide on commit drop as
  with before_list as (
    select slide_id, array_agg(picture order by ord) as list
      from shown_before group by slide_id
  ),
  now_list as (
    select n.slide_id, array_agg(pg_temp.picture(n.src) order by n.ord) as list
      from pg_temp.slide_images_shown() n group by n.slide_id
  )
  select s.id as slide_id
    from public.slides s
    left join before_list b on b.slide_id = s.id
    left join now_list n on n.slide_id = s.id
   where coalesce(b.list, '{}') is distinct from coalesce(n.list, '{}');

  update public.slides s
     set shows_all_images = false
    from changed_slide x
   where s.id = x.slide_id;
  get diagnostics frozen = row_count;

  insert into public.slide_images (slide_id, position, cell_id)
  select b.slide_id, (b.ord - 1)::int, b.cell_id
    from shown_before b
    join changed_slide x on x.slide_id = b.slide_id
   order by b.slide_id, b.ord;

  -- -------------------------------------------------------------------------
  -- After: every slide shows exactly the pictures it showed before
  -- -------------------------------------------------------------------------

  with now_shown as (
    select n.slide_id, n.ord, n.cell_id, pg_temp.picture(n.src) as picture
      from pg_temp.slide_images_shown() n
  )
  select count(*) into mismatched
    from shown_before e
    full join now_shown n
      on n.slide_id = e.slide_id and n.ord = e.ord
   where e.slide_id is null
      or n.slide_id is null
      or e.cell_id is distinct from n.cell_id
      or e.picture is distinct from n.picture;
  if mismatched <> 0 then
    raise exception 'featured images: % slide images differ from what the slides showed before', mismatched;
  end if;

  if exists (select 1 from public.resources where kind = 'attachment' and featured) then
    raise exception 'featured images: an attachment is still featured';
  end if;
  if exists (
    select 1 from featured_attachment f join public.cells c on c.id = f.cell_id
     where nullif(btrim(c.frame), '') is null
  ) then
    raise exception 'featured images: a cell that had a featured attachment has no frame';
  end if;
  if exists (
    select 1 from logo_placement l join public.cells c on c.id = l.cell_id
     where nullif(btrim(c.frame), '') is null
  ) then
    raise exception 'featured images: a cell on a touchpoint with a logo has no frame';
  end if;

  raise notice 'featured images: a pointed % touchpoints at the bucket, b framed %, c matched % logo copies and changed %, d framed %, e un-featured % attachments, f made % slides explicit',
    step_a, step_b, step_c_matched, step_c, step_d, step_e, frozen;

  drop function pg_temp.slide_images_shown();
  drop function pg_temp.picture(text);
end
$featured_image_moves$;
