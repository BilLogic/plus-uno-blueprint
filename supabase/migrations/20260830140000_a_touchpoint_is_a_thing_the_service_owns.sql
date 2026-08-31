-- A touchpoint stops being a word inside a cell's text.
--
-- Today a touchpoint is a name in `cells.content`, and its description and
-- screenshot are an entry in `cells.links` that finds its way back by matching
-- that name. There is no join but the string, so when the two stop agreeing
-- the detail is not found and nothing says so. Of 117 authored details, 57
-- currently resolve to nothing at all (#180 triages those; this migration
-- carries only the 60 that resolve).
--
-- Measured before writing this (2026-08-30, production):
--   308  placements — every content item on a touchpoint-bearing cell
--    92  distinct names among them
--    60  of the 117 tech_description links resolve to a name in their own cell
--    52  of those 60 carry a picture, 28 carry a url, all 60 carry a description
--     0  cells name the same touchpoint twice
--
-- ── What the two tables are for ────────────────────────────────────────────
--
-- `touchpoints` is the catalog: one row per real tool, document, channel or
-- artifact the service uses. The grid renders THIS name, so renaming "PLUS
-- App" once moves all 69 of its uses instead of 69 hand edits.
--
-- `cell_touchpoints` is the placement: this touchpoint, used at this cell,
-- this way. Its summary, screenshot and url differ per moment — two PLUS App
-- placements point at different Figma nodes and describe different screens —
-- and that is exactly the per-moment detail the string join kept losing.
--
-- ── Four deviations from the ticket's DDL, each forced by the data ─────────
--
-- 1. The placement carries `url`. The ticket's sketch had summary and
--    screenshot only, but 28 resolving links carry a Figma node URL that is
--    specific to that moment, not to the tool. Dropping the column would
--    discard 28 authored links, which is the same kind of silent loss this
--    ticket exists to end.
--
-- 2. `touchpoints.kind` defaults to 'other'. The ticket wants a touchpoint to
--    be classifiable as a document, a physical artifact or a channel, and the
--    column makes that possible. Classifying 92 names here would mean
--    guessing 89 times, and guessing is precisely how the 57 orphans came
--    about. The capability ships; the classification is an authoring task.
--
-- 3. A touchpoint-bearing cell is not only a cell on a touchpoint lane.
--    The first draft filtered on `lane_role in (frontstage_tech,
--    backstage_tech)` and its own assertion caught what that lost: four
--    resolving details — `Branding Guidelines`, `Design System`,
--    `Zoom Recording` — sit on SUPPORT ACTIONS cells. They are documents and
--    a recording, which is exactly what this ticket means by widening
--    "tech" to "touchpoint", and dropping them to a lane-role filter would
--    be the same silent loss the ticket exists to end.
--
--    So a cell is touchpoint-bearing if it sits on a touchpoint lane OR
--    carries any tech_description link, and then ALL of its content items
--    become placements. The alternative — migrating only the items that
--    happen to have detail — would leave a support cell half-modelled, with
--    one item a placement and its siblings still only text.
--
-- 4. Nothing collapses Workday or Handshake. The ticket asked for it on the
--    belief that the variant spellings were in cell content. They are not:
--    content holds only `Workday` and `Handshake`, and the variants
--    (`Workday (Employee View)`, `Workday (Employer View)`,
--    `Handshake Employer Profile`) exist ONLY as link labels — all three of
--    which are among the 57 that resolve to nothing. So the catalog built
--    from content is already collapsed, by construction, and the variants
--    are #180's to reattach to the entries this migration creates.

-- ── The catalog ────────────────────────────────────────────────────────────

