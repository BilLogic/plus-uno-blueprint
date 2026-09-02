-- A placement has a role.
--
-- `cell_touchpoints.prominence` said how much a touchpoint mattered, and that
-- is the wrong question: the column never held a degree of importance. It holds
-- WHAT THE TOUCHPOINT IS TO THIS MOMENT — the thing the step happens through
-- (`core`), or something merely present at it (`peripheral`) — and that is a
-- role, not a prominence. #264 settled the word; this file moves the schema
-- to it, in one batch, so no reader meets both spellings.
--
-- Two tables carry the column: the placement itself, and the queue of details
-- nobody has placed yet, which mirrors the placement's per-moment fields so a
-- placed detail can carry its judgement across. Both move together, with their
-- CHECK constraints, because a constraint that still says `prominence` is a
-- retired word in an identifier — exactly what `check:identifiers` exists to
-- find, and what it reported when the rename map gained this row before this
-- file existed.
--
-- The four function bodies below are the CURRENT definitions from
-- `pg_get_functiondef`, with the column and the JSON key renamed and nothing
-- else touched. The key matters as much as the column: `sync_cell_touchpoints`
-- hands the removed rows back to the caller under it, and `restore_cell_touchpoints`
-- and `restore_touchpoint_detail` read it back, so the app's inverse records
-- and this file have to agree on one spelling. `create or replace` keeps every
-- existing ACL, so nothing is re-granted here.
--
-- Nothing about the vocabulary changes: two words plus the null that means
-- nobody has judged this placement. Null still renders nothing.
--
-- ── Replaying against an empty database ───────────────────────────────────
--
-- The proof at the foot is an INVARIANT — no column and no function body in
-- `public` names the retired spelling, and both tables carry `role` under the
-- same two-word CHECK. It is true on an empty replay, where the tables exist
-- and hold no rows, and says something real on production.

alter table public.cell_touchpoints
  rename column prominence to role;
alter table public.cell_touchpoints
  rename constraint cell_touchpoints_prominence_check to cell_touchpoints_role_check;

alter table public.unplaced_touchpoint_details
  rename column prominence to role;
alter table public.unplaced_touchpoint_details
  rename constraint unplaced_touchpoint_details_prominence_check
    to unplaced_touchpoint_details_role_check;

comment on column public.cell_touchpoints.role is
  'What this touchpoint is to this moment: core (the step happens through '
  'it) or peripheral (present, but not what the step turns on), or null for '
  'the unmarked majority. Null is a state of its own and not a quiet '
  '"peripheral": it means nobody has judged this placement, so the panel '
  'renders nothing for it rather than a badge saying so. On the placement '
  'and not the catalog because the same artifact is central at one step and '
  'incidental at another.';

comment on column public.unplaced_touchpoint_details.role is
  'The role the detail claims for its touchpoint, carried until a person '
  'places it. The same two words as cell_touchpoints.role, and null when '
  'the detail says nothing about it.';

CREATE OR REPLACE FUNCTION public.sync_cell_touchpoints(p_cell_id uuid, p_names text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', tp.name,
           'position', ct.position,
           'summary', ct.summary,
           'screenshot', ct.screenshot,
           'url', ct.url,
           'role', ct.role
         )), '[]'::jsonb)
    into v_removed
    from public.cell_touchpoints ct
    join public.touchpoints tp on tp.id = ct.touchpoint_id
   where ct.cell_id = p_cell_id
     and tp.name not in (
       select w.name from jsonb_to_recordset(v_wanted) as w(name text, position int)
     );

  -- The new half. Before the delete, out of the same snapshot the caller
  -- gets, so the two can never describe different rows.
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

