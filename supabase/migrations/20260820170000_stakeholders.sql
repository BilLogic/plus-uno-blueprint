-- The stakeholder registry: one cast list instead of four.
--
-- Four free-text fields name the same people and none of them are connected —
-- `lanes.name`, `cells.value_props[].for`, `slices.actor`, and the business
-- model's `partners`. `check-value-ledger` already tries to reconcile the
-- first two by string match, and today it CANNOT: of 12 distinct lane names
-- only six name a person or an organisation, so the check would warn "Front
-- Stage Tech is never a value audience — who is this lane for?" six times in
-- every one of 22 scenarios. That is why it has never been trusted.
--
-- Measured before writing this (2026-08-20):
--   structural lanes  Front Stage Tech 38 · Back Stage Tech 38 · Storyboard 38
--                     Front Stage Actions 37 · Back Stage Actions 37
--                     Support Actions 36            → no stakeholder, ever
--   actor lanes       Regular Tutor 35 · Lead Tutor 19
--                     Partner Action: Teacher 16 · Student 2 · Tutor 2
--                     Supervisor 1
--   value audiences   business 10 · student 7 · tutor 4 · lead tutor 1
--
-- Two facts the seed encodes and the string match could never see: `Tutor` is
-- `Regular Tutor` authored in a second session (its 2 lanes sit in scenarios
-- that use the long name nowhere), and `business` — the MOST-cited audience —
-- is not a lane at all and never can be.
--
-- `service_id` points at `service_lifecycles` because plan 002 Phase 6, which
-- renames that table to `services`, is pinned with the rest of the service
-- tier. It renames with everything else when that phase runs.

create table public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null
    references public.service_lifecycles (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('recipient','staff','partner','provider')),
  note text,
  -- Other spellings seen in THIS blueprint. Not a synonym dictionary: every
  -- entry is a string that already exists in the data.
  aliases text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, name)
);

alter table public.stakeholders enable row level security;

-- Same shape as every other root-scoped table: anon reads, the service
-- account writes.
create policy stakeholders_select_anon on public.stakeholders
  for select to anon using (true);
create policy stakeholders_select_auth on public.stakeholders
  for select to authenticated using (true);
create policy stakeholders_insert_service_only on public.stakeholders
  for insert to authenticated with check (public.is_service_account());
create policy stakeholders_update_service_only on public.stakeholders
  for update to authenticated
  using (public.is_service_account())
  with check (public.is_service_account());
create policy stakeholders_delete_service_only on public.stakeholders
  for delete to authenticated using (public.is_service_account());

grant select on public.stakeholders to anon, authenticated;
grant insert on public.stakeholders to authenticated;
grant delete on public.stakeholders to authenticated;
-- Column-level, per access-and-security.md: ids and timestamps are the
-- database's business.
grant update (name, kind, note, aliases) on public.stakeholders to authenticated;

-- ── The seed ─────────────────────────────────────────────────────────────────
-- Reference data, so a migration rather than a script. Nothing here is
-- invented: every name is a lane label or a value audience that exists today.
insert into public.stakeholders (service_id, name, kind, note, aliases)
select sl.id, v.name, v.kind, v.note, v.aliases
from public.service_lifecycles sl
cross join (values
  ('Student', 'recipient',
   'Who the tutoring is for.',
   array['student']),
  ('Regular Tutor', 'staff',
   'The tutor running a session. `Tutor` is the same person, authored in a second session.',
   array['tutor','Tutor']),
  ('Lead Tutor', 'staff',
   'Holds the main room and supports the tutors in breakouts.',
   array['lead tutor']),
  ('Supervisor', 'staff',
   'Oversees tutors; receives no value entry anywhere in the blueprint today.',
   array[]::text[]),
  ('Partner Action: Teacher', 'partner',
   'The school-side teacher in the room. Named as a lane, not as an audience.',
   array['teacher']),
  ('PLUS', 'provider',
   'The service itself — the most-cited value audience, and no lane can represent it.',
   array['business'])
) as v(name, kind, note, aliases)
where sl.name = 'PLUS Application'
on conflict (service_id, name) do nothing;

-- ── The links ────────────────────────────────────────────────────────────────
alter table public.lanes
  add column stakeholder_id uuid references public.stakeholders (id);
alter table public.slices
  add column stakeholder_id uuid references public.stakeholders (id);

grant update (stakeholder_id) on public.lanes to authenticated;
grant update (stakeholder_id) on public.slices to authenticated;

-- Backfill by name AND alias, case-insensitively. The 224 structural lane
-- rows match nothing and stay null, which is the whole point: a null
-- stakeholder is what tells the check "this row is scaffolding, not a person".
update public.lanes l
set stakeholder_id = s.id
from public.stakeholders s
where lower(trim(l.name)) = lower(s.name)
   or lower(trim(l.name)) = any (select lower(a) from unnest(s.aliases) a);

update public.slices sl
set stakeholder_id = s.id
from public.stakeholders s
where sl.actor is not null
  and (lower(trim(sl.actor)) = lower(s.name)
       or lower(trim(sl.actor)) = any (select lower(a) from unnest(s.aliases) a));

-- One name, one owner. A slice's `actor` is display text that uno-bot also
-- matches on with ILIKE; once a slice is linked, the registry owns that text,
-- so renaming a stakeholder cannot leave a slice quoting the old spelling.
create or replace function public.slices_sync_actor()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog', 'pg_temp'
as $fn$
begin
  if new.stakeholder_id is not null then
    select s.name into new.actor
    from public.stakeholders s
    where s.id = new.stakeholder_id;
  end if;
  return new;
end;
$fn$;

revoke all on function public.slices_sync_actor() from public, anon;

create trigger slices_sync_actor_biu
  before insert or update of stakeholder_id on public.slices
  for each row execute function public.slices_sync_actor();

create or replace function public.stakeholders_rename_slices()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog', 'pg_temp'
as $fn$
begin
  if new.name is distinct from old.name then
    update public.slices set actor = new.name where stakeholder_id = new.id;
  end if;
  return new;
end;
$fn$;

revoke all on function public.stakeholders_rename_slices() from public, anon;

create trigger stakeholders_rename_slices_au
  after update of name on public.stakeholders
  for each row execute function public.stakeholders_rename_slices();

do $assert$
declare structural_linked int; actors_unlinked int; seeded int;
begin
  select count(*) into seeded from public.stakeholders;
  if seeded <> 6 then
    raise exception 'expected 6 stakeholders, seeded %', seeded;
  end if;

  -- A structural row with a stakeholder means the backfill matched something
  -- it should not have — the failure this table exists to prevent.
  select count(*) into structural_linked
  from public.lanes
  where stakeholder_id is not null
    and lane_role in ('visual','step_visual','frontstage_tech','backstage_tech','support_systems');
  if structural_linked > 0 then
    raise exception '% structural lanes were linked to a stakeholder', structural_linked;
  end if;

  -- Every actor lane must have found one, including the two labelled `Tutor`.
  select count(*) into actors_unlinked
  from public.lanes
  where stakeholder_id is null
    and lower(trim(name)) in
      ('student','regular tutor','tutor','lead tutor','supervisor','partner action: teacher');
  if actors_unlinked > 0 then
    raise exception '% actor lanes did not link', actors_unlinked;
  end if;
end
$assert$;
