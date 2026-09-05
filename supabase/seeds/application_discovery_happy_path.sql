-- Application → Discovery scenario — Happy Path
-- Stable keys map to fixed UUIDs in src/data/applicationHappyPathFallback.ts

insert into public.paths (id, scenario_id, name, summary, kind)
values (
  'a0000000-0000-4000-8000-000000000700',
  'a0000000-0000-4000-8000-000000000121',
  'Happy Path',
  'Potential tutors discover and want to join PLUS.',
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
    'a0000000-0000-4000-8000-000000000710',
    'a0000000-0000-4000-8000-000000000700',
    'Storyboard',
    0
  ),
  (
    'a0000000-0000-4000-8000-000000000703',
    'a0000000-0000-4000-8000-000000000700',
    'Regular Tutor',
    1
  ),
  (
    'a0000000-0000-4000-8000-000000000706',
    'a0000000-0000-4000-8000-000000000700',
    'Front Stage Tech',
    2
  ),
  (
    'a0000000-0000-4000-8000-000000000704',
    'a0000000-0000-4000-8000-000000000700',
    'Front Stage Actions',
    3
  ),
  (
    'a0000000-0000-4000-8000-000000000708',
    'a0000000-0000-4000-8000-000000000700',
    'Back Stage Tech',
    4
  ),
  (
    'a0000000-0000-4000-8000-000000000707',
    'a0000000-0000-4000-8000-000000000700',
    'Back Stage Actions',
    5
  ),
  (
    'a0000000-0000-4000-8000-000000000709',
    'a0000000-0000-4000-8000-000000000700',
    'Support Actions',
    6
  )
on conflict (id) do update set
  name = excluded.name,
  position = excluded.position;

insert into public.steps (id, scenario_id, name)
values
  (
    'a0000000-0000-4000-8000-000000000711',
    'a0000000-0000-4000-8000-000000000121',
    'Discovers PLUS'
  ),
  (
    'a0000000-0000-4000-8000-000000000712',
    'a0000000-0000-4000-8000-000000000121',
    'Discovers PLUS'
  ),
  (
    'a0000000-0000-4000-8000-000000000713',
    'a0000000-0000-4000-8000-000000000121',
    'Discovers PLUS'
  ),
  (
    'a0000000-0000-4000-8000-000000000714',
    'a0000000-0000-4000-8000-000000000121',
    'Discovers PLUS'
  ),
  (
    'a0000000-0000-4000-8000-000000000715',
    'a0000000-0000-4000-8000-000000000121',
    'Discovers PLUS'
  ),
  (
    'a0000000-0000-4000-8000-000000000716',
    'a0000000-0000-4000-8000-000000000121',
    'Interested in joining PLUS'
  ),
  (
    'a0000000-0000-4000-8000-000000000717',
    'a0000000-0000-4000-8000-000000000121',
    'Not interested in joining PLUS'
  )
on conflict (id) do update set
  name = excluded.name,
  scenario_id = excluded.scenario_id;

insert into public.path_steps (path_id, step_id, position)
values
  ('a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000711', 1),
  ('a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000712', 2),
  ('a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000713', 3),
  ('a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000714', 4),
  ('a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000715', 5),
  ('a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000716', 6)
on conflict (path_id, step_id) do update set
  position = excluded.position;

