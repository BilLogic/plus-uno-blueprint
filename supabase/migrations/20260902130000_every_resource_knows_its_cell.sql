-- Every resource knows its cell, and a placement's are the cell's too.
--
-- `resources` had two owners and a rule that a row picks one: `cell_id` OR
-- `cell_touchpoint_id`, never both. That made a placement's resource
-- invisible to every reader that asks "what does this cell point at?" — the
-- board embed, the Resources tab, the agent's read — because they all ask by
-- `cell_id`, and a placement's rows had none. #264 settled the model: a
-- placement is one touchpoint used at one cell, so what the placement points
-- at is what the cell points at, through that touchpoint. Every resource
-- carries its cell; a placement-owned one carries its placement as well.
--
-- Three things enforce that, and none of them is client-side agreement:
--
--   * `cell_id` is NOT NULL, backfilled from the placement where a row had
--     only that;
--   * a COMPOSITE foreign key `(cell_touchpoint_id, cell_id)` onto
--     `cell_touchpoints (id, cell_id)`, so a resource cannot name a placement
--     that sits in a different cell. MATCH SIMPLE: a row with no placement
--     is not checked against the placement table at all. The plain
--     `cell_touchpoint_id` reference goes, because the composite one covers
--     it — the same cascade, one path for PostgREST to see;
--   * `resources_one_owner` goes with the reason for it.
--
-- `kind` becomes `link | attachment`. `other` had zero rows and no reader;
-- an attachment is a file the cell points at, today a site-relative image
-- shipped in `public/` and after #274 an object in Storage. Both kinds carry
-- a url, so the link-only check becomes a check on every row.
--
-- `featured` marks the resource a placement leads with: one featured
-- attachment per owner (the image a placement shows), any number of featured
-- links. A partial unique index per owner shape is what makes "one" a rule.
--
-- The placement columns `url` and `screenshot` are COPIED, not moved: each
-- url becomes a featured link on its placement, each screenshot a featured
-- attachment whose url is the same site-relative path it was. The columns
-- stay until #276 drops them, so nothing that reads them today breaks.
--
-- `sync_cell_resources` learns the difference. It writes the cell's OWN
-- rows — the ones with no placement — and refuses an id that belongs to a
-- placement, because the list that edits a placement's resources is #273's,
-- and a cell list that quietly rewrote them would turn a featured attachment
-- into a link. It no longer sets `kind` on a kept row for the same reason:
-- kind is decided when a row is made. And it becomes SECURITY DEFINER behind
-- `is_service_account()`, like every structural write: 20260902100000 made it
-- UPDATE rows in place, and `authenticated` holds no UPDATE grant on this
-- table — 20260830290000 recorded "resources ends with no UPDATE surface"
-- because the function deleted and re-inserted. Rather than open a column
-- surface, the function carries the privilege and the guard.
--
-- ── The position rule, found at apply time ────────────────────────────────
--
-- `resources_cell_position_unique` was `unique (cell_id, position)`, written
-- when every row with a `cell_id` was one of the cell's own list. Once a
-- placement's rows carry the cell too, the first production placement's
-- featured link — position 0, in a cell whose own list already had a
-- position 0 — collided, and the apply rolled back. The rule was never about
-- placement rows: their order is `(cell_touchpoint_id, position)`, which
-- stays. So the cell's rule is re-issued as an EXCLUDE constraint over the
-- same pair, restricted to the cell's own rows, and still DEFERRABLE — a
-- unique index could carry the predicate but not the deferral, and the
-- deferral is what lets `sync_cell_resources` write a reorder in one
-- statement without colliding with itself halfway through.
--
-- ── Replaying against an empty database ───────────────────────────────────
--
-- Every statement here is a schema change or an UPDATE/INSERT that touches
-- zero rows on an empty database. The proof is an INVARIANT — every
-- placement with a url has exactly one featured link carrying it, every one
-- with a screenshot exactly one featured attachment, no row is without a
-- cell, and the constraints and indexes are present — vacuous on zero
-- placements and real on production's 28 and 52.

alter table public.resources
  add column featured boolean not null default false;

comment on column public.resources.featured is
  'The resource its owner leads with. One featured attachment per placement '
  'or per cell (the image it shows); any number of featured links.';

update public.resources r
   set cell_id = ct.cell_id
  from public.cell_touchpoints ct
 where r.cell_touchpoint_id = ct.id
   and r.cell_id is null;

alter table public.resources drop constraint resources_one_owner;
alter table public.resources alter column cell_id set not null;

