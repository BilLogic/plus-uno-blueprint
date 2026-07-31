-- Phases become creatable from the app.
--
-- Phases were the one level of the hierarchy with no create path, because they
-- read as fixed: Application → Onboarding → Pre-session → In-session →
-- Post-session is the shape of the service, not a preference. That turned out
-- to be an assumption about *this* service rather than a rule — a blueprint set
-- for a different service has different phases, and there was no way to make
-- one without editing the seed.
--
-- This is the only new operation the canvas IA needs. Everything else it does
-- calls a function that already exists.

-- Provenance, for the same reason the other five tables carry it: without it
-- nothing can tell an app-created phase from a seeded one, and therefore
-- nothing can protect either appropriately. Phases were left out of
-- `20260731000000` precisely because they could not be created.
alter table public.phases
  add column if not exists origin text not null default 'import'
    constraint phases_origin_check check (origin in ('import', 'app'));

/**
 * Create a phase at the end of a lifecycle.
 *
 * Appends rather than taking a position. A phase is a column of the whole
 * canvas, so inserting one in the middle re-lays-out every blueprint to its
 * right — that is a reorder, and reordering is its own operation with its own
 * confirmation. Appending is always safe.
 *
 * `loops_to_phase_id` starts null. A loop back to an earlier phase is a claim
 * about the service ("post-session leads back to pre-session"), and guessing it
 * for a phase that has no content yet would be inventing a fact.
 */
create or replace function public.create_phase(
  lifecycle_id uuid,
  name text,
  description text default null
)
returns uuid
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  new_phase_id uuid;
  next_order int;
begin
  if coalesce(trim(name), '') = '' then
    raise exception 'A phase needs a name';
  end if;

  if not exists (
    select 1 from public.service_lifecycles sl where sl.id = lifecycle_id
  ) then
    raise exception 'Unknown service';
  end if;

  -- Names are how a phase is read in the sidebar and in every cell key, so two
  -- phases sharing one is a genuine ambiguity rather than a cosmetic clash:
  -- `mint_cell_key` would produce the same key for cells in both.
  if exists (
    select 1 from public.phases p
    where p.service_lifecycle_id = lifecycle_id
      and lower(trim(p.name)) = lower(trim(create_phase.name))
  ) then
    raise exception 'This service already has a phase called %', trim(name);
  end if;

  select coalesce(max(p.order_position), -1) + 1 into next_order
  from public.phases p where p.service_lifecycle_id = lifecycle_id;

  insert into public.phases (
    service_lifecycle_id, name, description, order_position, origin
  )
  values (
    lifecycle_id, trim(create_phase.name),
    nullif(trim(create_phase.description), ''), next_order, 'app'
  )
  returning id into new_phase_id;

  return new_phase_id;
end;
$$;

grant execute on function public.create_phase(uuid, text, text) to authenticated;
