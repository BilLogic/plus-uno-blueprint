-- Pre-session → Standard Scheduling scenario — Happy Path
-- Stable keys map to fixed UUIDs in src/data/standardSchedulingHappyPathFallback.ts

insert into public.paths (id, scenario_id, name, summary, kind)
values (
  'a0000000-0000-4000-8000-000000000806',
  'a0000000-0000-4000-8000-000000000126',
  'Happy Path',
  'Tutors receive semester schedule.',
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
  where path_id = 'a0000000-0000-4000-8000-000000000806'
);

delete from public.cells
where path_id = 'a0000000-0000-4000-8000-000000000806';

delete from public.lanes
where path_id = 'a0000000-0000-4000-8000-000000000806';

insert into public.lanes (id, path_id, name, position)
values
  (
    'a0000000-0000-4000-8000-000000000885',
    'a0000000-0000-4000-8000-000000000806',
    'Storyboard',
    0
  ),
  (
    'a0000000-0000-4000-8000-000000000886',
    'a0000000-0000-4000-8000-000000000806',
    'Regular Tutor',
    1
  ),
  (
    'a0000000-0000-4000-8000-000000000888',
    'a0000000-0000-4000-8000-000000000806',
    'Front Stage Tech',
    2
  ),
  (
    'a0000000-0000-4000-8000-000000000887',
    'a0000000-0000-4000-8000-000000000806',
    'Front Stage Actions',
    3
  ),
  (
    'a0000000-0000-4000-8000-000000000890',
    'a0000000-0000-4000-8000-000000000806',
    'Back Stage Tech',
    4
  ),
  (
    'a0000000-0000-4000-8000-000000000889',
    'a0000000-0000-4000-8000-000000000806',
    'Back Stage Actions',
    5
  ),
  (
    'a0000000-0000-4000-8000-000000000895',
    'a0000000-0000-4000-8000-000000000806',
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
    'a0000000-0000-4000-8000-000000000894',
    'a0000000-0000-4000-8000-000000000126',
    'Review schedules'
  ),
  (
    'a0000000-0000-4000-8000-000000000896',
    'a0000000-0000-4000-8000-000000000126',
    'Receive schedule'
  )
on conflict (id) do update set
  name = excluded.name,
  scenario_id = excluded.scenario_id;

delete from public.path_steps
where path_id = 'a0000000-0000-4000-8000-000000000806';

insert into public.path_steps (path_id, step_id, position)
values
  ('a0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000894', 1),
  ('a0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000896', 2)
on conflict (path_id, step_id) do update set
  position = excluded.position;

insert into public.cells (id, path_id, lane_id, step_id, content)
values
  ('a0000000-0000-4000-8000-000000140110', 'a0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000885', 'a0000000-0000-4000-8000-000000000894', ''),

  ('a0000000-0000-4000-8000-000000140107', 'a0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000889', 'a0000000-0000-4000-8000-000000000894', 'Tutor supervisor team receives and reviews tutor schedules from the Dev Team.'),
  ('a0000000-0000-4000-8000-000000140108', 'a0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000890', 'a0000000-0000-4000-8000-000000000894', 'Google Spreadsheet'),
  ('a0000000-0000-4000-8000-000000140109', 'a0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000895', 'a0000000-0000-4000-8000-000000000894', 'Dev Team'),

  ('a0000000-0000-4000-8000-000000140210', 'a0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000885', 'a0000000-0000-4000-8000-000000000896', ''),
  ('a0000000-0000-4000-8000-000000140203', 'a0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000886', 'a0000000-0000-4000-8000-000000000896', 'Receive schedule for the semester.'),
  ('a0000000-0000-4000-8000-000000140204', 'a0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000887', 'a0000000-0000-4000-8000-000000000896', 'Tutor supervisor team sends schedule.'),
  ('a0000000-0000-4000-8000-000000140206', 'a0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000888', 'a0000000-0000-4000-8000-000000000896', 'PLUS App'),
  ('a0000000-0000-4000-8000-000000140209', 'a0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000895', 'a0000000-0000-4000-8000-000000000896', E'Dev Team\nDesign Team')
