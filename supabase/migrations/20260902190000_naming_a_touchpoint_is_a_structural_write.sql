-- Naming a placement's touchpoint is a structural write.
--
-- 20260902170000 let a placement name its touchpoint by `touchpoint_id` or
-- by `name`, and rewrote five functions to move rows between the two:
-- linking, unlinking, keeping a removed placement name-only, putting one
-- back. It left them SECURITY INVOKER — the posture their predecessors had
-- when all they wrote was `summary` and `role`, the columns a panel may
-- write. `touchpoint_id` and `name` are not among them, deliberately:
-- `authenticated` holds column UPDATE on summary, role, position and
-- updated_at and nothing else, because the grant is the whole of the
-- boundary between a panel and an RPC. So, as the caller, every one of the
-- five failed with "permission denied for table cell_touchpoints" the first
-- time the authoring session reached the new statements — the rehearsal had
-- run as the owner, which is the one role that could not see it.
--
-- The fix is the posture every other structural write has (20260902100000,
-- 20260902130000, 20260902140000): SECURITY DEFINER, `is_service_account()`
-- checked first, EXECUTE revoked from public and anon and granted to
-- authenticated. Bodies are otherwise 20260902170000's, unchanged.
--
-- ── Replaying against an empty database ───────────────────────────────────
--
-- Function definitions only. The proof is an INVARIANT: each of the five is
-- a definer and names the guard.

create or replace function public.sync_cell_touchpoints(p_cell_id uuid, p_names text[])
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_service_id uuid;
  v_lane_role  text;
  v_bearing    boolean;
  v_removed    jsonb;
  v_wanted     jsonb;
begin
  if not public.is_service_account() then
    raise exception 'only the service account names a placement''s touchpoint';
  end if;
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
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_service_account() then
    raise exception 'only the service account names a placement''s touchpoint';
  end if;
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
security definer
set search_path to 'public'
as $function$
declare
  v_row public.cell_touchpoints;
  v_service_id uuid;
begin
  if not public.is_service_account() then
    raise exception 'only the service account names a placement''s touchpoint';
  end if;
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
security definer
set search_path to 'public'
as $function$
declare
  v_row       jsonb;
  v_resources jsonb;
begin
  if not public.is_service_account() then
    raise exception 'only the service account names a placement''s touchpoint';
  end if;
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
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if not public.is_service_account() then
    raise exception 'only the service account names a placement''s touchpoint';
  end if;
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

revoke execute on function public.sync_cell_touchpoints(uuid, text[]) from public, anon;
grant execute on function public.sync_cell_touchpoints(uuid, text[]) to authenticated;
revoke execute on function public.restore_cell_touchpoints(uuid, jsonb) from public, anon;
grant execute on function public.restore_cell_touchpoints(uuid, jsonb) to authenticated;
revoke execute on function public.set_placement_touchpoint(uuid, uuid, text) from public, anon;
grant execute on function public.set_placement_touchpoint(uuid, uuid, text) to authenticated;
revoke execute on function public.remove_placement(uuid) from public, anon;
grant execute on function public.remove_placement(uuid) to authenticated;
revoke execute on function public.restore_placement(jsonb, jsonb) from public, anon;
grant execute on function public.restore_placement(jsonb, jsonb) to authenticated;

-- ── Proof ──────────────────────────────────────────────────────────────────
do $proof$
declare
  bad int;
begin
  select count(*) into bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('sync_cell_touchpoints', 'restore_cell_touchpoints',
                       'set_placement_touchpoint', 'remove_placement', 'restore_placement')
     and (not p.prosecdef or position('is_service_account()' in p.prosrc) = 0);
  if bad <> 0 then
    raise exception '% placement functions still run as the caller or skip the guard', bad;
  end if;
end
$proof$;
