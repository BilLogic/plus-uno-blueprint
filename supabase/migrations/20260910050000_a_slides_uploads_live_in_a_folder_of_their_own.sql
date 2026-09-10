-- A slide's uploads live in a folder of their own, and the bucket admits them.
--
-- `20260910030000` made a slide's images a SET, and one kind of member is an
-- uploaded picture. Uploading is the half of that feature that lives in
-- Storage rather than in `public`, and the object key changed shape when the
-- set did:
--
--   before   slices/<slice id>/<slide id>.png          one image per slide
--   after    slices/<slice id>/<slide id>/<id>.png     a folder per slide
--
-- The old key was an UPSERT target. A slide had one image, so replacing it
-- overwrote the object at its own name — which is why the row beside it used
-- to carry an `updated_at` cache-buster: the URL never changed and the bytes
-- did. A set does not overwrite. Every upload is its own object under its own
-- name, so a new image is a new URL and a slide can hold several at once; and
-- the folder is what makes "delete this slide's uploads" a thing that can be
-- asked, which deleting a slice needs and no per-object name gives you.
--
-- ── This file exists because the bucket refuses the new key ───────────────
--
-- `slice_illustrations_insert` matches the object name against a pattern, and
-- that pattern has exactly two path segments after `slices/`:
-- `^slices/<36>/(<36>|frame-[0-9]+|character-ref)\.(png|jpg|webp)$`
-- (`20260731000000`, widening `20260729120000`). A key with the slide folder in
-- it has three, so every upload the new field makes would be refused by RLS
-- after the whole file had gone over the wire — a 403 at the end of an upload,
-- with nothing on screen able to explain it.
--
-- The old spellings stay accepted. Objects uploaded under them are still in
-- the bucket and still named by rows, and a pattern that stopped matching them
-- would not delete anything — it would just make those objects unwritable for
-- no reason.
--
-- ── And the delete nobody could perform ──────────────────────────────────
--
-- There has never been a DELETE policy for this bucket. Deleting a slice
-- removes its slides and their members, and the objects were left behind —
-- which was correct while nothing ever asked to remove one, and stops being
-- correct now that the app calls `removeSlideUploadObjects` on the two paths
-- where a slide's folder becomes unreachable (a slice deleted, and an undo
-- that drops a slide the inverse does not restore). Without a policy that
-- call matches no rows and reports success, which is the worst of the three
-- possible outcomes: the leak, plus code that says it was handled.
--
-- The delete is `is_service_account()`-gated like every other write to this
-- bucket, and it is bounded by the same name pattern, so a session cannot
-- reach past the slice tree it is entitled to.
--
-- ── What is NOT here ─────────────────────────────────────────────────────
--
-- No sweep of existing objects, and no orphan purge. Dropping an image from a
-- slide's set leaves its object in the bucket ON PURPOSE: a duplicated slice
-- copies members verbatim, and an undo restores the `image_url` it captured,
-- so an object deleted the moment its last row went would break a slide
-- nobody asked to change. What this file makes possible is deleting the
-- folder of a slide that cannot come back, and nothing wider.
--
-- ── Guarded, because the migration role may not own storage.objects ──────
--
-- On some hosted projects it does not, and a policy statement raises
-- `insufficient_privilege`. This project's own `cell_attachments_*` policies
-- were created unguarded and are there, so the privilege is present here; the
-- guard is for a fresh environment brought up by somebody else, and it says
-- what is true when it fires rather than passing silently.

do $policies$
begin
  drop policy if exists "slice_illustrations_insert" on storage.objects;
  drop policy if exists "slice_illustrations_update" on storage.objects;
  drop policy if exists "slice_illustrations_delete" on storage.objects;

  create policy "slice_illustrations_insert" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'slice-illustrations'
      and name ~ '^slices/[0-9a-f-]{36}/([0-9a-f-]{36}/[0-9a-f-]{36}|[0-9a-f-]{36}|frame-[0-9]+|character-ref)\.(png|jpg|webp)$'
    );

  create policy "slice_illustrations_update" on storage.objects
    for update to authenticated
    using (bucket_id = 'slice-illustrations')
    with check (
      bucket_id = 'slice-illustrations'
      and name ~ '^slices/[0-9a-f-]{36}/([0-9a-f-]{36}/[0-9a-f-]{36}|[0-9a-f-]{36}|frame-[0-9]+|character-ref)\.(png|jpg|webp)$'
    );

  create policy "slice_illustrations_delete" on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'slice-illustrations'
      and name ~ '^slices/[0-9a-f-]{36}/([0-9a-f-]{36}/[0-9a-f-]{36}|[0-9a-f-]{36}|frame-[0-9]+|character-ref)\.(png|jpg|webp)$'
    );
