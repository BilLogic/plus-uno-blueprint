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

  select count(*) into leftover from public.paths where path_type = 'custom';
  if leftover <> 11 then
    raise exception 'expected 11 custom paths, found %', leftover;
  end if;
end $$;
