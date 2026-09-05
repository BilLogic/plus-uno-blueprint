-- Post-session → Reporting Hours scenario — Happy Path
-- Stable keys map to fixed UUIDs in src/data/reportingHoursHappyPathFallback.ts

insert into public.paths (id, scenario_id, name, summary, kind)
values (
  'a0000000-0000-4000-8000-000000000812',
  'a0000000-0000-4000-8000-000000000208',
  'Happy Path',
  'Tutor reports hours after tutoring session.',
  'happy'
)
on conflict (id) do update set
  scenario_id = excluded.scenario_id,
  name = excluded.name,
  summary = excluded.summary,
  kind = excluded.kind;

delete from public.cell_dependencies
where source_cell_id in (
  select id from public.cells
  where path_id = 'a0000000-0000-4000-8000-000000000812'
);

delete from public.cells
where path_id = 'a0000000-0000-4000-8000-000000000812';

delete from public.lanes
where path_id = 'a0000000-0000-4000-8000-000000000812';

insert into public.lanes (id, path_id, name, position)
values
  ('a0000000-0000-4000-8000-000000000920', 'a0000000-0000-4000-8000-000000000812', 'Storyboard', 0),
  ('a0000000-0000-4000-8000-000000000927', 'a0000000-0000-4000-8000-000000000812', 'Lead Tutor', 1),
  ('a0000000-0000-4000-8000-000000000921', 'a0000000-0000-4000-8000-000000000812', 'Regular Tutor', 2),
  ('a0000000-0000-4000-8000-000000000923', 'a0000000-0000-4000-8000-000000000812', 'Front Stage Tech', 3),
  ('a0000000-0000-4000-8000-000000000922', 'a0000000-0000-4000-8000-000000000812', 'Front Stage Actions', 4),
  ('a0000000-0000-4000-8000-000000000925', 'a0000000-0000-4000-8000-000000000812', 'Back Stage Tech', 5),
  ('a0000000-0000-4000-8000-000000000924', 'a0000000-0000-4000-8000-000000000812', 'Back Stage Actions', 6),
  ('a0000000-0000-4000-8000-000000000926', 'a0000000-0000-4000-8000-000000000812', 'Support Actions', 7)
on conflict (id) do update set
  name = excluded.name,
  position = excluded.position,
  path_id = excluded.path_id;

insert into public.steps (id, scenario_id, name)
values
  ('a0000000-0000-4000-8000-000000000992', 'a0000000-0000-4000-8000-000000000208', 'Report hours'),
  ('a0000000-0000-4000-8000-000000000994', 'a0000000-0000-4000-8000-000000000208', 'Approve hours'),
  ('a0000000-0000-4000-8000-000000000995', 'a0000000-0000-4000-8000-000000000208', 'Receive paycheck')
on conflict (id) do update set
  name = excluded.name,
  scenario_id = excluded.scenario_id;

delete from public.path_steps
where path_id = 'a0000000-0000-4000-8000-000000000812';

insert into public.path_steps (path_id, step_id, position)
values
  ('a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000992', 1),
  ('a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000994', 2),
  ('a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000995', 3)
on conflict (path_id, step_id) do update set
  position = excluded.position;