exception
  when insufficient_privilege then
    raise exception
      'storage.objects is owned by another role here, so the slice-illustration '
      'policies were not moved. Slide uploads will be refused until they are '
      'added through the dashboard: the insert pattern must accept '
      'slices/<slice>/<slide>/<id>.<ext>, and a DELETE policy must exist.';
end
$policies$;

-- ── Proof ─────────────────────────────────────────────────────────────────
--
-- Two claims, and neither of them is "a regex was typed". The first is that
-- the pattern decides the right way about seven names — the three the app
-- writes today, the shapes already in the bucket, and the three shapes it must
-- refuse. The second is that the pattern proved in the first is the one the
-- policies actually carry, read back out of the catalog.
--
-- Invariants: nothing here counts objects, and every case is a string.

do $the_pattern$
declare
  pattern text :=
    '^slices/[0-9a-f-]{36}/([0-9a-f-]{36}/[0-9a-f-]{36}|[0-9a-f-]{36}|frame-[0-9]+|character-ref)\.(png|jpg|webp)$';
  slice text := '11111111-1111-4111-8111-111111111111';
  slide text := '22222222-2222-4222-8222-222222222222';
  object text := '33333333-3333-4333-8333-333333333333';
  name text;
  installed int;
begin
  -- The key the image field writes now.
  name := format('slices/%s/%s/%s.png', slice, slide, object);
  if name !~ pattern then
    raise exception 'the bucket would refuse a slide upload: %', name;
  end if;
  if format('slices/%s/%s/%s.webp', slice, slide, object) !~ pattern then
    raise exception 'the bucket would refuse a WebP slide upload';
  end if;

  -- The keys already in the bucket.
  if format('slices/%s/%s.png', slice, slide) !~ pattern then
    raise exception 'the bucket stopped admitting the one-image-per-slide key';
  end if;
  if format('slices/%s/frame-3.png', slice) !~ pattern then
    raise exception 'the bucket stopped admitting a frame key';
  end if;
  if format('slices/%s/character-ref.jpg', slice) !~ pattern then
    raise exception 'the bucket stopped admitting the character reference key';
  end if;

  -- And what it must still refuse: a key outside the slices tree, a fourth
  -- segment, and anything that is not one of the three image extensions.
  if format('other/%s/%s.png', slice, slide) ~ pattern then
    raise exception 'the pattern admits a key outside the slices tree';
  end if;
  if format('slices/%s/%s/%s/%s.png', slice, slide, object, object) ~ pattern then
    raise exception 'the pattern admits a fourth path segment';
  end if;
  if format('slices/%s/%s/%s.svg', slice, slide, object) ~ pattern then
    raise exception 'the pattern admits an extension the bucket does not allow';
  end if;

  -- The three policies exist, each carries the pattern above, and none of
  -- them names anon.
  select count(*) into installed
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('slice_illustrations_insert', 'slice_illustrations_update',
                        'slice_illustrations_delete')
     and position(pattern in coalesce(qual, '') || coalesce(with_check, '')) > 0
     and not ('anon' = any(roles) or 'public' = any(roles));
  if installed <> 3 then
    raise exception
      'expected three slice_illustrations write policies carrying this pattern '
      'and named to authenticated, found %', installed;
  end if;

  -- The service gate is the restrictive companion 20260805170000 installed
  -- over every command on this bucket, DELETE included. If it ever goes, a
  -- view-only session inherits the three policies above.
  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'slice_illustrations_service_only'
       and permissive = 'RESTRICTIVE'
       and coalesce(qual, '') like '%is_service_account()%'
       and coalesce(with_check, '') like '%is_service_account()%'
  ) then
    raise exception
      'the restrictive service gate on slice-illustrations is gone, so these '
      'policies are the whole rule and a viewer may write to the bucket';
  end if;
end
$the_pattern$;
