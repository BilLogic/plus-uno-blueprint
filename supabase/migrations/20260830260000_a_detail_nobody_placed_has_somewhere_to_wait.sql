-- Fifty-seven authored details name a touchpoint their cell does not show.
--
-- An author wrote a description, attached a screenshot, and saved. The detail
-- went into `cells.links` as a `tech_description` entry keyed by a label, and
-- the app looked it up by matching that label against the words in the same
-- cell's text. When the two stopped agreeing the lookup returned nothing, the
-- panel showed nothing, and nothing anywhere said so. `20260830140000` carried
-- the 60 details that still resolved into `cell_touchpoints` and left these
-- behind deliberately, because placing them means deciding where they belong
-- and guessing is what produced them.
--
-- ── Why they get a table rather than staying where they are ───────────────
--
-- #181 dissolves `cells.links` into a `resources` table and DROPS the column.
-- Under 57 orphans that turns "unreachable" into "gone", so its migration
-- refuses to run while any orphaned `tech_description` entry is still in the
-- column. That makes this file the unblocker, and it settles the shape of it:
-- a queue that read the column would die the moment #181 landed, so the
-- details move OUT of the column into a home of their own and the queue reads
-- from there. After this file the column holds resources and the 60 resolved
-- details; #181 can then move both and drop it without knowing this table
-- exists.
--
-- The two tickets therefore run in this order and only this order. If #181 is
-- reverted, nothing here is affected: this table does not reference `links`,
-- and the details in it are already out.
--
-- ── What the table is, and what it is not ─────────────────────────────────
--
-- It is not a second placement table. A placement is a touchpoint used at a
-- cell and the board DRAWS it; a row here is a piece of writing waiting for
-- somebody to say which touchpoint it is about, and nothing draws it. That is
-- the whole distinction, and it is why the two cannot share a table: a row
-- here has no `touchpoint_id` to give, because the name it carries matches no
-- catalog entry the cell displays. `Workday (Employee View)`,
-- `Workday (Employer View)` and `Handshake Employer Profile` are three of
-- them — variant spellings that exist only as labels, never as cell text, so
-- `20260830140000` could not collapse them and did not try.
--
-- Nothing in this file places anything. The queue lists; a person decides.

