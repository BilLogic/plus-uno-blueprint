-- Goal Setting scenario — shared Lead Tutor step illustrations (all paths)

update public.cells c
set frame = v.frame
from public.lanes l,
     public.paths p,
     (
       values
         (
           'Lead Tutor',
           'Rename students to match roster name',
           'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000040102/74a1e3b0-2b4f-1510-f169-2efd835d2d4b.png'
         ),
         (
           'Lead Tutor',
           'Add any un-rostered students to attendance list',
           'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0202/0911e936-fd5a-3171-9338-9e57d694b158.png'
         ),
         (
           'Lead Tutor',
           'Manually assign unpaired students to available tutors',
           'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0302/d451bb96-0858-37e8-9e3c-588df38cfb2b.png'
         ),
         (
           'Lead Tutor',
           'Inform Classroom teacher about students that are absent',
           'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0402/db5f36b0-90a1-dbfe-92eb-07af60fb4bc0.png'
         ),
         (
           'Lead Tutor',
           'Respond to classroom teachers "ask for help" request',
           'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0502/63b222f0-1142-8cd8-0979-aa8e4ba2bcc2.png'
         )
     ) as v(layer_name, content, frame)
where c.lane_id = l.id
  and c.path_id = p.id
  and l.name = v.layer_name
  and c.content = v.content
  and p.scenario_id = 'a0000000-0000-4000-8000-000000000204';

-- Partner Action: Teacher
update public.cells c
set frame = v.frame
from public.lanes l,
     public.paths p,
     (
       values
         (
           'Partner Action: Teacher',
           'Circulate and quietly observe the students',
           'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000040101/9d01ca1e-57fd-c8f4-c9db-eb5260ec32ee.png'
         ),
         (
           'Partner Action: Teacher',
           'Remind students to keep working while waiting',
           'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000040201/45a51cb4-1ae3-d2c2-5f15-49fd1b4c00f2.png'
         ),
         (
           'Partner Action: Teacher',
           'Checks if all students are in the correct breakout room',
           'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000040301/0c96ea1a-4331-9912-e78a-3cca3a3f8c53.png'
         ),
         (
           'Partner Action: Teacher',
           'Receives information that student is absent from session',
           'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0401/df4eeba7-5747-4aa2-1d62-dde366548029.png'
         ),
         (
           'Partner Action: Teacher',
           'Alerts lead tutor about unassigned or miss-assigned students using the "ask for help" alert',
           'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0501/610fd0d7-ee32-6f6e-8d3c-7d56c796381e.png'
         ),
         (
           'Partner Action: Teacher',
           'Handles student tech problems as they arise',
           'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0601/70caf55e-72b8-3f2e-73e3-c419a60a501c.png'
         ),
         (
           'Partner Action: Teacher',
           'Escalates unresolved issues to tutors@tutor.plus promptly',
           'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0701/3a876ff6-fdbe-77c5-7a7f-1c7d1c305198.png'
         )
     ) as v(layer_name, content, frame)
where c.lane_id = l.id
  and c.path_id = p.id
  and l.name = v.layer_name
  and c.content = v.content
  and p.scenario_id = 'a0000000-0000-4000-8000-000000000204';

-- Front Stage Tech — Zoom/Pencil logos (all paths, all steps)
update public.cells c
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000040106/36ccc1f1-b3bb-3314-2647-5e481ccd1845.png'
from public.lanes l,
     public.paths p
where c.lane_id = l.id
  and c.path_id = p.id
  and l.name = 'Front Stage Tech'
  and (
    c.content = 'Zoom/Pencil'
    or c.content like 'Zoom/Pencil,%'
    or c.content like '%, Zoom/Pencil'
    or c.content like '%, Zoom/Pencil,%'
  )
  and p.scenario_id = 'a0000000-0000-4000-8000-000000000204';

-- Front Stage Tech — Zoom/Pencil shared summary (all paths, all steps)
update public.cells c
set summary = 'The tutor connects with student via Zoom/Pencil in individual breakout room.'
from public.lanes l,
     public.paths p
where c.lane_id = l.id
  and c.path_id = p.id
  and l.name = 'Front Stage Tech'
  and (
    c.content = 'Zoom/Pencil'
    or c.content like 'Zoom/Pencil,%'
    or c.content like '%, Zoom/Pencil'
    or c.content like '%, Zoom/Pencil,%'
  )
  and p.scenario_id = 'a0000000-0000-4000-8000-000000000204';

