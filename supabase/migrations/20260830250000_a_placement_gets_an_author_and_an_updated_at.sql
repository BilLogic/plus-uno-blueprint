-- 20260830250000 — the placement editor lands, and the row has to say when.
--
-- #188 gives an author somewhere to write a placement's summary, screenshot
-- and design link, and #189 gives them the core/peripheral mark beside it. All
-- four already exist as columns and all four already render; what did not
-- exist was any way to put a value in one. Every one of the 117 authored
-- details arrived by import, and the read side was built while the write side
-- was not — which is the same shape as a column with no reader, and is how
-- half of them went missing in the first place.
--
-- The write itself needs NO new schema. `20260830140000` granted
-- `authenticated` update on (position, summary, screenshot, url, prominence),
-- `20260830220000` added `updated_at` to that list, row-level security admits
-- the service account, and the app writes through those grants the way the
-- cell and lane panels already do.
--
-- Two things were missing anyway, and they are what this file is.
--
-- ── 1. `updated_at` moves only when a function remembers to move it ───────
--
-- Both touchpoint tables carry `updated_at timestamptz not null default now()`
-- and NEITHER got the trigger that maintains it. Every other table in this
-- schema has had one since `20250602170000`.
--
-- Until now that was survivable, because the only writers were functions.
-- `sync_cell_touchpoints` and `restore_cell_touchpoints` stamp the column by
-- hand inside their own UPDATE, and `20260830220000` found that out, wrote it
-- down, and granted `authenticated` update on `updated_at` so those stamps
-- keep working on the day #183 narrows the table grants to the column lists
-- that were always meant to hold. It declined to swap the mechanism, and gave
-- the reason: swapping would mean re-emitting both placement functions to
-- change one clause each.
--
-- This file does not swap it. It adds the trigger BESIDE the stamps, which
-- re-emits nothing: a `before update` trigger setting `new.updated_at = now()`
-- and a SET clause writing `now()` in the same statement agree, so the two
-- functions keep working unchanged and their stamps become redundant rather
-- than wrong. #183 can retire them whenever it reaches this table.
--
-- What makes it worth doing NOW rather than with #183 is the second writer.
-- The placement editor is a PostgREST update from the panel, not a function,
-- and there is nothing there to remember a stamp — a client that writes its
-- own `updated_at` is the exact thing `src/lib/optimisticConcurrency.ts`
-- forbids in its header, because a client-chosen timestamp defeats the guard
-- that reads it and puts clock skew in the row. So without the trigger, an
-- author's edit would leave the row's timestamp reading whatever the import
-- wrote, and "when was this last touched" would answer for the migration
-- rather than for the person.
--
-- ── 2. The gate was true and unstated ─────────────────────────────────────
--
-- A placement may only exist on a touchpoint-BEARING cell, because
-- `cells.content` on an actor lane is a sentence about what somebody did and
-- syncing it would file that sentence in the catalog as a tool. That rule
-- lives inside `sync_cell_touchpoints` and is proven there.
--
-- It is a gate only while nothing writes around it. `authenticated` holds
-- INSERT and DELETE on `cell_touchpoints` and has to: the sync function is
-- `security invoker` and runs as its caller, so the grants cannot say "only
-- through the sync". What the grants CAN say is that `cell_id` and
-- `touchpoint_id` are not updatable, so a placement the gate admitted cannot
-- later be moved onto a cell it would have refused. That was already true and
-- nothing asserted it, which is the condition every finding in #172 was found
-- in. The assertions below state it, along with the one that matters most:
-- that `sync_cell_touchpoints` is still the only function that inserts a
-- placement at all.
--
-- NO ROW COUNT IS ASSERTED. Every assertion here is an invariant that is
-- vacuously true on an empty database and meaningful on the populated one —
-- `docs/reference/migration-replay-baseline.json` is a ratchet, and a
-- migration asserting "308 placements" fails every empty replay for the rest
-- of time.
--
-- NOTHING HERE CALLS `sync_cell_touchpoints`. `scripts/check-proof-footprint.
-- mjs` exists because a proof block in `20260830160000` called it against a
-- cell it did not create and destroyed a production row. There is no probe in
-- this file: every assertion reads the catalog, and a catalog read has no
-- footprint to give back.

-- ---------------------------------------------------------------------------
-- The trigger both tables should have had from the start — added BESIDE the
-- functions' own stamps, not in place of them, so nothing is re-emitted.
-- ---------------------------------------------------------------------------
drop trigger if exists touchpoints_set_updated_at on public.touchpoints;
create trigger touchpoints_set_updated_at
  before update on public.touchpoints
  for each row execute function public.set_updated_at();

drop trigger if exists cell_touchpoints_set_updated_at on public.cell_touchpoints;
create trigger cell_touchpoints_set_updated_at
  before update on public.cell_touchpoints
  for each row execute function public.set_updated_at();

comment on column public.cell_touchpoints.prominence is
  'Core or peripheral AT THIS MOMENT, or null for the unmarked majority. '
  'Null is a state of its own and not a quiet "peripheral": it means nobody '
  'has judged this placement, so the panel renders nothing for it rather than '
  'a badge saying so. On the placement and not the catalog because the same '
  'artifact is central at one step and incidental at another.';