alter table public.cell_touchpoints
  add constraint cell_touchpoints_id_cell_id_key unique (id, cell_id);

alter table public.resources drop constraint resources_cell_touchpoint_id_fkey;
alter table public.resources
  add constraint resources_placement_in_cell_fkey
  foreign key (cell_touchpoint_id, cell_id)
  references public.cell_touchpoints (id, cell_id)
  on delete cascade;

alter table public.resources drop constraint resources_cell_position_unique;
alter table public.resources
  add constraint resources_cell_position_unique
  exclude using btree (cell_id with =, position with =)
  where (cell_touchpoint_id is null)
  deferrable initially deferred;

alter table public.resources drop constraint resources_kind_check;
alter table public.resources
  add constraint resources_kind_check check (kind in ('link', 'attachment'));

alter table public.resources drop constraint resources_link_has_url;
alter table public.resources
  add constraint resources_has_url check (nullif(btrim(url), '') is not null);

create unique index resources_one_featured_attachment_per_placement
  on public.resources (cell_touchpoint_id)
  where featured and kind = 'attachment' and cell_touchpoint_id is not null;

create unique index resources_one_featured_attachment_per_cell
  on public.resources (cell_id)
  where featured and kind = 'attachment' and cell_touchpoint_id is null;

comment on column public.resources.cell_id is
  'The cell this resource belongs to — always. A placement-owned resource '
  'carries its placement in cell_touchpoint_id as well, and the composite '
  'key holds the two to one row.';

comment on column public.resources.kind is
  'link = a place on the web; attachment = a file the cell points at, '
  'today a site-relative image path, after #274 an object in Storage. Both '
  'carry a url. Host and file type are read at render, never stored.';

-- ── The placement columns, copied onto the placement as resources ──────────

insert into public.resources
  (cell_id, cell_touchpoint_id, kind, name, url, position, origin, featured)
select ct.cell_id, ct.id, 'link', tp.name, btrim(ct.url), 0, 'import', true
  from public.cell_touchpoints ct
  join public.touchpoints tp on tp.id = ct.touchpoint_id
 where nullif(btrim(ct.url), '') is not null
   and not exists (
     select 1 from public.resources r
      where r.cell_touchpoint_id = ct.id and r.url = btrim(ct.url)
   );

insert into public.resources
  (cell_id, cell_touchpoint_id, kind, name, url, position, origin, featured)
select ct.cell_id, ct.id, 'attachment', tp.name, btrim(ct.screenshot),
       (select coalesce(max(r.position), -1) + 1
          from public.resources r where r.cell_touchpoint_id = ct.id),
       'import', true
  from public.cell_touchpoints ct
  join public.touchpoints tp on tp.id = ct.touchpoint_id
 where nullif(btrim(ct.screenshot), '') is not null
   and not exists (
     select 1 from public.resources r
      where r.cell_touchpoint_id = ct.id and r.url = btrim(ct.screenshot)
   );

-- ── The cell's list writes the cell's own rows ─────────────────────────────

