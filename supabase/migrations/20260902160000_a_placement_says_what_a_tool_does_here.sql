-- A placement says what a tool does here, and nothing else.
--
-- `cell_touchpoints` carried three things about one touchpoint at one cell:
-- its words (`summary`), its weight (`role`), and two URLs — `screenshot`
-- and `url` — that 20260902130000 already copied into `resources` as a
-- featured attachment and a featured link. Since then the panel has read the
-- resource and the editor has written the column, and #272 showed what that
-- costs: two homes for one fact, a dedupe in the presentation layer, and a
-- label ("Link") that had to explain which URL it meant.
--
-- This drops the two columns. A placement is summary + role; everything it
-- points at is a resource on it (#271, #273, #274).
--
-- ── Order of work ─────────────────────────────────────────────────────────
--
-- 1. Copy, again and idempotently. 20260902130000 copied every url and
--    screenshot that existed on 2026-09-02; anything typed into the columns
--    since is copied here, skipping a url the placement already has as a
--    resource. Proved before the drop, while both sides can still be read.
-- 2. The four functions that read or wrote the columns are rewritten so a
--    placement's per-moment writing is summary + role, and what it POINTS AT
--    travels with it as resources:
--      · `sync_cell_touchpoints` hands back a removed placement's resources
--        (all of them, in order) and parks the featured link and attachment
--        in the unplaced queue's `url` / `screenshot` — the queue keeps those
--        columns until #277 folds it in — so nothing an author attached is
--        lost when a name leaves the cell's text.
--      · `restore_cell_touchpoints` puts summary and role back by name and
--        re-creates the resources it was handed, for a placement that has
--        none — the placement was re-inserted by the same revert.
--      · `place_touchpoint_detail` writes summary and role onto the
--        placement, and turns the detail's url / screenshot into a featured
--        link / attachment when the placement has no resource at that url.
--        It reports which resources it added, so its inverse can remove
--        exactly those.
--      · `restore_touchpoint_detail` restores summary and role, and deletes
--        the resources the place added. A ledger entry recorded before this
--        migration carries `screenshot` and `url` in its placement payload;
--        `jsonb_to_record` reads the fields it is asked for, so such an
--        entry still restores summary and role.
-- 3. Drop the columns. Postgres drops their grants with them, so the panel's
--    column-grant list shrinks by two without a REVOKE.
--
-- ── Replaying against an empty database ───────────────────────────────────
--
-- Every statement is a schema change or an idempotent copy over whatever
-- rows exist; the proof is an INVARIANT — the columns are gone and none of
-- the four functions names them — not a census.

-- ── 1. Copy what the columns still hold ───────────────────────────────────

insert into public.resources
  (cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
select ct.cell_id, ct.id, 'link', tp.name, btrim(ct.url), 0,
       not exists (
         select 1 from public.resources f
          where f.cell_touchpoint_id = ct.id and f.kind = 'link' and f.featured
       ),
       'import'
  from public.cell_touchpoints ct
  join public.touchpoints tp on tp.id = ct.touchpoint_id
 where nullif(btrim(ct.url), '') is not null
   and not exists (
     select 1 from public.resources r
      where r.cell_touchpoint_id = ct.id and r.url = btrim(ct.url)
   );

insert into public.resources
  (cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
select ct.cell_id, ct.id, 'attachment', tp.name, btrim(ct.screenshot), 1,
       not exists (
         select 1 from public.resources f
          where f.cell_touchpoint_id = ct.id and f.kind = 'attachment' and f.featured
       ),
       'import'
  from public.cell_touchpoints ct
  join public.touchpoints tp on tp.id = ct.touchpoint_id
 where nullif(btrim(ct.screenshot), '') is not null
   and not exists (
     select 1 from public.resources r
      where r.cell_touchpoint_id = ct.id and r.url = btrim(ct.screenshot)
   );

do $proof$
declare
  missing int;
begin
  select count(*) into missing
    from public.cell_touchpoints ct
   where (nullif(btrim(ct.url), '') is not null
          and not exists (select 1 from public.resources r
                           where r.cell_touchpoint_id = ct.id and r.url = btrim(ct.url)))
      or (nullif(btrim(ct.screenshot), '') is not null
          and not exists (select 1 from public.resources r
                           where r.cell_touchpoint_id = ct.id and r.url = btrim(ct.screenshot)));
  if missing <> 0 then
    raise exception '% placements still hold a url or screenshot no resource carries', missing;
  end if;
end
$proof$;

-- ── 2. The functions ──────────────────────────────────────────────────────

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

  -- What a removed placement carried: its own words and weight, plus every
  -- resource on it in order (the revert re-creates them), plus the featured
  -- link and attachment by url for the unplaced queue, which still keeps a
  -- `url` and a `screenshot` until #277.
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', tp.name,
           'position', ct.position,
           'summary', ct.summary,
           'role', ct.role,
           'url', (select r.url from public.resources r
                    where r.cell_touchpoint_id = ct.id and r.kind = 'link' and r.featured
                    order by r.position limit 1),
           'screenshot', (select r.url from public.resources r
                           where r.cell_touchpoint_id = ct.id and r.kind = 'attachment' and r.featured
                           order by r.position limit 1),
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

  -- Parked before the delete, out of the same snapshot the caller gets, so
  -- the two can never describe different rows.
  insert into public.unplaced_touchpoint_details
    (cell_id, name, summary, screenshot, url, role, origin)
  select p_cell_id, r.name, r.summary, r.screenshot, r.url, r.role, 'app'
    from jsonb_to_recordset(v_removed)
      as r(name text, position int, summary text, screenshot text,
           url text, role text)
   where coalesce(btrim(r.summary), '') <> ''
      or coalesce(btrim(r.screenshot), '') <> ''
      or coalesce(btrim(r.url), '') <> '';

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
  update public.cell_touchpoints ct
     set summary    = r.summary,
         role       = r.role,
         updated_at = now()
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
           as r(name text, summary text, role text),
         public.touchpoints tp
   where ct.touchpoint_id = tp.id
     and ct.cell_id = p_cell_id
     and tp.name = r.name;

  -- The resources the placement carried, for a placement that has none —
  -- the one the same revert just re-inserted. A placement that still has
  -- its own is left alone rather than doubled.
  insert into public.resources
    (cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
  select p_cell_id, ct.id,
         coalesce(nullif(btrim(e.kind), ''), 'link'), e.name, e.url,
         coalesce(e.position, e.ord::int - 1), coalesce(e.featured, false),
         coalesce(nullif(btrim(e.origin), ''), 'app')
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
           as r(name text, resources jsonb),
         public.touchpoints tp,
         public.cell_touchpoints ct,
         lateral (
           select x.kind, x.name, x.url, x.position, x.featured, x.origin, x.ord
             from rows from (
                    jsonb_to_recordset(coalesce(r.resources, '[]'::jsonb))
                      as (kind text, name text, url text, position int, featured boolean, origin text)
                  ) with ordinality as x(kind, name, url, position, featured, origin, ord)
         ) e
   where tp.name = r.name
     and ct.touchpoint_id = tp.id
     and ct.cell_id = p_cell_id
     and nullif(btrim(e.url), '') is not null
     and not exists (select 1 from public.resources have where have.cell_touchpoint_id = ct.id);

  delete from public.unplaced_touchpoint_details u
   using jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
           as r(name text)
   where u.cell_id = p_cell_id
     and u.origin = 'app'
     and u.name = r.name;
end
$function$;

create or replace function public.place_touchpoint_detail(p_detail_id uuid, p_touchpoint_id uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_detail       public.unplaced_touchpoint_details;
  v_placement_id uuid;
  v_previous     jsonb;
  v_name         text;
  v_added        uuid[] := '{}';
  v_id           uuid;
begin
  -- Locked, because this reads the row and then deletes it. Two places
  -- landing on one detail would otherwise both write and both report a
  -- success, and the second inverse would restore a row that is already back.
  select * into v_detail
    from public.unplaced_touchpoint_details
   where id = p_detail_id
     for update;

  if v_detail.id is null then
    raise exception 'no unplaced touchpoint detail % is waiting', p_detail_id;
  end if;

  select ct.id, tp.name,
         jsonb_build_object('summary', ct.summary, 'role', ct.role)
    into v_placement_id, v_name, v_previous
    from public.cell_touchpoints ct
    join public.touchpoints tp on tp.id = ct.touchpoint_id
   where ct.cell_id = v_detail.cell_id
     and ct.touchpoint_id = p_touchpoint_id;

  if v_placement_id is null then
    raise exception
      'that cell does not show that touchpoint, so there is nothing to place the detail on';
  end if;

  -- Field by field, and only where the detail has something to say: words
  -- over words replace them, and the previous values go back to the caller
  -- so taking it back restores exactly what was there.
  update public.cell_touchpoints ct
     set summary    = coalesce(nullif(btrim(v_detail.summary), ''), ct.summary),
         role       = coalesce(v_detail.role, ct.role),
         updated_at = now()
   where ct.id = v_placement_id;

  -- What the detail pointed at becomes what the placement points at: a
  -- featured link, a featured attachment — unless the placement already
  -- has a resource at that url, or already leads with one of that kind.
  if nullif(btrim(v_detail.url), '') is not null and not exists (
       select 1 from public.resources r
        where r.cell_touchpoint_id = v_placement_id and r.url = btrim(v_detail.url)) then
    insert into public.resources
      (cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
    values (v_detail.cell_id, v_placement_id, 'link', v_name, btrim(v_detail.url),
            coalesce((select max(position) + 1 from public.resources
                       where cell_touchpoint_id = v_placement_id), 0),
            not exists (select 1 from public.resources f
                         where f.cell_touchpoint_id = v_placement_id and f.kind = 'link' and f.featured),
            'app')
    returning id into v_id;
    v_added := v_added || v_id;
  end if;

  if nullif(btrim(v_detail.screenshot), '') is not null and not exists (
       select 1 from public.resources r
        where r.cell_touchpoint_id = v_placement_id and r.url = btrim(v_detail.screenshot)) then
    insert into public.resources
      (cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
    values (v_detail.cell_id, v_placement_id, 'attachment', v_name, btrim(v_detail.screenshot),
            coalesce((select max(position) + 1 from public.resources
                       where cell_touchpoint_id = v_placement_id), 0),
            not exists (select 1 from public.resources f
                         where f.cell_touchpoint_id = v_placement_id and f.kind = 'attachment' and f.featured),
            'app')
    returning id into v_id;
    v_added := v_added || v_id;
  end if;

  delete from public.unplaced_touchpoint_details where id = p_detail_id;

  return jsonb_build_object(
    'detail',          to_jsonb(v_detail),
    'cell_id',         v_detail.cell_id,
    'touchpoint_id',   p_touchpoint_id,
    'touchpoint_name', v_name,
    'previous',        v_previous || jsonb_build_object('added_resources', to_jsonb(v_added))
  );
end
$function$;

create or replace function public.restore_touchpoint_detail(p_detail jsonb, p_placement jsonb default null::jsonb)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  insert into public.unplaced_touchpoint_details
    (id, cell_id, name, summary, screenshot, url, role, origin, created_at)
  select d.id, d.cell_id, d.name, d.summary, d.screenshot, d.url, d.role,
         d.origin, coalesce(d.created_at, now())
    from jsonb_to_record(p_detail)
      as d(id uuid, cell_id uuid, name text, summary text, screenshot text,
           url text, role text, origin text, created_at timestamptz)
  returning id into v_id;

  if v_id is null then
    raise exception 'the captured detail could not be restored';
  end if;

  -- Only a place has a placement to put back; a discard passes null. A
  -- payload recorded before 20260902160000 also carries `screenshot` and
  -- `url`; they are not asked for, so they are not read.
  if p_placement is not null and jsonb_typeof(p_placement) = 'object' then
    update public.cell_touchpoints ct
       set summary    = p.summary,
           role       = p.role,
           updated_at = now()
      from jsonb_to_record(p_placement)
        as p(cell_id uuid, touchpoint_id uuid, summary text, role text)
     where ct.cell_id = p.cell_id
       and ct.touchpoint_id = p.touchpoint_id;

    -- The resources the place added, and only those.
    delete from public.resources r
     where r.id in (
       select a::uuid from jsonb_array_elements_text(
         coalesce(p_placement -> 'added_resources', '[]'::jsonb)) as a
     );
  end if;

  return jsonb_build_object('detail_id', v_id);
end
$function$;

comment on function public.sync_cell_touchpoints(uuid, text[]) is
  'Brings a cell''s placements into line with its text. A removed placement comes back with its summary, role and resources; its featured link and attachment are parked in the unplaced queue.';
comment on function public.restore_cell_touchpoints(uuid, jsonb) is
  'The inverse of a sync: summary and role back by name, the placement''s resources re-created when it has none, the parked copy cleared.';
comment on function public.place_touchpoint_detail(uuid, uuid) is
  'Places a queued detail: summary and role onto the placement, its url and screenshot as a featured link and attachment. Reports the previous words and the resources it added.';
comment on function public.restore_touchpoint_detail(jsonb, jsonb) is
  'The inverse of a place or a discard: the detail back in the queue, the placement''s summary and role restored, the resources the place added removed.';

-- ── 3. The columns ────────────────────────────────────────────────────────

alter table public.cell_touchpoints
  drop column screenshot,
  drop column url;

comment on table public.cell_touchpoints is
  'One touchpoint used at one cell: its own summary and role at this moment. What it points at is in resources (cell_touchpoint_id).';

-- ── Proof ──────────────────────────────────────────────────────────────────
do $proof$
declare
  bad int;
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'cell_touchpoints'
       and column_name in ('screenshot', 'url')
  ) then
    raise exception 'cell_touchpoints still carries screenshot or url';
  end if;

  select count(*) into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('sync_cell_touchpoints', 'restore_cell_touchpoints',
                       'place_touchpoint_detail', 'restore_touchpoint_detail')
     and p.prosrc ~ 'ct\.(screenshot|url)\M';
  if bad <> 0 then
    raise exception '% placement functions still read cell_touchpoints.screenshot or .url', bad;
  end if;

  select 4 - count(*) into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('sync_cell_touchpoints', 'restore_cell_touchpoints',
                       'place_touchpoint_detail', 'restore_touchpoint_detail');
  if bad <> 0 then
    raise exception '% of the four placement functions are missing', bad;
  end if;
end
$proof$;