insert into public.cells (id, path_id, lane_id, step_id, content)
values
  ('a0000000-0000-4000-8000-0000001e0110', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000920', 'a0000000-0000-4000-8000-000000000992', ''),
  ('a0000000-0000-4000-8000-0000001e0102', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000927', 'a0000000-0000-4000-8000-000000000992', 'Report hours by week deadline.'),
  ('a0000000-0000-4000-8000-0000001e0103', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000921', 'a0000000-0000-4000-8000-000000000992', 'Report hours by week deadline.'),
  ('a0000000-0000-4000-8000-0000001e0106', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000923', 'a0000000-0000-4000-8000-000000000992', 'Workday'),
  ('a0000000-0000-4000-8000-0000001e0210', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000920', 'a0000000-0000-4000-8000-000000000995', ''),
  ('a0000000-0000-4000-8000-0000001e0202', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000927', 'a0000000-0000-4000-8000-000000000995', 'Receives biweekly paycheck.'),
  ('a0000000-0000-4000-8000-0000001e0203', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000921', 'a0000000-0000-4000-8000-000000000995', 'Receives biweekly paycheck.'),
  ('a0000000-0000-4000-8000-0000001e0206', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000923', 'a0000000-0000-4000-8000-000000000995', 'Bank'),
  ('a0000000-0000-4000-8000-0000001e0310', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000920', 'a0000000-0000-4000-8000-000000000994', ''),
  ('a0000000-0000-4000-8000-0000001e0307', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000924', 'a0000000-0000-4000-8000-000000000994', 'PLUS supervisor team reviews and approves hours.'),
  ('a0000000-0000-4000-8000-0000001e0308', 'a0000000-0000-4000-8000-000000000812', 'a0000000-0000-4000-8000-000000000925', 'a0000000-0000-4000-8000-000000000994', 'Workday')
on conflict (id) do update set
  path_id = excluded.path_id,
  lane_id = excluded.lane_id,
  step_id = excluded.step_id,
  content = excluded.content;

insert into public.cell_dependencies (id, source_cell_id, target_cell_id)
values
  ('a0000000-0000-4000-8000-000000098090', 'a0000000-0000-4000-8000-0000001e0103', 'a0000000-0000-4000-8000-0000001e0106'),
  ('a0000000-0000-4000-8000-000000098091', 'a0000000-0000-4000-8000-0000001e0102', 'a0000000-0000-4000-8000-0000001e0106'),
  ('a0000000-0000-4000-8000-000000098094', 'a0000000-0000-4000-8000-0000001e0106', 'a0000000-0000-4000-8000-0000001e0307'),
  ('a0000000-0000-4000-8000-000000098085', 'a0000000-0000-4000-8000-0000001e0307', 'a0000000-0000-4000-8000-0000001e0308'),
  ('a0000000-0000-4000-8000-000000098086', 'a0000000-0000-4000-8000-0000001e0308', 'a0000000-0000-4000-8000-0000001e0206'),
  ('a0000000-0000-4000-8000-000000098092', 'a0000000-0000-4000-8000-0000001e0206', 'a0000000-0000-4000-8000-0000001e0202'),
  ('a0000000-0000-4000-8000-000000098093', 'a0000000-0000-4000-8000-0000001e0206', 'a0000000-0000-4000-8000-0000001e0203')
on conflict (id) do update set
  source_cell_id = excluded.source_cell_id,
  target_cell_id = excluded.target_cell_id;

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001e0102/c7eef24c-d9af-c0ba-2217-9ad183056e3d.png'
where id = 'a0000000-0000-4000-8000-0000001e0102';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001e0202/dccfd262-c9f0-de23-7868-848457c0e68d.png'
where id = 'a0000000-0000-4000-8000-0000001e0202';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001e0103/7033cb5d-4202-711e-c9bb-7a9f6d382ccd.png'
where id = 'a0000000-0000-4000-8000-0000001e0103';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001e0203/8962757f-86b3-ff83-f801-a7de491fb841.png'
where id = 'a0000000-0000-4000-8000-0000001e0203';
-- Touchpoint placements — see the note at the foot of supabase/seed.sql.
insert into public.cell_touchpoints (id, cell_id, name, position, summary, origin)
values
  ('cb555474-af5e-558e-40bb-c20aa1af4a2c', 'a0000000-0000-4000-8000-0000001e0106', 'Workday', 0, 'The tutor logs and submits tutoring hours in Workday by the deadline.', 'import'),
  ('2cd27fcf-15c5-ce1e-5eeb-64a9c2f83663', 'a0000000-0000-4000-8000-0000001e0206', 'Bank', 0, 'The tutor receives their biweekly paycheck via direct deposit to their bank account.', 'import'),
  ('05c83da4-1116-b1cf-44c8-ff1069b39887', 'a0000000-0000-4000-8000-0000001e0308', 'Workday', 0, 'The PLUS supervisor team reviews submitted hours and approves them in Workday.', 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  name = excluded.name,
  position = excluded.position,
  summary = excluded.summary;

-- Resources — see the note at the foot of supabase/seed.sql.
insert into public.resources
  (id, cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
values
  ('f4c01d2b-254a-87cf-2cc5-f787018940fb', 'a0000000-0000-4000-8000-0000001e0102', null, 'link', 'Onboarding Module 8', 'https://plus-tutors.notion.site/Module-8-Day-to-Day-Protocols-26fb7cca49828064a32cdde194e36bbd', 1, false, 'import'),
  ('7772e4f5-ec29-701e-8143-4ad50bc5d3a7', 'a0000000-0000-4000-8000-0000001e0106', 'cb555474-af5e-558e-40bb-c20aa1af4a2c', 'attachment', 'Workday', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000100406/f0133eb7-e0c4-7e7d-bedf-a3ac37b455be.png', 0, true, 'import'),
  ('0f903ecb-a4db-0b8e-37e4-0db6b72503d8', 'a0000000-0000-4000-8000-0000001e0202', null, 'link', 'Onboarding Module 8', 'https://plus-tutors.notion.site/Module-8-Day-to-Day-Protocols-26fb7cca49828064a32cdde194e36bbd', 1, false, 'import'),
  ('f394b128-8c75-2d21-6c6d-2ca4b9d6138a', 'a0000000-0000-4000-8000-0000001e0308', '05c83da4-1116-b1cf-44c8-ff1069b39887', 'attachment', 'Workday', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000100406/f0133eb7-e0c4-7e7d-bedf-a3ac37b455be.png', 0, true, 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  cell_touchpoint_id = excluded.cell_touchpoint_id,
  kind = excluded.kind,
  name = excluded.name,
  url = excluded.url,
  position = excluded.position,
  featured = excluded.featured;
