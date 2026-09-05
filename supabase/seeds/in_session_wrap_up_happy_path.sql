-- In-session → Wrap-Up scenario — Happy Path
-- Stable keys map to fixed UUIDs in src/data/wrapUpHappyPathFallback.ts

update public.scenarios
set
  summary = 'Teachers and tutors close breakout sessions, debrief, and complete wrap-up tasks.',
  layout = 'stacked'
where id = 'a0000000-0000-4000-8000-000000000206';

insert into public.paths (id, scenario_id, name, summary, kind)
values (
  'a0000000-0000-4000-8000-00000000080e',
  'a0000000-0000-4000-8000-000000000206',
  'Happy Path',
  'Teachers and tutors close breakout sessions, debrief, and complete wrap-up tasks.',
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
  where path_id = 'a0000000-0000-4000-8000-00000000080e'
);

delete from public.cells
where path_id = 'a0000000-0000-4000-8000-00000000080e';

delete from public.lanes
where path_id = 'a0000000-0000-4000-8000-00000000080e';

insert into public.lanes (id, path_id, name, position)
values
  ('a0000000-0000-4000-8000-000000000870', 'a0000000-0000-4000-8000-00000000080e', 'Storyboard', 0),
  ('a0000000-0000-4000-8000-000000000871', 'a0000000-0000-4000-8000-00000000080e', 'Partner Action: Teacher', 1),
  ('a0000000-0000-4000-8000-000000000872', 'a0000000-0000-4000-8000-00000000080e', 'Lead Tutor', 2),
  ('a0000000-0000-4000-8000-000000000873', 'a0000000-0000-4000-8000-00000000080e', 'Regular Tutor', 3),
  ('a0000000-0000-4000-8000-000000000874', 'a0000000-0000-4000-8000-00000000080e', 'Front Stage Tech', 4),
  ('a0000000-0000-4000-8000-000000000875', 'a0000000-0000-4000-8000-00000000080e', 'Front Stage Actions', 5),
  ('a0000000-0000-4000-8000-000000000877', 'a0000000-0000-4000-8000-00000000080e', 'Back Stage Tech', 6),
  ('a0000000-0000-4000-8000-000000000876', 'a0000000-0000-4000-8000-00000000080e', 'Back Stage Actions', 7),
  ('a0000000-0000-4000-8000-00000000087a', 'a0000000-0000-4000-8000-00000000080e', 'Support Actions', 8)
on conflict (id) do update set
  name = excluded.name,
  position = excluded.position,
  path_id = excluded.path_id;

insert into public.steps (id, scenario_id, name)
values
  ('a0000000-0000-4000-8000-000000000980', 'a0000000-0000-4000-8000-000000000206', 'Close breakout sessions'),
  ('a0000000-0000-4000-8000-000000000981', 'a0000000-0000-4000-8000-000000000206', 'Thank students'),
  ('a0000000-0000-4000-8000-000000000982', 'a0000000-0000-4000-8000-000000000206', 'Debrief with tutors'),
  ('a0000000-0000-4000-8000-000000000983', 'a0000000-0000-4000-8000-000000000206', 'Complete wrap-up')
on conflict (id) do update set
  name = excluded.name,
  scenario_id = excluded.scenario_id;

delete from public.path_steps
where path_id = 'a0000000-0000-4000-8000-00000000080e';

insert into public.path_steps (path_id, step_id, position)
values
  ('a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000980', 1),
  ('a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000981', 2),
  ('a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000982', 3),
  ('a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000983', 4)
on conflict (path_id, step_id) do update set
  position = excluded.position;

