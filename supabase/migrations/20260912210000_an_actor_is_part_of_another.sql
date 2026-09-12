-- An actor is part of another.
--
-- `parent_id` says there is a tree. There is not.
--
-- `20260821280000` gave `stakeholders` a self-reference so that Design's four
-- sub-teams roll up to Design, asserted in the same file that the hierarchy is
-- never more than one level deep, and then named the column for the SHAPE
-- rather than for the relationship. The shape that name describes is a tree of
-- any depth. A reader who trusts it reaches for a recursive CTE, or nests a
-- third level and is refused by a rule the name gave no warning about.
--
-- This deployment's own prose already had the right word. The column comment
-- says "the party this one is part of", and the glossary says an actor may be
-- part of another. `part_of_id` names the RELATIONSHIP — membership, which is
-- flat by nature — instead of a graph shape the registry forbids. It is the
-- same rule `20260830170000` settled on this very table: the name says the
-- thing.
--
-- ── THE SCHEMA IS WRITTEN TWICE, ON PURPOSE ───────────────────────────────
--
-- The template made this rename upstream in
-- `21000217000000_an_actor_is_part_of_another.sql`, and the application code
-- arrives here through the version pin. The schema does not: this deployment
-- is a separate Postgres with its own series, and none of the template's band
-- has ever run against it. So the same sentence is said again here, against
-- the statements this database actually admits — which are not the template's,
-- as the two paragraphs below record.
--
-- ── WHAT UPSTREAM RENAMES THAT THIS DATABASE DOES NOT HAVE ────────────────
--
-- Upstream the column arrived with a `stakeholders_parent_not_self` check
-- constraint and a `stakeholders_parent_is_flat` trigger, and that migration
-- moves both. THIS DATABASE HAS NEITHER. `20260821280000` added a bare
-- `references public.stakeholders (id)` and stated the one-level rule as an
-- assertion in its own transaction; no constraint and no trigger were ever
-- created here. Swept against the catalogue rather than remembered: the only
-- constraints on this table are its primary key, the unique `name`
-- `20260902230000` added, `stakeholders_kind_check`, and the foreign key
-- renamed below.
--
-- So this file renames what exists and does not mint the upstream guard under
-- a new name. A trigger this database has never carried is a decision about
-- whether to hold the registry flat in the schema, and that decision is not a
-- rename's to take in passing.
--
-- ── NO GRANT MOVES, AND THE TEMPLATE'S BELT-AND-BRACES IS OMITTED ─────────
--
-- Upstream re-emits `grant update (part_of_id) on public.stakeholders to
-- authenticated`, harmlessly, because upstream grants that column. It would
-- not be harmless here. `20260830290000` revoked table-level UPDATE from
-- `authenticated` on every base table in `public` and handed back one
-- (table, column) pair per field a panel actually writes; `stakeholders` got
-- back `name`, `kind`, `summary` and `aliases`, and this column was never one
-- of them. Nothing in the app re-parents an actor. Copying that line would
-- open a write surface this deployment closed on purpose, so §3 below asserts
-- the opposite.
--
-- What `authenticated` does hold on this column is SELECT and INSERT, from the
-- table-level grants in `20260820170000`. A rename carries a privilege with
-- the name, so those travel — §2 asserts it by name rather than assuming it,
-- for the reason `20260830170000` gives: a host that replayed the grant rather
-- than the rename would leave the registry silently unwritable.
--
-- ── NOTHING ELSE DEPENDS ON THE COLUMN ────────────────────────────────────
--
-- Swept against production's catalogue rather than assumed. No function body
-- in `public` names it — `alter table … rename column` says nothing about a
-- plpgsql body, which is why §2 sweeps `pg_proc` as well as
-- `information_schema`. No view selects it; there is no view over
-- `stakeholders` at all. The two indexes are on `id` and `name`, so the
-- column has none of its own. No policy expression mentions it: the eight
-- policies on this table are `true` or `is_service_account()`. The one
-- trigger, `stakeholders_rename_slices_au`, reads `name`. The only dependent
-- identifier in the whole catalogue is the foreign key, which is why it is
-- the one other statement in this file.
--
-- ── THE ASSERTIONS ARE INVARIANTS, NEVER CENSUSES ─────────────────────────
--
-- Every guard below holds on an empty database as well as on this one
-- (ADR 0009). A rename cannot strand a value — the data moves with the name —
-- so there is no count of sub-teams to take, and a guard naming today's four
-- would make this file unable to run anywhere else.
--
-- ── THE APPLY ORDER, BECAUSE main IS PRODUCTION ───────────────────────────
--
-- Additive in the sense that matters: this file is applied BEFORE the branch
-- that renames the reading code is merged. The application already reads
-- `part_of_id` — it comes from the pinned package, which made this rename
-- upstream — so between the two the registry read is correct for the first
-- time rather than newly wrong.

alter table public.stakeholders rename column parent_id to part_of_id;

-- Longhand, and at the top level, for the reason the vocabulary migrations
-- documented: a rename moves the column and NOTHING that hangs off it, and a
-- name the static readers cannot see is a retired word nothing forbids.
alter table public.stakeholders
  rename constraint stakeholders_parent_id_fkey to stakeholders_part_of_id_fkey;

comment on column public.stakeholders.part_of_id is
  'The actor this one is part of, or null when it is not part of another. '
  'Exactly one level: an actor that is part of something is part of nothing '
  'further. A lane still names the specific actor; this is what lets a reader '
  'roll those up.';

-- ---------------------------------------------------------------------------
-- 2. Proof — the shape, and everything that had to follow the name
-- ---------------------------------------------------------------------------

