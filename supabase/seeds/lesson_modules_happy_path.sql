-- Onboarding → Lesson Modules scenario — Happy Path
-- Stable keys map to fixed UUIDs in src/data/lessonModulesHappyPathFallback.ts

insert into public.paths (id, scenario_id, name, summary, kind)
values (
  'a0000000-0000-4000-8000-000000000802',
  'a0000000-0000-4000-8000-000000000124',
  'Happy Path',
  'Tutor completes lesson modules.',
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
  where path_id = 'a0000000-0000-4000-8000-000000000802'
);

delete from public.cells
where path_id = 'a0000000-0000-4000-8000-000000000802';

delete from public.lanes
where path_id = 'a0000000-0000-4000-8000-000000000802';

insert into public.lanes (id, path_id, name, position)
values
  (
    'a0000000-0000-4000-8000-000000001240',
    'a0000000-0000-4000-8000-000000000802',
    'Storyboard',
    0
  ),
  (
    'a0000000-0000-4000-8000-000000001241',
    'a0000000-0000-4000-8000-000000000802',
    'Regular Tutor',
    1
  ),
  (
    'a0000000-0000-4000-8000-000000001243',
    'a0000000-0000-4000-8000-000000000802',
    'Front Stage Tech',
    2
  ),
  (
    'a0000000-0000-4000-8000-000000001242',
    'a0000000-0000-4000-8000-000000000802',
    'Front Stage Actions',
    3
  ),
  (
    'a0000000-0000-4000-8000-000000001245',
    'a0000000-0000-4000-8000-000000000802',
    'Back Stage Tech',
    4
  ),
  (
    'a0000000-0000-4000-8000-000000001244',
    'a0000000-0000-4000-8000-000000000802',
    'Back Stage Actions',
    5
  ),
  (
    'a0000000-0000-4000-8000-000000001246',
    'a0000000-0000-4000-8000-000000000802',
    'Support Actions',
    6
  )
on conflict (id) do update set
  name = excluded.name,
  position = excluded.position,
  path_id = excluded.path_id;

insert into public.steps (id, scenario_id, name)
values
  (
    'a0000000-0000-4000-8000-000000000861',
    'a0000000-0000-4000-8000-000000000124',
    'Open lesson'
  ),
  (
    'a0000000-0000-4000-8000-000000000862',
    'a0000000-0000-4000-8000-000000000124',
    'Work through questions'
  ),
  (
    'a0000000-0000-4000-8000-000000000863',
    'a0000000-0000-4000-8000-000000000124',
    'Finish lesson'
  )
on conflict (id) do update set
  name = excluded.name,
  scenario_id = excluded.scenario_id;

insert into public.path_steps (path_id, step_id, position)
values
  ('a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000000861', 1),
  ('a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000000862', 2),
  ('a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000000863', 3)
on conflict (path_id, step_id) do update set
  position = excluded.position;

