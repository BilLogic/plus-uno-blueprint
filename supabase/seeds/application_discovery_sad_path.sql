-- Application → Discovery scenario — Sad Path (mirrors Happy Path for now)
-- Reuses scenario steps from application_discovery_happy_path.sql via path_steps.

insert into public.paths (id, scenario_id, name, summary, kind)
values (
  'a0000000-0000-4000-8000-000000000701',
  'a0000000-0000-4000-8000-000000000121',
  'Sad Path',
  'Potential tutors discover and are not interested in joining PLUS.',
  'exception'
)
on conflict (id) do update set
  scenario_id = excluded.scenario_id,
  name = excluded.name,
  summary = excluded.summary,
  kind = excluded.kind;

insert into public.lanes (id, path_id, name, position)
values
  (
    'a0000000-0000-4000-8000-000000000791',
    'a0000000-0000-4000-8000-000000000701',
    'Storyboard',
    0
  ),
  (
    'a0000000-0000-4000-8000-000000000792',
    'a0000000-0000-4000-8000-000000000701',
    'Regular Tutor',
    1
  ),
  (
    'a0000000-0000-4000-8000-000000000794',
    'a0000000-0000-4000-8000-000000000701',
    'Front Stage Tech',
    2
  ),
  (
    'a0000000-0000-4000-8000-000000000793',
    'a0000000-0000-4000-8000-000000000701',
    'Front Stage Actions',
    3
  ),
  (
    'a0000000-0000-4000-8000-000000000796',
    'a0000000-0000-4000-8000-000000000701',
    'Back Stage Tech',
    4
  ),
  (
    'a0000000-0000-4000-8000-000000000795',
    'a0000000-0000-4000-8000-000000000701',
    'Back Stage Actions',
    5
  ),
  (
    'a0000000-0000-4000-8000-000000000797',
    'a0000000-0000-4000-8000-000000000701',
    'Support Actions',
    6
  )
on conflict (id) do update set
  name = excluded.name,
  position = excluded.position;

insert into public.path_steps (path_id, step_id, position)
values
  ('a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000711', 1),
  ('a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000712', 2),
  ('a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000713', 3),
  ('a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000714', 4),
  ('a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000715', 5),
  ('a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000717', 6)
on conflict (path_id, step_id) do update set
  position = excluded.position;

