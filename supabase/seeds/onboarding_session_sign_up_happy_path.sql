-- Onboarding → Session Sign Up scenario — Happy Path
-- Stable keys map to fixed UUIDs in src/data/sessionSignUpHappyPathFallback.ts

insert into public.paths (id, service_scenario_id, name, description, path_type)
values (
  'a0000000-0000-4000-8000-000000000805',
  'a0000000-0000-4000-8000-000000000125',
  'Happy Path',
  'Tutor succesfully signs up for recurring sessions for the rest of the semester.',
  'happy'
)
on conflict (id) do update set
  service_scenario_id = excluded.service_scenario_id,
  name = excluded.name,
  description = excluded.description,
  path_type = excluded.path_type;

delete from public.cell_triggers
where source_cell_id in (
  select id from public.cells
  where path_id = 'a0000000-0000-4000-8000-000000000805'
);

delete from public.cells
where path_id = 'a0000000-0000-4000-8000-000000000805';

delete from public.layers
where path_id = 'a0000000-0000-4000-8000-000000000805';

insert into public.layers (id, path_id, name, row_position)
values
  (
    'a0000000-0000-4000-8000-000000000878',
    'a0000000-0000-4000-8000-000000000805',
    'Visual',
    0
  ),
  (
    'a0000000-0000-4000-8000-000000000879',
    'a0000000-0000-4000-8000-000000000805',
    'Regular Tutor',
    1
  ),
  (
    'a0000000-0000-4000-8000-000000000880',
    'a0000000-0000-4000-8000-000000000805',
    'Front Stage Actions',
    2
  ),
  (
    'a0000000-0000-4000-8000-000000000881',
    'a0000000-0000-4000-8000-000000000805',
    'Front Stage Tech',
    3
  ),
  (
    'a0000000-0000-4000-8000-000000000882',
    'a0000000-0000-4000-8000-000000000805',
    'Back Stage Actions',
    4
  ),
  (
    'a0000000-0000-4000-8000-000000000883',
    'a0000000-0000-4000-8000-000000000805',
    'Back Stage Tech',
    5
  ),
  (
    'a0000000-0000-4000-8000-000000000884',
    'a0000000-0000-4000-8000-000000000805',
    'Support Actions',
    6
  )
on conflict (id) do update set
  name = excluded.name,
  row_position = excluded.row_position,
  path_id = excluded.path_id;

insert into public.steps (id, service_scenario_id, name)
values
  (
    'a0000000-0000-4000-8000-000000000891',
    'a0000000-0000-4000-8000-000000000125',
    'Sign up'
  ),
  (
    'a0000000-0000-4000-8000-000000000892',
    'a0000000-0000-4000-8000-000000000125',
    'Review scheduling'
  )
on conflict (id) do update set
  name = excluded.name,
  service_scenario_id = excluded.service_scenario_id;

insert into public.path_steps (path_id, step_id, column_position)
values
  ('a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000891', 1),
  ('a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000892', 2)
on conflict (path_id, step_id) do update set
  column_position = excluded.column_position;

insert into public.cells (id, path_id, layer_id, step_id, content)
values
  ('a0000000-0000-4000-8000-000000130110', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000878', 'a0000000-0000-4000-8000-000000000891', ''),
  ('a0000000-0000-4000-8000-000000130210', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000878', 'a0000000-0000-4000-8000-000000000892', ''),

  ('a0000000-0000-4000-8000-000000130103', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000879', 'a0000000-0000-4000-8000-000000000891', 'Sign up for Recurring Sessions for rest of semester'),
  ('a0000000-0000-4000-8000-000000130106', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000881', 'a0000000-0000-4000-8000-000000000891', 'PLUS app'),
  ('a0000000-0000-4000-8000-000000130107', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000882', 'a0000000-0000-4000-8000-000000000891', 'Dev team takes that scheduling info and stores it in a Google Spreadsheet'),
  ('a0000000-0000-4000-8000-000000130108', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000883', 'a0000000-0000-4000-8000-000000000891', 'PLUS App, Google Spreadsheet'),

  ('a0000000-0000-4000-8000-000000130207', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000882', 'a0000000-0000-4000-8000-000000000892', 'Tutor Supervisor team receives and reviews google spreadsheet from dev team'),
  ('a0000000-0000-4000-8000-000000130208', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000883', 'a0000000-0000-4000-8000-000000000892', 'Google Spreadsheet')
on conflict (id) do update set
  path_id = excluded.path_id,
  layer_id = excluded.layer_id,
  step_id = excluded.step_id,
  content = excluded.content;

delete from public.cell_triggers
where id in (
  select id from public.cell_triggers
  where source_cell_id in (
    select id from public.cells
    where path_id = 'a0000000-0000-4000-8000-000000000805'
  )
);

insert into public.cell_triggers (id, source_cell_id, target_cell_id)
values
  ('a0000000-0000-4000-8000-000000092001', 'a0000000-0000-4000-8000-000000130106', 'a0000000-0000-4000-8000-000000130107'),
  ('a0000000-0000-4000-8000-000000092002', 'a0000000-0000-4000-8000-000000130107', 'a0000000-0000-4000-8000-000000130106'),
  ('a0000000-0000-4000-8000-000000092011', 'a0000000-0000-4000-8000-000000130107', 'a0000000-0000-4000-8000-000000130207')
on conflict (id) do update set
  source_cell_id = excluded.source_cell_id,
  target_cell_id = excluded.target_cell_id;
