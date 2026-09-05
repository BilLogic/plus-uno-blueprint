-- In-session → Student Just Joined scenario — Happy Path
-- Stable keys map to fixed UUIDs in src/data/studentsJustJoinedHappyPathFallback.ts

update public.scenarios
set
  summary = 'Teachers and tutors welcome students as they join the session.',
  layout = 'stacked'
where id = 'a0000000-0000-4000-8000-000000000202';

insert into public.paths (id, scenario_id, name, summary, kind)
values (
  'a0000000-0000-4000-8000-00000000080b',
  'a0000000-0000-4000-8000-000000000202',
  'Happy Path',
  'Teachers and tutors welcome students as they join the session.',
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
  where path_id = 'a0000000-0000-4000-8000-00000000080b'
);

delete from public.cells
where path_id = 'a0000000-0000-4000-8000-00000000080b';

delete from public.lanes
where path_id = 'a0000000-0000-4000-8000-00000000080b';

insert into public.lanes (id, path_id, name, position)
values
  ('a0000000-0000-4000-8000-000000002020', 'a0000000-0000-4000-8000-00000000080b', 'Storyboard', 0),
  ('a0000000-0000-4000-8000-000000002021', 'a0000000-0000-4000-8000-00000000080b', 'Partner Action: Teacher', 1),
  ('a0000000-0000-4000-8000-000000002022', 'a0000000-0000-4000-8000-00000000080b', 'Lead Tutor', 2),
  ('a0000000-0000-4000-8000-000000002023', 'a0000000-0000-4000-8000-00000000080b', 'Regular Tutor', 3),
  ('a0000000-0000-4000-8000-000000002024', 'a0000000-0000-4000-8000-00000000080b', 'Front Stage Tech', 4),
  ('a0000000-0000-4000-8000-000000002025', 'a0000000-0000-4000-8000-00000000080b', 'Front Stage Actions', 5),
  ('a0000000-0000-4000-8000-000000002027', 'a0000000-0000-4000-8000-00000000080b', 'Back Stage Tech', 6),
  ('a0000000-0000-4000-8000-000000002026', 'a0000000-0000-4000-8000-00000000080b', 'Back Stage Actions', 7),
  ('a0000000-0000-4000-8000-000000002028', 'a0000000-0000-4000-8000-00000000080b', 'Support Actions', 8)
on conflict (id) do update set
  name = excluded.name,
  position = excluded.position,
  path_id = excluded.path_id;

insert into public.steps (id, scenario_id, name)
values
  ('a0000000-0000-4000-8000-000000000960', 'a0000000-0000-4000-8000-000000000202', 'Students join'),
  ('a0000000-0000-4000-8000-000000000961', 'a0000000-0000-4000-8000-000000000202', 'Share screen and log in'),
  ('a0000000-0000-4000-8000-000000000962', 'a0000000-0000-4000-8000-000000000202', 'Raise hand for help')
on conflict (id) do update set
  name = excluded.name,
  scenario_id = excluded.scenario_id;

delete from public.path_steps
where path_id = 'a0000000-0000-4000-8000-00000000080b';

insert into public.path_steps (path_id, step_id, position)
values
  ('a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000000960', 1),
  ('a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000000961', 2),
  ('a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000000962', 3)
on conflict (path_id, step_id) do update set
  position = excluded.position;

insert into public.cells (id, path_id, lane_id, step_id, content)
values
  ('a0000000-0000-4000-8000-000000190110', 'a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000002020', 'a0000000-0000-4000-8000-000000000960', ''),
  ('a0000000-0000-4000-8000-000000190210', 'a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000002020', 'a0000000-0000-4000-8000-000000000961', ''),
  ('a0000000-0000-4000-8000-000000190310', 'a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000002020', 'a0000000-0000-4000-8000-000000000962', ''),
  ('a0000000-0000-4000-8000-000000190101', 'a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000002021', 'a0000000-0000-4000-8000-000000000960', 'Remind students that tutors support multiple students and wait time is normal.'),
  ('a0000000-0000-4000-8000-000000190201', 'a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000002021', 'a0000000-0000-4000-8000-000000000961', 'Ask students to share screen and log into math software.'),
  ('a0000000-0000-4000-8000-000000190301', 'a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000002021', 'a0000000-0000-4000-8000-000000000962', 'Show students how to use the ''raise hand'' emoji to let tutors know when they need help.'),
  ('a0000000-0000-4000-8000-000000190102', 'a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000002022', 'a0000000-0000-4000-8000-000000000960', 'Greet students as they join.'),
  ('a0000000-0000-4000-8000-000000190202', 'a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000002022', 'a0000000-0000-4000-8000-000000000961', 'Mute students if necessary.'),
  ('a0000000-0000-4000-8000-000000190302', 'a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000002022', 'a0000000-0000-4000-8000-000000000962', 'Ping tutor if they missed moving student to breakout room for late joiners.'),
  ('a0000000-0000-4000-8000-000000190303', 'a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000002023', 'a0000000-0000-4000-8000-000000000962', 'Move student to breakout room.'),
  ('a0000000-0000-4000-8000-000000190106', 'a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000002025', 'a0000000-0000-4000-8000-000000000960', 'Zoom/Pencil'),
  ('a0000000-0000-4000-8000-000000190206', 'a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000002025', 'a0000000-0000-4000-8000-000000000961', 'Zoom/Pencil'),
  ('a0000000-0000-4000-8000-000000190306', 'a0000000-0000-4000-8000-00000000080b', 'a0000000-0000-4000-8000-000000002025', 'a0000000-0000-4000-8000-000000000962', 'Zoom/Pencil')