create or replace function public.sync_cell_resources(
  p_cell_id uuid,
  p_rows    jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $function$
declare
  v_nameless  int;
  v_foreign   int;
  v_placement int;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint' using errcode = '42501';
  end if;
  if not exists (select 1 from public.cells c where c.id = p_cell_id) then
    raise exception 'cell % does not exist', p_cell_id;
  end if;

  -- Refused rather than defaulted. The editor already falls back to the
  -- url's host, so a nameless row reaching here means a caller skipped that,
  -- and inventing a name on its behalf hides the bug.
  select count(*) into v_nameless
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
    as r(id uuid, kind text, name text, url text)
  where nullif(btrim(coalesce(r.name, '')), '') is null;
  if v_nameless <> 0 then
    raise exception '% resource(s) arrived with no name', v_nameless;
  end if;

  -- An id has to be one of this cell's own rows.
  select count(*) into v_foreign
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(id uuid)
  where r.id is not null
    and not exists (
      select 1 from public.resources x
       where x.id = r.id and x.cell_id = p_cell_id
    );
  if v_foreign <> 0 then
    raise exception '% resource id(s) are not rows of cell %', v_foreign, p_cell_id;
  end if;

  -- And not one of a placement's. Those are the cell's to READ, and the
  -- touchpoint's list to write (#273); a cell list rewriting them would turn
  -- a featured attachment into a link.
  select count(*) into v_placement
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(id uuid)
  join public.resources x on x.id = r.id
  where x.cell_touchpoint_id is not null;
  if v_placement <> 0 then
    raise exception '% resource(s) belong to a touchpoint placement and are edited from it', v_placement;
  end if;

  -- Rows the list no longer names — the cell's own only.
  delete from public.resources x
   where x.cell_id = p_cell_id
     and x.cell_touchpoint_id is null
     and x.id not in (
       select r.id
         from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(id uuid)
        where r.id is not null
     );

  -- Kept rows, updated in place — position included, kind left alone.
  update public.resources x
     set name       = btrim(r.name),
         url        = nullif(btrim(coalesce(r.url, '')), ''),
         position   = r.ord::int,
         updated_at = now()
    from rows from (
           jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
             as (id uuid, kind text, name text, url text)
         ) with ordinality as r(id, kind, name, url, ord)
   where x.id = r.id
     and x.cell_id = p_cell_id;

  -- New rows.
  insert into public.resources (cell_id, kind, name, url, position, origin)
  select p_cell_id,
         coalesce(nullif(btrim(coalesce(r.kind, '')), ''), 'link'),
         btrim(r.name),
         nullif(btrim(coalesce(r.url, '')), ''),
         r.ord::int,
         'app'
    from rows from (
           jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
             as (id uuid, kind text, name text, url text)
         ) with ordinality as r(id, kind, name, url, ord)
   where r.id is null;
end
$function$;

revoke execute on function public.sync_cell_resources(uuid, jsonb) from public, anon;
grant execute on function public.sync_cell_resources(uuid, jsonb) to authenticated;

-- ── Proof ──────────────────────────────────────────────────────────────────
do $proof$
declare
  bad int;
begin
  -- 1. NO RESOURCE IS WITHOUT A CELL, AND A PLACEMENT'S SITS IN ITS CELL.
  select count(*) into bad from public.resources where cell_id is null;
  if bad <> 0 then raise exception '% resources have no cell', bad; end if;
  select count(*) into bad
    from public.resources r
    join public.cell_touchpoints ct on ct.id = r.cell_touchpoint_id
   where ct.cell_id <> r.cell_id;
  if bad <> 0 then
    raise exception '% resources name a placement in another cell', bad;
  end if;

  -- 2. THE CONSTRAINTS AND INDEXES ARE THERE.
  if not exists (select 1 from pg_constraint
                  where conname = 'resources_placement_in_cell_fkey') then
    raise exception 'resources_placement_in_cell_fkey is missing';
  end if;
  if exists (select 1 from pg_constraint where conname = 'resources_one_owner') then
    raise exception 'resources_one_owner survived';
  end if;
  if (select count(*) from pg_indexes
       where tablename = 'resources'
         and indexname in ('resources_one_featured_attachment_per_placement',
                           'resources_one_featured_attachment_per_cell')) <> 2 then
    raise exception 'the featured-attachment indexes are missing';
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'resources_cell_position_unique'
                    and contype = 'x' and condeferrable) then
    raise exception 'the cell position rule is not a deferrable exclusion over the cell''s own rows';
  end if;

  -- 3. EVERY PLACEMENT URL IS EXACTLY ONE FEATURED LINK; EVERY SCREENSHOT
  --    EXACTLY ONE FEATURED ATTACHMENT. Vacuous with no placements.
  select count(*) into bad
    from public.cell_touchpoints ct
   where nullif(btrim(ct.url), '') is not null
     and (select count(*) from public.resources r
           where r.cell_touchpoint_id = ct.id and r.kind = 'link'
             and r.featured and r.url = btrim(ct.url)) <> 1;
  if bad <> 0 then
    raise exception '% placements with a url lack exactly one featured link for it', bad;
  end if;
  select count(*) into bad
    from public.cell_touchpoints ct
   where nullif(btrim(ct.screenshot), '') is not null
     and (select count(*) from public.resources r
           where r.cell_touchpoint_id = ct.id and r.kind = 'attachment'
             and r.featured and r.url = btrim(ct.screenshot)) <> 1;
  if bad <> 0 then
    raise exception '% placements with a screenshot lack exactly one featured attachment for it', bad;
  end if;

  -- 4. THE CELL LIST'S WRITE IS DEFINER-GUARDED AND CLOSED TO ANON.
  if not (select prosecdef from pg_proc where proname = 'sync_cell_resources') then
    raise exception 'sync_cell_resources is not SECURITY DEFINER';
  end if;
  if has_function_privilege('anon', 'public.sync_cell_resources(uuid, jsonb)', 'execute') then
    raise exception 'anon can execute sync_cell_resources';
  end if;
end
$proof$;
