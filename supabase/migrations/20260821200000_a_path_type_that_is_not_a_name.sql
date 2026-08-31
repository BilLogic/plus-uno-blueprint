-- `named` was never a good word for it.
--
-- The value means "this path has no journey archetype — it is one of a set of
-- peer routes told apart by what they are called". Every path has a name, so
-- `named` reads as a tautology, and the UI printed "Named path" beside
-- "Set Goals" as though that were a kind of path. It is the absence of a kind.
--
-- `custom` says the true thing: the service defined this route itself rather
-- than drawing it from the happy/unhappy/exception/alternative vocabulary.

alter table public.paths
  drop constraint if exists paths_path_type_check;

-- Widen first, migrate, then narrow. A single swapped constraint would refuse
-- the very rows it is meant to convert.
alter table public.paths
  add constraint paths_path_type_check
  check (
    path_type in (
      'happy',
      'unhappy',
      'exception',
      'alternative',
      'named',
      'custom'
    )
  );

update public.paths
set path_type = 'custom', updated_at = now()
where path_type = 'named';

alter table public.paths
  drop constraint paths_path_type_check;

alter table public.paths
  add constraint paths_path_type_check
  check (
    path_type in (
      'happy',
      'unhappy',
      'exception',
      'alternative',
      'custom'
    )
  );

comment on column public.paths.path_type is
  'Journey archetype: happy, unhappy, exception, alternative — or custom, for a route this service defined itself rather than drawing from that vocabulary.';

do $$
declare
  leftover int;
begin
  select count(*) into leftover from public.paths where path_type = 'named';
  if leftover > 0 then
    raise exception 'still % paths on the old value', leftover;
  end if;

  -- AMENDED 2026-08-31. A census — `expected 11 custom paths` — stood here,
  -- counting production's rows on the day. On an empty database `paths` holds
  -- nothing, it raises, and because a migration is one transaction the
  -- CONSTRAINT SWAP ABOVE ROLLS BACK: the narrowed `paths_path_type_check`
  -- never lands, and `20260821220000`, which widens the same constraint and
  -- then narrows it again, is working from a vocabulary this file was supposed
  -- to have set.
  --
  -- The rule is `20260821340000`'s: amend an applied migration only where
  -- leaving it is actively harmful, and an assertion that disables the only
  -- instrument this repository has for #148 is that case.
  --
  -- Nothing replaces it, because the assertion above IS the invariant it was
  -- reaching for. `expected 11` said "the update converted the rows I counted
  -- yesterday"; `still % paths on the old value` says "the update left nothing
  -- behind", which is the same claim without the date on it — vacuously true
  -- on an empty database, and on production the two could not have differed.
end $$;
