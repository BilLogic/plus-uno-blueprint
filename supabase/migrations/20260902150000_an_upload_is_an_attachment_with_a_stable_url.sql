-- An upload is an attachment with a stable URL.
--
-- 20260902130000 gave `resources` an `attachment` kind and copied the
-- placement screenshots into it as the site-relative `/blueprint-images/…`
-- paths they were — files shipped in `public/`, which nothing but a deploy
-- can add to. This is where a person adds one: a public-read Storage bucket
-- on the free tier, one object per attachment, its public URL the row's
-- `url`. The row's kind is decided when it is made (#271); the bytes at the
-- other end decide how it is shown (#272).
--
-- ── The bucket ────────────────────────────────────────────────────────────
--
-- `cell-attachments`, public. Public because the app reads without a session
-- — every board is readable by anon — and a private bucket would need a
-- signed URL per image per viewer, minted by a session the reader does not
-- have. Reading is the same posture as the tables: open. Writing is not.
--
-- Objects are keyed `cells/<cell id>/<generated id>.<ext>`: ids and nothing
-- else, so renaming the placement, the touchpoint or the cell changes no
-- URL. No orphan purge: deleting the row leaves the object, which is a
-- bounded cost on a bucket this size and a deliberate non-goal of #274.
--
-- ── The policies ──────────────────────────────────────────────────────────
--
-- Mirrors the tables: SELECT for anyone signed in (anon reads through the
-- public URL, which never consults a policy), INSERT / UPDATE / DELETE only
-- for `authenticated` AND `is_service_account()`, and only under the key
-- pattern above. `slice-illustrations` reached the same shape in two steps
-- (a permissive policy, then a restrictive service-only one); this bucket
-- starts there. Each write policy carries the guard itself, so the four
-- policies are the whole rule and no reader has to combine two.
--
-- ── Replaying against an empty database ───────────────────────────────────
--
-- The replay prelude models `storage.buckets` and `storage.objects`, so the
-- bucket row and the policies replay. The proof is an INVARIANT: the bucket
-- exists and is public, the four policies exist on `storage.objects`, and
-- none of the write policies admits anon.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cell-attachments', 'cell-attachments', true, 10485760,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg',
    'application/pdf'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cell_attachments_select" on storage.objects;
drop policy if exists "cell_attachments_insert" on storage.objects;
drop policy if exists "cell_attachments_update" on storage.objects;
drop policy if exists "cell_attachments_delete" on storage.objects;

create policy "cell_attachments_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'cell-attachments');

create policy "cell_attachments_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cell-attachments'
    and public.is_service_account()
    and name ~ '^cells/[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{1,8}$'
  );

create policy "cell_attachments_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'cell-attachments' and public.is_service_account())
  with check (
    bucket_id = 'cell-attachments'
    and public.is_service_account()
    and name ~ '^cells/[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{1,8}$'
  );

create policy "cell_attachments_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cell-attachments' and public.is_service_account());

-- ── Proof ──────────────────────────────────────────────────────────────────
do $proof$
declare
  bad int;
begin
  if not exists (select 1 from storage.buckets where id = 'cell-attachments' and public) then
    raise exception 'the cell-attachments bucket is missing or not public';
  end if;

  select count(*) into bad
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('cell_attachments_select', 'cell_attachments_insert',
                        'cell_attachments_update', 'cell_attachments_delete');
  if bad <> 4 then
    raise exception 'expected four cell_attachments policies on storage.objects, found %', bad;
  end if;

  -- No write policy on this bucket names anon, and every one names the
  -- service-account guard.
  select count(*) into bad
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('cell_attachments_insert', 'cell_attachments_update', 'cell_attachments_delete')
     and ('anon' = any(roles) or 'public' = any(roles)
          or coalesce(qual, '') || coalesce(with_check, '') not like '%is_service_account()%');
  if bad <> 0 then
    raise exception '% cell_attachments write policies are open to anon or unguarded', bad;
  end if;
end
$proof$;