on conflict (id) do update set
  path_id = excluded.path_id,
  lane_id = excluded.lane_id,
  step_id = excluded.step_id,
  content = excluded.content;

delete from public.cell_dependencies
where id in (
  'a0000000-0000-4000-8000-000000093001',
  'a0000000-0000-4000-8000-000000093002',
  'a0000000-0000-4000-8000-000000093003',
  'a0000000-0000-4000-8000-000000093004'
);

insert into public.cell_dependencies (id, source_cell_id, target_cell_id)
values
  (
    'a0000000-0000-4000-8000-000000093003',
    'a0000000-0000-4000-8000-000000140108',
    'a0000000-0000-4000-8000-000000140107'
  ),
  (
    'a0000000-0000-4000-8000-000000093001',
    'a0000000-0000-4000-8000-000000140107',
    'a0000000-0000-4000-8000-000000140204'
  ),
  (
    'a0000000-0000-4000-8000-000000093002',
    'a0000000-0000-4000-8000-000000140204',
    'a0000000-0000-4000-8000-000000140206'
  ),
  (
    'a0000000-0000-4000-8000-000000093004',
    'a0000000-0000-4000-8000-000000140206',
    'a0000000-0000-4000-8000-000000140203'
  )
on conflict (id) do update set
  source_cell_id = excluded.source_cell_id,
  target_cell_id = excluded.target_cell_id;

update public.cells
set
  summary = 'The tutor''s session scheduling information is stored in a Google Spreadsheet.'
where id = 'a0000000-0000-4000-8000-000000140108';

update public.cells
set
  summary = 'The tutor supervisor team sends the semester schedule to tutors through the PLUS app.'
where id = 'a0000000-0000-4000-8000-000000140206';

update public.cells
set summary =
  'The Dev Team stores tutor schedules in a Google Spreadsheet for the tutor supervisor team to review.'
where id = 'a0000000-0000-4000-8000-000000140109';

update public.cells
set summary =
  'The Dev Team builds the PLUS app features for sending semester schedules, and the Design Team creates the screens and flows for that experience.'
where id = 'a0000000-0000-4000-8000-000000140209';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000140203/1c4f0033-cf8e-8dba-0257-a590fbdf9aa0.png'
where id = 'a0000000-0000-4000-8000-000000140203';

-- Touchpoint placements — see the note at the foot of supabase/seed.sql.
insert into public.cell_touchpoints (id, cell_id, name, position, summary, origin)
values
  ('b9f83e94-6484-daac-4041-51a7e9ce1e12', 'a0000000-0000-4000-8000-000000140108', 'Google Spreadsheet', 0, 'The tutor''s session scheduling information is stored in a Google Spreadsheet.', 'import'),
  ('7a7a8da2-2734-1e66-d486-426c90e4fb64', 'a0000000-0000-4000-8000-000000140206', 'PLUS App', 0, 'The tutor supervisor team sends the semester schedule to tutors through the PLUS app.', 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  name = excluded.name,
  position = excluded.position,
  summary = excluded.summary;

-- Resources — see the note at the foot of supabase/seed.sql.
insert into public.resources
  (id, cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
values
  ('a86bc132-9809-7d29-9fa4-1efbe469e168', 'a0000000-0000-4000-8000-000000140108', 'b9f83e94-6484-daac-4041-51a7e9ce1e12', 'attachment', 'Google Spreadsheet', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000150108/737f7fb4-8397-708e-f575-02a91f4ba361.png', 0, true, 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  cell_touchpoint_id = excluded.cell_touchpoint_id,
  kind = excluded.kind,
  name = excluded.name,
  url = excluded.url,
  position = excluded.position,
  featured = excluded.featured;