-- ---------------------------------------------------------------------------
-- Post-conditions. Every one of them holds on an empty database.
-- ---------------------------------------------------------------------------
do $assert$
declare
  missing text;
  granted text[];
  inserters text;
  bad int;
begin
  -- 1. THE TRIGGERS ARE INSTALLED. Named individually rather than counted:
  -- "two triggers exist" would pass if one table had both.
  select string_agg(t.name, ', ' order by t.name) into missing
  from (values
         ('touchpoints_set_updated_at', 'public.touchpoints'),
         ('cell_touchpoints_set_updated_at', 'public.cell_touchpoints')
       ) as t(name, table_name)
  where not exists (
    select 1 from pg_trigger g
    where g.tgrelid = t.table_name::regclass
      and g.tgname = t.name
      and not g.tgisinternal
  );
  if missing is not null then
    raise exception 'these updated_at triggers are missing: %', missing;
  end if;

  -- 2. THE PLACEMENT'S EDITABLE COLUMNS ARE EXACTLY ITS DETAIL AND ITS ORDER.
  -- Read out of the catalog and compared as a SET, in both directions: a
  -- one-way check ("cell_id is not granted") would pass while a later
  -- migration quietly added `origin` or `created_at` to the grant.
  select coalesce(array_agg(column_name order by column_name), array[]::text[])
    into granted
  from information_schema.column_privileges
  where table_schema = 'public'
    and table_name = 'cell_touchpoints'
    and grantee = 'authenticated'
    and privilege_type = 'UPDATE';

  -- `updated_at` is in the list and does not belong to a panel: it is there
  -- because `20260830220000` granted it so the placement functions' own
  -- stamps survive #183's narrowing. The trigger above makes those stamps
  -- redundant, so the grant becomes removable — by #183, which owns the grant
  -- surface — and this assertion is what will notice when it goes.
  if granted <> array['position','prominence','screenshot','summary','updated_at','url'] then
    raise exception
      'authenticated may update % on cell_touchpoints; expected exactly '
      '(position, prominence, screenshot, summary, updated_at, url)', granted;
  end if;

  -- 3. WHERE A PLACEMENT SITS IS NOT WRITABLE BY A CLIENT. Implied by the set
  -- above and stated on its own anyway, because this is the half of the
  -- touchpoint-bearing gate that lives in the grants: a placement the gate
  -- admitted must not be movable onto a cell it would have refused.
  if has_column_privilege('authenticated', 'public.cell_touchpoints', 'cell_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.cell_touchpoints', 'touchpoint_id', 'UPDATE') then
    raise exception
      'a client can re-anchor a placement — cell_id or touchpoint_id is updatable';
  end if;

  -- 4. THE SYNC IS STILL THE ONLY FUNCTION THAT CREATES A PLACEMENT. This is
  -- the gate stated where it cannot drift: a second function that inserts
  -- placements is a second answer to "may this cell have one", and the one in
  -- `sync_cell_touchpoints` would stop being the rule without anything saying
  -- so. Not vacuous on an empty database — the function is created by
  -- 20260830160000, which runs before this file.
  select string_agg(p.proname, ', ' order by p.proname) into inserters
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosrc like '%insert into public.cell_touchpoints%'
    and p.proname <> 'sync_cell_touchpoints';
  if inserters is not null then
    raise exception
      'these functions create placements without the touchpoint-bearing gate: %',
      inserters;
  end if;
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'sync_cell_touchpoints'
  ) then
    raise exception 'public.sync_cell_touchpoints is missing — nothing gates a placement';
  end if;

  -- 5. anon HOLDS NO WRITE ON EITHER TOUCHPOINT TABLE. `20260830240000`
  -- revoked exactly this, one migration ago, because creating a table hands
  -- anon four privileges the author never typed. Repeating the assertion here
  -- costs nothing and means the migration that opens an authoring surface on
  -- these tables cannot be the one that reopens that hole.
  select count(*) into bad
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in ('touchpoints', 'cell_touchpoints')
    and grantee = 'anon'
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  if bad <> 0 then
    raise exception '% anon write grants survive on the touchpoint tables', bad;
  end if;

  -- 6. THE PROMINENCE VOCABULARY IS CONSTRAINED, AND ARMED. The constraint is
  -- what makes the editor's three-option control honest — two values plus the
  -- null that means "nobody judged this" — and a text column without it would
  -- accept a third word from a seed and render it as a badge nobody defined.
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.cell_touchpoints'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%prominence%'
      and pg_get_constraintdef(c.oid) like '%core%'
      and pg_get_constraintdef(c.oid) like '%peripheral%'
  ) then
    raise exception 'cell_touchpoints.prominence has no CHECK constraint';
  end if;

  -- And no row contradicts it. The constraint already refuses these, so this
  -- asserts it is present and enforcing rather than trusting that it is.
  select count(*) into bad
  from public.cell_touchpoints
  where prominence is not null and prominence not in ('core', 'peripheral');
  if bad <> 0 then
    raise exception '% placements carry a prominence outside the vocabulary', bad;
  end if;
end
$assert$;