on conflict (id) do update set
  path_id = excluded.path_id,
  lane_id = excluded.lane_id,
  step_id = excluded.step_id,
  content = excluded.content;

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000190101/b2c048eb-8c1b-1e90-b650-91c83f61bff0.png'
where id = 'a0000000-0000-4000-8000-000000190101';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000190201/971ff267-83a9-bbc1-aa8d-b1d9566c723e.png'
where id = 'a0000000-0000-4000-8000-000000190201';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000190301/c2a5af30-6c33-aaf8-66e0-f782fca767f4.png'
where id = 'a0000000-0000-4000-8000-000000190301';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000190102/218c9cbc-f78d-ce67-c06f-2a719dfe355c.png'
where id = 'a0000000-0000-4000-8000-000000190102';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000190202/a1fd75a0-1fb0-10cf-b45a-c9d6f5ad1adc.png'
where id = 'a0000000-0000-4000-8000-000000190202';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000190302/24a8b06c-a3d5-905b-f0c2-8183ccfc30af.png'
where id = 'a0000000-0000-4000-8000-000000190302';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000190303/8dc54203-5cb3-6128-a60d-6ff39b848e54.png'
where id = 'a0000000-0000-4000-8000-000000190303';

update public.cells
set
  frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000040106/36ccc1f1-b3bb-3314-2647-5e481ccd1845.png',
  summary = 'The lead tutor greets students on Zoom/Pencil as they join the session.'
where path_id = 'a0000000-0000-4000-8000-00000000080b'
  and id = 'a0000000-0000-4000-8000-000000190106';

update public.cells
set
  frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000040106/36ccc1f1-b3bb-3314-2647-5e481ccd1845.png',
  summary = 'Lead tutors utilize the mute function on Zoom/Pencil if necessary.'
where path_id = 'a0000000-0000-4000-8000-00000000080b'
  and id = 'a0000000-0000-4000-8000-000000190206';

update public.cells
set
  frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000040106/36ccc1f1-b3bb-3314-2647-5e481ccd1845.png',
  summary = 'Regular tutors move their students to their corresponding breakout room on Zoom/Pencil.'
where path_id = 'a0000000-0000-4000-8000-00000000080b'
  and id = 'a0000000-0000-4000-8000-000000190306';

insert into public.cell_dependencies (id, source_cell_id, target_cell_id)
values
  ('a0000000-0000-4000-8000-000000097001', 'a0000000-0000-4000-8000-000000190101', 'a0000000-0000-4000-8000-000000190201'),
  ('a0000000-0000-4000-8000-000000097002', 'a0000000-0000-4000-8000-000000190201', 'a0000000-0000-4000-8000-000000190301'),
  ('a0000000-0000-4000-8000-000000097010', 'a0000000-0000-4000-8000-000000190102', 'a0000000-0000-4000-8000-000000190202'),
  ('a0000000-0000-4000-8000-000000097011', 'a0000000-0000-4000-8000-000000190202', 'a0000000-0000-4000-8000-000000190302'),
  ('a0000000-0000-4000-8000-000000097020', 'a0000000-0000-4000-8000-000000190302', 'a0000000-0000-4000-8000-000000190303'),
  ('a0000000-0000-4000-8000-000000097031', 'a0000000-0000-4000-8000-000000190102', 'a0000000-0000-4000-8000-000000190106'),
  ('a0000000-0000-4000-8000-000000097032', 'a0000000-0000-4000-8000-000000190202', 'a0000000-0000-4000-8000-000000190206'),
  ('a0000000-0000-4000-8000-000000097030', 'a0000000-0000-4000-8000-000000190303', 'a0000000-0000-4000-8000-000000190306')
on conflict (id) do update set
  source_cell_id = excluded.source_cell_id,
  target_cell_id = excluded.target_cell_id;