create table public.unplaced_touchpoint_details (
  id         uuid primary key default gen_random_uuid(),
  -- The cell the detail was written on. That is the one fact about it that
  -- was never in doubt, and it is what makes triage possible: the author sees
  -- the moment beside the words and can say which pill they meant.
  cell_id    uuid not null references public.cells (id) on delete cascade,
  -- The touchpoint name the detail CLAIMS — not a name it owns. It matched no
  -- item of its cell's text, which is the entire reason the row is here. No
  -- non-empty check: a `tech_description` entry with no label at all is
  -- orphaned by the same predicate as the rest and needs the same home, and
  -- refusing it would leave it in the column for #181 to trip over.
  name       text not null,
  summary    text,
  screenshot text,
  url        text,
  prominence text check (prominence in ('core','peripheral')),
  origin     text not null check (origin in ('import','app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The sheet reads the queue whole, which is a small scan and needs nothing.
-- This index is for the three per-cell reads that are not the sheet: the
-- cascade from `cells`, the delete `restore_cell_touchpoints` issues on the
-- revert path, and the sync's own writes.
create index unplaced_touchpoint_details_cell_id_idx
  on public.unplaced_touchpoint_details (cell_id);

comment on table public.unplaced_touchpoint_details is
  'Touchpoint detail whose name matches nothing its cell shows. A work queue: '
  'an author places each row on a touchpoint the cell actually displays, or '
  'discards it. Nothing here is drawn, and nothing places itself.';
comment on column public.unplaced_touchpoint_details.name is
  'The touchpoint name the detail claims. It named nothing in its cell, which '
  'is why the row exists.';

-- ── Access, the shape `cell_touchpoints` already has ──────────────────────
--
-- Including the anon SELECT, and that is a decision rather than a copy. This
-- prose is not new material: every row of it was in `cells.links` an hour ago,
-- on a table anon already reads, and the resolving half of the same authored
-- text sits in `cell_touchpoints.summary` which anon also reads. Withholding
-- it here would hide nothing and would make the queue unreadable in the one
-- state a reader most needs it — a board opened without a session.

alter table public.unplaced_touchpoint_details enable row level security;

create policy unplaced_touchpoint_details_select_anon
  on public.unplaced_touchpoint_details for select to anon using (true);
create policy unplaced_touchpoint_details_select_auth
  on public.unplaced_touchpoint_details for select to authenticated using (true);
create policy unplaced_touchpoint_details_insert_service_only
  on public.unplaced_touchpoint_details for insert to authenticated
  with check (public.is_service_account());
create policy unplaced_touchpoint_details_update_service_only
  on public.unplaced_touchpoint_details for update to authenticated
  using (public.is_service_account())
  with check (public.is_service_account());
create policy unplaced_touchpoint_details_delete_service_only
  on public.unplaced_touchpoint_details for delete to authenticated
  using (public.is_service_account());

grant select on public.unplaced_touchpoint_details to anon, authenticated;
grant insert, delete on public.unplaced_touchpoint_details to authenticated;
-- Ids, foreign keys and timestamps are the database's business; the writing is
-- the author's. Same split as `cell_touchpoints`.
grant update (name, summary, screenshot, url, prominence)
  on public.unplaced_touchpoint_details to authenticated;
-- The platform grants anon these at create time. Nothing anonymous writes.
revoke insert, update, delete, truncate
  on public.unplaced_touchpoint_details from anon;

-- ── The move ──────────────────────────────────────────────────────────────
--
-- One statement, so the insert and the removal see the same set. A predicate
-- written twice is a predicate that drifts, and the two halves disagreeing
-- would either lose a detail or leave one behind for #181 to refuse.
--
-- Orphaned means: a `tech_description` entry whose label is not one of the
-- items of its own cell's text. `E'[\n,]'` and the blank filter are the
-- splitting rule `parseCellContentItems` uses in the app and
-- `20260830140000` used to build the placements; a third spelling of it here
-- would move a different set than the one the board considers resolved.

with orphan as (
  select c.id as cell_id, entry.ord, entry.value as link
    from public.cells c
    cross join lateral jsonb_array_elements(c.links)
      with ordinality as entry(value, ord)
   where entry.value ->> 'type' = 'tech_description'
     and not exists (
       select 1
         from unnest(regexp_split_to_array(c.content, E'[\n,]')) as item
        where btrim(item) <> ''
          and btrim(item) = btrim(coalesce(entry.value ->> 'label', ''))
     )
),
parked as (
  insert into public.unplaced_touchpoint_details
    (cell_id, name, summary, screenshot, url, origin)
  select o.cell_id,
         btrim(coalesce(o.link ->> 'label', '')),
         o.link ->> 'description',
         -- `picture`, singular: the same field `20260830140000` read for the
         -- details that resolved. A link carrying a `pictures` array keeps its
         -- first, which is what the fallback normalizer shows too.
         coalesce(o.link ->> 'picture', o.link -> 'pictures' ->> 0),
         o.link ->> 'url',
         'import'
    from orphan o
)
update public.cells c
   set links = (
     select coalesce(jsonb_agg(entry.value order by entry.ord), '[]'::jsonb)
       from jsonb_array_elements(c.links) with ordinality as entry(value, ord)
      where not exists (
        select 1 from orphan o where o.cell_id = c.id and o.ord = entry.ord
      )
   )
 where exists (select 1 from orphan o where o.cell_id = c.id);

-- ── The queue has to keep filling itself ──────────────────────────────────
--
-- A migration that emptied the column and stopped there would fix 57 details
-- and start losing the next one on the next save. `sync_cell_touchpoints`
-- brings a cell's placements into line with the text just typed, and REMOVAL
-- is one of the things it does: take a name out of the cell and the placement
-- goes, taking its summary, screenshot and url with it. That is a newly
-- created orphan, and until now it went nowhere.
--
-- It was not silent — the removed rows come back to the caller and go into the
-- inverse the session ledger records — but that ledger is in memory and a
-- refresh empties it. So the writing survived exactly as long as the tab did.
-- Here it goes somewhere durable instead, and the ledger keeps its inverse.
--
-- Only rows carrying WRITING are parked. A placement with no summary, no
-- screenshot and no url is a pill and nothing else; queueing it would fill the
-- author's list with rows that say nothing about anything. `prominence` alone
-- does not count for the same reason: core-or-peripheral is meaningless
-- without the words it qualifies.
--
-- The rest of the function is `20260830160000` unchanged, restated because
-- `create or replace` takes a whole body.

create or replace function public.sync_cell_touchpoints(
  p_cell_id uuid,
  p_names   text[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public
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

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', tp.name,
           'position', ct.position,
           'summary', ct.summary,
           'screenshot', ct.screenshot,
           'url', ct.url,
           'prominence', ct.prominence
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
    (cell_id, name, summary, screenshot, url, prominence, origin)
  select p_cell_id, r.name, r.summary, r.screenshot, r.url, r.prominence, 'app'
    from jsonb_to_recordset(v_removed)
      as r(name text, position int, summary text, screenshot text,
           url text, prominence text)
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

-- ── And taking the save back has to empty it again ────────────────────────
--
-- `restore_cell_touchpoints` is what the ledger's inverse calls: the names are
-- back because the text is back, and it puts the writing back onto them. With
-- the parking above in place it has a second job, or the detail ends up in two
-- places at once — on the placement AND still queued as unplaced, which reads
-- to the author as work left to do that is already done.
--
-- Only the rows this sync parked (`origin = 'app'`) are cleared. An `import`
-- row bearing the same name is one of the 57, and it is not this revert's to
-- resolve.

create or replace function public.restore_cell_touchpoints(
  p_cell_id uuid,
  p_rows    jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $function$
begin
  update public.cell_touchpoints ct
     set summary    = r.summary,
         screenshot = r.screenshot,
         url        = r.url,
         prominence = r.prominence,
         updated_at = now()
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
           as r(name text, summary text, screenshot text, url text, prominence text),
         public.touchpoints tp
   where ct.touchpoint_id = tp.id
     and ct.cell_id = p_cell_id
     and tp.name = r.name;

  delete from public.unplaced_touchpoint_details u
   using jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
           as r(name text, summary text, screenshot text, url text, prominence text)
   where u.cell_id = p_cell_id
     and u.origin = 'app'
     and u.name = r.name;
end
$function$;

-- ── Placing one, and discarding one ───────────────────────────────────────
--
-- Two operations and one inverse, all three in the database rather than in the
-- client, for the reason `20260830160000` gives at length: PostgREST hands
-- every statement its own transaction, and both of these are two statements
-- that must not half-happen. Placing writes the detail onto a placement and
-- then removes it from the queue; if the second half failed on its own the
-- author would see the words in two places and could not tell which was real.
--
-- THE REFUSAL IS THE POINT OF THE WHOLE TICKET. `place_touchpoint_detail`
-- will not create a placement. It writes onto one that is already there, and
-- raises when the cell does not display the touchpoint asked for. Creating one
-- would put a tool on a cell whose text does not name it — a pill that appears
-- from nowhere and that the next content save deletes again — and that is the
-- guess that produced these 57 in the first place.

create or replace function public.place_touchpoint_detail(
  p_detail_id    uuid,
  p_touchpoint_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
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
           'prominence', ct.prominence
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
         prominence = coalesce(v_detail.prominence, ct.prominence),
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

create or replace function public.discard_touchpoint_detail(p_detail_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_detail public.unplaced_touchpoint_details;
begin
  delete from public.unplaced_touchpoint_details
   where id = p_detail_id
  returning * into v_detail;

  if v_detail.id is null then
    raise exception 'no unplaced touchpoint detail % is waiting', p_detail_id;
  end if;

  return jsonb_build_object('detail', to_jsonb(v_detail));
end
$function$;

-- The inverse of both, because both destroy the queue row and one of them
-- also overwrites a placement. Keyed on the detail's OWN id, so replaying it
-- puts back the row that went rather than one that merely looks like it.

create or replace function public.restore_touchpoint_detail(
  p_detail    jsonb,
  p_placement jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_id uuid;
begin
  insert into public.unplaced_touchpoint_details
    (id, cell_id, name, summary, screenshot, url, prominence, origin, created_at)
  select d.id, d.cell_id, d.name, d.summary, d.screenshot, d.url, d.prominence,
         d.origin, coalesce(d.created_at, now())
    from jsonb_to_record(p_detail)
      as d(id uuid, cell_id uuid, name text, summary text, screenshot text,
           url text, prominence text, origin text, created_at timestamptz)
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
           prominence = p.prominence,
           updated_at = now()
      from jsonb_to_record(p_placement)
        as p(cell_id uuid, touchpoint_id uuid, summary text, screenshot text,
             url text, prominence text)
     where ct.cell_id = p.cell_id
       and ct.touchpoint_id = p.touchpoint_id;
  end if;

  return jsonb_build_object('detail_id', v_id);
end
$function$;

grant execute on function public.place_touchpoint_detail(uuid, uuid) to authenticated;
grant execute on function public.discard_touchpoint_detail(uuid) to authenticated;
grant execute on function public.restore_touchpoint_detail(jsonb, jsonb) to authenticated;

-- ── Prove it ──────────────────────────────────────────────────────────────
--
-- Invariants, never a census. `docs/reference/migration-replay-baseline.json`
-- is explicit that a migration which cannot replay against an empty database
-- has not been tested by anything, and asserting "57" would fail every empty
-- replay forever while saying nothing on any database but today's.

do $do$
declare
  v_left int;
begin
  -- The condition #181 refuses to run under. After this file the column
  -- carries resources and the details that resolve, and nothing that names
  -- something its cell does not show.
  select count(*) into v_left
    from public.cells c
    cross join lateral jsonb_array_elements(c.links) as entry
   where entry ->> 'type' = 'tech_description'
     and not exists (
       select 1
         from unnest(regexp_split_to_array(c.content, E'[\n,]')) as item
        where btrim(item) <> ''
          and btrim(item) = btrim(coalesce(entry ->> 'label', ''))
     );
  if v_left <> 0 then
    raise exception
      '% orphaned tech_description entries are still in cells.links, and #181 would drop the column over them',
      v_left;
  end if;
end
$do$;

do $do$
declare
  v_resolving int;
  v_placed int;
begin
  -- The other half of the same move: only the orphans left. A detail whose
  -- label IS an item of its cell's text is one of the 60 `20260830140000`
  -- carried, and #181 is what moves those.
  select count(*) into v_resolving
    from public.unplaced_touchpoint_details u
    join public.cells c on c.id = u.cell_id
   where u.origin = 'import'
     and exists (
       select 1
         from unnest(regexp_split_to_array(c.content, E'[\n,]')) as item
        where btrim(item) <> '' and btrim(item) = u.name
     );
  if v_resolving <> 0 then
    raise exception
      '% details that DID resolve were parked as unplaced', v_resolving;
  end if;

  -- Nothing was placed. This is the acceptance criterion stated as a shape
  -- rather than as a promise: were any row here also a placement on its own
  -- cell, this migration would have made the guess it exists to refuse.
  select count(*) into v_placed
    from public.unplaced_touchpoint_details u
   where exists (
     select 1
       from public.cell_touchpoints ct
       join public.touchpoints tp on tp.id = ct.touchpoint_id
      where ct.cell_id = u.cell_id and tp.name = u.name
   );
  if v_placed <> 0 then
    raise exception '% unplaced details were placed by this migration', v_placed;
  end if;
end
$do$;

-- ── Prove the queue keeps filling, and that placing refuses to guess ──────
--
-- Against the real functions on a real cell, because that is where the last
-- three defects in this area lived: the plan was right each time and only its
-- application failed.
--
-- The cell is BORROWED, and per `scripts/check-proof-footprint.mjs` a block
-- that borrows must give back. The probes are appended to the cell's own text
-- and the wanted list is derived from that text, so every name the cell
-- already carries is in every list the sync sees and nothing of anyone's is
-- displaced; the text goes back at the end, and the counts are asserted.

do $do$
declare
  v_cell    uuid;
  v_content text;
  v_staged  text;
  v_target  text := 'ZZ Unplaced Target';
  v_orphan  text := 'ZZ Unplaced Orphan';
  v_blank   text := 'ZZ Unplaced Blank';
  v_names   text[];
  v_detail  uuid;
  v_tp_target uuid;
  v_tp_blank  uuid;
  v_summary text;
  v_shot    text;
  v_refused boolean := false;
  v_payload jsonb;
  v_before  jsonb;
  v_catalog uuid[];
  v_queue_before int;
  v_place_before int;
  v_queue_after  int;
  v_place_after  int;
  v_catalog_after int;
begin
  select c.id, c.content into v_cell, v_content
    from public.cells c
    join public.lanes ln on ln.id = c.lane_id
   where ln.lane_role in ('frontstage_touchpoints', 'backstage_touchpoints')
   order by exists (
     select 1 from public.cell_touchpoints ct where ct.cell_id = c.id
   ), c.id
   limit 1;

  if v_cell is null then
    raise notice
      'no touchpoint cell exists, so the unplaced-detail proof has nothing to run against';
    return;
  end if;

  select count(*) into v_queue_before
    from public.unplaced_touchpoint_details where cell_id = v_cell;
  select count(*) into v_place_before
    from public.cell_touchpoints where cell_id = v_cell;

  -- Everything the cell holds before the probes, kept by touchpoint id rather
  -- than by name — the restore has to put back the same rows, not rows that
  -- merely spell the same. Appending probes to the text displaces nothing, so
  -- this snapshot is belt and braces for the text half; it is load-bearing for
  -- the last statement in this block, which puts the placements back rather
  -- than re-deriving them from the restored text. Re-deriving looks equivalent
  -- and is not: on a cell whose placements do not already agree with its text,
  -- it MINTS placements this proof was never given, and the assertion at the
  -- bottom caught exactly that.
  select coalesce(jsonb_agg(jsonb_build_object(
           'touchpoint_id', ct.touchpoint_id,
           'position',      ct.position,
           'summary',       ct.summary,
           'screenshot',    ct.screenshot,
           'url',           ct.url,
           'prominence',    ct.prominence,
           'origin',        ct.origin
         )), '[]'::jsonb)
    into v_before
    from public.cell_touchpoints ct
   where ct.cell_id = v_cell;

  -- The catalog as found. A sync mints a catalog row for any name it is
  -- handed that the service has not seen, which for the probes is the point
  -- and for the cell's own names is normally a no-op — normally, because in
  -- production every content item already has one. Recording the before-set
  -- means the cleanup can be exact rather than relying on that.
  select coalesce(array_agg(id), '{}') into v_catalog from public.touchpoints;

  -- The author types three tools into the cell and saves.
  v_staged := case when btrim(v_content) = '' then '' else v_content || ', ' end
              || v_target || ', ' || v_orphan || ', ' || v_blank;
  update public.cells set content = v_staged where id = v_cell;
  select array_agg(btrim(item) order by ord) into v_names
    from public.cells c,
         unnest(regexp_split_to_array(c.content, E'[\n,]')) with ordinality as t(item, ord)
   where c.id = v_cell and btrim(item) <> '';
  perform public.sync_cell_touchpoints(v_cell, v_names);

  -- And writes about one of them. This is the per-moment detail the whole
  -- ticket exists to stop losing.
  update public.cell_touchpoints ct
     set summary = 'What this tool does at THIS moment',
         screenshot = 'https://example.invalid/shot.png'
    from public.touchpoints tp
   where tp.id = ct.touchpoint_id
     and ct.cell_id = v_cell
     and tp.name = v_orphan;

  -- Then takes two of them out again and saves. Before this file, the writing
  -- went with them and the only record was in the tab.
  v_staged := case when btrim(v_content) = '' then '' else v_content || ', ' end || v_target;
  update public.cells set content = v_staged where id = v_cell;
  select array_agg(btrim(item) order by ord) into v_names
    from public.cells c,
         unnest(regexp_split_to_array(c.content, E'[\n,]')) with ordinality as t(item, ord)
   where c.id = v_cell and btrim(item) <> '';
  perform public.sync_cell_touchpoints(v_cell, v_names);

  select id, summary, screenshot into v_detail, v_summary, v_shot
    from public.unplaced_touchpoint_details
   where cell_id = v_cell and name = v_orphan;
  if v_detail is null then
    raise exception 'a removed placement carrying writing did not reach the queue';
  end if;
  if v_summary is distinct from 'What this tool does at THIS moment'
     or v_shot is distinct from 'https://example.invalid/shot.png' then
    raise exception 'the queued detail did not carry the writing it was holding';
  end if;

  -- A pill with nothing written about it is not work; it is a name that went.
  if exists (
    select 1 from public.unplaced_touchpoint_details
     where cell_id = v_cell and name = v_blank
  ) then
    raise exception 'a placement with no writing was queued as work to do';
  end if;

  select id into v_tp_blank from public.touchpoints where name = v_blank;
  select ct.touchpoint_id into v_tp_target
    from public.cell_touchpoints ct
    join public.touchpoints tp on tp.id = ct.touchpoint_id
   where ct.cell_id = v_cell and tp.name = v_target;

  -- Placing it on a touchpoint the cell DOES show writes the words there and
  -- takes the row off the queue, in one go.
  perform public.place_touchpoint_detail(v_detail, v_tp_target);

  select summary, screenshot into v_summary, v_shot
    from public.cell_touchpoints
   where cell_id = v_cell and touchpoint_id = v_tp_target;
  if v_summary is distinct from 'What this tool does at THIS moment'
     or v_shot is distinct from 'https://example.invalid/shot.png' then
    raise exception 'placing the detail did not write it onto the placement';
  end if;
  if exists (select 1 from public.unplaced_touchpoint_details where id = v_detail) then
    raise exception 'the placed detail is still queued as unplaced';
  end if;

  -- And on one the cell does NOT show, it refuses. `ZZ Unplaced Blank` is in
  -- the catalog and no longer on this cell, which is exactly the shape of the
  -- 57: a name that exists somewhere and not here.
  insert into public.unplaced_touchpoint_details (cell_id, name, summary, origin)
  values (v_cell, 'ZZ Unplaced Refused', 'words with nowhere to go', 'app')
  returning id into v_detail;

  begin
    perform public.place_touchpoint_detail(v_detail, v_tp_blank);
  exception when others then
    v_refused := true;
  end;
  if not v_refused then
    raise exception
      'a detail was placed on a touchpoint the cell does not display, which is the guess that made the 57';
  end if;

  -- Discarding is destructive and therefore has an inverse, and the inverse
  -- puts back the same row rather than one that resembles it.
  v_payload := public.discard_touchpoint_detail(v_detail) -> 'detail';
  if exists (select 1 from public.unplaced_touchpoint_details where id = v_detail) then
    raise exception 'a discarded detail is still queued';
  end if;
  perform public.restore_touchpoint_detail(v_payload, null);
  if not exists (
    select 1 from public.unplaced_touchpoint_details
     where id = v_detail and name = 'ZZ Unplaced Refused'
  ) then
    raise exception 'the inverse of a discard did not put the row back';
  end if;

  -- Put the cell back exactly as it was found: the text, then the placements
  -- from the snapshot. Placements go before catalog rows, because
  -- `on delete restrict` refuses the other order.
  update public.cells set content = v_content where id = v_cell;

  delete from public.unplaced_touchpoint_details
   where cell_id = v_cell and name like 'ZZ Unplaced %';
  delete from public.cell_touchpoints where cell_id = v_cell;
  -- Every catalog row this block minted, named by the before-set rather than
  -- by a `like 'ZZ %'` pattern — which would have left behind the entries a
  -- sync creates for the cell's OWN names. The `not exists` is the guard that
  -- keeps this from ever touching a row somebody else is still using.
  delete from public.touchpoints tp
   where tp.id <> all (v_catalog)
     and not exists (
       select 1 from public.cell_touchpoints ct where ct.touchpoint_id = tp.id
     );

  insert into public.cell_touchpoints
    (cell_id, touchpoint_id, position, summary, screenshot, url, prominence, origin)
  select v_cell, b.touchpoint_id, b.position, b.summary, b.screenshot, b.url,
         b.prominence, b.origin
    from jsonb_to_recordset(v_before) as b(
           touchpoint_id uuid, position int, summary text, screenshot text,
           url text, prominence text, origin text);

  select count(*) into v_queue_after
    from public.unplaced_touchpoint_details where cell_id = v_cell;
  select count(*) into v_place_after
    from public.cell_touchpoints where cell_id = v_cell;
  select count(*) into v_catalog_after from public.touchpoints;
  if v_queue_after <> v_queue_before or v_place_after <> v_place_before then
    raise exception
      'the proof left the cell holding % queued and % placed, against % and % found',
      v_queue_after, v_place_after, v_queue_before, v_place_before;
  end if;
  if v_catalog_after <> coalesce(array_length(v_catalog, 1), 0) then
    raise exception
      'the proof left % catalog entries, against % found',
      v_catalog_after, coalesce(array_length(v_catalog, 1), 0);
  end if;
end
$do$;