CREATE OR REPLACE FUNCTION public.restore_cell_touchpoints(p_cell_id uuid, p_rows jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  update public.cell_touchpoints ct
     set summary    = r.summary,
         screenshot = r.screenshot,
         url        = r.url,
         role       = r.role,
         updated_at = now()
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
           as r(name text, summary text, screenshot text, url text, role text),
         public.touchpoints tp
   where ct.touchpoint_id = tp.id
     and ct.cell_id = p_cell_id
     and tp.name = r.name;

  delete from public.unplaced_touchpoint_details u
   using jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
           as r(name text, summary text, screenshot text, url text, role text)
   where u.cell_id = p_cell_id
     and u.origin = 'app'
     and u.name = r.name;
end
$function$;

CREATE OR REPLACE FUNCTION public.place_touchpoint_detail(p_detail_id uuid, p_touchpoint_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_detail   public.unplaced_touchpoint_details;
  v_previous jsonb;
  v_name     text;
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

  select tp.name,
         jsonb_build_object(
           'summary',    ct.summary,
           'screenshot', ct.screenshot,
           'url',        ct.url,
           'role',       ct.role
         )
    into v_name, v_previous
    from public.cell_touchpoints ct
    join public.touchpoints tp on tp.id = ct.touchpoint_id
   where ct.cell_id = v_detail.cell_id
     and ct.touchpoint_id = p_touchpoint_id;

  if v_previous is null then
    raise exception
      'that cell does not show that touchpoint, so there is nothing to place the detail on';
  end if;

  -- Field by field, and only where the detail has something to say. A detail
  -- carrying words and no screenshot leaves the placement's screenshot alone;
  -- one carrying words over words replaces them, and the previous values go
  -- back to the caller so taking it back restores exactly what was there.
  update public.cell_touchpoints ct
     set summary    = coalesce(nullif(btrim(v_detail.summary), ''), ct.summary),
         screenshot = coalesce(nullif(btrim(v_detail.screenshot), ''), ct.screenshot),
         url        = coalesce(nullif(btrim(v_detail.url), ''), ct.url),
         role       = coalesce(v_detail.role, ct.role),
         updated_at = now()
   where ct.cell_id = v_detail.cell_id
     and ct.touchpoint_id = p_touchpoint_id;

  delete from public.unplaced_touchpoint_details where id = p_detail_id;

  return jsonb_build_object(
    'detail',         to_jsonb(v_detail),
    'cell_id',        v_detail.cell_id,
    'touchpoint_id',  p_touchpoint_id,
    'touchpoint_name', v_name,
    'previous',       v_previous
  );
end
$function$;

CREATE OR REPLACE FUNCTION public.restore_touchpoint_detail(p_detail jsonb, p_placement jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

  -- Only a place has a placement to put back; a discard passes null.
  if p_placement is not null and jsonb_typeof(p_placement) = 'object' then
    update public.cell_touchpoints ct
       set summary    = p.summary,
           screenshot = p.screenshot,
           url        = p.url,
           role       = p.role,
           updated_at = now()
      from jsonb_to_record(p_placement)
        as p(cell_id uuid, touchpoint_id uuid, summary text, screenshot text,
             url text, role text)
     where ct.cell_id = p.cell_id
       and ct.touchpoint_id = p.touchpoint_id;
  end if;

  return jsonb_build_object('detail_id', v_id);
end
$function$;

-- ── Proof ──────────────────────────────────────────────────────────────────
do $proof$
declare
  bad int;
begin
  -- 1. NO COLUMN IN `public` STILL SAYS PROMINENCE.
  select count(*) into bad
    from information_schema.columns
   where table_schema = 'public'
     and column_name = 'prominence';
  if bad <> 0 then
    raise exception '% column(s) still say prominence', bad;
  end if;

  -- 2. BOTH TABLES CARRY `role`, UNDER THE SAME TWO-WORD CHECK, AND THE
  --    CONSTRAINT IS NAMED FOR THE COLUMN IT CONSTRAINS.
  select count(*) into bad
    from pg_constraint c
   where c.contype = 'c'
     and c.conrelid in ('public.cell_touchpoints'::regclass,
                        'public.unplaced_touchpoint_details'::regclass)
     and c.conname in ('cell_touchpoints_role_check',
                       'unplaced_touchpoint_details_role_check')
     and pg_get_constraintdef(c.oid) like '%role%'
     and pg_get_constraintdef(c.oid) like '%core%'
     and pg_get_constraintdef(c.oid) like '%peripheral%';
  if bad <> 2 then
    raise exception 'expected two role CHECK constraints, found %', bad;
  end if;

  -- 3. NO FUNCTION BODY IN `public` NAMES THE RETIRED SPELLING — the four
  --    above were the only ones that did, and a body that still reads
  --    `ct.prominence` would fail at its first call rather than here.
  select count(*) into bad
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosrc ~* '\mprominence\M';
  if bad <> 0 then
    raise exception '% function bodies still say prominence', bad;
  end if;
end
$proof$;
