-- Post-session → Reporting Hours scenario — Happy Path
-- Stable keys map to fixed UUIDs in src/data/reportingHoursHappyPathFallback.ts

insert into public.paths (id, service_scenario_id, name, description, path_type)
values (
  'a0000000-0000-4000-8000-000000000812',
  'a0000000-0000-4000-8000-000000000208',
  'Happy Path',
  'Tutor reports tutoring hours after the session.',
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
  where path_id = 'a0000000-0000-4000-8000-000000000812'
);

delete from public.cells
where path_id = 'a0000000-0000-4000-8000-000000000812';

delete from public.layers
where path_id = 'a0000000-0000-4000-8000-000000000812';

insert into public.layers (id, path_id, name, row_position)
values
  ('a0000000-0000-4000-8000-000000000920', 'a0000000-0000-4000-8000-000000000812', 'Visual', 0),
  ('a0000000-0000-4000-8000-000000000921', 'a0000000-0000-4000-8000-000000000812', 'Regular Tutor', 1),
  ('a0000000-0000-4000-8000-000000000922', 'a0000000-0000-4000-8000-000000000812', 'Front Stage Actions', 2),
  ('a0000000-0000-4000-8000-000000000923', 'a0000000-0000-4000-8000-000000000812', 'Front Stage Tech', 3),
  ('a0000000-0000-4000-8000-000000000924', 'a0000000-0000-4000-8000-000000000812', 'Back Stage Actions', 4),
  ('a0000000-0000-4000-8000-000000000925', 'a0000000-0000-4000-8000-000000000812', 'Back Stage Tech', 5),
  ('a0000000-0000-4000-8000-000000000926', 'a0000000-0000-4000-8000-000000000812', 'Support Actions', 6)
on conflict (id) do update set
  name = excluded.name,
  row_position = excluded.row_position,
  path_id = excluded.path_id;

insert into public.steps (id, service_scenario_id, name)
values
  ('a0000000-0000-4000-8000-000000000992', 'a0000000-0000-4000-8000-000000000208', 'Report hours'),
  ('a0000000-0000-4000-8000-000000000994', 'a0000000-0000-4000-8000-000000000208', 'Approve hours'),
  ('a0000000-0000-4000-8000-000000000995', 'a0000000-0000-4000-8000-000000000208', 'Receive paycheck')
on conflict (id) do update set
  name = excluded.name,
  service_scenario_id = excluded.service_scenario_id;

delete from public.path_steps
where path_id = 'a0000000-0000-4000-8000-000000000812';

insert into public.path_steps (path_id, step_id, column_position)
values
  ('a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000992', 1),
  ('a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000994', 2),
  ('a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000995', 3)
on conflict (path_id, step_id) do update set
  column_position = excluded.column_position;

insert into public.cells (id, path_id, layer_id, step_id, content)
values
  ('a0000000-0000-4000-8000-0000001e0110', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000920', 'a0000000-0000-4000-8000-000000000992', ''),
  ('a0000000-0000-4000-8000-0000001e0103', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000921', 'a0000000-0000-4000-8000-000000000992', 'Report Hours by Week Deadline'),
  ('a0000000-0000-4000-8000-0000001e0106', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000923', 'a0000000-0000-4000-8000-000000000992', 'Workday'),
  ('a0000000-0000-4000-8000-0000001e0210', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000920', 'a0000000-0000-4000-8000-000000000994', ''),
  ('a0000000-0000-4000-8000-0000001e0207', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000924', 'a0000000-0000-4000-8000-000000000994', 'PLUS Supervisor team reviews and approves hours'),
  ('a0000000-0000-4000-8000-0000001e0208', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000925', 'a0000000-0000-4000-8000-000000000994', 'Workday'),
  ('a0000000-0000-4000-8000-0000001e0310', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000920', 'a0000000-0000-4000-8000-000000000995', ''),
  ('a0000000-0000-4000-8000-0000001e0303', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000921', 'a0000000-0000-4000-8000-000000000995', 'Receive Biweekly Paycheck'),
  ('a0000000-0000-4000-8000-0000001e0306', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000923', 'a0000000-0000-4000-8000-000000000995', 'Bank')
on conflict (id) do update set
  path_id = excluded.path_id,
  layer_id = excluded.layer_id,
  step_id = excluded.step_id,
  content = excluded.content;

insert into public.cell_triggers (id, source_cell_id, target_cell_id)
values
  ('a0000000-0000-4000-8000-000000098080', 'a0000000-0000-4000-8000-0000001e0103', 'a0000000-0000-4000-8000-0000001e0207'),
  ('a0000000-0000-4000-8000-000000098081', 'a0000000-0000-4000-8000-0000001e0207', 'a0000000-0000-4000-8000-0000001e0303')
on conflict (id) do update set
  source_cell_id = excluded.source_cell_id,
  target_cell_id = excluded.target_cell_id;
