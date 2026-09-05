-- Application → Interview scenario — Happy Path
-- Stable keys map to fixed UUIDs in src/data/applicationInterviewHappyPathFallback.ts

insert into public.paths (id, scenario_id, name, summary, kind)
values (
  'a0000000-0000-4000-8000-000000000702',
  'a0000000-0000-4000-8000-000000000122',
  'Happy Path',
  'Tutor applies, interviews with the team, and receives an offer decision.',
  'happy'
)
on conflict (id) do update set
  scenario_id = excluded.scenario_id,
  name = excluded.name,
  summary = excluded.summary,
  kind = excluded.kind;

insert into public.lanes (id, path_id, name, position)
values
  (
    'a0000000-0000-4000-8000-000000000810',
    'a0000000-0000-4000-8000-000000000702',
    'Storyboard',
    0
  ),
  (
    'a0000000-0000-4000-8000-000000000803',
    'a0000000-0000-4000-8000-000000000702',
    'Regular Tutor',
    1
  ),
  (
    'a0000000-0000-4000-8000-000000000806',
    'a0000000-0000-4000-8000-000000000702',
    'Front Stage Tech',
    2
  ),
  (
    'a0000000-0000-4000-8000-000000000804',
    'a0000000-0000-4000-8000-000000000702',
    'Front Stage Actions',
    3
  ),
  (
    'a0000000-0000-4000-8000-000000000808',
    'a0000000-0000-4000-8000-000000000702',
    'Back Stage Tech',
    4
  ),
  (
    'a0000000-0000-4000-8000-000000000807',
    'a0000000-0000-4000-8000-000000000702',
    'Back Stage Actions',
    5
  ),
  (
    'a0000000-0000-4000-8000-000000000809',
    'a0000000-0000-4000-8000-000000000702',
    'Support Actions',
    6
  )
on conflict (id) do update set
  name = excluded.name,
  position = excluded.position;

insert into public.steps (id, scenario_id, name)
values
  (
    'a0000000-0000-4000-8000-000000000731',
    'a0000000-0000-4000-8000-000000000122',
    'Applies'
  ),
  (
    'a0000000-0000-4000-8000-000000000732',
    'a0000000-0000-4000-8000-000000000122',
    'Receives email invitation for group interview'
  ),
  (
    'a0000000-0000-4000-8000-000000000733',
    'a0000000-0000-4000-8000-000000000122',
    'Group interviews'
  ),
  (
    'a0000000-0000-4000-8000-000000000734',
    'a0000000-0000-4000-8000-000000000122',
    'Waits for offer decision'
  ),
  (
    'a0000000-0000-4000-8000-000000000735',
    'a0000000-0000-4000-8000-000000000122',
    'Receives offer decision'
  )
on conflict (id) do update set
  name = excluded.name,
  scenario_id = excluded.scenario_id;

insert into public.path_steps (path_id, step_id, position)
values
  ('a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000731', 1),
  ('a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000732', 2),
  ('a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000733', 3),
  ('a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000734', 4),
  ('a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000735', 5)
on conflict (path_id, step_id) do update set
  position = excluded.position;

