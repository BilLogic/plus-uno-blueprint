-- A touchpoint the registry lacks is still a placement.
--
-- `unplaced_touchpoint_details` was a waiting room: 57 authored details whose
-- name matched nothing their cell showed, kept in a side table so that no
-- one would "place" them by guessing at the catalog entry they resembled.
-- The room worked as a room — nothing was lost — and failed as a place to
-- read: a detail in it drew nowhere, and a board reader never learned that
-- a moment had a tool it could not name.
--
-- A placement can now name its touchpoint one of two ways: by `touchpoint_id`
-- into the registry, or by `name` alone. Exactly one. A name-only placement
-- is drawn on the board with a dashed face, opens the same panel, and gets a
-- "Link to registry" action — so the 57 stop being invisible and become
-- seven decisions (#279) plus fifty rows that were already answerable.
--
-- ── The fold ──────────────────────────────────────────────────────────────
--
-- Each queued detail joins its cell's placements:
--   · its name matches a registry touchpoint of the same service (case-
--     insensitively) and the cell does not show that touchpoint yet → a
--     linked placement, summary and role carried over;
--   · it matches one the cell already shows → folded INTO that placement:
--     the placement keeps its own words where it has them, takes the
--     detail's where it does not;
--   · it matches nothing → a name-only placement under the detail's name.
-- In every case the detail's url and screenshot become a featured link and
-- a featured attachment on the placement (#271's rule), unless the placement
-- already has a resource at that url.
--
-- Matching is done HERE, in the migration, by the same rule the app refused
-- to apply automatically — and that is not a contradiction. The refusal was
-- about placing a detail onto a touchpoint its cell did not show; the fold
-- creates the placement the detail was always describing, and where the
-- registry lacks the name it creates nothing in the registry.
--
-- ── The functions ─────────────────────────────────────────────────────────
--
-- `sync_cell_touchpoints`: a name that leaves the cell's text used to park
-- the placement's writing in the queue. It now keeps the ROW: a removed
-- placement with anything on it — words, a role, resources — becomes
-- name-only (its touchpoint unset, its name kept), resources and all; one
-- with nothing on it is deleted. A name typed back links the name-only row
-- to the registry again rather than inserting beside it.
--
-- `restore_cell_touchpoints`: summary and role back by name, whether the
-- row is linked or name-only; resources re-created for a row that has none.
--
-- `set_placement_touchpoint`: "Link to registry" and its inverse — exactly
-- one of a touchpoint id or a name, the previous pair returned.
-- `remove_placement` / `restore_placement`: a name-only row nobody wants,
-- and the way back, resources included.
--
-- `place_touchpoint_detail`, `discard_touchpoint_detail` and
-- `restore_touchpoint_detail` go with the table.
--
-- ── Replaying against an empty database ───────────────────────────────────
--
-- The fold moves whatever rows exist and is a no-op on none. The proof is
-- an INVARIANT: the table and its three functions are gone, the identity
-- check stands, no row names both or neither, and the five functions exist.

-- ── 1. Two ways to name a touchpoint ──────────────────────────────────────

alter table public.cell_touchpoints
  alter column touchpoint_id drop not null,
  add column name text,
  add constraint cell_touchpoints_one_identity
    check ((touchpoint_id is null) <> (name is null)),
  add constraint cell_touchpoints_name_not_blank
    check (name is null or btrim(name) <> '');

create unique index cell_touchpoints_cell_name_key
  on public.cell_touchpoints (cell_id, lower(name))
  where name is not null;

comment on column public.cell_touchpoints.name is
  'The touchpoint''s name when the registry lacks it. Exactly one of name and touchpoint_id is set; linking to the registry clears it.';

-- ── 2. The fold ───────────────────────────────────────────────────────────

-- Every queued detail, with the registry match it has (or not) and the
-- placement its cell already holds for that match (or not).
create temporary table folded on commit drop as
select u.id as detail_id, u.cell_id, u.name, u.summary, u.screenshot, u.url, u.role,
       tp.id as touchpoint_id,
       ct.id as existing_placement_id
  from public.unplaced_touchpoint_details u
  join public.cells c on c.id = u.cell_id
  join public.paths p on p.id = c.path_id
  join public.scenarios s on s.id = p.scenario_id
  join public.phases ph on ph.id = s.phase_id
  left join public.touchpoints tp
    on tp.service_id = ph.service_id and lower(tp.name) = lower(u.name)
  left join public.cell_touchpoints ct
    on ct.cell_id = u.cell_id and ct.touchpoint_id = tp.id;

-- Folded into a placement the cell already shows: its own words stay.
update public.cell_touchpoints ct
   set summary    = coalesce(nullif(btrim(ct.summary), ''), nullif(btrim(f.summary), '')),
       role       = coalesce(ct.role, f.role),
       updated_at = now()
  from folded f
 where f.existing_placement_id = ct.id;

-- New placements: linked where the registry has the name, name-only where
-- it does not. Positioned after whatever the cell already shows.
with placed as (
  insert into public.cell_touchpoints
    (id, cell_id, touchpoint_id, name, position, summary, role, origin)
  select f.detail_id, f.cell_id,
         f.touchpoint_id,
         case when f.touchpoint_id is null then f.name end,
         coalesce((select max(position) from public.cell_touchpoints x where x.cell_id = f.cell_id), -1)
           + row_number() over (partition by f.cell_id order by f.name),
         nullif(btrim(f.summary), ''), f.role, 'import'
    from folded f
   where f.existing_placement_id is null
  returning id
)
select count(*) from placed;

-- The placement each detail landed on, for its resources.
create temporary table landed on commit drop as
select f.detail_id, f.cell_id, f.url, f.screenshot,
       coalesce(f.existing_placement_id, f.detail_id) as placement_id,
       f.name
  from folded f;

insert into public.resources
  (cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
select l.cell_id, l.placement_id, 'link', l.name, btrim(l.url),
       coalesce((select max(position) + 1 from public.resources where cell_touchpoint_id = l.placement_id), 0),
       not exists (select 1 from public.resources f
                    where f.cell_touchpoint_id = l.placement_id and f.kind = 'link' and f.featured),
       'import'
  from landed l
 where nullif(btrim(l.url), '') is not null
   and not exists (select 1 from public.resources r
                    where r.cell_touchpoint_id = l.placement_id and r.url = btrim(l.url));

insert into public.resources
  (cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
select l.cell_id, l.placement_id, 'attachment', l.name, btrim(l.screenshot),
       coalesce((select max(position) + 1 from public.resources where cell_touchpoint_id = l.placement_id), 0),
       not exists (select 1 from public.resources f
                    where f.cell_touchpoint_id = l.placement_id and f.kind = 'attachment' and f.featured),
       'import'
  from landed l
 where nullif(btrim(l.screenshot), '') is not null
   and not exists (select 1 from public.resources r
                    where r.cell_touchpoint_id = l.placement_id and r.url = btrim(l.screenshot));

do $proof$
declare
  bad int;
begin
  -- Before the table goes: every detail landed, and every url it carried
  -- is a resource on the placement it landed on.
  select count(*) into bad
    from landed l
   where not exists (select 1 from public.cell_touchpoints ct where ct.id = l.placement_id)
      or (nullif(btrim(l.url), '') is not null and not exists (
            select 1 from public.resources r
             where r.cell_touchpoint_id = l.placement_id and r.url = btrim(l.url)))
      or (nullif(btrim(l.screenshot), '') is not null and not exists (
            select 1 from public.resources r
             where r.cell_touchpoint_id = l.placement_id and r.url = btrim(l.screenshot)));
  if bad <> 0 then
    raise exception '% queued details did not fold with everything they carried', bad;
  end if;
end
$proof$;

drop function if exists public.place_touchpoint_detail(uuid, uuid);
drop function if exists public.discard_touchpoint_detail(uuid);
drop function if exists public.restore_touchpoint_detail(jsonb, jsonb);
drop table public.unplaced_touchpoint_details;

-- ── 3. The functions ──────────────────────────────────────────────────────

create or replace function public.sync_cell_touchpoints(p_cell_id uuid, p_names text[])
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_service_id uuid;
  v_lane_role  text;
  v_bearing    boolean;
  v_removed    jsonb;
  v_wanted     jsonb;
begin
  select ph.service_id, ln.lane_role
    into v_service_id, v_lane_role
    from public.cells c
    join public.lanes ln on ln.id = c.lane_id
    join public.paths p on p.id = c.path_id
    join public.scenarios s on s.id = p.scenario_id
    join public.phases ph on ph.id = s.phase_id
   where c.id = p_cell_id;

  if v_service_id is null then
    raise exception 'cell % is not attached to a service', p_cell_id;
  end if;

  select v_lane_role in ('frontstage_touchpoints', 'backstage_touchpoints')
         or exists (select 1 from public.cell_touchpoints where cell_id = p_cell_id)
    into v_bearing;

  if not v_bearing then
    return jsonb_build_object('skipped', true, 'removed', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'position', position)), '[]'::jsonb)
    into v_wanted
    from (
      select name, min(ord)::int as position
        from unnest(p_names) with ordinality as t(name, ord)
       where btrim(name) <> ''
       group by name
    ) deduped;

  insert into public.touchpoints (service_id, name, origin)
  select v_service_id, w.name, 'app'
    from jsonb_to_recordset(v_wanted) as w(name text, position int)
  on conflict (service_id, name) do nothing;

  -- A name typed back links the name-only row that was keeping its
  -- writing, rather than inserting a second row beside it.
  update public.cell_touchpoints ct
     set touchpoint_id = tp.id,
         name          = null,
         updated_at    = now()
    from jsonb_to_recordset(v_wanted) as w(name text, position int)
    join public.touchpoints tp
      on tp.service_id = v_service_id and tp.name = w.name
   where ct.cell_id = p_cell_id
     and ct.touchpoint_id is null
     and lower(ct.name) = lower(w.name)
     and not exists (select 1 from public.cell_touchpoints x
                      where x.cell_id = p_cell_id and x.touchpoint_id = tp.id);

  -- What leaves the text: linked rows whose name is not wanted. Handed back
  -- with everything on them, so the inverse can put the words back.
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', tp.name,
           'position', ct.position,
           'summary', ct.summary,
           'role', ct.role,
           'resources', (select coalesce(jsonb_agg(jsonb_build_object(
                             'kind', r.kind, 'name', r.name, 'url', r.url,
                             'position', r.position, 'featured', r.featured, 'origin', r.origin
                           ) order by r.position), '[]'::jsonb)
                           from public.resources r where r.cell_touchpoint_id = ct.id)
         )), '[]'::jsonb)
    into v_removed
    from public.cell_touchpoints ct
    join public.touchpoints tp on tp.id = ct.touchpoint_id
   where ct.cell_id = p_cell_id
     and tp.name not in (
       select w.name from jsonb_to_recordset(v_wanted) as w(name text, position int)
     );

  -- A removed placement with anything on it stays as a name-only row —
  -- words, role and resources intact, drawn dashed — unless the cell already
  -- keeps a name-only row under that name. One with nothing on it goes.
  update public.cell_touchpoints ct
     set touchpoint_id = null,
         name          = tp.name,
         updated_at    = now()
    from public.touchpoints tp
   where ct.touchpoint_id = tp.id
     and ct.cell_id = p_cell_id
     and tp.name not in (
       select w.name from jsonb_to_recordset(v_wanted) as w(name text, position int)
     )
     and (coalesce(btrim(ct.summary), '') <> ''
          or ct.role is not null
          or exists (select 1 from public.resources r where r.cell_touchpoint_id = ct.id))
     and not exists (select 1 from public.cell_touchpoints x
                      where x.cell_id = p_cell_id and x.name is not null
                        and lower(x.name) = lower(tp.name));

  delete from public.cell_touchpoints ct
   using public.touchpoints tp
   where ct.touchpoint_id = tp.id
     and ct.cell_id = p_cell_id
     and tp.name not in (
       select w.name from jsonb_to_recordset(v_wanted) as w(name text, position int)
     );

  update public.cell_touchpoints ct
     set position = w.position,
         updated_at = now()
    from public.touchpoints tp,
         jsonb_to_recordset(v_wanted) as w(name text, position int)
   where ct.touchpoint_id = tp.id
     and ct.cell_id = p_cell_id
     and tp.name = w.name
     and ct.position is distinct from w.position;

  -- Name-only rows sit after the text's own, in the order they had.
  update public.cell_touchpoints ct
     set position = ranked.position,
         updated_at = now()
    from (
      select x.id,
             (select coalesce(max(position), -1) from public.cell_touchpoints y
               where y.cell_id = p_cell_id and y.touchpoint_id is not null)
             + row_number() over (order by x.position, x.name) as position
        from public.cell_touchpoints x
       where x.cell_id = p_cell_id and x.touchpoint_id is null
    ) ranked
   where ct.id = ranked.id
     and ct.position is distinct from ranked.position;

  insert into public.cell_touchpoints (cell_id, touchpoint_id, position, origin)
  select p_cell_id, tp.id, w.position, 'app'
    from jsonb_to_recordset(v_wanted) as w(name text, position int)
    join public.touchpoints tp
      on tp.service_id = v_service_id and tp.name = w.name
   where not exists (
     select 1 from public.cell_touchpoints ct
      where ct.cell_id = p_cell_id and ct.touchpoint_id = tp.id
   );

  return jsonb_build_object('skipped', false, 'removed', v_removed);
