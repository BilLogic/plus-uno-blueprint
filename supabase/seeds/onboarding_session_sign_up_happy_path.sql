-- Onboarding → Session Sign Up scenario — Happy Path
-- Stable keys map to fixed UUIDs in src/data/sessionSignUpHappyPathFallback.ts

insert into public.paths (id, scenario_id, name, summary, kind)
values (
  'a0000000-0000-4000-8000-000000000805',
  'a0000000-0000-4000-8000-000000000125',
  'Happy Path',
  'Tutor signs up for recurring sessions for the rest of the semester.',
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
  where path_id = 'a0000000-0000-4000-8000-000000000805'
);

delete from public.cells
where path_id = 'a0000000-0000-4000-8000-000000000805';

delete from public.lanes
where path_id = 'a0000000-0000-4000-8000-000000000805';

insert into public.lanes (id, path_id, name, position)
values
  (
    'a0000000-0000-4000-8000-000000000878',
    'a0000000-0000-4000-8000-000000000805',
    'Storyboard',
    0
  ),
  (
    'a0000000-0000-4000-8000-000000000879',
    'a0000000-0000-4000-8000-000000000805',
    'Regular Tutor',
    1
  ),
  (
    'a0000000-0000-4000-8000-000000000881',
    'a0000000-0000-4000-8000-000000000805',
    'Front Stage Tech',
    2
  ),
  (
    'a0000000-0000-4000-8000-000000000880',
    'a0000000-0000-4000-8000-000000000805',
    'Front Stage Actions',
    3
  ),
  (
    'a0000000-0000-4000-8000-000000000883',
    'a0000000-0000-4000-8000-000000000805',
    'Back Stage Tech',
    4
  ),
  (
    'a0000000-0000-4000-8000-000000000882',
    'a0000000-0000-4000-8000-000000000805',
    'Back Stage Actions',
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
  position = excluded.position,
  path_id = excluded.path_id;

insert into public.steps (id, scenario_id, name)
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
  scenario_id = excluded.scenario_id;

insert into public.path_steps (path_id, step_id, position)
values
  ('a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000891', 1),
  ('a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000892', 2)
on conflict (path_id, step_id) do update set
  position = excluded.position;

insert into public.cells (id, path_id, lane_id, step_id, content)
values
  ('a0000000-0000-4000-8000-000000130110', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000878', 'a0000000-0000-4000-8000-000000000891', ''),
  ('a0000000-0000-4000-8000-000000130210', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000878', 'a0000000-0000-4000-8000-000000000892', ''),

  ('a0000000-0000-4000-8000-000000130103', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000879', 'a0000000-0000-4000-8000-000000000891', 'Signs up for recurring sessions for rest of semester.'),
  ('a0000000-0000-4000-8000-000000130106', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000881', 'a0000000-0000-4000-8000-000000000891', 'PLUS app'),
  ('a0000000-0000-4000-8000-000000130107', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000882', 'a0000000-0000-4000-8000-000000000891', 'Dev Team takes that scheduling info and stores it in a Google Spreadsheet.'),
  ('a0000000-0000-4000-8000-000000130108', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000883', 'a0000000-0000-4000-8000-000000000891', 'Google Spreadsheet'),
  ('a0000000-0000-4000-8000-000000130109', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000884', 'a0000000-0000-4000-8000-000000000891', E'Dev Team\nDesign Team'),

  ('a0000000-0000-4000-8000-000000130207', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000882', 'a0000000-0000-4000-8000-000000000892', 'Tutor supervisor team receives and reviews Google Spreadsheet from Dev Team.'),
  ('a0000000-0000-4000-8000-000000130208', 'a0000000-0000-4000-8000-000000000805', 'a0000000-0000-4000-8000-000000000883', 'a0000000-0000-4000-8000-000000000892', '')
on conflict (id) do update set
  path_id = excluded.path_id,
  lane_id = excluded.lane_id,
  step_id = excluded.step_id,
  content = excluded.content;

update public.cells
set summary =
  'The Dev Team builds the PLUS app features for session sign up, and the Design Team creates the screens and flows for that experience.'
where id = 'a0000000-0000-4000-8000-000000130109';

update public.cells
set
  summary = 'The tutor signs up for recurring sessions for the rest of the semester in the PLUS app.'
where id = 'a0000000-0000-4000-8000-000000130106';

update public.cells
set
  summary = 'The tutor''s session scheduling information is stored in a Google Spreadsheet.'
where id = 'a0000000-0000-4000-8000-000000130108';

delete from public.cell_dependencies
where id in (
  select id from public.cell_dependencies
  where source_cell_id in (
    select id from public.cells
    where path_id = 'a0000000-0000-4000-8000-000000000805'
  )
);

insert into public.cell_dependencies (id, source_cell_id, target_cell_id)
values
  ('a0000000-0000-4000-8000-000000092003', 'a0000000-0000-4000-8000-000000130103', 'a0000000-0000-4000-8000-000000130106'),
  ('a0000000-0000-4000-8000-000000092001', 'a0000000-0000-4000-8000-000000130106', 'a0000000-0000-4000-8000-000000130107'),
  ('a0000000-0000-4000-8000-000000092004', 'a0000000-0000-4000-8000-000000130107', 'a0000000-0000-4000-8000-000000130108'),
  ('a0000000-0000-4000-8000-000000092005', 'a0000000-0000-4000-8000-000000130108', 'a0000000-0000-4000-8000-000000130207')
on conflict (id) do update set
  source_cell_id = excluded.source_cell_id,
  target_cell_id = excluded.target_cell_id;

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000130103/6e09d0d6-ef24-243c-0b5a-4cfb2c43a6ea.png'
where id = 'a0000000-0000-4000-8000-000000130103';

-- Touchpoint placements — see the note at the foot of supabase/seed.sql.
insert into public.cell_touchpoints (id, cell_id, name, position, summary, origin)
values
  ('8fd0ab0b-0010-aa57-beb2-ea09565c151a', 'a0000000-0000-4000-8000-000000130106', 'PLUS app', 0, 'The tutor signs up for recurring sessions for the rest of the semester in the PLUS app.', 'import'),
  ('fd561f49-6411-fb3a-bc45-348c87e2288c', 'a0000000-0000-4000-8000-000000130108', 'Google Spreadsheet', 0, 'The tutor''s session scheduling information is stored in a Google Spreadsheet.', 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  name = excluded.name,
  position = excluded.position,
  summary = excluded.summary;

-- Resources — see the note at the foot of supabase/seed.sql.
insert into public.resources
  (id, cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
values
  ('f77638d5-70e5-3794-0910-caa92a7cb57f', 'a0000000-0000-4000-8000-000000130106', '8fd0ab0b-0010-aa57-beb2-ea09565c151a', 'link', 'PLUS app', 'https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=1751-119990&t=rLMzaNhqBUszclus-1', 0, true, 'import'),
  ('d8b701ac-df50-3117-5db2-59785a23d3f7', 'a0000000-0000-4000-8000-000000130106', '8fd0ab0b-0010-aa57-beb2-ea09565c151a', 'attachment', 'PLUS app', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000130106/ceb61317-6d1e-512e-8d1f-ab0d2e917ea5.png', 1, true, 'import'),
  ('f9760c23-86b9-0667-e7ee-66f3a11c5e55', 'a0000000-0000-4000-8000-000000130108', 'fd561f49-6411-fb3a-bc45-348c87e2288c', 'attachment', 'Google Spreadsheet', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000150108/737f7fb4-8397-708e-f575-02a91f4ba361.png', 0, true, 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  cell_touchpoint_id = excluded.cell_touchpoint_id,
  kind = excluded.kind,
  name = excluded.name,
  url = excluded.url,
  position = excluded.position,
  featured = excluded.featured;
