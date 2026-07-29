-- Title-based paths (Goal Setting activity variants) use path_type `named`.
-- Identity is the path name (Set Goals, Check Goals, …), not a journey archetype
-- such as happy / alternative / exception.

alter table public.paths
  drop constraint if exists paths_path_type_check;

alter table public.paths
  add constraint paths_path_type_check
  check (
    path_type in (
      'happy',
      'unhappy',
      'exception',
      'alternative',
      'named'
    )
  );

comment on column public.paths.path_type is
  'Path variant: happy, unhappy, exception, alternative, or named (title-based identity)';

update public.paths
set
  path_type = 'named',
  updated_at = now()
where service_scenario_id = 'a0000000-0000-4000-8000-000000000204'
  and name in (
    'Set Goals',
    'Check Goals',
    'Update Goals',
    'Set Goals Edge Case',
    'Update Goals Edge Case'
  );