end
$function$;

create or replace function public.restore_cell_touchpoints(p_cell_id uuid, p_rows jsonb)
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  -- By name, linked or name-only: the revert re-ran the sync first, so a
  -- row that was kept name-only is linked again by the time this runs.
  update public.cell_touchpoints ct
     set summary    = r.summary,
         role       = r.role,
         updated_at = now()
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
           as r(name text, summary text, role text)
    left join public.touchpoints tp on tp.name = r.name
   where ct.cell_id = p_cell_id
     and (ct.touchpoint_id = tp.id
          or (ct.touchpoint_id is null and lower(ct.name) = lower(r.name)));

  insert into public.resources
    (cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
  select p_cell_id, ct.id,
         coalesce(nullif(btrim(e.kind), ''), 'link'), e.name, e.url,
         coalesce(e.position, e.ord::int - 1), coalesce(e.featured, false),
         coalesce(nullif(btrim(e.origin), ''), 'app')
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
           as r(name text, resources jsonb)
    left join public.touchpoints tp on tp.name = r.name
    join public.cell_touchpoints ct
      on ct.cell_id = p_cell_id
     and (ct.touchpoint_id = tp.id
          or (ct.touchpoint_id is null and lower(ct.name) = lower(r.name))),
         lateral (
           select x.kind, x.name, x.url, x.position, x.featured, x.origin, x.ord
             from rows from (
                    jsonb_to_recordset(coalesce(r.resources, '[]'::jsonb))
                      as (kind text, name text, url text, position int, featured boolean, origin text)
                  ) with ordinality as x(kind, name, url, position, featured, origin, ord)
         ) e
   where nullif(btrim(e.url), '') is not null
     and not exists (select 1 from public.resources have where have.cell_touchpoint_id = ct.id);
end
$function$;

create or replace function public.set_placement_touchpoint(
  p_placement_id uuid,
  p_touchpoint_id uuid default null,
  p_name text default null
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_row public.cell_touchpoints;
  v_service_id uuid;
begin
  if (p_touchpoint_id is null) = (nullif(btrim(coalesce(p_name, '')), '') is null) then
    raise exception 'a placement names its touchpoint one way: a registry id or a name';
  end if;

  select ct.* into v_row from public.cell_touchpoints ct where ct.id = p_placement_id for update;
  if v_row.id is null then
    raise exception 'placement % does not exist', p_placement_id;
  end if;

  if p_touchpoint_id is not null then
    select ph.service_id into v_service_id
      from public.cells c
      join public.paths p on p.id = c.path_id
      join public.scenarios s on s.id = p.scenario_id
      join public.phases ph on ph.id = s.phase_id
     where c.id = v_row.cell_id;
    if not exists (select 1 from public.touchpoints tp
                    where tp.id = p_touchpoint_id and tp.service_id = v_service_id) then
      raise exception 'that touchpoint is not in this service''s registry';
    end if;
    if exists (select 1 from public.cell_touchpoints x
                where x.cell_id = v_row.cell_id and x.touchpoint_id = p_touchpoint_id and x.id <> v_row.id) then
      raise exception 'that cell already shows that touchpoint';
    end if;
  end if;

  update public.cell_touchpoints
     set touchpoint_id = p_touchpoint_id,
         name          = case when p_touchpoint_id is null then btrim(p_name) end,
         updated_at    = now()
   where id = p_placement_id;

  return jsonb_build_object('touchpoint_id', v_row.touchpoint_id, 'name', v_row.name);
end
$function$;

create or replace function public.remove_placement(p_placement_id uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_row       jsonb;
  v_resources jsonb;
begin
  select to_jsonb(ct) into v_row from public.cell_touchpoints ct where ct.id = p_placement_id for update;
  if v_row is null then
    raise exception 'placement % does not exist', p_placement_id;
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.position), '[]'::jsonb)
    into v_resources
    from public.resources r where r.cell_touchpoint_id = p_placement_id;

  delete from public.cell_touchpoints where id = p_placement_id;

  return jsonb_build_object('row', v_row, 'resources', v_resources);
end
$function$;

create or replace function public.restore_placement(p_row jsonb, p_resources jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  insert into public.cell_touchpoints
    (id, cell_id, touchpoint_id, name, position, summary, role, origin, created_at)
  select r.id, r.cell_id, r.touchpoint_id, r.name,
         -- Its old position if free, else after everything the cell shows.
         case when exists (select 1 from public.cell_touchpoints x
                            where x.cell_id = r.cell_id and x.position = r.position)
              then (select coalesce(max(position), -1) + 1 from public.cell_touchpoints x
                     where x.cell_id = r.cell_id)
              else r.position end,
         r.summary, r.role, coalesce(r.origin, 'app'), coalesce(r.created_at, now())
    from jsonb_to_record(p_row)
      as r(id uuid, cell_id uuid, touchpoint_id uuid, name text, position int,
           summary text, role text, origin text, created_at timestamptz)
  returning id into v_id;

  if v_id is null then
    raise exception 'the captured placement could not be restored';
  end if;

  insert into public.resources
    (id, cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
  select coalesce(e.id, gen_random_uuid()), (p_row ->> 'cell_id')::uuid, v_id,
         coalesce(nullif(btrim(e.kind), ''), 'link'), e.name, e.url,
         coalesce(e.position, e.ord::int - 1), coalesce(e.featured, false),
         coalesce(nullif(btrim(e.origin), ''), 'app')
    from rows from (
           jsonb_to_recordset(coalesce(p_resources, '[]'::jsonb))
             as (id uuid, kind text, name text, url text, position int, featured boolean, origin text)
         ) with ordinality as e(id, kind, name, url, position, featured, origin, ord)
   where nullif(btrim(e.url), '') is not null;

  return jsonb_build_object('placement_id', v_id);
end
$function$;

revoke execute on function public.set_placement_touchpoint(uuid, uuid, text) from public, anon;
revoke execute on function public.remove_placement(uuid) from public, anon;
revoke execute on function public.restore_placement(jsonb, jsonb) from public, anon;
grant execute on function public.set_placement_touchpoint(uuid, uuid, text) to authenticated;
grant execute on function public.remove_placement(uuid) to authenticated;
grant execute on function public.restore_placement(jsonb, jsonb) to authenticated;

comment on function public.sync_cell_touchpoints(uuid, text[]) is
  'Brings a cell''s placements into line with its text. A name typed back links the name-only row; a removed placement with anything on it becomes name-only, one with nothing is deleted.';
comment on function public.restore_cell_touchpoints(uuid, jsonb) is
  'The inverse of a sync: summary and role back by name, linked or name-only; resources re-created for a row that has none.';
comment on function public.set_placement_touchpoint(uuid, uuid, text) is
  'Names a placement''s touchpoint one way — a registry id, or a name the registry lacks — and returns the previous pair for the inverse.';
comment on function public.remove_placement(uuid) is
  'Deletes one placement and returns the row and its resources for restore_placement.';
comment on function public.restore_placement(jsonb, jsonb) is
  'The inverse of remove_placement: the row back under its own id, resources included.';

comment on table public.cell_touchpoints is
  'One touchpoint used at one cell: its own summary and role at this moment. Named by touchpoint_id into the registry, or by name alone when the registry lacks it. What it points at is in resources.';

-- ── Proof ──────────────────────────────────────────────────────────────────
do $proof$
declare
  bad int;
begin
  if to_regclass('public.unplaced_touchpoint_details') is not null then
    raise exception 'unplaced_touchpoint_details still exists';
  end if;
  select count(*) into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('place_touchpoint_detail', 'discard_touchpoint_detail', 'restore_touchpoint_detail');
  if bad <> 0 then
    raise exception '% queue functions survived the table', bad;
  end if;
  select 5 - count(*) into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('sync_cell_touchpoints', 'restore_cell_touchpoints',
                       'set_placement_touchpoint', 'remove_placement', 'restore_placement');
  if bad <> 0 then
    raise exception '% of the five placement functions are missing', bad;
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.cell_touchpoints'::regclass
                    and conname = 'cell_touchpoints_one_identity') then
    raise exception 'cell_touchpoints has no one-identity check';
  end if;
  select count(*) into bad from public.cell_touchpoints
   where (touchpoint_id is null) = (name is null);
  if bad <> 0 then
    raise exception '% placements name their touchpoint both ways or neither', bad;
  end if;
end
$proof$;
