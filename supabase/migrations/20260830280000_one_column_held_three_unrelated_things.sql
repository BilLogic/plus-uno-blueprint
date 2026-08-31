-- `cells.links` held resources, touchpoint detail and provenance, and the
-- name described one of the three.
--
-- Measured before writing this (2026-08-30, production, over the anon read
-- path the app itself uses), when the column still held all 656 entries:
--
--   931  cells
--   656  entries in `cells.links`, in exactly three shapes and no others
--   475  `type = 'url'`             — genuine resources. Every one carries a
--                                     label and an http(s) url. 223 cells
--                                     hold them, at most 6 on any one cell.
--   117  `type = 'tech_description'` — touchpoint detail. 20260830140000
--                                     moved the 60 that resolve into
--                                     `cell_touchpoints`; 20260830260000
--                                     moved the 57 that do not into
--                                     `unplaced_touchpoint_details` AND
--                                     removed them from the column. This file
--                                     moves none of them and still checks —
--                                     see "The guard" below.
--    64  `type = 'ref'`             — provenance. "Card 2452", "Metabase,
--                                     2026-08-08", "sweep 10-clearance-
--                                     procedure", "Slack #plus-core, Alex
--                                     Houk, 2026-04-01". Each is
--                                     `{type, label}` and nothing else. 45
--                                     cells hold them; 36 of those 45 carry
--                                     no `cell_key`.
--
-- So by the time this file runs the column holds the 475 resources, the 64
-- citations, and the 60 details that resolved — and the resolved ones are
-- already in `cell_touchpoints`, which is what makes dropping the column
-- lossless rather than merely tidy.
--
-- The 64 are the interesting number. `evidence` exists, has exactly the right
-- columns, and holds TWO rows — because provenance has been going into a
-- jsonb array on `cells` since import. And misfiled means unread: a `ref`
-- entry carries no url, `CellResourcesTab` renders only entries that have
-- one, and no other surface reads that column at all. So every one of the 64
-- has been invisible to every reader since the day it was written. They
-- survived each resources save only because `updateCellResources` carried
-- forward the entries it could not see — a filter written to protect the
-- touchpoint detail, keeping something nobody could look at.
--
-- ── The new table, and the two decisions inside it ─────────────────────────
--
-- A resource is the parent concept and a link is one kind of it, so the table
-- is named for the parent and `kind` carries the subtype.
--
-- 1. `kind` admits `link` and `other`, and the short list is the decision
--    rather than an omission. Every row this file writes is a link; `other`
--    is the residual every kind column in this schema carries. A value
--    nothing can produce is a vocabulary nobody can check, so the list grows
--    when something produces a second kind. That is 20260830140000's
--    reasoning about `touchpoints.kind` arriving at the opposite shape for
--    the same reason: there the ticket named six kinds and the data could not
--    be sorted into them without guessing 89 times; here the ticket names one
--    kind and every row is unambiguously it.
--
-- 2. `name`, not `label`. This vocabulary gives a NAME to a thing a reader
--    navigates and a TITLE to authored content a reader reads (CONTEXT.md).
--    A resource is the first: "Onboarding Module 8" and "AI Coach Dashboard
--    (Figma)" name the thing on the other end of the url. `label` survives on
--    `cell_dependencies` because an edge label genuinely is a tag on a line
--    and not a name for anything.
--
-- ── A resource attaches to a cell OR to one placement, never both ──────────
--
-- Enforced by `num_nonnulls(...) = 1` in the schema — the construction
-- `evidence_exactly_one_target` already uses — and not by agreement in the
-- client. That constraint is what lets a design link belong to the tool it
-- documents rather than to the cell at large.
--
-- Nothing is attached to a placement HERE. All 475 sit on a cell today, and
-- deciding which of them really document one touchpoint would be 475 guesses
-- of exactly the kind that produced #180's 57 orphans. The capability ships;
-- the attaching is an authoring act.
--
-- ── The citations go to `evidence`, unclassified on purpose ────────────────
--
-- `kind` is `other` on all 64. `analytics` is plainly right for "Metabase,
-- 2026-08-08" and plainly wrong for "kickoff_interview.jsp", and sorting 64
-- one-line citations into eight buckets by pattern-matching their text is the
-- guess this ticket's parent exists to stop making. `added_by` records where
-- they came from, so the next person can sort them deliberately.
--
-- The label becomes `title` and `ref` stays null. `evidence.title` is not
-- null and the label is the only text there is; writing it into `ref` as well
-- would make the reader render `"Card 2452" ref=Card 2452`.
--
-- `evidence_cell_key_paired` demands a key whenever `cell_id` is set, and 36
-- of the 45 cells have none. Those rows take `mint_cell_key`'s answer — the
-- key the import pipeline would have given that cell — rather than a backfill
-- of `cells.cell_key`, which is a different ticket and collides on 17 cells
-- (`scripts/backfill_cell_keys.mjs` measures that).
--
-- ── The guard, and why it stays now that it passes ────────────────────────
--
-- This file DROPS the column, so anything still living only in it is
-- destroyed. It therefore refuses to run while a `tech_description` entry has
-- not been moved somewhere: those were #180's 57 orphans, and dropping the
-- column under them would have turned "unreachable" into "gone".
--
-- 20260830260000 has since landed and emptied that set, so on production the
-- guard now counts zero and passes. It is NOT deleted, and the difference
-- matters: the condition has not become impossible, it has become false. A
-- `tech_description` entry can still enter the column between that file and
-- this one — a re-import, a hand-written repair, a scenario duplicated out of
-- an older path — and the guard is the only thing that would notice before
-- the DROP took it. A check kept after the fix that satisfied it is how the
-- fix stays true; one deleted the day it goes green is a check that only ever
-- described one afternoon.
--
-- ── Deliberately not done ──────────────────────────────────────────────────
--
-- `search_blueprint` keeps an OUTPUT column called `links`, now built from
-- `resources`. uno-bot reads that key by name, the contract has no alias
-- mechanism for an output column, and renaming it is a cross-repo crossing
-- rather than a side effect of a schema change. The RPC's projection is its
-- own decision — `BLUEPRINT_CONTRACT.searchBlueprintColumns` says so in as
-- many words.
--
-- Nothing yet READS a placement-attached resource. The board embeds
-- `resources` through `resources_cell_id_fkey`, so a row hanging off a
-- placement is not in that list, and no editor writes one. That is the same
-- bargain 20260830140000 struck for `prominence` — the constraint the ticket
-- asks for, ahead of the surface that uses it — and it is stated here rather
-- than left to be discovered, because a column with no reader is the exact
-- shape this ticket's parent is about. Zero rows are in that state today; the
-- surface that puts one there brings its reader with it.
--
-- `duplicate_path` and `duplicate_scenario` stop carrying resources onto the
-- copy, because they stop carrying `links`. That is a real loss, recorded
-- rather than half-fixed, and the reason is no longer a mechanical one:
-- 20260830190000 and 20260830270000 re-created both bodies literally, so the
-- text IS in this repository now and an insert could be spliced in.
--
-- What stops it is that neither function carries `cell_touchpoints` either —
-- a gap 20260830140000 opened and nothing has closed — so a duplicated path
-- today shows no touchpoints at all. A copy that carried resources but still
-- no placements would be harder to reason about than one that carries
-- neither, and would leave the remaining half harder to see. One follow-up
-- owns both, and it is cheaper now than it was.

