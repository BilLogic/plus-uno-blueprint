-- Post-session → Reporting an Issue scenario — Happy Path
-- Stable keys map to fixed UUIDs in src/data/reportingAnIssueHappyPathFallback.ts

insert into public.paths (id, scenario_id, name, summary, kind)
values (
  'a0000000-0000-4000-8000-00000000080f',
  'a0000000-0000-4000-8000-000000000207',
  'Happy Path',
  'Tutor reports an issue after tutoring session.',
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
  where path_id = 'a0000000-0000-4000-8000-00000000080f'
);

delete from public.cells
where path_id = 'a0000000-0000-4000-8000-00000000080f';

delete from public.lanes
where path_id = 'a0000000-0000-4000-8000-00000000080f';

insert into public.lanes (id, path_id, name, position)
values
  ('a0000000-0000-4000-8000-000000000910', 'a0000000-0000-4000-8000-00000000080f', 'Storyboard', 0),
  ('a0000000-0000-4000-8000-000000000917', 'a0000000-0000-4000-8000-00000000080f', 'Lead Tutor', 1),
  ('a0000000-0000-4000-8000-000000000911', 'a0000000-0000-4000-8000-00000000080f', 'Regular Tutor', 2),
  ('a0000000-0000-4000-8000-000000000913', 'a0000000-0000-4000-8000-00000000080f', 'Front Stage Tech', 3),
  ('a0000000-0000-4000-8000-000000000912', 'a0000000-0000-4000-8000-00000000080f', 'Front Stage Actions', 4),
  ('a0000000-0000-4000-8000-000000000915', 'a0000000-0000-4000-8000-00000000080f', 'Back Stage Tech', 5),
  ('a0000000-0000-4000-8000-000000000914', 'a0000000-0000-4000-8000-00000000080f', 'Back Stage Actions', 6),
  ('a0000000-0000-4000-8000-000000000916', 'a0000000-0000-4000-8000-00000000080f', 'Support Actions', 7)
on conflict (id) do update set
  name = excluded.name,
  position = excluded.position,
  path_id = excluded.path_id;

insert into public.steps (id, scenario_id, name)
values
  ('a0000000-0000-4000-8000-000000000988', 'a0000000-0000-4000-8000-000000000207', 'Reach out'),
  ('a0000000-0000-4000-8000-000000000990', 'a0000000-0000-4000-8000-000000000207', 'Resolve concern'),
  ('a0000000-0000-4000-8000-000000000991', 'a0000000-0000-4000-8000-000000000207', 'Request assistance'),
  ('a0000000-0000-4000-8000-000000000993', 'a0000000-0000-4000-8000-000000000207', 'Follow up')
on conflict (id) do update set
  name = excluded.name,
  scenario_id = excluded.scenario_id;

delete from public.path_steps
where path_id = 'a0000000-0000-4000-8000-00000000080f';

insert into public.path_steps (path_id, step_id, position)
values
  ('a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000988', 1),
  ('a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000991', 2),
  ('a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000993', 3),
  ('a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000990', 4)
on conflict (path_id, step_id) do update set
  position = excluded.position;

