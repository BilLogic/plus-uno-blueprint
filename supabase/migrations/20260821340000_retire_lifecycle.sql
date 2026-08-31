-- Plan 002 phase 6, unpinned.
--
-- It was parked only because the service TIER was, and the service tier is
-- coming back (the service panel). The pin note predicted the exact sharp
-- edge this leaves behind: plan 009's `stakeholders.service_id` had to
-- reference `service_lifecycles` in the meantime, "and be renamed with
-- everything else when this phase runs".
--
-- A service cannot contain several lifecycles. The two tables were never
-- related — `service_lifecycles` has no `service_id` — and `services` holds a
-- single placeholder row named "Example API" with no readers. So "lifecycle"
-- is not a level in the hierarchy: it IS the service, wearing a longer name.

drop table if exists public.services cascade;

alter table public.service_lifecycles rename to services;

alter table public.phases       rename column service_lifecycle_id to service_id;
alter table public.evidence     rename column service_lifecycle_id to service_id;
alter table public.findings     rename column service_lifecycle_id to service_id;
alter table public.slices       rename column service_lifecycle_id to service_id;
alter table public.propositions rename column service_lifecycle_id to service_id;

comment on table public.services is
  'The service this board describes. One row. Renamed from service_lifecycles on 2026-08-21 — a service cannot contain several lifecycles, so the word named a level that does not exist.';

do $$
declare n int;
begin
  select count(*) into n from information_schema.tables
  where table_schema = 'public' and table_name = 'service_lifecycles';
  if n > 0 then raise exception 'service_lifecycles survived'; end if;

  select count(*) into n from information_schema.columns
  where table_schema = 'public' and column_name = 'service_lifecycle_id';
  if n > 0 then raise exception '% columns still say lifecycle', n; end if;

  -- AMENDED 2026-08-31. These two assertions were census counts — "expected 1
  -- service", "at least 12 stakeholders" — measured against production on the
  -- day this was written. On an empty database they are false, the migration
  -- raises, and because a migration is one transaction the RENAMES ABOVE ROLL
  -- BACK WITH THEM. That is why `npm run replay:migrations` reports 187 files
  -- unable to replay and every later migration naming `phases.service_id`
  -- fails with "column does not exist": the column is still called
  -- `service_lifecycle_id` there, because this file's rename never survived.
  --
  -- One assertion, 187 files. Nobody saw it because the replay instrument was
  -- believed unrunnable on this machine; a local Postgres 17 is installed and
  -- running, and it says otherwise.
  --
  -- Amending an applied migration is not free and this repository means the
  -- rule. `20260830160000` spent that budget on a statement that deleted rows.
  -- This is the other case worth it: an assertion that disables the only
  -- instrument the repository has for #148. The rename it guards has long
  -- since run in production, so nothing here changes what production is — it
  -- changes whether anything can ever check.
  --
  -- What replaces them is what they were reaching for, stated as invariants:
  -- the rename must not have orphaned anything. Vacuously true on an empty
  -- database, and exactly as strong on production, where 1 service and 18
  -- stakeholders had to survive it for them to hold.

  select count(*) into n from public.phases p
    left join public.services s on s.id = p.service_id
   where s.id is null;
  if n <> 0 then
    raise exception '% phases point at no service after the rename', n;
  end if;

  -- Guarded, because `public.stakeholders` does not exist on an empty replay
  -- either: the migration that creates it is itself in the replay baseline.
  -- An assertion that cannot find its subject has nothing to say, and saying
  -- it by raising would take this file's renames down with it a second time.
  if to_regclass('public.stakeholders') is null then
    raise notice 'public.stakeholders is absent, so the registry link has nothing to check';
  else
    select count(*) into n from public.stakeholders s
      left join public.services v on v.id = s.service_id
     where v.id is null;
    if n <> 0 then
      raise exception 'the registry lost its service link on % rows', n;
    end if;
  end if;
end $$;
