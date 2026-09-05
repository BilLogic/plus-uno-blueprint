-- Pre-session → Fill-in Request scenario — Happy Path
-- Stable keys map to fixed UUIDs in src/data/fillInRequestHappyPathFallback.ts

insert into public.paths (id, scenario_id, name, summary, kind)
values (
  'a0000000-0000-4000-8000-000000000807',
  'a0000000-0000-4000-8000-000000000127',
  'Happy Path',
  'Tutor is requested to fill in for a session.',
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
  where path_id = 'a0000000-0000-4000-8000-000000000807'
);

delete from public.cells
where path_id = 'a0000000-0000-4000-8000-000000000807';

delete from public.lanes
where path_id = 'a0000000-0000-4000-8000-000000000807';

insert into public.lanes (id, path_id, name, position)
values
  (
    'a0000000-0000-4000-8000-000000000903',
    'a0000000-0000-4000-8000-000000000807',
    'Storyboard',
    0
  ),
  (
    'a0000000-0000-4000-8000-000000000904',
    'a0000000-0000-4000-8000-000000000807',
    'Regular Tutor',
    1
  ),
  (
    'a0000000-0000-4000-8000-000000000906',
    'a0000000-0000-4000-8000-000000000807',
    'Front Stage Tech',
    2
  ),
  (
    'a0000000-0000-4000-8000-000000000905',
    'a0000000-0000-4000-8000-000000000807',
    'Front Stage Actions',
    3
  ),
  (
    'a0000000-0000-4000-8000-000000000908',
    'a0000000-0000-4000-8000-000000000807',
    'Back Stage Tech',
    4
  ),
  (
    'a0000000-0000-4000-8000-000000000907',
    'a0000000-0000-4000-8000-000000000807',
    'Back Stage Actions',
    5
  ),
  (
    'a0000000-0000-4000-8000-000000000909',
    'a0000000-0000-4000-8000-000000000807',
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
    'a0000000-0000-4000-8000-000000000897',
    'a0000000-0000-4000-8000-000000000127',
    'Initial request'
  ),
  (
    'a0000000-0000-4000-8000-000000000898',
    'a0000000-0000-4000-8000-000000000127',
    'Send request'
  ),
  (
    'a0000000-0000-4000-8000-000000000899',
    'a0000000-0000-4000-8000-000000000127',
    'Tutor response'
  ),
  (
    'a0000000-0000-4000-8000-000000000900',
    'a0000000-0000-4000-8000-000000000127',
    'Finalize assignment'
  )
on conflict (id) do update set
  name = excluded.name,
  scenario_id = excluded.scenario_id;

delete from public.path_steps
where path_id = 'a0000000-0000-4000-8000-000000000807';

insert into public.path_steps (path_id, step_id, position)
values
  ('a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000897', 1),
  ('a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000898', 2),
  ('a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000899', 3),
  ('a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000900', 4)
on conflict (path_id, step_id) do update set
  position = excluded.position;