insert into public.cells (id, path_id, lane_id, step_id, content)
values
  -- Visual row
  ('a0000000-0000-4000-8000-000000070110', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000710', 'a0000000-0000-4000-8000-000000000711', ''),
  ('a0000000-0000-4000-8000-000000070210', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000710', 'a0000000-0000-4000-8000-000000000712', ''),
  ('a0000000-0000-4000-8000-000000070310', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000710', 'a0000000-0000-4000-8000-000000000713', ''),
  ('a0000000-0000-4000-8000-000000070410', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000710', 'a0000000-0000-4000-8000-000000000714', ''),
  ('a0000000-0000-4000-8000-000000070510', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000710', 'a0000000-0000-4000-8000-000000000715', ''),
  ('a0000000-0000-4000-8000-000000070610', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000710', 'a0000000-0000-4000-8000-000000000716', ''),
  -- Step 1 — word of mouth
  ('a0000000-0000-4000-8000-000000070103', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000703', 'a0000000-0000-4000-8000-000000000711', 'Discovers PLUS via word of mouth.'),
  ('a0000000-0000-4000-8000-000000070104', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000704', 'a0000000-0000-4000-8000-000000000711', 'Previous or current PLUS tutor might have informed about PLUS.'),
  -- Step 2 — Social Media
  ('a0000000-0000-4000-8000-000000070203', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000703', 'a0000000-0000-4000-8000-000000000712', 'Discovers PLUS via social media.'),
  ('a0000000-0000-4000-8000-000000070206', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000706', 'a0000000-0000-4000-8000-000000000712', 'Social Media'),
  ('a0000000-0000-4000-8000-000000070207', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000707', 'a0000000-0000-4000-8000-000000000712', 'Marketing team creates social media posts and manages social platforms.'),
  ('a0000000-0000-4000-8000-000000070208', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000708', 'a0000000-0000-4000-8000-000000000712', 'Figma'),
  ('a0000000-0000-4000-8000-000000070209', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000709', 'a0000000-0000-4000-8000-000000000712', 'Branding Guidelines'),
  -- Step 3 — Marketing Website
  ('a0000000-0000-4000-8000-000000070303', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000703', 'a0000000-0000-4000-8000-000000000713', 'Discovers PLUS via PLUS marketing website.'),
  ('a0000000-0000-4000-8000-000000070306', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000706', 'a0000000-0000-4000-8000-000000000713', 'Marketing Website'),
  ('a0000000-0000-4000-8000-000000070307', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000707', 'a0000000-0000-4000-8000-000000000713', 'Design team manages content and messaging on the website. Dev team implements website into code.'),
  ('a0000000-0000-4000-8000-000000070308', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000708', 'a0000000-0000-4000-8000-000000000713', E'Figma\nDev Tools'),
  ('a0000000-0000-4000-8000-000000070309', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000709', 'a0000000-0000-4000-8000-000000000713', 'Branding Guidelines, Design System'),
  -- Step 4 — On-campus job fair
  ('a0000000-0000-4000-8000-000000070403', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000703', 'a0000000-0000-4000-8000-000000000714', 'Discovers PLUS via on campus activities.'),
  ('a0000000-0000-4000-8000-000000070404', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000704', 'a0000000-0000-4000-8000-000000000714', 'Tutor supervisor team meets prospective tutors at on-campus job fair.'),
  ('a0000000-0000-4000-8000-000000070406', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000706', 'a0000000-0000-4000-8000-000000000714', E'Posters\nOn-campus booth'),
  -- Step 5 — Handshake
  ('a0000000-0000-4000-8000-000000070503', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000703', 'a0000000-0000-4000-8000-000000000715', 'Discovers PLUS via Handshake.'),
  ('a0000000-0000-4000-8000-000000070506', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000706', 'a0000000-0000-4000-8000-000000000715', 'Handshake'),
  ('a0000000-0000-4000-8000-000000070507', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000707', 'a0000000-0000-4000-8000-000000000715', 'Tutor supervisor team posts job openings on Handshake.'),
  ('a0000000-0000-4000-8000-000000070508', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000708', 'a0000000-0000-4000-8000-000000000715', 'Handshake Employer Profile'),
  -- Step 6 — Interested in joining PLUS
  ('a0000000-0000-4000-8000-000000070603', 'a0000000-0000-4000-8000-000000000700', 'a0000000-0000-4000-8000-000000000703', 'a0000000-0000-4000-8000-000000000716', 'Interested in joining PLUS.')
on conflict (id) do update set
  content = excluded.content,
  lane_id = excluded.lane_id,
  step_id = excluded.step_id;

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070103/d5ec6f03-ed64-d798-1562-c0d259bc3c79.png'
where id = 'a0000000-0000-4000-8000-000000070103';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070203/059f0d50-8be6-b2a3-3a81-fbb199047e5c.png'
where id = 'a0000000-0000-4000-8000-000000070203';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070303/287d60b4-4423-c079-b81e-b37878f5f1e4.png'
where id = 'a0000000-0000-4000-8000-000000070303';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070403/1e111d5b-3dd9-ed49-3691-7b3948bd01fa.png'
where id = 'a0000000-0000-4000-8000-000000070403';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070503/de6b2b53-26f2-4b42-fdc2-9adbfad8f85b.png'
where id = 'a0000000-0000-4000-8000-000000070503';

update public.cells
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070603/a05693b5-01a5-bfc5-672e-616968158878.png'
where id = 'a0000000-0000-4000-8000-000000070603';insert into public.cell_dependencies (id, source_cell_id, target_cell_id)
values
  ('a0000000-0000-4000-8000-000000078001', 'a0000000-0000-4000-8000-000000070104', 'a0000000-0000-4000-8000-000000070103'),
  ('a0000000-0000-4000-8000-000000078002', 'a0000000-0000-4000-8000-000000070207', 'a0000000-0000-4000-8000-000000070208'),
  ('a0000000-0000-4000-8000-000000078016', 'a0000000-0000-4000-8000-000000070208', 'a0000000-0000-4000-8000-000000070206'),
  ('a0000000-0000-4000-8000-000000078004', 'a0000000-0000-4000-8000-000000070206', 'a0000000-0000-4000-8000-000000070203'),
  ('a0000000-0000-4000-8000-000000078003', 'a0000000-0000-4000-8000-000000070307', 'a0000000-0000-4000-8000-000000070308'),
  ('a0000000-0000-4000-8000-000000078017', 'a0000000-0000-4000-8000-000000070308', 'a0000000-0000-4000-8000-000000070306'),
  ('a0000000-0000-4000-8000-000000078005', 'a0000000-0000-4000-8000-000000070306', 'a0000000-0000-4000-8000-000000070303'),
  ('a0000000-0000-4000-8000-000000078006', 'a0000000-0000-4000-8000-000000070404', 'a0000000-0000-4000-8000-000000070403'),
  ('a0000000-0000-4000-8000-000000078007', 'a0000000-0000-4000-8000-000000070404', 'a0000000-0000-4000-8000-000000070406'),
  ('a0000000-0000-4000-8000-000000078018', 'a0000000-0000-4000-8000-000000070406', 'a0000000-0000-4000-8000-000000070403'),
  ('a0000000-0000-4000-8000-000000078008', 'a0000000-0000-4000-8000-000000070506', 'a0000000-0000-4000-8000-000000070503'),
  ('a0000000-0000-4000-8000-000000078009', 'a0000000-0000-4000-8000-000000070507', 'a0000000-0000-4000-8000-000000070508'),
  ('a0000000-0000-4000-8000-000000078010', 'a0000000-0000-4000-8000-000000070508', 'a0000000-0000-4000-8000-000000070506'),
  ('a0000000-0000-4000-8000-000000078011', 'a0000000-0000-4000-8000-000000070103', 'a0000000-0000-4000-8000-000000070603'),
  ('a0000000-0000-4000-8000-000000078012', 'a0000000-0000-4000-8000-000000070203', 'a0000000-0000-4000-8000-000000070603'),
  ('a0000000-0000-4000-8000-000000078013', 'a0000000-0000-4000-8000-000000070303', 'a0000000-0000-4000-8000-000000070603'),
  ('a0000000-0000-4000-8000-000000078014', 'a0000000-0000-4000-8000-000000070403', 'a0000000-0000-4000-8000-000000070603'),
  ('a0000000-0000-4000-8000-000000078015', 'a0000000-0000-4000-8000-000000070503', 'a0000000-0000-4000-8000-000000070603')
on conflict (id) do update set
  source_cell_id = excluded.source_cell_id,
  target_cell_id = excluded.target_cell_id;

-- Touchpoint placements — see the note at the foot of supabase/seed.sql.
insert into public.cell_touchpoints (id, cell_id, name, position, summary, origin)
values
  ('d130d6a4-b7cd-0307-56b2-57112fde16fa', 'a0000000-0000-4000-8000-000000070206', 'Social Media', 0, 'Potential tutors discover PLUS through social posts on platforms like Instagram, LinkedIn, and similar channels where the marketing team shares recruiting content.', 'import'),
  ('30213f01-789d-8056-8c60-08bc5469bd55', 'a0000000-0000-4000-8000-000000070208', 'Figma', 0, 'The marketing team uses Figma to design social graphics and post layouts before publishing PLUS content to social platforms.', 'import'),
  ('780bf487-6072-f208-4c69-2dc0f609890e', 'a0000000-0000-4000-8000-000000070209', 'Branding Guidelines', 0, 'Branding Guidelines are followed by the marketing team to keep PLUS social content visually and tonally consistent.', 'import'),
  ('5329d16e-e8b6-2226-6594-c270f6e3b27b', 'a0000000-0000-4000-8000-000000070306', 'Marketing Website', 0, 'Potential tutors visit the marketing website to learn about PLUS, understand the tutor role, and find a path to apply.', 'import'),
  ('03d693b0-fb06-5fae-2187-5dffbc266e91', 'a0000000-0000-4000-8000-000000070308', 'Dev Tools', 0, 'The dev team uses development tools to build and update the marketing website from approved Figma designs.', 'import'),
  ('9e6be27e-1b2a-aff1-052a-ecbad78e33c0', 'a0000000-0000-4000-8000-000000070308', 'Figma', 1, 'The design team uses Figma to create website layouts, content, and visuals that define how PLUS is presented on the marketing site.', 'import'),
  ('7f88d2a1-c069-c409-57f9-0d715090028c', 'a0000000-0000-4000-8000-000000070309', 'Branding Guidelines', 0, 'Branding Guidelines are followed by the marketing team to keep PLUS social content visually and tonally consistent.', 'import'),
  ('13b2739a-4b6b-0e96-d8fa-282f2a70456d', 'a0000000-0000-4000-8000-000000070309', 'Design System', 1, 'The design system is used by the marketing team to keep the marketing website visually consistent.', 'import'),
  ('c72fdfc6-9252-af5f-3e71-91c94c67e430', 'a0000000-0000-4000-8000-000000070406', 'On-campus booth', 0, 'A physical booth at on-campus job fairs where the tutor supervisor team meets prospective tutors, answers questions, and shares information about joining PLUS.', 'import'),
  ('0b5d6b38-0519-f46c-e5b8-92fa97c85c68', 'a0000000-0000-4000-8000-000000070406', 'Posters', 1, 'Printed posters on campus promote PLUS tutoring opportunities.', 'import'),
  ('bfbaded2-3b3f-056f-0627-95b8c912aa82', 'a0000000-0000-4000-8000-000000070506', 'Handshake', 0, 'Potential tutors discover PLUS on Handshake and browse open job postings.', 'import'),
  ('e612e660-d7ea-6a0e-f514-ce2d5cc2bf63', 'a0000000-0000-4000-8000-000000070508', 'Handshake Employer Profile', 0, 'The tutor supervisor team manages the PLUS employer profile on Handshake, where job postings are published and kept up to date for student applicants.', 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  name = excluded.name,
  position = excluded.position,
  summary = excluded.summary;

-- Resources — see the note at the foot of supabase/seed.sql.
insert into public.resources
  (id, cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
values
  ('56307266-e372-ad9a-b324-a5ef6c3a375a', 'a0000000-0000-4000-8000-000000070206', 'd130d6a4-b7cd-0307-56b2-57112fde16fa', 'attachment', 'Social Media', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070206/8c46f557-498f-6920-0e67-828de92ea64d.png', 0, true, 'import'),
  ('a25f35cd-eecb-ed70-2d10-f602aa6a90e1', 'a0000000-0000-4000-8000-000000070208', '30213f01-789d-8056-8c60-08bc5469bd55', 'attachment', 'Figma', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070208/8b26b46a-6ba3-963f-fd8d-f413a1bb1e83.png', 0, true, 'import'),
  ('984e15fb-7690-fbb1-656e-b2536d290210', 'a0000000-0000-4000-8000-000000070306', null, 'link', 'Visit marketing website', 'https://www.tutors.plus/', 1, false, 'import'),
  ('d3cbc633-3b58-8411-01dc-36280b3adb1d', 'a0000000-0000-4000-8000-000000070306', '5329d16e-e8b6-2226-6594-c270f6e3b27b', 'attachment', 'Marketing Website', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070306/2b6a68b2-27a9-5b5f-d456-a9679b77da9f.png', 0, true, 'import'),
  ('cbd2c401-585e-2377-ce99-aaed2934c7bd', 'a0000000-0000-4000-8000-000000070308', '9e6be27e-1b2a-aff1-052a-ecbad78e33c0', 'attachment', 'Figma', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070208/8b26b46a-6ba3-963f-fd8d-f413a1bb1e83.png', 0, true, 'import'),
  ('dab39def-e4cb-55f8-8afe-b68f7a5c0b25', 'a0000000-0000-4000-8000-000000070406', 'c72fdfc6-9252-af5f-3e71-91c94c67e430', 'attachment', 'On-campus booth', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070406/6fc4f2fc-40c1-bae2-a8cc-dc0328b2ed20.png', 0, true, 'import'),
  ('6f630b7e-f990-dbdc-767f-5c49137f47f3', 'a0000000-0000-4000-8000-000000070506', 'bfbaded2-3b3f-056f-0627-95b8c912aa82', 'attachment', 'Handshake', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070506/0f28b590-ce8d-aebd-c664-392680b4617b.png', 0, true, 'import'),
  ('fa3d17a1-6fc4-658d-382c-fa54b728701a', 'a0000000-0000-4000-8000-000000070508', 'e612e660-d7ea-6a0e-f514-ce2d5cc2bf63', 'attachment', 'Handshake Employer Profile', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070506/0f28b590-ce8d-aebd-c664-392680b4617b.png', 0, true, 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  cell_touchpoint_id = excluded.cell_touchpoint_id,
  kind = excluded.kind,
  name = excluded.name,
  url = excluded.url,
  position = excluded.position,
  featured = excluded.featured;
