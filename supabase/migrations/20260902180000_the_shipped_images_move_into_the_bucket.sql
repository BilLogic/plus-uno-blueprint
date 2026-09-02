-- The shipped images move into the bucket.
--
-- 247 files under `public/blueprint-images` were named by 107 `resources`
-- rows and 322 `cells.frame` values as site-relative paths — authored
-- content of one deployment, shipped inside the template and served by
-- whatever site happened to deploy it. `scripts/move-images-to-bucket.mjs`
-- has put every file in the `cell-attachments` bucket (20260902150000)
-- under a key derived from the path; this rewrites the paths to the objects'
-- public URLs and then refuses a site-relative one for good.
--
-- ── The key, derived here exactly as the script derives it ────────────────
--
--   cells/<cell>/<md5(path)::uuid>.<ext>
--
-- <cell> is the smallest cell id among the rows that name the path — as
-- text, since uuid has no min aggregate and its text order is its byte
-- order — so a file several cells share lives under the first of them; the
-- extension is the path's own, lowercased. No mapping is handed from the script to this
-- file: both compute the same key from the same path and the same rows.
--
-- ── This deployment's project ─────────────────────────────────────────────
--
-- The public URL names the project, and a migration has no other way to
-- learn it. It is written here once: an empty database has no rows to
-- rewrite, and a different deployment has no `/blueprint-images/` paths.
--
-- ── Replaying against an empty database ───────────────────────────────────
--
-- The rewrite touches whatever rows exist; the two CHECKs and the proof are
-- INVARIANTS — no url and no frame starts with `/` — vacuous on none.

-- The step-visual placeholder is template code, not content: a frame that
-- named it meant "no frame", and null is how that is spelled.
update public.cells
   set frame = null
 where frame = '/blueprint-images/shared/step-visual-placeholder.svg';

-- The project's public base is written once, in the one statement that
-- needs it: an empty database has no rows to rewrite, and another
-- deployment has no `/blueprint-images/` paths.
create temporary table moved (old_path text primary key, url text not null) on commit drop;

insert into moved (old_path, url)
with named as (
  select r.url as old_path, r.cell_id from public.resources r where r.url like '/blueprint-images/%'
  union all
  select c.frame, c.id from public.cells c where c.frame like '/blueprint-images/%'
)
select old_path,
       'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/'
         || 'cells/' || min(cell_id::text) || '/' || md5(old_path)::uuid::text || '.'
         || lower(coalesce(substring(old_path from '\.([A-Za-z0-9]+)$'), 'bin'))
  from named
 group by old_path;

update public.resources r
   set url = m.url
  from moved m
 where r.url = m.old_path;

update public.cells c
   set frame = m.url
  from moved m
 where c.frame = m.old_path;

alter table public.resources
  add constraint resources_url_absolute check (url is null or url !~ '^/');
alter table public.cells
  add constraint cells_frame_absolute check (frame is null or frame !~ '^/');

comment on constraint resources_url_absolute on public.resources is
  'A resource points at a URL, never at a path inside whatever site deployed this template (#278).';
comment on constraint cells_frame_absolute on public.cells is
  'A storyboard frame is a URL — the bucket''s, since 20260902180000 — never a path the site serves (#278).';

-- ── Proof ──────────────────────────────────────────────────────────────────
do $proof$
declare
  bad int;
begin
  select count(*) into bad from public.resources where url ~ '^/';
  if bad <> 0 then raise exception '% resources still point inside the site', bad; end if;
  select count(*) into bad from public.cells where frame ~ '^/';
  if bad <> 0 then raise exception '% storyboard frames still point inside the site', bad; end if;
  if not exists (select 1 from pg_constraint where conname = 'resources_url_absolute')
     or not exists (select 1 from pg_constraint where conname = 'cells_frame_absolute') then
    raise exception 'the absolute-url checks are missing';
  end if;
end
$proof$;