insert into public.cells (id, path_id, lane_id, step_id, content)
values
  -- Visual row
  ('a0000000-0000-4000-8000-000000090110', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000810', 'a0000000-0000-4000-8000-000000000731', ''),
  ('a0000000-0000-4000-8000-000000090210', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000810', 'a0000000-0000-4000-8000-000000000732', ''),
  ('a0000000-0000-4000-8000-000000090310', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000810', 'a0000000-0000-4000-8000-000000000733', ''),
  ('a0000000-0000-4000-8000-000000090410', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000810', 'a0000000-0000-4000-8000-000000000734', ''),
  ('a0000000-0000-4000-8000-000000090510', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000810', 'a0000000-0000-4000-8000-000000000735', ''),
  -- Step 1 — Applies
  ('a0000000-0000-4000-8000-000000090103', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000803', 'a0000000-0000-4000-8000-000000000731', 'Applies.'),
  ('a0000000-0000-4000-8000-000000090106', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000731', 'Google Form Application'),
  ('a0000000-0000-4000-8000-000000090107', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000731', 'Tutor supervisor team creates and manages application form.'),
  -- Step 2 — Review & invitation
  ('a0000000-0000-4000-8000-000000090203', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000803', 'a0000000-0000-4000-8000-000000000732', 'Receives email invitation for group interview.'),
  ('a0000000-0000-4000-8000-000000090204', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000804', 'a0000000-0000-4000-8000-000000000732', 'Tutor supervisor team invites applicant for group interview.'),
  ('a0000000-0000-4000-8000-000000090206', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000732', 'Email'),
  ('a0000000-0000-4000-8000-000000090207', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000732', 'Tutor supervisor team receives and reviews application.'),
  -- Step 3 — Group interview
  ('a0000000-0000-4000-8000-000000090303', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000803', 'a0000000-0000-4000-8000-000000000733', 'Group interviews.'),
  ('a0000000-0000-4000-8000-000000090304', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000804', 'a0000000-0000-4000-8000-000000000733', 'Tutor supervisor team facilitates group interview.'),
  ('a0000000-0000-4000-8000-000000090306', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000733', 'Zoom'),
  ('a0000000-0000-4000-8000-000000090307', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000733', 'Tutor supervisor team takes notes for group interview.'),
  ('a0000000-0000-4000-8000-000000090308', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000808', 'a0000000-0000-4000-8000-000000000733', 'Notion'),
  ('a0000000-0000-4000-8000-000000090309', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000809', 'a0000000-0000-4000-8000-000000000733', 'Zoom Recording'),
  -- Step 4 — Decision processing
  ('a0000000-0000-4000-8000-000000090403', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000803', 'a0000000-0000-4000-8000-000000000734', 'Waits for offer decision.'),
  ('a0000000-0000-4000-8000-000000090407', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000734', 'Tutor supervisor team reviews interview data.'),
  ('a0000000-0000-4000-8000-000000090408', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000808', 'a0000000-0000-4000-8000-000000000734', E'Zoom\nNotion'),
  -- Step 5 — Final decision
  ('a0000000-0000-4000-8000-000000090503', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000803', 'a0000000-0000-4000-8000-000000000735', 'Receives offer decision.'),
  ('a0000000-0000-4000-8000-000000090504', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000804', 'a0000000-0000-4000-8000-000000000735', 'Sends offer decision and next steps (if applicable).'),
  ('a0000000-0000-4000-8000-000000090506', 'a0000000-0000-4000-8000-000000000702', 'a0000000-0000-4000-8000-000000000806', 'a0000000-0000-4000-8000-000000000735', 'Email')
on conflict (id) do update set
  content = excluded.content,
  lane_id = excluded.lane_id,
  step_id = excluded.step_id;

delete from public.cell_dependencies
where id in (
  'a0000000-0000-4000-8000-000000098021',
  'a0000000-0000-4000-8000-000000098022'
);

delete from public.cells
where id = 'a0000000-0000-4000-8000-000000090104';

insert into public.cell_dependencies (id, source_cell_id, target_cell_id)
values
  ('a0000000-0000-4000-8000-000000098001', 'a0000000-0000-4000-8000-000000090107', 'a0000000-0000-4000-8000-000000090106'),
  ('a0000000-0000-4000-8000-000000098002', 'a0000000-0000-4000-8000-000000090107', 'a0000000-0000-4000-8000-000000090207'),
  ('a0000000-0000-4000-8000-000000098005', 'a0000000-0000-4000-8000-000000090103', 'a0000000-0000-4000-8000-000000090106'),
  ('a0000000-0000-4000-8000-000000098003', 'a0000000-0000-4000-8000-000000090207', 'a0000000-0000-4000-8000-000000090204'),
  ('a0000000-0000-4000-8000-000000098004', 'a0000000-0000-4000-8000-000000090204', 'a0000000-0000-4000-8000-000000090206'),
  ('a0000000-0000-4000-8000-000000098006', 'a0000000-0000-4000-8000-000000090206', 'a0000000-0000-4000-8000-000000090203'),
  ('a0000000-0000-4000-8000-000000098011', 'a0000000-0000-4000-8000-000000090103', 'a0000000-0000-4000-8000-000000090203'),
  ('a0000000-0000-4000-8000-000000098012', 'a0000000-0000-4000-8000-000000090203', 'a0000000-0000-4000-8000-000000090303'),
  ('a0000000-0000-4000-8000-000000098013', 'a0000000-0000-4000-8000-000000090303', 'a0000000-0000-4000-8000-000000090403'),
  ('a0000000-0000-4000-8000-000000098014', 'a0000000-0000-4000-8000-000000090403', 'a0000000-0000-4000-8000-000000090503'),
  ('a0000000-0000-4000-8000-000000098023', 'a0000000-0000-4000-8000-000000090304', 'a0000000-0000-4000-8000-000000090306'),
  ('a0000000-0000-4000-8000-000000098024', 'a0000000-0000-4000-8000-000000090303', 'a0000000-0000-4000-8000-000000090306'),
  ('a0000000-0000-4000-8000-000000098025', 'a0000000-0000-4000-8000-000000090307', 'a0000000-0000-4000-8000-000000090308'),
  ('a0000000-0000-4000-8000-000000098031', 'a0000000-0000-4000-8000-000000090307', 'a0000000-0000-4000-8000-000000090407'),
  ('a0000000-0000-4000-8000-000000098032', 'a0000000-0000-4000-8000-000000090407', 'a0000000-0000-4000-8000-000000090408'),
  ('a0000000-0000-4000-8000-000000098041', 'a0000000-0000-4000-8000-000000090407', 'a0000000-0000-4000-8000-000000090504'),
  ('a0000000-0000-4000-8000-000000098042', 'a0000000-0000-4000-8000-000000090504', 'a0000000-0000-4000-8000-000000090506'),
  ('a0000000-0000-4000-8000-000000098043', 'a0000000-0000-4000-8000-000000090506', 'a0000000-0000-4000-8000-000000090503')
on conflict (id) do update set
  source_cell_id = excluded.source_cell_id,
  target_cell_id = excluded.target_cell_id;

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090103/4649423b-ffc7-682f-2e4f-d7c902cfa656.png'
where id = 'a0000000-0000-4000-8000-000000090103';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090203/51215f55-0094-4c51-0bf3-7578ba0c0916.png'
where id = 'a0000000-0000-4000-8000-000000090203';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090303/c769335d-b957-cee3-1373-b1797554c2be.png'
where id = 'a0000000-0000-4000-8000-000000090303';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090403/b83929a1-f68b-5f35-8c1c-63501b99af8b.png'
where id = 'a0000000-0000-4000-8000-000000090403';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090503/00275e93-abfb-5a89-bcd9-5fb4045393e6.png'
where id = 'a0000000-0000-4000-8000-000000090503';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090106/0a4b724b-c24e-000d-192f-2a07089472aa.png'
where id = 'a0000000-0000-4000-8000-000000090106';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000040106/36ccc1f1-b3bb-3314-2647-5e481ccd1845.png'
where id = 'a0000000-0000-4000-8000-000000090306';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090308/19e60568-ae56-7fb2-6711-afba55dc45ea.png'
where id = 'a0000000-0000-4000-8000-000000090308';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090206/b69f74c2-1a83-e916-497a-a2aed9f14eb4.png'
where id in (
  'a0000000-0000-4000-8000-000000090206',
  'a0000000-0000-4000-8000-000000090506'
);
-- Touchpoint placements — see the note at the foot of supabase/seed.sql.
insert into public.cell_touchpoints (id, cell_id, name, position, summary, origin)
values
  ('7b80eb6c-3295-8b61-b1d0-7938090f4c2f', 'a0000000-0000-4000-8000-000000090106', 'Google Form Application', 0, 'The applicant completes and submits the tutor application through the Google Form created and managed by the tutor supervisor team.', 'import'),
  ('885b4163-3e73-8850-7fd7-ea66f08edac0', 'a0000000-0000-4000-8000-000000090206', 'Email', 0, 'Email is used as the mode of communication to set up interview date, time, and joining details.', 'import'),
  ('aafd5766-4676-f347-3352-d67d52f72eef', 'a0000000-0000-4000-8000-000000090306', 'Zoom', 0, 'The applicant and tutor supervisor team join a Zoom meeting for the group interview.', 'import'),
  ('bef17ab2-2afc-67d1-581a-a73487dc3e76', 'a0000000-0000-4000-8000-000000090308', 'Notion', 0, 'The tutor supervisor team captures interview notes in Notion during the group interview.', 'import'),
  ('d0423388-456d-eee1-6d3a-94c77fe66b50', 'a0000000-0000-4000-8000-000000090309', 'Zoom Recording', 0, 'Zoom recording captures the group interview so the tutor supervisor team can review it during the offer decision process.', 'import'),
  ('8d4fea2a-68a8-0941-c087-eb5472f8070b', 'a0000000-0000-4000-8000-000000090408', 'Notion', 0, 'The tutor supervisor team may review interview notes in Notion as part of the offer decision process.', 'import'),
  ('f2bf827c-8e5b-ed2a-dd91-795ad313c38b', 'a0000000-0000-4000-8000-000000090408', 'Zoom', 1, 'The tutor supervisor team may review the group interview Zoom recording as part of the offer decision process.', 'import'),
  ('4269cb72-dc49-e408-8cce-58426fd3ddca', 'a0000000-0000-4000-8000-000000090506', 'Email', 0, 'The applicant receives an email from the tutor supervisor team with their offer decision and next steps, if applicable.', 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  name = excluded.name,
  position = excluded.position,
  summary = excluded.summary;

-- Resources — see the note at the foot of supabase/seed.sql.
insert into public.resources
  (id, cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
values
  ('1207c377-cec1-d824-ac54-3caa68859fa6', 'a0000000-0000-4000-8000-000000090106', '7b80eb6c-3295-8b61-b1d0-7938090f4c2f', 'attachment', 'Google Form Application', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090106/0a4b724b-c24e-000d-192f-2a07089472aa.png', 0, true, 'import'),
  ('b443a3c7-bfe9-0b3d-3e11-607683e69054', 'a0000000-0000-4000-8000-000000090206', '885b4163-3e73-8850-7fd7-ea66f08edac0', 'attachment', 'Email', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090206/b69f74c2-1a83-e916-497a-a2aed9f14eb4.png', 0, true, 'import'),
  ('eb0c441e-0031-0d0f-7d26-27ce738a9921', 'a0000000-0000-4000-8000-000000090306', 'aafd5766-4676-f347-3352-d67d52f72eef', 'attachment', 'Zoom', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000040106/36ccc1f1-b3bb-3314-2647-5e481ccd1845.png', 0, true, 'import'),
  ('cbe2e01f-23a8-b56f-dd0d-f0d5f66af4db', 'a0000000-0000-4000-8000-000000090308', 'bef17ab2-2afc-67d1-581a-a73487dc3e76', 'attachment', 'Notion', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090308/19e60568-ae56-7fb2-6711-afba55dc45ea.png', 0, true, 'import'),
  ('4cd20606-e714-8d6f-84ad-e8f5c931560c', 'a0000000-0000-4000-8000-000000090408', '8d4fea2a-68a8-0941-c087-eb5472f8070b', 'attachment', 'Notion', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090308/19e60568-ae56-7fb2-6711-afba55dc45ea.png', 0, true, 'import'),
  ('af798027-584b-7b37-3d80-ab75a741cb40', 'a0000000-0000-4000-8000-000000090408', 'f2bf827c-8e5b-ed2a-dd91-795ad313c38b', 'attachment', 'Zoom', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000040106/36ccc1f1-b3bb-3314-2647-5e481ccd1845.png', 0, true, 'import'),
  ('022765fc-805a-f733-785b-b23098b64f64', 'a0000000-0000-4000-8000-000000090506', '4269cb72-dc49-e408-8cce-58426fd3ddca', 'attachment', 'Email', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090206/b69f74c2-1a83-e916-497a-a2aed9f14eb4.png', 0, true, 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  cell_touchpoint_id = excluded.cell_touchpoint_id,
  kind = excluded.kind,
  name = excluded.name,
  url = excluded.url,
  position = excluded.position,
  featured = excluded.featured;