insert into public.cells (id, path_id, lane_id, step_id, content)
values
  -- Visual row
  ('a0000000-0000-4000-8000-000000720110', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000791', 'a0000000-0000-4000-8000-000000000711', ''),
  ('a0000000-0000-4000-8000-000000720210', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000791', 'a0000000-0000-4000-8000-000000000712', ''),
  ('a0000000-0000-4000-8000-000000720310', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000791', 'a0000000-0000-4000-8000-000000000713', ''),
  ('a0000000-0000-4000-8000-000000720410', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000791', 'a0000000-0000-4000-8000-000000000714', ''),
  ('a0000000-0000-4000-8000-000000720510', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000791', 'a0000000-0000-4000-8000-000000000715', ''),
  ('a0000000-0000-4000-8000-000000720610', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000791', 'a0000000-0000-4000-8000-000000000717', ''),
  -- Step 1 — word of mouth
  ('a0000000-0000-4000-8000-000000720103', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000792', 'a0000000-0000-4000-8000-000000000711', 'Discovers PLUS via word of mouth.'),
  ('a0000000-0000-4000-8000-000000720104', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000793', 'a0000000-0000-4000-8000-000000000711', 'Previous or current PLUS tutor might have informed about PLUS.'),
  -- Step 2 — Social Media
  ('a0000000-0000-4000-8000-000000720203', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000792', 'a0000000-0000-4000-8000-000000000712', 'Discovers PLUS via social media.'),
  ('a0000000-0000-4000-8000-000000720206', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000794', 'a0000000-0000-4000-8000-000000000712', 'Social Media'),
  ('a0000000-0000-4000-8000-000000720207', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000795', 'a0000000-0000-4000-8000-000000000712', 'Marketing team creates social media posts and manages social platforms.'),
  ('a0000000-0000-4000-8000-000000720208', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000796', 'a0000000-0000-4000-8000-000000000712', 'Figma'),
  ('a0000000-0000-4000-8000-000000720209', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000797', 'a0000000-0000-4000-8000-000000000712', 'Branding Guidelines'),
  -- Step 3 — Marketing Website
  ('a0000000-0000-4000-8000-000000720303', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000792', 'a0000000-0000-4000-8000-000000000713', 'Discovers PLUS via PLUS marketing website.'),
  ('a0000000-0000-4000-8000-000000720306', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000794', 'a0000000-0000-4000-8000-000000000713', 'Marketing Website'),
  ('a0000000-0000-4000-8000-000000720307', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000795', 'a0000000-0000-4000-8000-000000000713', 'Design team manages content and messaging on the website. Dev team implements website into code.'),
  ('a0000000-0000-4000-8000-000000720308', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000796', 'a0000000-0000-4000-8000-000000000713', E'Figma\nDev Tools'),
  ('a0000000-0000-4000-8000-000000720309', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000797', 'a0000000-0000-4000-8000-000000000713', 'Branding Guidelines, Design System'),
  -- Step 4 — On-campus job fair
  ('a0000000-0000-4000-8000-000000720403', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000792', 'a0000000-0000-4000-8000-000000000714', 'Discovers PLUS via on campus activities.'),
  ('a0000000-0000-4000-8000-000000720404', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000793', 'a0000000-0000-4000-8000-000000000714', 'Tutor supervisor team meets prospective tutors at on-campus job fair.'),
  ('a0000000-0000-4000-8000-000000720406', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000794', 'a0000000-0000-4000-8000-000000000714', E'Posters\nOn-campus booth'),
  -- Step 5 — Handshake
  ('a0000000-0000-4000-8000-000000720503', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000792', 'a0000000-0000-4000-8000-000000000715', 'Discovers PLUS via Handshake.'),
  ('a0000000-0000-4000-8000-000000720506', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000794', 'a0000000-0000-4000-8000-000000000715', 'Handshake'),
  ('a0000000-0000-4000-8000-000000720507', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000795', 'a0000000-0000-4000-8000-000000000715', 'Tutor supervisor team posts job openings on Handshake.'),
  ('a0000000-0000-4000-8000-000000720508', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000796', 'a0000000-0000-4000-8000-000000000715', 'Handshake Employer Profile'),
  -- Step 6 — Not interested in joining PLUS
  ('a0000000-0000-4000-8000-000000720603', 'a0000000-0000-4000-8000-000000000701', 'a0000000-0000-4000-8000-000000000792', 'a0000000-0000-4000-8000-000000000717', 'Not interested in joining PLUS.')
on conflict (id) do update set
  content = excluded.content,
  lane_id = excluded.lane_id,
  step_id = excluded.step_id;insert into public.cell_dependencies (id, source_cell_id, target_cell_id)
values
  ('a0000000-0000-4000-8000-000000728001', 'a0000000-0000-4000-8000-000000720104', 'a0000000-0000-4000-8000-000000720103'),
  ('a0000000-0000-4000-8000-000000728002', 'a0000000-0000-4000-8000-000000720207', 'a0000000-0000-4000-8000-000000720208'),
  ('a0000000-0000-4000-8000-000000728016', 'a0000000-0000-4000-8000-000000720208', 'a0000000-0000-4000-8000-000000720206'),
  ('a0000000-0000-4000-8000-000000728004', 'a0000000-0000-4000-8000-000000720206', 'a0000000-0000-4000-8000-000000720203'),
  ('a0000000-0000-4000-8000-000000728003', 'a0000000-0000-4000-8000-000000720307', 'a0000000-0000-4000-8000-000000720308'),
  ('a0000000-0000-4000-8000-000000728017', 'a0000000-0000-4000-8000-000000720308', 'a0000000-0000-4000-8000-000000720306'),
  ('a0000000-0000-4000-8000-000000728005', 'a0000000-0000-4000-8000-000000720306', 'a0000000-0000-4000-8000-000000720303'),
  ('a0000000-0000-4000-8000-000000728006', 'a0000000-0000-4000-8000-000000720404', 'a0000000-0000-4000-8000-000000720403'),
  ('a0000000-0000-4000-8000-000000728007', 'a0000000-0000-4000-8000-000000720404', 'a0000000-0000-4000-8000-000000720406'),
  ('a0000000-0000-4000-8000-000000728018', 'a0000000-0000-4000-8000-000000720406', 'a0000000-0000-4000-8000-000000720403'),
  ('a0000000-0000-4000-8000-000000728008', 'a0000000-0000-4000-8000-000000720506', 'a0000000-0000-4000-8000-000000720503'),
  ('a0000000-0000-4000-8000-000000728009', 'a0000000-0000-4000-8000-000000720507', 'a0000000-0000-4000-8000-000000720508'),
  ('a0000000-0000-4000-8000-000000728010', 'a0000000-0000-4000-8000-000000720508', 'a0000000-0000-4000-8000-000000720506'),
  ('a0000000-0000-4000-8000-000000728011', 'a0000000-0000-4000-8000-000000720103', 'a0000000-0000-4000-8000-000000720603'),
  ('a0000000-0000-4000-8000-000000728012', 'a0000000-0000-4000-8000-000000720203', 'a0000000-0000-4000-8000-000000720603'),
  ('a0000000-0000-4000-8000-000000728013', 'a0000000-0000-4000-8000-000000720303', 'a0000000-0000-4000-8000-000000720603'),
  ('a0000000-0000-4000-8000-000000728014', 'a0000000-0000-4000-8000-000000720403', 'a0000000-0000-4000-8000-000000720603'),
  ('a0000000-0000-4000-8000-000000728015', 'a0000000-0000-4000-8000-000000720503', 'a0000000-0000-4000-8000-000000720603')
on conflict (id) do update set
  source_cell_id = excluded.source_cell_id,
  target_cell_id = excluded.target_cell_id;

-- Touchpoint placements — see the note at the foot of supabase/seed.sql.
insert into public.cell_touchpoints (id, cell_id, name, position, summary, origin)
values
  ('5480781a-5360-76e4-ee93-662577614e2b', 'a0000000-0000-4000-8000-000000720206', 'Social Media', 0, 'Potential tutors discover PLUS through social posts on platforms like Instagram, LinkedIn, and similar channels where the marketing team shares recruiting content.', 'import'),
  ('a55e779f-a3dd-21d5-47d7-925a817fa6ec', 'a0000000-0000-4000-8000-000000720208', 'Figma', 0, 'The marketing team uses Figma to design social graphics and post layouts before publishing PLUS content to social platforms.', 'import'),
  ('2a5750d4-eb89-2971-23e6-3804e97435a2', 'a0000000-0000-4000-8000-000000720209', 'Branding Guidelines', 0, 'Branding Guidelines are followed by the marketing team to keep PLUS social content visually and tonally consistent.', 'import'),
  ('949694d3-6b88-12fe-73fa-130645d9adc0', 'a0000000-0000-4000-8000-000000720306', 'Marketing Website', 0, 'Potential tutors visit the marketing website to learn about PLUS, understand the tutor role, and find a path to apply.', 'import'),
  ('be87eac5-9d04-5385-a78f-39257f58cc3d', 'a0000000-0000-4000-8000-000000720308', 'Dev Tools', 0, 'The dev team uses development tools to build and update the marketing website from approved Figma designs.', 'import'),
  ('bacbc35d-187f-50bc-5c24-50cccb266796', 'a0000000-0000-4000-8000-000000720308', 'Figma', 1, 'The design team uses Figma to create website layouts, content, and visuals that define how PLUS is presented on the marketing site.', 'import'),
  ('dd226a5c-6754-a170-0446-b1d7a61a6b0e', 'a0000000-0000-4000-8000-000000720309', 'Branding Guidelines', 0, 'Branding Guidelines are followed by the marketing team to keep PLUS social content visually and tonally consistent.', 'import'),
  ('61a2a6e2-ef8b-20ff-d044-8323f47207c3', 'a0000000-0000-4000-8000-000000720309', 'Design System', 1, 'The design system is used by the marketing team to keep the marketing website visually consistent.', 'import'),
  ('5c87788e-9767-8762-c491-f25532c7bfd9', 'a0000000-0000-4000-8000-000000720406', 'On-campus booth', 0, 'A physical booth at on-campus job fairs where the tutor supervisor team meets prospective tutors, answers questions, and shares information about joining PLUS.', 'import'),
  ('6e1328aa-075c-5ce7-9658-7b94be360d16', 'a0000000-0000-4000-8000-000000720406', 'Posters', 1, 'Printed posters on campus promote PLUS tutoring opportunities.', 'import'),
  ('d69fb71f-26b5-bbe1-4b24-c10e87df6bce', 'a0000000-0000-4000-8000-000000720506', 'Handshake', 0, 'Potential tutors discover PLUS on Handshake and browse open job postings.', 'import'),
  ('25d0fa7e-91cb-b633-f17d-5d298d55a50e', 'a0000000-0000-4000-8000-000000720508', 'Handshake Employer Profile', 0, 'The tutor supervisor team manages the PLUS employer profile on Handshake, where job postings are published and kept up to date for student applicants.', 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  name = excluded.name,
  position = excluded.position,
  summary = excluded.summary;

-- Resources — see the note at the foot of supabase/seed.sql.
insert into public.resources
  (id, cell_id, cell_touchpoint_id, kind, name, url, position, featured, origin)
values
  ('65300084-8582-33d1-d132-73ec758b1b29', 'a0000000-0000-4000-8000-000000720206', '5480781a-5360-76e4-ee93-662577614e2b', 'attachment', 'Social Media', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070206/8c46f557-498f-6920-0e67-828de92ea64d.png', 0, true, 'import'),
  ('ad23254a-7593-db4a-7dca-3f23a3c4dc0a', 'a0000000-0000-4000-8000-000000720208', 'a55e779f-a3dd-21d5-47d7-925a817fa6ec', 'attachment', 'Figma', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070208/8b26b46a-6ba3-963f-fd8d-f413a1bb1e83.png', 0, true, 'import'),
  ('10592429-e191-141a-cc9e-88e22769b77f', 'a0000000-0000-4000-8000-000000720306', null, 'link', 'Visit marketing website', 'https://www.tutors.plus/', 1, false, 'import'),
  ('70c6ab15-a8af-2d3d-0c50-139759a9e8f1', 'a0000000-0000-4000-8000-000000720306', '949694d3-6b88-12fe-73fa-130645d9adc0', 'attachment', 'Marketing Website', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070306/2b6a68b2-27a9-5b5f-d456-a9679b77da9f.png', 0, true, 'import'),
  ('8cc01ee0-85b4-29d0-dcde-a7c60ba13baa', 'a0000000-0000-4000-8000-000000720308', 'bacbc35d-187f-50bc-5c24-50cccb266796', 'attachment', 'Figma', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070208/8b26b46a-6ba3-963f-fd8d-f413a1bb1e83.png', 0, true, 'import'),
  ('fc96137b-0d8a-1061-ffe2-4af82ad6d97d', 'a0000000-0000-4000-8000-000000720406', '5c87788e-9767-8762-c491-f25532c7bfd9', 'attachment', 'On-campus booth', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070406/6fc4f2fc-40c1-bae2-a8cc-dc0328b2ed20.png', 0, true, 'import'),
  ('5003d56c-9251-19bc-d3ce-5c649bac2c93', 'a0000000-0000-4000-8000-000000720506', 'd69fb71f-26b5-bbe1-4b24-c10e87df6bce', 'attachment', 'Handshake', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070506/0f28b590-ce8d-aebd-c664-392680b4617b.png', 0, true, 'import'),
  ('c4824021-8c67-c798-ffe6-c38bd3c8454c', 'a0000000-0000-4000-8000-000000720508', '25d0fa7e-91cb-b633-f17d-5d298d55a50e', 'attachment', 'Handshake Employer Profile', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000070506/0f28b590-ce8d-aebd-c664-392680b4617b.png', 0, true, 'import')
on conflict (id) do update set
  cell_id = excluded.cell_id,
  cell_touchpoint_id = excluded.cell_touchpoint_id,
  kind = excluded.kind,
  name = excluded.name,
  url = excluded.url,
  position = excluded.position,
  featured = excluded.featured;