insert into public.cells (id, path_id, lane_id, step_id, content)
values
  ('a0000000-0000-4000-8000-0000001d0110', 'a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000910', 'a0000000-0000-4000-8000-000000000988', ''),
  ('a0000000-0000-4000-8000-0000001d0102', 'a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000917', 'a0000000-0000-4000-8000-000000000988', 'Reach out to PLUS staff with any concerns.'),
  ('a0000000-0000-4000-8000-0000001d0103', 'a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000911', 'a0000000-0000-4000-8000-000000000988', 'Reach out to PLUS staff with any concerns.'),
  ('a0000000-0000-4000-8000-0000001d0104', 'a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000912', 'a0000000-0000-4000-8000-000000000988', 'PLUS tutor supervisor team evaluates concern and reaches out as needed.'),
  ('a0000000-0000-4000-8000-0000001d0106', 'a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000913', 'a0000000-0000-4000-8000-000000000988', 'Slack, Email'),
  ('a0000000-0000-4000-8000-0000001d0210', 'a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000910', 'a0000000-0000-4000-8000-000000000990', ''),
  ('a0000000-0000-4000-8000-0000001d0207', 'a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000914', 'a0000000-0000-4000-8000-000000000990', 'PLUS supervisor team is able to resolve concern.'),
  ('a0000000-0000-4000-8000-0000001d0310', 'a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000910', 'a0000000-0000-4000-8000-000000000991', ''),
  ('a0000000-0000-4000-8000-0000001d0304', 'a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000912', 'a0000000-0000-4000-8000-000000000991', 'If needed, PLUS staff might request assistance.'),
  ('a0000000-0000-4000-8000-0000001d0410', 'a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000910', 'a0000000-0000-4000-8000-000000000993', ''),
  ('a0000000-0000-4000-8000-0000001d0402', 'a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000917', 'a0000000-0000-4000-8000-000000000993', 'Processes request and follows up on request.'),
  ('a0000000-0000-4000-8000-0000001d0403', 'a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000911', 'a0000000-0000-4000-8000-000000000993', 'Processes request and follows up on request.'),
  ('a0000000-0000-4000-8000-0000001d0406', 'a0000000-0000-4000-8000-00000000080f', 'a0000000-0000-4000-8000-000000000913', 'a0000000-0000-4000-8000-000000000993', 'Slack, Email, Zoom')
on conflict (id) do update set
  path_id = excluded.path_id,
  lane_id = excluded.lane_id,
  step_id = excluded.step_id,
  content = excluded.content;

insert into public.cell_dependencies (id, source_cell_id, target_cell_id)
values
  ('a0000000-0000-4000-8000-000000098070', 'a0000000-0000-4000-8000-0000001d0103', 'a0000000-0000-4000-8000-0000001d0106'),
  ('a0000000-0000-4000-8000-000000098074', 'a0000000-0000-4000-8000-0000001d0102', 'a0000000-0000-4000-8000-0000001d0106'),
  ('a0000000-0000-4000-8000-000000098076', 'a0000000-0000-4000-8000-0000001d0106', 'a0000000-0000-4000-8000-0000001d0104'),
  ('a0000000-0000-4000-8000-000000098078', 'a0000000-0000-4000-8000-0000001d0104', 'a0000000-0000-4000-8000-0000001d0304'),
  ('a0000000-0000-4000-8000-000000098081', 'a0000000-0000-4000-8000-0000001d0104', 'a0000000-0000-4000-8000-0000001d0207'),
  ('a0000000-0000-4000-8000-000000098077', 'a0000000-0000-4000-8000-0000001d0304', 'a0000000-0000-4000-8000-0000001d0406'),
  ('a0000000-0000-4000-8000-000000098073', 'a0000000-0000-4000-8000-0000001d0406', 'a0000000-0000-4000-8000-0000001d0403'),
  ('a0000000-0000-4000-8000-000000098075', 'a0000000-0000-4000-8000-0000001d0406', 'a0000000-0000-4000-8000-0000001d0402'),
  ('a0000000-0000-4000-8000-000000098079', 'a0000000-0000-4000-8000-0000001d0402', 'a0000000-0000-4000-8000-0000001d0207'),
  ('a0000000-0000-4000-8000-000000098080', 'a0000000-0000-4000-8000-0000001d0403', 'a0000000-0000-4000-8000-0000001d0207')