create table public.touchpoints (
  id             uuid primary key default gen_random_uuid(),
  service_id     uuid not null references public.services (id) on delete cascade,
  name           text not null,
  -- Defaulted rather than guessed; see deviation 2 above.
  kind           text not null default 'other'
                   check (kind in ('app','document','physical','channel','service','other')),
  summary        text,
  url            text,
  -- The owning party. NOT declared inline, and the reason is at the bottom
  -- of this file under "the stakeholder reference".
  stakeholder_id uuid,
  origin         text not null check (origin in ('import','app')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (service_id, name)
);

-- ── The placement ──────────────────────────────────────────────────────────

create table public.cell_touchpoints (
  id            uuid primary key default gen_random_uuid(),
  cell_id       uuid not null references public.cells (id) on delete cascade,
  -- `restrict`, not `cascade`: deleting a catalog entry that is still placed
  -- somewhere should fail loudly rather than silently empty 69 cells.
  touchpoint_id uuid not null references public.touchpoints (id) on delete restrict,
  position      int  not null,
  summary       text,
  screenshot    text,
  url           text,
  prominence    text check (prominence in ('core','peripheral')),
  origin        text not null check (origin in ('import','app')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One row per touchpoint per cell. No cell names the same touchpoint twice
  -- today, so this costs nothing now and stops a duplicate later.
  unique (cell_id, touchpoint_id),
  -- Deferrable because reordering swaps two positions inside one transaction,
  -- and an immediate check fails halfway through the swap.
  constraint cell_touchpoints_cell_position_unique
    unique (cell_id, position) deferrable initially deferred
);

-- Without this, "where else is this touchpoint used" scans the whole table.
-- That query is the reason the catalog exists, so it gets its index here
-- rather than after someone notices the page is slow.
create index cell_touchpoints_touchpoint_id_idx
  on public.cell_touchpoints (touchpoint_id);

comment on table public.touchpoints is
  'Catalog of the tools, documents, channels and artifacts a service uses. '
  'One row per real thing; the grid renders this name, so a rename here moves '
  'every placement at once.';

comment on table public.cell_touchpoints is
  'One touchpoint, used at one cell. summary, screenshot and url are the '
  'per-moment detail — the same tool describes a different screen at a '
  'different step, which is what the old string join could not hold.';

-- ── Access, the same shape as every other root-scoped table ────────────────

alter table public.touchpoints enable row level security;
alter table public.cell_touchpoints enable row level security;

create policy touchpoints_select_anon on public.touchpoints
  for select to anon using (true);
create policy touchpoints_select_auth on public.touchpoints
  for select to authenticated using (true);
create policy touchpoints_insert_service_only on public.touchpoints
  for insert to authenticated with check (public.is_service_account());
create policy touchpoints_update_service_only on public.touchpoints
  for update to authenticated
  using (public.is_service_account())
  with check (public.is_service_account());
create policy touchpoints_delete_service_only on public.touchpoints
  for delete to authenticated using (public.is_service_account());

create policy cell_touchpoints_select_anon on public.cell_touchpoints
  for select to anon using (true);
create policy cell_touchpoints_select_auth on public.cell_touchpoints
  for select to authenticated using (true);
create policy cell_touchpoints_insert_service_only on public.cell_touchpoints
  for insert to authenticated with check (public.is_service_account());
create policy cell_touchpoints_update_service_only on public.cell_touchpoints
  for update to authenticated
  using (public.is_service_account())
  with check (public.is_service_account());
create policy cell_touchpoints_delete_service_only on public.cell_touchpoints
  for delete to authenticated using (public.is_service_account());

grant select on public.touchpoints to anon, authenticated;
grant insert, delete on public.touchpoints to authenticated;
grant select on public.cell_touchpoints to anon, authenticated;
grant insert, delete on public.cell_touchpoints to authenticated;

-- Column-level, per access-and-security.md: ids, foreign keys and timestamps
-- are the database's business, and #183 is the ticket that makes that true
-- of every table rather than only the ones that remembered.
grant update (name, kind, summary, url, stakeholder_id)
  on public.touchpoints to authenticated;
-- `stakeholder_id` is granted unconditionally even where the reference below
-- is skipped: a grant on a column that exists is valid whether or not the
-- column points anywhere, and withholding it on a replay would make the
-- grant surface differ between schemas for no reason a reader could use.
grant update (position, summary, screenshot, url, prominence)
  on public.cell_touchpoints to authenticated;

-- ── The catalog seed ───────────────────────────────────────────────────────
--
-- Every distinct name that appears as a pill on a touchpoint lane. Nothing is
-- invented: each row is a string already on the board.

insert into public.touchpoints (service_id, name, origin)
with bearing as (
  select c.id, c.content, c.links, ph.service_id
  from public.cells c
  join public.lanes ln on ln.id = c.lane_id
  join public.paths p on p.id = c.path_id
  join public.scenarios s on s.id = p.scenario_id
  join public.phases ph on ph.id = s.phase_id
  where ln.lane_role in ('frontstage_tech', 'backstage_tech')
     or exists (
       select 1 from jsonb_array_elements(c.links) l
       where l ->> 'type' = 'tech_description'
     )
)
select distinct bearing.service_id, trim(item), 'import'
from bearing
cross join lateral unnest(regexp_split_to_array(bearing.content, E'[\n,]')) as item
where trim(item) <> ''
on conflict (service_id, name) do nothing;

-- ── The placements ─────────────────────────────────────────────────────────
--
-- One row per content item, in the order the item appears in the cell, with
-- the detail joined on from the link that names it. `ordinality` is what
-- makes the order the author typed survive: without it the pills would come
-- back in whatever order the planner chose.
--
-- The lateral join to `links` is left, not inner: 244 of the 304 placements
-- have no authored detail at all and must still exist, because they are
-- pills on the board.

insert into public.cell_touchpoints
  (cell_id, touchpoint_id, position, summary, screenshot, url, origin)
with bearing as (
  select c.id, c.content, c.links, ph.service_id
  from public.cells c
  join public.lanes ln on ln.id = c.lane_id
  join public.paths p on p.id = c.path_id
  join public.scenarios s on s.id = p.scenario_id
  join public.phases ph on ph.id = s.phase_id
  where ln.lane_role in ('frontstage_tech', 'backstage_tech')
     or exists (
       select 1 from jsonb_array_elements(c.links) l
       where l ->> 'type' = 'tech_description'
     )
)
select
  bearing.id,
  tp.id,
  item.ord::int,
  detail.link ->> 'description',
  detail.link ->> 'picture',
  detail.link ->> 'url',
  'import'
from bearing
cross join lateral unnest(regexp_split_to_array(bearing.content, E'[\n,]'))
  with ordinality as item(value, ord)
join public.touchpoints tp
  on tp.service_id = bearing.service_id and tp.name = trim(item.value)
left join lateral (
  select l as link
  from jsonb_array_elements(bearing.links) l
  where l ->> 'type' = 'tech_description'
    and l ->> 'label' = trim(item.value)
  limit 1
) detail on true
where trim(item.value) <> ''
on conflict (cell_id, touchpoint_id) do nothing;

-- ── Prove it ───────────────────────────────────────────────────────────────
--
-- Invariants, not a census. This file has to replay against an empty
-- database, and `docs/reference/migration-replay-baseline.json` is explicit
-- that a new failing entry means "a migration written against an apply path
-- that does not work". Asserting 304 and 89 would fail every empty replay
-- forever, while asserting the RELATIONSHIPS is vacuously true on an empty
-- table and exactly as strong on production.

do $do$
declare
  unplaced int;
  detail_lost int;
begin
  -- Every pill on a touchpoint lane became a placement. This is the one that
  -- would catch a regexp that split differently than the app's parser does.
  select count(*) into unplaced
  from public.cells c
  join public.lanes ln on ln.id = c.lane_id
  cross join lateral unnest(regexp_split_to_array(c.content, E'[\n,]')) as item
  where (
      ln.lane_role in ('frontstage_tech', 'backstage_tech')
      or exists (
        select 1 from jsonb_array_elements(c.links) l
        where l ->> 'type' = 'tech_description'
      )
    )
    and trim(item) <> ''
    and not exists (
      select 1
      from public.cell_touchpoints ct
      join public.touchpoints tp on tp.id = ct.touchpoint_id
      where ct.cell_id = c.id and tp.name = trim(item)
    );
  if unplaced <> 0 then
    raise exception '% touchpoint pills did not become placements', unplaced;
  end if;

  -- Every link that RESOLVED carried its detail across. A link that resolved
  -- to nothing is #180's problem and is deliberately not counted here.
  select count(*) into detail_lost
  from public.cells c
  cross join lateral jsonb_array_elements(c.links) l
  where l ->> 'type' = 'tech_description'
    and exists (
      select 1 from unnest(regexp_split_to_array(c.content, E'[\n,]')) x
      where trim(x) = l ->> 'label'
    )
    and not exists (
      select 1
      from public.cell_touchpoints ct
      join public.touchpoints tp on tp.id = ct.touchpoint_id
      where ct.cell_id = c.id
        and tp.name = l ->> 'label'
        and ct.summary is not distinct from l ->> 'description'
    );
  if detail_lost <> 0 then
    raise exception
      '% resolving tech_description links lost their detail', detail_lost;
  end if;
end
$do$;

-- ── The stakeholder reference, added only where there is one to point at ───
--
-- `touchpoints.stakeholder_id` was declared inline as
-- `references public.stakeholders (id)`, and that one clause made this whole
-- file unable to replay against an empty database — along with the four
-- migrations that build on it, because a failed CREATE TABLE rolls back and
-- everything downstream then says `relation "public.touchpoints" does not
-- exist`. Six files, one clause.
--
-- `public.stakeholders` does not survive an empty replay. It is in
-- `docs/reference/migration-replay-baseline.json` already: the migration that
-- creates it asserts against rows that are not there, and a migration runs in
-- one transaction, so the assertion takes the table down with it.
--
-- Nobody saw this because everyone believed `npm run replay:migrations` could
-- not be run on this machine. A local Postgres 17 is installed and running,
-- and the ratchet those six files broke says in its own words that the set
-- "may shrink and never grow".
--
-- So the constraint is added when the table it points at is there, and
-- skipped with a notice when it is not. The column exists either way, so the
-- schema shape does not fork — only the referential guarantee does, and it is
-- absent on a replay because its target is absent, which is the honest
-- outcome rather than a weakened one.
--
-- Written here rather than inline because a guarded `alter table` is the only
-- form that can be conditional; Postgres has no `references … if exists`.

do $stakeholder_ref$
begin
  if to_regclass('public.stakeholders') is null then
    raise notice
      'public.stakeholders is absent, so touchpoints.stakeholder_id points at nothing here';
    return;
  end if;

  alter table public.touchpoints
    add constraint touchpoints_stakeholder_id_fkey
    foreign key (stakeholder_id) references public.stakeholders (id);
end
$stakeholder_ref$;