-- ── The table ──────────────────────────────────────────────────────────────

create table public.resources (
  id                 uuid primary key default gen_random_uuid(),
  -- Exactly one of these two is set. `cascade` on both: a resource is a
  -- property of the thing it hangs off and outlives neither.
  cell_id            uuid references public.cells (id) on delete cascade,
  cell_touchpoint_id uuid references public.cell_touchpoints (id) on delete cascade,
  kind               text not null default 'link'
                       check (kind in ('link', 'other')),
  name               text not null,
  url                text,
  position           int  not null,
  origin             text not null check (origin in ('import', 'app')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- The one design point the ticket is firm on, in the schema rather than in
  -- the client: a cell OR a placement, never both and never neither.
  constraint resources_one_owner
    check (num_nonnulls(cell_id, cell_touchpoint_id) = 1),
  -- A link with no url is what a `ref` entry was, and it rendered nowhere.
  constraint resources_link_has_url
    check (kind <> 'link' or nullif(btrim(url), '') is not null),
  -- Deferrable for the reason the placement's is: a reorder swaps two
  -- positions inside one transaction and an immediate check fails halfway.
  constraint resources_cell_position_unique
    unique (cell_id, position) deferrable initially deferred,
  constraint resources_touchpoint_position_unique
    unique (cell_touchpoint_id, position) deferrable initially deferred
);

comment on table public.resources is
  'Things a cell, or one touchpoint placement, points at. A link is one kind '
  'of resource and `kind` carries the subtype. Exactly one of cell_id and '
  'cell_touchpoint_id is set, so a design link can belong to the tool it '
  'documents rather than to the cell at large.';
comment on column public.resources.name is
  'What the thing on the other end is called. `name`, not `label`: a reader '
  'navigates to it.';

-- No separate foreign-key indexes: each unique constraint above leads with
-- its owning column, so `where cell_id = ?` and `where cell_touchpoint_id = ?`
-- are already served by one.

-- ── Access, the same shape as every other cell-scoped table ────────────────

alter table public.resources enable row level security;

create policy resources_select_anon on public.resources
  for select to anon using (true);
create policy resources_select_auth on public.resources
  for select to authenticated using (true);
create policy resources_insert_service_only on public.resources
  for insert to authenticated with check (public.is_service_account());
create policy resources_update_service_only on public.resources
  for update to authenticated
  using (public.is_service_account())
  with check (public.is_service_account());
create policy resources_delete_service_only on public.resources
  for delete to authenticated using (public.is_service_account());

grant select on public.resources to anon, authenticated;
grant insert, delete on public.resources to authenticated;
-- Column-level, per access-and-security.md: ids, foreign keys and timestamps
-- are the database's business. WHICH cell or placement a resource hangs off
-- is structure, and structure does not move through a direct update.
grant update (kind, name, url, position) on public.resources to authenticated;
-- The platform grants anon these at create time, on every relation created in
-- `public`. Nothing anonymous writes, and `check:new-table-grants` is what
-- collects this debt at the point it is incurred rather than in the next
-- sweep.
revoke insert, update, delete, truncate on public.resources from anon;

-- ── Prove the owner constraint, both ways ──────────────────────────────────
--
-- A CHECK that was written and never exercised is indistinguishable from one
-- that was written wrong, and this is the one design point the ticket is firm
-- on. So both halves of `num_nonnulls(...) = 1` are attempted here, against
-- the real constraint. Neither insert leaves a row: either the constraint
-- refuses it, or it does not and this migration stops.
--
-- The first needs nothing to exist, so it runs on an empty database too. The
-- second needs a placement to point at and says so when there is none —
-- 20260830160000's reorder proof takes the same shape for the same reason.

do $do$
begin
  begin
    insert into public.resources (kind, name, url, position, origin)
    values ('link', 'ZZ Probe', 'https://example.invalid/', 1, 'app');
    raise exception 'a resource owned by neither a cell nor a placement was accepted';
  exception
    when check_violation then null;
  end;
end
$do$;

do $do$
declare
  v_cell      uuid;
  v_placement uuid;
begin
  select ct.cell_id, ct.id into v_cell, v_placement
  from public.cell_touchpoints ct limit 1;

  if v_placement is null then
    raise notice
      'no placement exists, so the both-owners proof has nothing to run against';
    return;
  end if;

  begin
    insert into public.resources
      (cell_id, cell_touchpoint_id, kind, name, url, position, origin)
    values (v_cell, v_placement, 'link', 'ZZ Probe', 'https://example.invalid/', 1, 'app');
    raise exception 'a resource owned by a cell AND a placement was accepted';
  exception
    when check_violation then null;
  end;
end
$do$;

-- ── The resources ──────────────────────────────────────────────────────────
--
-- `with ordinality` keeps the order the author typed; `row_number` makes it
-- 1-based and contiguous per cell, which is what the position constraint and
-- the sync function below both assume. One cell holds the same url twice —
-- that is the author's business, and there is deliberately no unique on url.

insert into public.resources (cell_id, kind, name, url, position, origin)
select
  c.id,
  'link',
  -- All 475 carry a label today, so this coalesce moves nothing. It is here
  -- because `name` is not null and an entry could arrive without one, and it
  -- falls back to the URL's HOST rather than to a word like "Link" because
  -- that is what `cellResources.ts` does for the same entry in a fallback
  -- blueprint, and what the resources editor does for a row an author leaves
  -- unnamed. Three answers to "what is this called when nobody said" is how
  -- the two sources start disagreeing about the same board, which
  -- `cellResources.test.ts` exists to refuse.
  coalesce(
    nullif(btrim(item.link ->> 'label'), ''),
    nullif(
      regexp_replace(btrim(item.link ->> 'url'),
                     '^https?://(www\.)?([^/?#:]+).*$', '\2'),
      btrim(item.link ->> 'url')),
    'Link'),
  btrim(item.link ->> 'url'),
  row_number() over (partition by c.id order by item.ord)::int,
  'import'
from public.cells c
cross join lateral jsonb_array_elements(c.links) with ordinality as item(link, ord)
where item.link ->> 'type' = 'url'
  and nullif(btrim(item.link ->> 'url'), '') is not null;

-- ── The citations ──────────────────────────────────────────────────────────

insert into public.evidence
  (service_id, cell_id, cell_key, kind, title, added_by)
select
  ph.service_id,
  c.id,
  coalesce(c.cell_key, public.mint_cell_key(c.path_id, c.lane_id, c.step_id)),
  'other',
  btrim(item.link ->> 'label'),
  'cells-links-migration'
from public.cells c
join public.paths p on p.id = c.path_id
join public.scenarios s on s.id = p.scenario_id
join public.phases ph on ph.id = s.phase_id
cross join lateral jsonb_array_elements(c.links) as item(link)
where item.link ->> 'type' = 'ref'
  and nullif(btrim(item.link ->> 'label'), '') is not null;

-- The unused `evidence.note` column this ticket also asked for is NOT dropped
-- here. 20260830190000 dropped it, with the same reasoning and an assertion
-- that it held nothing first, and `scripts/tests/one-spelling-each.test.mjs`
-- owns that invariant. Dropping it twice would be a second owner for one
-- fact, which is the shape this batch of work keeps removing.

-- ── The functions that read the column, before it goes ─────────────────────
--
-- Three functions read `cells.links`: `search_blueprint` and the two
-- duplicate functions.
--
-- They are rewritten from the definition the DATABASE holds rather than from
-- any file, and that is a deliberate choice rather than the only one
-- available. 20260830190000 and 20260830270000 re-created all three
-- literally, so the file text and the live text agree today — but they have not always, and the failure
-- is silent: the layers→lanes rename rewrote bodies in place with
-- `regexp_replace` over `pg_get_functiondef`, and for months the newest FILE
-- defining `duplicate_scenario` still said `layers`, `description` and
-- `slot_position` while production said none of them. Re-creating from a file
-- that has drifted resurrects whatever it drifted from, and nothing would
-- report it.
--
-- Reading the catalogue cannot drift by construction. Every substitution
-- below is asserted to have matched, and the sweep at the bottom of the file
-- proves the rewrite reached all three — because a `replace` that silently
-- matched nothing is how a rename comes to look applied while a function
-- still carries the old word, which is the mess 20260826110000 exists to
-- clean up.

do $do$
declare
  v_def  text;
  v_next text;
begin
  for v_def in
    select pg_get_functiondef(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~ '\mc\.links\M'
  loop
    v_next := v_def;

    -- `search_blueprint` keeps its `links` output column and builds it from
    -- the new table, in the same `{type,label,url}` shape uno-bot parses.
    --
    -- `label`, not `name`, and that is the careful choice rather than the
    -- lazy one. 20260830190000 moved payload keys that were named after
    -- COLUMNS — the edge payload's `label` became `name` because the column
    -- did. These three were never column names: they are the keys of a jsonb
    -- value, they are what `CellLink` in this repository still spells for the
    -- fallback blueprints, and they are what uno-bot parses today. Preserving
    -- a wire shape whose source changed is not a rename left undone.
    v_next := replace(
      v_next,
      'c.links as lnk',
      '(select coalesce(jsonb_agg(jsonb_build_object('
        || '''type'', ''url'', ''label'', r.name, ''url'', r.url) '
        || 'order by r.position), ''[]''::jsonb) '
        || 'from public.resources r where r.cell_id = c.id) as lnk');

    -- The two duplicate functions copy every authored column of a cell.
    --
    -- Anchored on `links` and its FOLLOWING column, never on the one before
    -- it. The first draft matched `picture, links, function,` and was already
    -- stale by the time it ran: 20260830270000 renamed `cells.picture` to
    -- `cells.frame` and both lists became `frame, links, function,`. The
    -- assertion below caught it, which is what it is for — but an anchor that
    -- survives its neighbours being renamed is better than one that reports
    -- the rename.
    v_next := replace(v_next, ', links, function,', ', function,');
    v_next := replace(v_next, ', c.links, c.function,', ', c.function,');

    if v_next = v_def then
      raise exception
        'a function reads cells.links in a shape this migration does not know: %',
        left(v_def, 200);
    end if;

    execute v_next;
  end loop;
end
$do$;

-- ── Rewriting a cell's resources is one transaction ────────────────────────
--
-- The lesson 20260830160000 records for placements, arrived at from the same
-- direction: the editor replaces a whole list, PostgREST gives every
-- statement its own transaction, and a deferred position constraint only
-- forgives a collision until COMMIT.
--
-- Delete-and-reinsert rather than a diff, and the difference from
-- `sync_cell_touchpoints` is the point. A placement carries a per-moment
-- summary and screenshot that a delete would destroy, so a kept placement has
-- to be REPOSITIONED. A resource carries nothing that is not in the list
-- being written — name, url, kind — so the simpler operation is also the
-- correct one.
--
-- Placement-attached resources are untouched. This is the CELL's editor, and
-- it reaches only rows whose `cell_id` is this cell.

create or replace function public.sync_cell_resources(
  p_cell_id uuid,
  p_rows    jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_nameless int;
begin
  if not exists (select 1 from public.cells c where c.id = p_cell_id) then
    raise exception 'cell % does not exist', p_cell_id;
  end if;

  -- Refused rather than defaulted. The editor already falls back to the
  -- url's host, so a nameless row reaching here means a caller skipped that,
  -- and inventing a name on its behalf hides the bug.
  select count(*) into v_nameless
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
    as r(kind text, name text, url text)
  where nullif(btrim(coalesce(r.name, '')), '') is null;
  if v_nameless <> 0 then
    raise exception '% resource(s) arrived with no name', v_nameless;
  end if;

  delete from public.resources where cell_id = p_cell_id;

  insert into public.resources (cell_id, kind, name, url, position, origin)
  select p_cell_id,
         coalesce(nullif(btrim(coalesce(r.kind, '')), ''), 'link'),
         btrim(r.name),
         nullif(btrim(coalesce(r.url, '')), ''),
         r.ord::int,
         'app'
  -- `rows from (... as (...)) with ordinality`, not
  -- `jsonb_to_recordset(...) with ordinality as r(...)`. The second is what
  -- this said first, and Postgres refuses it outright: "WITH ORDINALITY
  -- cannot be used with a column definition list". Nothing static caught it —
  -- the file parses, an empty replay never calls the function, and the unit
  -- tests stub the RPC — so it took running the real function against a real
  -- server, which is the same gap the reorder proof in 20260830160000 exists
  -- for one layer down.
  from rows from (
    jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb))
      as (kind text, name text, url text)
  ) with ordinality as r(kind, name, url, ord);
end
$function$;

grant execute on function public.sync_cell_resources(uuid, jsonb) to authenticated;

-- ── Nothing may be left in the column ──────────────────────────────────────
--
-- Invariants, not a census. This file has to replay against an empty database
-- and `docs/reference/migration-replay-baseline.json` treats a new failing
-- entry as a migration written against an apply path that does not work.
-- Asserting 475 and 64 would fail every empty replay forever; asserting that
-- the column holds nothing this file did not carry across is vacuously true
-- on an empty table and exactly as strong on production.

do $do$
declare
  v_orphan_detail int;
  v_lost_resource int;
  v_lost_citation int;
  v_stray         int;
  v_both_owners   int;
begin
  -- The one that can genuinely stop this migration. A `tech_description`
  -- entry that does not resolve to a placement on its own cell was one of
  -- #180's 57 orphans; 20260830260000 moved all 57 out, so this now counts
  -- zero. It is kept because the count can rise again — a re-import, a hand
  -- repair, a scenario duplicated out of an older path — and the DROP below
  -- would destroy whatever it found. Verified against a real server that it
  -- still raises when given one.
  select count(*) into v_orphan_detail
  from public.cells c
  cross join lateral jsonb_array_elements(c.links) as item(link)
  where item.link ->> 'type' = 'tech_description'
    and not exists (
      select 1
      from public.cell_touchpoints ct
      join public.touchpoints tp on tp.id = ct.touchpoint_id
      where ct.cell_id = c.id and tp.name = item.link ->> 'label'
    );
  if v_orphan_detail <> 0 then
    raise exception
      '% touchpoint detail entries are still only in cells.links', v_orphan_detail
      using hint = 'Move them to unplaced_touchpoint_details the way '
                   '20260830260000 did — dropping the column destroys them.';
  end if;

  select count(*) into v_lost_resource
  from public.cells c
  cross join lateral jsonb_array_elements(c.links) as item(link)
  where item.link ->> 'type' = 'url'
    and nullif(btrim(item.link ->> 'url'), '') is not null
    and not exists (
      select 1 from public.resources r
      where r.cell_id = c.id
        and r.url = btrim(item.link ->> 'url')
    );
  if v_lost_resource <> 0 then
    raise exception '% resources did not reach the table', v_lost_resource;
  end if;

  select count(*) into v_lost_citation
  from public.cells c
  cross join lateral jsonb_array_elements(c.links) as item(link)
  where item.link ->> 'type' = 'ref'
    and nullif(btrim(item.link ->> 'label'), '') is not null
    and not exists (
      select 1 from public.evidence e
      where e.cell_id = c.id and e.title = btrim(item.link ->> 'label')
    );
  if v_lost_citation <> 0 then
    raise exception '% provenance citations did not reach evidence', v_lost_citation;
  end if;

  -- Anything the three clauses above did not name. A fourth entry shape would
  -- otherwise be dropped in silence, which is how this column came to hold
  -- three things in the first place.
  select count(*) into v_stray
  from public.cells c
  cross join lateral jsonb_array_elements(c.links) as item(link)
  where coalesce(item.link ->> 'type', '')
        not in ('url', 'ref', 'tech_description');
  if v_stray <> 0 then
    raise exception
      '% link entries are of a shape this migration does not know', v_stray;
  end if;

  -- The constraint says this cannot happen. Asserted anyway, because a
  -- CHECK that was written and never exercised is indistinguishable from one
  -- that was written wrong.
  select count(*) into v_both_owners
  from public.resources
  where num_nonnulls(cell_id, cell_touchpoint_id) <> 1;
  if v_both_owners <> 0 then
    raise exception '% resources name a cell and a placement', v_both_owners;
  end if;
end
$do$;

-- ── And the column goes ────────────────────────────────────────────────────

alter table public.cells drop constraint cells_links_is_array;
alter table public.cells drop column links;

-- Nothing in `public` may still read it. `drop column` refuses when a view or
-- an index depends on the column and says nothing at all about a function
-- body, which is the whole reason the rewrite above had to be explicit.

do $do$
declare
  v_left text;
begin
  select string_agg(p.proname, ', ') into v_left
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and pg_get_functiondef(p.oid) ~ '(\mc\.links\M|[ (]links,)';
  if v_left is not null then
    raise exception 'these functions still read cells.links: %', v_left;
  end if;
end
$do$;