-- Front Stage Tech — Zoom/Pencil Share Screen step summary (all paths)
update public.cells
set summary = 'The tutor shares screen via Zoom/Pencil screen share feature.'
where id in (
  'a0000000-0000-4000-8000-0000001a0206',
  'a0000000-0000-4000-8000-0000001f0306',
  'a0000000-0000-4000-8000-000000a00306',
  'a0000000-0000-4000-8000-000000b00306',
  'a0000000-0000-4000-8000-000000c00406',
  'a0000000-0000-4000-8000-000000d00406'
);

-- Front Stage Tech — Zoom/Pencil Leave breakout room step summary (all paths)
update public.cells
set summary = 'The tutor leaves the student''s Zoom/Pencil breakout room.'
where id in (
  'a0000000-0000-4000-8000-0000001a0606',
  'a0000000-0000-4000-8000-0000001f1006',
  'a0000000-0000-4000-8000-000000a00706',
  'a0000000-0000-4000-8000-000000b01006',
  'a0000000-0000-4000-8000-000000c01106',
  'a0000000-0000-4000-8000-000000d01106'
);

-- Regular Tutor — step 1 illustration (all paths)
update public.cells c
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/00000000-0000-4000-8000-000000000000/56d6240d-733e-59cb-00b4-f55836e74968.png'
from public.lanes l,
     public.paths p,
     public.path_steps ps
where c.lane_id = l.id
  and c.path_id = p.id
  and ps.path_id = p.id
  and ps.step_id = c.step_id
  and l.name = 'Regular Tutor'
  and ps.position = 1
  and p.scenario_id = 'a0000000-0000-4000-8000-000000000204';

-- Regular Tutor — step 2 illustration (all paths)
update public.cells c
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/00000000-0000-4000-8000-000000000000/31515394-2e1f-c02e-4d76-650a81128b1b.png'
from public.lanes l,
     public.paths p,
     public.path_steps ps
where c.lane_id = l.id
  and c.path_id = p.id
  and ps.path_id = p.id
  and ps.step_id = c.step_id
  and l.name = 'Regular Tutor'
  and ps.position = 2
  and p.scenario_id = 'a0000000-0000-4000-8000-000000000204';

-- Regular Tutor — step 3 illustration (all paths)
update public.cells c
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/00000000-0000-4000-8000-000000000000/dd456872-93de-5c77-4675-5932485c06b8.png'
from public.lanes l,
     public.paths p,
     public.path_steps ps
where c.lane_id = l.id
  and c.path_id = p.id
  and ps.path_id = p.id
  and ps.step_id = c.step_id
  and l.name = 'Regular Tutor'
  and ps.position = 3
  and p.scenario_id = 'a0000000-0000-4000-8000-000000000204';

-- Regular Tutor — step 4 illustration (all paths)
update public.cells c
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/00000000-0000-4000-8000-000000000000/afdac622-3dc2-b53a-4541-f90b106e599a.png'
from public.lanes l,
     public.paths p,
     public.path_steps ps
where c.lane_id = l.id
  and c.path_id = p.id
  and ps.path_id = p.id
  and ps.step_id = c.step_id
  and l.name = 'Regular Tutor'
  and ps.position = 4
  and p.scenario_id = 'a0000000-0000-4000-8000-000000000204';

-- Regular Tutor — step 5 illustration (all paths)
update public.cells c
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/00000000-0000-4000-8000-000000000000/bfc0f8dd-a7f5-00e6-8ae3-40b266d06b7d.png'
from public.lanes l,
     public.paths p,
     public.path_steps ps
where c.lane_id = l.id
  and c.path_id = p.id
  and ps.path_id = p.id
  and ps.step_id = c.step_id
  and l.name = 'Regular Tutor'
  and ps.position = 5
  and p.scenario_id = 'a0000000-0000-4000-8000-000000000204';

-- Regular Tutor — step 6 illustration (all paths)
update public.cells c
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/00000000-0000-4000-8000-000000000000/4065a6ea-b24a-7c27-54c7-fa9c7d5cf14f.png'
from public.lanes l,
     public.paths p,
     public.path_steps ps
where c.lane_id = l.id
  and c.path_id = p.id
  and ps.path_id = p.id
  and ps.step_id = c.step_id
  and l.name = 'Regular Tutor'
  and ps.position = 6
  and p.scenario_id = 'a0000000-0000-4000-8000-000000000204';

-- Regular Tutor — step 7 illustration (all paths)
update public.cells c
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/00000000-0000-4000-8000-000000000000/e9b17d69-2e30-4f33-728d-6a66fea9ecde.png'
from public.lanes l,
     public.paths p,
     public.path_steps ps
where c.lane_id = l.id
  and c.path_id = p.id
  and ps.path_id = p.id
  and ps.step_id = c.step_id
  and l.name = 'Regular Tutor'
  and ps.position = 7
  and p.scenario_id = 'a0000000-0000-4000-8000-000000000204';