do $the_shape$
declare
  bodies int;
  grants int;
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'stakeholders'
       and column_name = 'parent_id'
  ) then
    raise exception 'stakeholders still carries parent_id';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'stakeholders'
       and column_name = 'part_of_id'
  ) then
    raise exception 'stakeholders has no part_of_id — the membership link landed nowhere';
  end if;

  -- The foreign key still points at this table, under its new name. Stated as
  -- both halves: a schema carrying the old name beside the new one satisfies
  -- neither the sweep nor a reader.
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.stakeholders'::regclass
       and conname = 'stakeholders_parent_id_fkey'
  ) then
    raise exception 'the foreign key is still named stakeholders_parent_id_fkey';
  end if;

  if not exists (
    select 1 from pg_constraint c
     where c.conrelid = 'public.stakeholders'::regclass
       and c.conname = 'stakeholders_part_of_id_fkey'
       and c.contype = 'f'
       and c.confrelid = 'public.stakeholders'::regclass
  ) then
    raise exception 'stakeholders_part_of_id_fkey is missing — the self-reference did not survive';
  end if;

  -- A body that read the old name would raise 42703 the next time somebody
  -- called it. This is where it says so instead. The word is taken bare
  -- because it appears nowhere else in this schema's identifiers.
  select count(*) into bodies
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind in ('f', 'p')
     and p.prosrc ~ '\mparent_id\M';
  if bodies <> 0 then
    raise exception '% function(s) still name stakeholders.parent_id', bodies;
  end if;

  -- The read and write privileges followed the rename. Postgres tracks a
  -- column grant by attribute number, so they do — but `20260820170000`
  -- granted them table-wide by name, and this is the assertion that the
  -- carried grant is real rather than assumed.
  select count(*) into grants
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'stakeholders'
     and column_name = 'part_of_id' and grantee = 'authenticated'
     and privilege_type in ('SELECT', 'INSERT');
  if grants <> 2 then
    raise exception
      'authenticated holds % of the 2 expected SELECT/INSERT grants on stakeholders.part_of_id', grants;
  end if;
end
$the_shape$;

-- ---------------------------------------------------------------------------
-- 3. Proof — the write surface did not widen
-- ---------------------------------------------------------------------------
--
-- A rename cannot grant anything, so this can only fail if somebody copies the
-- template's `grant update (part_of_id)` line into this file. That is exactly
-- the mistake worth catching: it is one plausible line, it would pass every
-- other check here, and it would make an actor's membership editable from a
-- panel that has no control for it.

do $the_write_surface$
declare
  widened text;
begin
  select string_agg(coalesce(column_name, '<table>'), ', ' order by column_name)
    into widened
    from (
      select null::text as column_name
        from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'stakeholders'
         and grantee = 'authenticated' and privilege_type = 'UPDATE'
      union all
      select column_name
        from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'stakeholders'
         and grantee = 'authenticated' and privilege_type = 'UPDATE'
         and column_name = 'part_of_id'
    ) held;

  if widened is not null then
    raise exception
      'authenticated holds UPDATE on stakeholders (%). 20260830290000 handed back '
      'name, kind, summary and aliases and nothing else; a rename must not widen that.',
      widened;
  end if;
end
$the_write_surface$;

-- ---------------------------------------------------------------------------
-- 4. Proof — the write path, performed as the app
-- ---------------------------------------------------------------------------
--
-- The claim an owner run cannot make. `authenticated` must still be able to
-- INSERT an actor that is part of another, through the grant that had to
-- travel with the name and past the restrictive service-account policies on
-- this table. Those policies match ZERO ROWS SILENTLY under a plain
-- authenticated session, so the block holds a service claim in
-- `request.jwt.claims` — which is what `auth.jwt()` reads and therefore what
-- `is_service_account()` decides on. Without it every statement below would
-- pass by writing nowhere.
--
-- The block rolls itself back through the sentinel exception, in the shape
-- `20260830180000` established: a migration may prove a thing, and may not
-- leave the rows it proved it with.

do $the_write_path$
declare
  whole uuid;
  part uuid;
  stored uuid;
  remaining int;
  done boolean := false;
  msg text;
begin
  begin
    execute 'set local request.jwt.claims = ' ||
      quote_literal('{"role":"authenticated","app_metadata":{"role":"service"}}');
    execute 'set local role authenticated';

    insert into public.stakeholders (name, kind, summary)
      values ('issue-640 fixture whole', 'team', 'The actor the fixture below is part of.')
      returning id into whole;
    if whole is null then
      raise exception 'authenticated could not insert an actor — the insert grant did not survive the rename';
    end if;

    insert into public.stakeholders (name, kind, summary, part_of_id)
      values ('issue-640 fixture part', 'staff', 'An actor that is part of another.', whole)
      returning id into part;

    select s.part_of_id into stored from public.stakeholders s where s.id = part;
    if stored is distinct from whole then
      raise exception 'the membership link did not come back: %', coalesce(stored::text, '<null>');
    end if;

    delete from public.stakeholders where id in (part, whole);
    select count(*) into remaining from public.stakeholders
     where name like 'issue-640 fixture%';
    if remaining <> 0 then
      raise exception '% fixture actor(s) survived the delete', remaining;
    end if;

    execute 'reset role';
    done := true;
    raise exception using errcode = 'P0001', message = 'issue-640 fixture rollback';
  exception when others then
    execute 'reset role';
    get stacked diagnostics msg = message_text;
    if msg <> 'issue-640 fixture rollback' then raise; end if;
  end;

  if not done then
    raise exception 'the write-path cases never ran';
  end if;
  if exists (select 1 from public.stakeholders where name like 'issue-640 fixture%') then
    raise exception 'the issue-640 fixture survived the rollback';
  end if;
end
$the_write_path$;
