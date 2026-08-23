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

  select count(*) into n from public.services;
  if n <> 1 then raise exception 'expected 1 service, got %', n; end if;

  select count(*) into n from public.stakeholders s
  join public.services v on v.id = s.service_id;
  if n < 12 then raise exception 'the registry lost its service link: %', n; end if;
end $$;