insert into public.cells (id, path_id, lane_id, step_id, content)
values
  ('a0000000-0000-4000-8000-0000001c0110', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000870', 'a0000000-0000-4000-8000-000000000980', ''),
  ('a0000000-0000-4000-8000-0000001c0210', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000870', 'a0000000-0000-4000-8000-000000000981', ''),
  ('a0000000-0000-4000-8000-0000001c0310', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000870', 'a0000000-0000-4000-8000-000000000982', ''),
  ('a0000000-0000-4000-8000-0000001c0410', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000870', 'a0000000-0000-4000-8000-000000000983', ''),
  ('a0000000-0000-4000-8000-0000001c0101', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000871', 'a0000000-0000-4000-8000-000000000980', 'Help students log out of Zoom.'),
  ('a0000000-0000-4000-8000-0000001c0201', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000871', 'a0000000-0000-4000-8000-000000000981', 'Remind students to save their work or note what they accomplished.'),
  ('a0000000-0000-4000-8000-0000001c0301', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000871', 'a0000000-0000-4000-8000-000000000982', 'Encourage them to reflect on what they learned or practiced.'),
  ('a0000000-0000-4000-8000-0000001c0401', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000871', 'a0000000-0000-4000-8000-000000000983', 'Share quick reminders to students about what to bring or prepare for next time.'),
  ('a0000000-0000-4000-8000-0000001c0102', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000872', 'a0000000-0000-4000-8000-000000000980', 'Close breakout rooms.'),
  ('a0000000-0000-4000-8000-0000001c0202', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000872', 'a0000000-0000-4000-8000-000000000981', 'Thank students.'),
  ('a0000000-0000-4000-8000-0000001c0302', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000872', 'a0000000-0000-4000-8000-000000000982', 'Debrief with tutors.'),
  ('a0000000-0000-4000-8000-0000001c0402', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000872', 'a0000000-0000-4000-8000-000000000983', 'Remind tutors to upload Zoom recording and complete reflection form.'),
  ('a0000000-0000-4000-8000-0000001c0103', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000873', 'a0000000-0000-4000-8000-000000000980', 'Return to main room.'),
  ('a0000000-0000-4000-8000-0000001c0203', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000873', 'a0000000-0000-4000-8000-000000000981', 'Thank students.'),
  ('a0000000-0000-4000-8000-0000001c0303', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000873', 'a0000000-0000-4000-8000-000000000982', 'Debrief with lead tutor.'),
  ('a0000000-0000-4000-8000-0000001c0403', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000873', 'a0000000-0000-4000-8000-000000000983', 'Fill out reflection form and upload Zoom recording.'),
  ('a0000000-0000-4000-8000-0000001c0106', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000875', 'a0000000-0000-4000-8000-000000000980', 'Zoom/Pencil'),
  ('a0000000-0000-4000-8000-0000001c0206', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000875', 'a0000000-0000-4000-8000-000000000981', 'Zoom/Pencil'),
  ('a0000000-0000-4000-8000-0000001c0306', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000875', 'a0000000-0000-4000-8000-000000000982', 'Zoom/Pencil'),
  ('a0000000-0000-4000-8000-0000001c0406', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-000000000875', 'a0000000-0000-4000-8000-000000000983', 'PLUS App'),
  ('a0000000-0000-4000-8000-0000001c0409', 'a0000000-0000-4000-8000-00000000080e', 'a0000000-0000-4000-8000-00000000087a', 'a0000000-0000-4000-8000-000000000983', E'Dev Team\nDesign Team')
on conflict (id) do update set
  path_id = excluded.path_id,
  lane_id = excluded.lane_id,
  step_id = excluded.step_id,
  content = excluded.content;

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000040106/36ccc1f1-b3bb-3314-2647-5e481ccd1845.png'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id in (
    'a0000000-0000-4000-8000-0000001c0106',
    'a0000000-0000-4000-8000-0000001c0206',
    'a0000000-0000-4000-8000-0000001c0306'
  );

update public.cells
set summary =
  'Tutor connects with the other tutors and students via Zoom/Pencil.'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0106';

update public.cells
set summary =
  'Tutors connect with the students via Zoom/Pencil.'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0206';

update public.cells
set summary =
  'Tutors connect with lead tutors via Zoom/Pencil.'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0306';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001c0101/30b4be58-bca7-4766-292f-f97f76fd7b4c.png'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0101';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001c0201/0b4fd703-3198-d047-39a9-9e91fb557c22.png'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0201';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001c0301/074e38ef-3305-5d21-da9f-bd664b33736c.png'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0301';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001c0401/7c034094-330b-860b-595b-ce195c753c3f.png'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0401';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001c0102/122c0e83-cb94-5202-a7d8-8e363263fc4c.png'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0102';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001c0202/ab7c18a0-caad-0e09-7d09-53b1b2d1be1a.png'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0202';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001c0302/885bbe2d-fd9c-2f53-40f4-8f924968a1d4.png'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0302';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001c0402/5872cc3d-d7be-ef82-190d-50f78abe0e99.png'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0402';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001c0103/37f0c948-30bf-3c0c-e731-c2a48f45b3b1.png'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0103';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001c0203/bbe4265b-798d-5e7d-7b02-fd7a9850412a.png'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0203';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001c0303/38d1d044-268d-972d-2655-e947af1e0ec3.png'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0303';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001c0403/a5041dc6-f107-619c-8d84-53d086006a30.png'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0403';

update public.cells
set summary =
  'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'
where path_id = 'a0000000-0000-4000-8000-00000000080e'
  and id = 'a0000000-0000-4000-8000-0000001c0409';
insert into public.cell_dependencies (id, source_cell_id, target_cell_id)
values
  ('a0000000-0000-4000-8000-00000009a001', 'a0000000-0000-4000-8000-0000001c0101', 'a0000000-0000-4000-8000-0000001c0201'),
  ('a0000000-0000-4000-8000-00000009a002', 'a0000000-0000-4000-8000-0000001c0201', 'a0000000-0000-4000-8000-0000001c0301'),
  ('a0000000-0000-4000-8000-00000009a003', 'a0000000-0000-4000-8000-0000001c0301', 'a0000000-0000-4000-8000-0000001c0401'),
  ('a0000000-0000-4000-8000-00000009a010', 'a0000000-0000-4000-8000-0000001c0102', 'a0000000-0000-4000-8000-0000001c0202'),
  ('a0000000-0000-4000-8000-00000009a011', 'a0000000-0000-4000-8000-0000001c0202', 'a0000000-0000-4000-8000-0000001c0302'),
  ('a0000000-0000-4000-8000-00000009a012', 'a0000000-0000-4000-8000-0000001c0302', 'a0000000-0000-4000-8000-0000001c0402'),
  ('a0000000-0000-4000-8000-00000009a020', 'a0000000-0000-4000-8000-0000001c0103', 'a0000000-0000-4000-8000-0000001c0203'),
  ('a0000000-0000-4000-8000-00000009a021', 'a0000000-0000-4000-8000-0000001c0203', 'a0000000-0000-4000-8000-0000001c0303'),
  ('a0000000-0000-4000-8000-00000009a022', 'a0000000-0000-4000-8000-0000001c0303', 'a0000000-0000-4000-8000-0000001c0403'),
  ('a0000000-0000-4000-8000-00000009a033', 'a0000000-0000-4000-8000-0000001c0302', 'a0000000-0000-4000-8000-0000001c0303'),
  ('a0000000-0000-4000-8000-00000009a034', 'a0000000-0000-4000-8000-0000001c0303', 'a0000000-0000-4000-8000-0000001c0302'),
  ('a0000000-0000-4000-8000-00000009a113', 'a0000000-0000-4000-8000-0000001c0103', 'a0000000-0000-4000-8000-0000001c0106'),
  ('a0000000-0000-4000-8000-00000009a114', 'a0000000-0000-4000-8000-0000001c0203', 'a0000000-0000-4000-8000-0000001c0206'),
  ('a0000000-0000-4000-8000-00000009a115', 'a0000000-0000-4000-8000-0000001c0303', 'a0000000-0000-4000-8000-0000001c0306'),
  ('a0000000-0000-4000-8000-00000009a116', 'a0000000-0000-4000-8000-0000001c0403', 'a0000000-0000-4000-8000-0000001c0406')
on conflict (id) do update set
  source_cell_id = excluded.source_cell_id,
  target_cell_id = excluded.target_cell_id;

-- Touchpoint placements — see the note at the foot of supabase/seed.sql.
insert into public.cell_touchpoints (id, cell_id, name, position, summary, origin)
values
  ('fd53a99d-0944-86d7-f8be-58d7f44b8c2e', 'a0000000-0000-4000-8000-0000001c0406', 'PLUS App', 0, 'The tutor completes the reflection form in the PLUS app after the session.', 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  name = excluded.name,
  position = excluded.position,
  summary = excluded.summary;

-- Resources — see the note at the foot of supabase/seed.sql.
insert into public.resources
  (id, cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
values
  ('1697cf05-9245-a56c-7229-e4726ac58f4e', 'a0000000-0000-4000-8000-0000001c0406', 'fd53a99d-0944-86d7-f8be-58d7f44b8c2e', 'link', 'PLUS App', 'https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=563-296430&t=XKhgzk0ZQ9Na4Nqs-1', 0, true, 'import'),
  ('69aa434c-ba12-214c-c98e-b6feb4d317ea', 'a0000000-0000-4000-8000-0000001c0406', 'fd53a99d-0944-86d7-f8be-58d7f44b8c2e', 'attachment', 'PLUS App', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001c0406/658db114-bc17-14fe-b7e6-e573d02ab360.png', 1, true, 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  cell_touchpoint_id = excluded.cell_touchpoint_id,
  kind = excluded.kind,
  name = excluded.name,
  url = excluded.url,
  position = excluded.position,
  featured = excluded.featured;