insert into public.cells (id, path_id, lane_id, step_id, content)
values
  ('a0000000-0000-4000-8000-000000150110', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000897', ''),
  ('a0000000-0000-4000-8000-000000150107', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000907', 'a0000000-0000-4000-8000-000000000897', 'Tutor supervisor team receives call off request and reviews tutor availabilities.'),
  ('a0000000-0000-4000-8000-000000150108', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000908', 'a0000000-0000-4000-8000-000000000897', 'Google Spreadsheet'),
  ('a0000000-0000-4000-8000-000000150106', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000906', 'a0000000-0000-4000-8000-000000000897', 'Shift Swap Google Form'),
  ('a0000000-0000-4000-8000-000000150109', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000909', 'a0000000-0000-4000-8000-000000000897', 'Dev Team'),

  ('a0000000-0000-4000-8000-000000150210', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000898', ''),
  ('a0000000-0000-4000-8000-000000150204', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000905', 'a0000000-0000-4000-8000-000000000898', 'Tutor supervisor team requests fill in and fellow tutor sends message in #shift-swap Slack channel.'),
  ('a0000000-0000-4000-8000-000000150203', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000898', 'Tutor receives request.'),
  ('a0000000-0000-4000-8000-000000150206', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000906', 'a0000000-0000-4000-8000-000000000898', 'Slack, Email'),

  ('a0000000-0000-4000-8000-000000150310', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000899', ''),
  ('a0000000-0000-4000-8000-000000150303', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000899', 'Tutor confirms or denies fill in request.'),
  ('a0000000-0000-4000-8000-000000150304', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000905', 'a0000000-0000-4000-8000-000000000899', 'Tutor supervisor team is notified on if tutor can fill in.'),
  ('a0000000-0000-4000-8000-000000150306', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000906', 'a0000000-0000-4000-8000-000000000899', 'Slack, Email'),

  ('a0000000-0000-4000-8000-000000150410', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000903', 'a0000000-0000-4000-8000-000000000900', ''),
  ('a0000000-0000-4000-8000-000000150403', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000904', 'a0000000-0000-4000-8000-000000000900', 'Tutor accesses session if able to fill in.'),
  ('a0000000-0000-4000-8000-000000150406', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000906', 'a0000000-0000-4000-8000-000000000900', 'PLUS App'),
  ('a0000000-0000-4000-8000-000000150407', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000907', 'a0000000-0000-4000-8000-000000000900', 'Tutor supervisor team adds tutor to session if tutor confirms request.'),
  ('a0000000-0000-4000-8000-000000150409', 'a0000000-0000-4000-8000-000000000807', 'a0000000-0000-4000-8000-000000000909', 'a0000000-0000-4000-8000-000000000900', E'Dev Team\nDesign Team')
on conflict (id) do update set
  path_id = excluded.path_id,
  lane_id = excluded.lane_id,
  step_id = excluded.step_id,
  content = excluded.content;

insert into public.cell_dependencies (id, source_cell_id, target_cell_id)
values
  ('a0000000-0000-4000-8000-000000094001', 'a0000000-0000-4000-8000-000000150107', 'a0000000-0000-4000-8000-000000150108'),
  ('a0000000-0000-4000-8000-000000094009', 'a0000000-0000-4000-8000-000000150106', 'a0000000-0000-4000-8000-000000150107'),
  ('a0000000-0000-4000-8000-000000094002', 'a0000000-0000-4000-8000-000000150107', 'a0000000-0000-4000-8000-000000150204'),
  ('a0000000-0000-4000-8000-000000094003', 'a0000000-0000-4000-8000-000000150204', 'a0000000-0000-4000-8000-000000150206'),
  ('a0000000-0000-4000-8000-000000094010', 'a0000000-0000-4000-8000-000000150206', 'a0000000-0000-4000-8000-000000150203'),
  ('a0000000-0000-4000-8000-000000094004', 'a0000000-0000-4000-8000-000000150203', 'a0000000-0000-4000-8000-000000150303'),
  ('a0000000-0000-4000-8000-000000094005', 'a0000000-0000-4000-8000-000000150303', 'a0000000-0000-4000-8000-000000150306'),
  ('a0000000-0000-4000-8000-000000094011', 'a0000000-0000-4000-8000-000000150306', 'a0000000-0000-4000-8000-000000150304'),
  ('a0000000-0000-4000-8000-000000094012', 'a0000000-0000-4000-8000-000000150303', 'a0000000-0000-4000-8000-000000150403'),
  ('a0000000-0000-4000-8000-000000094006', 'a0000000-0000-4000-8000-000000150304', 'a0000000-0000-4000-8000-000000150407'),
  ('a0000000-0000-4000-8000-000000094013', 'a0000000-0000-4000-8000-000000150407', 'a0000000-0000-4000-8000-000000150406'),
  ('a0000000-0000-4000-8000-000000094014', 'a0000000-0000-4000-8000-000000150406', 'a0000000-0000-4000-8000-000000150403')
on conflict (id) do update set
  source_cell_id = excluded.source_cell_id,
  target_cell_id = excluded.target_cell_id;

delete from public.steps
where id = 'a0000000-0000-4000-8000-000000000901'
  and not exists (
    select 1 from public.path_steps ps
    where ps.step_id = 'a0000000-0000-4000-8000-000000000901'
  );
update public.cells
set
  summary = 'The tutor''s session scheduling information is stored in a Google Spreadsheet.'
where id = 'a0000000-0000-4000-8000-000000150108';

update public.cells
set summary =
  'The Dev Team stores tutor schedules in a Google Spreadsheet for the tutor supervisor team to review.'
where id = 'a0000000-0000-4000-8000-000000150109';update public.cells
set summary =
  'The Dev Team builds the PLUS app features for assigning tutors to sessions and accessing session details, and the Design Team creates the screens and flows for that experience.'
where id = 'a0000000-0000-4000-8000-000000150409';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000150203/61bcd12e-990a-329f-2625-66526fc78e12.png'
where id = 'a0000000-0000-4000-8000-000000150203';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000150303/3bb87f92-7081-6589-8c70-161e48511bf7.png'
where id = 'a0000000-0000-4000-8000-000000150303';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000150403/51c26b0e-965e-df2e-0151-4b6d6c7fe9e7.png'
where id = 'a0000000-0000-4000-8000-000000150403';

-- Touchpoint placements — see the note at the foot of supabase/seed.sql.
insert into public.cell_touchpoints (id, cell_id, name, position, summary, origin)
values
  ('c294cb71-3cd7-8cc4-d775-50d5cd613b28', 'a0000000-0000-4000-8000-000000150106', 'Shift Swap Google Form', 0, 'The call-off request is initiated through the Shift Swap Google Form, which lets the tutor supervisor team know they need to find coverage for that session.', 'import'),
  ('3722f1b0-d07f-7128-c1f9-7a8025601522', 'a0000000-0000-4000-8000-000000150108', 'Google Spreadsheet', 0, 'The tutor''s session scheduling information is stored in a Google Spreadsheet.', 'import'),
  ('51c4e401-1aef-f99c-6241-49df292d4f8f', 'a0000000-0000-4000-8000-000000150206', 'Email', 0, 'The tutor supervisor team can also send the fill-in request to tutors by email.', 'import'),
  ('2ab6a128-5af4-1e43-ac11-ac4fdea6e1f9', 'a0000000-0000-4000-8000-000000150206', 'Slack', 1, 'The fill-in request is shared in the #shift-swap Slack channel so available tutors can see it.', 'import'),
  ('0b7e63ad-4b4c-bbb8-9d1b-8fd72e30f04c', 'a0000000-0000-4000-8000-000000150306', 'Email', 0, 'The tutor can also confirm or deny the fill-in request by email.', 'import'),
  ('44697586-9513-21ae-c878-223ba78bf065', 'a0000000-0000-4000-8000-000000150306', 'Slack', 1, 'The tutor confirms or denies the fill-in request through Slack.', 'import'),
  ('4b548105-82c9-4428-78ad-a528c96d64c0', 'a0000000-0000-4000-8000-000000150406', 'PLUS App', 0, 'The tutor supervisor team adds that tutor to the session in the PLUS app. Once added, the tutor accesses the session details in the PLUS app.', 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  name = excluded.name,
  position = excluded.position,
  summary = excluded.summary;

-- Resources — see the note at the foot of supabase/seed.sql.
insert into public.resources
  (id, cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
values
  ('d508f181-8a13-bf49-d14f-34b6350fd909', 'a0000000-0000-4000-8000-000000150106', 'c294cb71-3cd7-8cc4-d775-50d5cd613b28', 'attachment', 'Shift Swap Google Form', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090106/0a4b724b-c24e-000d-192f-2a07089472aa.png', 0, true, 'import'),
  ('e5c5b888-d50c-0757-bc93-38036e6bdaaf', 'a0000000-0000-4000-8000-000000150108', '3722f1b0-d07f-7128-c1f9-7a8025601522', 'attachment', 'Google Spreadsheet', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000150108/737f7fb4-8397-708e-f575-02a91f4ba361.png', 0, true, 'import'),
  ('724abfa3-d5d8-808c-735b-4487e3b4083c', 'a0000000-0000-4000-8000-000000150206', '2ab6a128-5af4-1e43-ac11-ac4fdea6e1f9', 'attachment', 'Slack', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000100706/21a81bb9-8af4-9dc8-5879-b4fa64946bd7.png', 0, true, 'import'),
  ('6ef9b44b-5b78-8e79-c80d-8c10b2bcdd7d', 'a0000000-0000-4000-8000-000000150206', '51c4e401-1aef-f99c-6241-49df292d4f8f', 'attachment', 'Email', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090206/b69f74c2-1a83-e916-497a-a2aed9f14eb4.png', 0, true, 'import'),
  ('a4bb3fa6-c0cd-c861-e5de-77b4d42dde24', 'a0000000-0000-4000-8000-000000150306', '0b7e63ad-4b4c-bbb8-9d1b-8fd72e30f04c', 'attachment', 'Email', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090206/b69f74c2-1a83-e916-497a-a2aed9f14eb4.png', 0, true, 'import'),
  ('1359f604-3dc1-e6fe-e159-111398357b7c', 'a0000000-0000-4000-8000-000000150306', '44697586-9513-21ae-c878-223ba78bf065', 'attachment', 'Slack', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000100706/21a81bb9-8af4-9dc8-5879-b4fa64946bd7.png', 0, true, 'import'),
  ('7e58aaab-6556-05ed-4979-e8e52a91c2bd', 'a0000000-0000-4000-8000-000000150406', '4b548105-82c9-4428-78ad-a528c96d64c0', 'link', 'PLUS App', 'https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=2942-401328&t=NRQGuswXJmExM6wI-1', 0, true, 'import'),
  ('0c8e6e77-a786-aa4f-03f8-085a3eddbabb', 'a0000000-0000-4000-8000-000000150406', '4b548105-82c9-4428-78ad-a528c96d64c0', 'attachment', 'PLUS App', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000150406/5aaa0787-ee1b-6f5e-10ec-f0e1386d5a58.png', 1, true, 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  cell_touchpoint_id = excluded.cell_touchpoint_id,
  kind = excluded.kind,
  name = excluded.name,
  url = excluded.url,
  position = excluded.position,
  featured = excluded.featured;