insert into public.cells (id, path_id, lane_id, step_id, content)
values
  ('a0000000-0000-4000-8000-000000120110', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001240', 'a0000000-0000-4000-8000-000000000861', ''),
  ('a0000000-0000-4000-8000-000000120210', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001240', 'a0000000-0000-4000-8000-000000000862', ''),
  ('a0000000-0000-4000-8000-000000120310', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001240', 'a0000000-0000-4000-8000-000000000863', ''),

  ('a0000000-0000-4000-8000-000000120103', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001241', 'a0000000-0000-4000-8000-000000000861', 'Opens next uncompleted assigned lesson.'),
  ('a0000000-0000-4000-8000-000000120106', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001243', 'a0000000-0000-4000-8000-000000000861', 'PLUS App'),
  ('a0000000-0000-4000-8000-000000120107', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001244', 'a0000000-0000-4000-8000-000000000861', 'Tutor supervisor team assigns lessons.'),
  ('a0000000-0000-4000-8000-000000120109', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001246', 'a0000000-0000-4000-8000-000000000861', E'Researchers help guide instructional implementation.\nDev Team\nDesign Team'),

  ('a0000000-0000-4000-8000-000000120203', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001241', 'a0000000-0000-4000-8000-000000000862', 'Works through the questions.'),
  ('a0000000-0000-4000-8000-000000120206', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001243', 'a0000000-0000-4000-8000-000000000862', 'PLUS App'),
  ('a0000000-0000-4000-8000-000000120207', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001244', 'a0000000-0000-4000-8000-000000000862', 'Instructional design team designs and maintains lessons.'),
  ('a0000000-0000-4000-8000-000000120208', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001245', 'a0000000-0000-4000-8000-000000000862', 'Notion'),
  ('a0000000-0000-4000-8000-000000120209', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001246', 'a0000000-0000-4000-8000-000000000862', E'Researchers help guide instructional implementation.\nDev Team\nDesign Team'),

  ('a0000000-0000-4000-8000-000000120303', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001241', 'a0000000-0000-4000-8000-000000000863', 'Finishes lesson and receives score.'),
  ('a0000000-0000-4000-8000-000000120306', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001243', 'a0000000-0000-4000-8000-000000000863', 'PLUS App'),
  ('a0000000-0000-4000-8000-000000120307', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001244', 'a0000000-0000-4000-8000-000000000863', 'Instructional design team designs and maintains lessons.'),
  ('a0000000-0000-4000-8000-000000120308', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001245', 'a0000000-0000-4000-8000-000000000863', 'Notion'),
  ('a0000000-0000-4000-8000-000000120309', 'a0000000-0000-4000-8000-000000000802', 'a0000000-0000-4000-8000-000000001246', 'a0000000-0000-4000-8000-000000000863', E'Dev Team\nDesign Team')
on conflict (id) do update set
  path_id = excluded.path_id,
  lane_id = excluded.lane_id,
  step_id = excluded.step_id,
  content = excluded.content;

delete from public.cell_dependencies
where id in (
  select id from public.cell_dependencies
  where source_cell_id in (
    select id from public.cells
    where path_id = 'a0000000-0000-4000-8000-000000000802'
  )
);

insert into public.cell_dependencies (id, source_cell_id, target_cell_id)
values
  ('a0000000-0000-4000-8000-000000090001', 'a0000000-0000-4000-8000-000000120103', 'a0000000-0000-4000-8000-000000120106'),
  ('a0000000-0000-4000-8000-000000090002', 'a0000000-0000-4000-8000-000000120203', 'a0000000-0000-4000-8000-000000120206'),
  ('a0000000-0000-4000-8000-000000090003', 'a0000000-0000-4000-8000-000000120303', 'a0000000-0000-4000-8000-000000120306'),
  ('a0000000-0000-4000-8000-000000090011', 'a0000000-0000-4000-8000-000000120103', 'a0000000-0000-4000-8000-000000120203'),
  ('a0000000-0000-4000-8000-000000090012', 'a0000000-0000-4000-8000-000000120203', 'a0000000-0000-4000-8000-000000120303'),
  ('a0000000-0000-4000-8000-000000090013', 'a0000000-0000-4000-8000-000000120303', 'a0000000-0000-4000-8000-000000120103'),
  ('a0000000-0000-4000-8000-000000090031', 'a0000000-0000-4000-8000-000000120107', 'a0000000-0000-4000-8000-000000120106'),
  ('a0000000-0000-4000-8000-000000090032', 'a0000000-0000-4000-8000-000000120207', 'a0000000-0000-4000-8000-000000120208'),
  ('a0000000-0000-4000-8000-000000090033', 'a0000000-0000-4000-8000-000000120307', 'a0000000-0000-4000-8000-000000120308'),
  ('a0000000-0000-4000-8000-000000090034', 'a0000000-0000-4000-8000-000000120208', 'a0000000-0000-4000-8000-000000120206'),
  ('a0000000-0000-4000-8000-000000090035', 'a0000000-0000-4000-8000-000000120308', 'a0000000-0000-4000-8000-000000120306')
on conflict (id) do update set
  source_cell_id = excluded.source_cell_id,
  target_cell_id = excluded.target_cell_id;update public.cells
set summary =
  'Researchers help guide how lesson content is designed and delivered so tutors learn effectively.

The Dev Team builds the PLUS app features for lesson modules, and the Design Team creates the screens and flows for that experience.'
where id in (
  'a0000000-0000-4000-8000-000000120109',
  'a0000000-0000-4000-8000-000000120209'
);

update public.cells
set summary =
  'The Dev Team builds the PLUS app features for lesson modules, and the Design Team creates the screens and flows for that experience.'
where id = 'a0000000-0000-4000-8000-000000120309';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000120103/694078eb-62d4-8564-8b5b-55e18bd1b3ef.png'
where id = 'a0000000-0000-4000-8000-000000120103';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000120203/7acdcf35-f515-41d7-01ec-25b58e69e157.png'
where id = 'a0000000-0000-4000-8000-000000120203';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000120303/f1324962-c3b1-ff41-1f61-a87a15eee2bd.png'
where id = 'a0000000-0000-4000-8000-000000120303';

-- Touchpoint placements — see the note at the foot of supabase/seed.sql.
insert into public.cell_touchpoints (id, cell_id, name, position, summary, origin)
values
  ('caa6b3e8-f6ef-5064-366c-29c72b69f367', 'a0000000-0000-4000-8000-000000120106', 'PLUS App', 0, 'The tutor starts the next uncompleted assigned lesson in the PLUS app.', 'import'),
  ('452f228f-6cfb-6c5d-868a-75e50a4c46d5', 'a0000000-0000-4000-8000-000000120206', 'PLUS App', 0, 'The tutor works through the lesson questions in the PLUS app.', 'import'),
  ('794b0fde-f5a4-0ae6-4685-691d43900070', 'a0000000-0000-4000-8000-000000120208', 'Notion', 0, 'The instructional design team uses Notion to design and maintain the lesson content.', 'import'),
  ('0da0bc2b-9a0e-c5e5-f714-d61bdefd303a', 'a0000000-0000-4000-8000-000000120306', 'PLUS App', 0, 'The tutor finishes the lesson in the PLUS app and receives their score.', 'import'),
  ('72764ce7-9254-07e5-4a2a-3c1071b99aa0', 'a0000000-0000-4000-8000-000000120308', 'Notion', 0, 'The instructional design team uses Notion to design and maintain the lesson content.', 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  name = excluded.name,
  position = excluded.position,
  summary = excluded.summary;

-- Resources — see the note at the foot of supabase/seed.sql.
insert into public.resources
  (id, cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
values
  ('363e1def-6ffd-03ca-394f-ab552e0ebc15', 'a0000000-0000-4000-8000-000000120106', 'caa6b3e8-f6ef-5064-366c-29c72b69f367', 'link', 'PLUS App', 'https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3385-256703&t=Fyqmb2RX2B0cj9sv-1', 0, true, 'import'),
  ('89bdedec-d491-ab87-b40a-632c8d95482a', 'a0000000-0000-4000-8000-000000120106', 'caa6b3e8-f6ef-5064-366c-29c72b69f367', 'attachment', 'PLUS App', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000120106/84c0e05b-894a-0b1f-e04c-632fd5ab1142.png', 1, true, 'import'),
  ('7ce6169d-7ae5-25e8-f125-56330bde42c0', 'a0000000-0000-4000-8000-000000120206', '452f228f-6cfb-6c5d-868a-75e50a4c46d5', 'link', 'PLUS App', 'https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3385-256698&t=3WtQ7pKHkR28zhEn-1', 0, true, 'import'),
  ('88ab45ea-8ffd-bf4e-d015-4a0cf746205a', 'a0000000-0000-4000-8000-000000120206', '452f228f-6cfb-6c5d-868a-75e50a4c46d5', 'attachment', 'PLUS App', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000120206/a8133957-06e8-50b6-4bf5-5a1c79fa6b64.png', 1, true, 'import'),
  ('1b8c077d-1e38-cb47-080a-658d57cca64c', 'a0000000-0000-4000-8000-000000120208', '794b0fde-f5a4-0ae6-4685-691d43900070', 'attachment', 'Notion', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090308/19e60568-ae56-7fb2-6711-afba55dc45ea.png', 0, true, 'import'),
  ('6656f7aa-f378-640f-b400-8e38807493f3', 'a0000000-0000-4000-8000-000000120306', '0da0bc2b-9a0e-c5e5-f714-d61bdefd303a', 'link', 'PLUS App', 'https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3385-256699&t=Fyqmb2RX2B0cj9sv-1', 0, true, 'import'),
  ('3aa546f7-1bee-1c81-2d0d-0920a88b3873', 'a0000000-0000-4000-8000-000000120306', '0da0bc2b-9a0e-c5e5-f714-d61bdefd303a', 'attachment', 'PLUS App', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000120306/63c8b284-c01c-41df-836e-80174722f0ca.png', 1, true, 'import'),
  ('967a485d-dfdf-b29a-72f3-0bf257d92083', 'a0000000-0000-4000-8000-000000120308', '72764ce7-9254-07e5-4a2a-3c1071b99aa0', 'attachment', 'Notion', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090308/19e60568-ae56-7fb2-6711-afba55dc45ea.png', 0, true, 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  cell_touchpoint_id = excluded.cell_touchpoint_id,
  kind = excluded.kind,
  name = excluded.name,
  url = excluded.url,
  position = excluded.position,
  featured = excluded.featured;