on conflict (id) do update set
  source_cell_id = excluded.source_cell_id,
  target_cell_id = excluded.target_cell_id;

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001d0102/fa633b95-45ae-d609-fbc9-06eb3f5e1291.png'
where id = 'a0000000-0000-4000-8000-0000001d0102';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001d0402/84f6ca4e-161e-e7ec-583d-551862ff771a.png'
where id = 'a0000000-0000-4000-8000-0000001d0402';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001d0103/ab13b929-6608-ac2b-5268-c16927040a3f.png'
where id = 'a0000000-0000-4000-8000-0000001d0103';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001d0403/f864d4ca-a48a-e179-32a0-2d9a84fe0f8c.png'
where id = 'a0000000-0000-4000-8000-0000001d0403';
-- Touchpoint placements — see the note at the foot of supabase/seed.sql.
insert into public.cell_touchpoints (id, cell_id, name, position, summary, origin)
values
  ('279450f8-b661-51f3-38a3-b19a0e497893', 'a0000000-0000-4000-8000-0000001d0106', 'Email', 0, 'The tutor uses email to reach out to PLUS staff and report any session concerns after tutoring.', 'import'),
  ('5cbe376f-60bf-56e8-4d03-f611d67845eb', 'a0000000-0000-4000-8000-0000001d0106', 'Slack', 1, 'The tutor uses Slack to reach out to PLUS staff and share any session concerns after tutoring.', 'import'),
  ('7c870e64-5a66-684d-e07f-61a4c98520f6', 'a0000000-0000-4000-8000-0000001d0406', 'Email', 0, 'The tutor might receive email from PLUS staff following up on the reported issue.', 'import'),
  ('49eccf36-7f35-49de-a2f9-93dd8e59b98c', 'a0000000-0000-4000-8000-0000001d0406', 'Slack', 1, 'The tutor might receive Slack message from PLUS staff following up on the reported issue.', 'import'),
  ('ef6f792a-2808-67b3-9514-6bcbaa01ef8b', 'a0000000-0000-4000-8000-0000001d0406', 'Zoom', 2, 'PLUS staff might request for tutor to join a Zoom meeting to discuss the reported issue.', 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  name = excluded.name,
  position = excluded.position,
  summary = excluded.summary;

-- Resources — see the note at the foot of supabase/seed.sql.
insert into public.resources
  (id, cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
values
  ('086a1b33-1615-4ac5-c619-db387743e4cc', 'a0000000-0000-4000-8000-0000001d0102', null, 'link', 'Onboarding Module 2', 'https://plus-tutors.notion.site/Module-2-Your-Role-at-PLUS-26fb7cca498280daac2fd7efc191708d', 1, false, 'import'),
  ('0e5d0cd1-1e57-8b76-dfc1-bfc888d78fac', 'a0000000-0000-4000-8000-0000001d0106', '279450f8-b661-51f3-38a3-b19a0e497893', 'attachment', 'Email', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090206/b69f74c2-1a83-e916-497a-a2aed9f14eb4.png', 0, true, 'import'),
  ('6b4f9289-f1f6-69f9-ef2c-722fa83aeb52', 'a0000000-0000-4000-8000-0000001d0106', '5cbe376f-60bf-56e8-4d03-f611d67845eb', 'attachment', 'Slack', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000100706/21a81bb9-8af4-9dc8-5879-b4fa64946bd7.png', 0, true, 'import'),
  ('b98e7d03-8b45-6c86-ce8c-fb0785f788c5', 'a0000000-0000-4000-8000-0000001d0402', null, 'link', 'Onboarding Module 2', 'https://plus-tutors.notion.site/Module-2-Your-Role-at-PLUS-26fb7cca498280daac2fd7efc191708d', 1, false, 'import'),
  ('ff8d4fe4-89be-bda8-dbed-3aba9e974acb', 'a0000000-0000-4000-8000-0000001d0406', '49eccf36-7f35-49de-a2f9-93dd8e59b98c', 'attachment', 'Slack', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000100706/21a81bb9-8af4-9dc8-5879-b4fa64946bd7.png', 0, true, 'import'),
  ('28e06e83-e554-479c-cbaf-4e1fc76a2ab9', 'a0000000-0000-4000-8000-0000001d0406', '7c870e64-5a66-684d-e07f-61a4c98520f6', 'attachment', 'Email', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000090206/b69f74c2-1a83-e916-497a-a2aed9f14eb4.png', 0, true, 'import'),
  ('44df46e8-7c5b-4d42-dd95-a80e448a26fd', 'a0000000-0000-4000-8000-0000001d0406', 'ef6f792a-2808-67b3-9514-6bcbaa01ef8b', 'attachment', 'Zoom', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000040106/36ccc1f1-b3bb-3314-2647-5e481ccd1845.png', 0, true, 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  cell_touchpoint_id = excluded.cell_touchpoint_id,
  kind = excluded.kind,
  name = excluded.name,
  url = excluded.url,
  position = excluded.position,
  featured = excluded.featured;
