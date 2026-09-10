-- The 88 cells the board drew from TypeScript and the database never had.
--
-- `src/data/` holds this deployment's blueprint content as a fallback registry
-- that `resolveBlueprintForScenario` merges under the database. That merge is
-- DB-wins for every field, so the registry's only live effect is APPENDING
-- rows the database does not have: measured against production, it fills no
-- blank `content`, no blank `frame` and no blank `summary` anywhere, because
-- no such case exists.
--
-- What it does append, on paths a reader can actually reach, is 88 cells,
-- 87 of them carrying text. A person reading the board sees them. The agent,
-- an export, and anyone running SQL do not, because they are not rows. That
-- split is the reason for this migration: the board and the database should
-- be describing the same service.
--
-- Two hidden paths are deliberately NOT here. `UI_HIDDEN_PATH_IDS_BY_SCENARIO`
-- keeps Discovery's "Sad Path" and Warm-Up's out of every picker and grid, so
-- their rows are invisible today, and importing them would make them real
-- without making them wanted. They stay a separate decision.
--
-- The ids are the registry's own, so this is idempotent by primary key: a
-- second apply is a no-op rather than a duplicate board.
--
-- One row the id-keyed diff called missing is not here. The registry places
-- wrap-up's "Dev Team / Design Team" cell on lane `…0878`, and the database
-- retired that id from this path and gave it to a lane on another one. The
-- cell itself is already in the database, on wrap-up's current Support
-- Actions lane, so importing the registry's copy would have written the same
-- content a second time under a lane the path does not have. A rehearsal
-- against a copy of production is what separated the two:
-- `cells_validate_path_match` raised, and matching by content rather than by
-- id found the row already there.

begin;

-- Four of the cells below sit on a step that reaches this path through no
-- `path_steps` row. It joins the end of that path's existing sequence.
insert into public.path_steps (path_id, step_id, position)
values (
  'a0000000-0000-4000-8000-000000000808',
  'a0000000-0000-4000-8000-000000000942',
  (
    select coalesce(max(position), 0) + 1
    from public.path_steps
    where path_id = 'a0000000-0000-4000-8000-000000000808'
  )
)
on conflict (path_id, step_id) do nothing;

insert into public.cells (id, path_id, lane_id, step_id, content, frame, summary, origin)
select v.id::uuid, v.path_id::uuid, v.lane_id::uuid, v.step_id::uuid,
       v.content, v.frame, v.summary, 'import'
from (values
  ('a0000000-0000-4000-8000-000000040202', 'a0000000-0000-4000-8000-000000000300', 'a0000000-0000-4000-8000-000000000302', 'a0000000-0000-4000-8000-000000000312', 'Add any un-rostered students to attendance list.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0202/0911e936-fd5a-3171-9338-9e57d694b158.png', null),
  ('a0000000-0000-4000-8000-000000040302', 'a0000000-0000-4000-8000-000000000300', 'a0000000-0000-4000-8000-000000000302', 'a0000000-0000-4000-8000-000000000313', 'Manually assign unpaired students to available tutors.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0302/d451bb96-0858-37e8-9e3c-588df38cfb2b.png', null),
  ('a0000000-0000-4000-8000-000000040401', 'a0000000-0000-4000-8000-000000000300', 'a0000000-0000-4000-8000-000000000301', 'a0000000-0000-4000-8000-000000000314', 'Receives information that student is absent from session.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0401/df4eeba7-5747-4aa2-1d62-dde366548029.png', null),
  ('a0000000-0000-4000-8000-000000040402', 'a0000000-0000-4000-8000-000000000300', 'a0000000-0000-4000-8000-000000000302', 'a0000000-0000-4000-8000-000000000314', 'Inform classroom teacher about students that are absent.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0402/db5f36b0-90a1-dbfe-92eb-07af60fb4bc0.png', null),
  ('a0000000-0000-4000-8000-000000040501', 'a0000000-0000-4000-8000-000000000300', 'a0000000-0000-4000-8000-000000000301', 'a0000000-0000-4000-8000-000000000315', 'Alerts lead tutor about unassigned or miss-assigned students using the "ask for help" alert.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0501/610fd0d7-ee32-6f6e-8d3c-7d56c796381e.png', null),
  ('a0000000-0000-4000-8000-000000040502', 'a0000000-0000-4000-8000-000000000300', 'a0000000-0000-4000-8000-000000000302', 'a0000000-0000-4000-8000-000000000315', 'Respond to classroom teachers "ask for help" request.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0502/63b222f0-1142-8cd8-0979-aa8e4ba2bcc2.png', null),
  ('a0000000-0000-4000-8000-000000040601', 'a0000000-0000-4000-8000-000000000300', 'a0000000-0000-4000-8000-000000000301', 'a0000000-0000-4000-8000-000000000316', 'Handles student tech problems as they arise.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0601/70caf55e-72b8-3f2e-73e3-c419a60a501c.png', null),
  ('a0000000-0000-4000-8000-000000040609', 'a0000000-0000-4000-8000-000000000300', 'a0000000-0000-4000-8000-000000000309', 'a0000000-0000-4000-8000-000000000316', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000040701', 'a0000000-0000-4000-8000-000000000300', 'a0000000-0000-4000-8000-000000000301', 'a0000000-0000-4000-8000-000000000317', 'Escalates unresolved issues to tutors@tutor.plus promptly.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0701/3a876ff6-fdbe-77c5-7a7f-1c7d1c305198.png', null),
  ('a0000000-0000-4000-8000-000000040709', 'a0000000-0000-4000-8000-000000000300', 'a0000000-0000-4000-8000-000000000309', 'a0000000-0000-4000-8000-000000000317', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000040909', 'a0000000-0000-4000-8000-000000000300', 'a0000000-0000-4000-8000-000000000309', 'a0000000-0000-4000-8000-000000000318', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000060202', 'a0000000-0000-4000-8000-000000000350', 'a0000000-0000-4000-8000-000000000402', 'a0000000-0000-4000-8000-000000000312', 'Add any un-rostered students to attendance list.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0202/0911e936-fd5a-3171-9338-9e57d694b158.png', null),
  ('a0000000-0000-4000-8000-000000060302', 'a0000000-0000-4000-8000-000000000350', 'a0000000-0000-4000-8000-000000000402', 'a0000000-0000-4000-8000-000000000314', 'Manually assign unpaired students to available tutors.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0302/d451bb96-0858-37e8-9e3c-588df38cfb2b.png', null),
  ('a0000000-0000-4000-8000-000000060401', 'a0000000-0000-4000-8000-000000000350', 'a0000000-0000-4000-8000-000000000401', 'a0000000-0000-4000-8000-000000000315', 'Receives information that student is absent from session.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0401/df4eeba7-5747-4aa2-1d62-dde366548029.png', null),
  ('a0000000-0000-4000-8000-000000060402', 'a0000000-0000-4000-8000-000000000350', 'a0000000-0000-4000-8000-000000000402', 'a0000000-0000-4000-8000-000000000315', 'Inform classroom teacher about students that are absent.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0402/db5f36b0-90a1-dbfe-92eb-07af60fb4bc0.png', null),
  ('a0000000-0000-4000-8000-000000060501', 'a0000000-0000-4000-8000-000000000350', 'a0000000-0000-4000-8000-000000000401', 'a0000000-0000-4000-8000-000000000316', 'Alerts lead tutor about unassigned or miss-assigned students using the "ask for help" alert.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0501/610fd0d7-ee32-6f6e-8d3c-7d56c796381e.png', null),
  ('a0000000-0000-4000-8000-000000060502', 'a0000000-0000-4000-8000-000000000350', 'a0000000-0000-4000-8000-000000000402', 'a0000000-0000-4000-8000-000000000316', 'Respond to classroom teachers "ask for help" request.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0502/63b222f0-1142-8cd8-0979-aa8e4ba2bcc2.png', null),
  ('a0000000-0000-4000-8000-000000060509', 'a0000000-0000-4000-8000-000000000350', 'a0000000-0000-4000-8000-000000000409', 'a0000000-0000-4000-8000-000000000315', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000060601', 'a0000000-0000-4000-8000-000000000350', 'a0000000-0000-4000-8000-000000000401', 'a0000000-0000-4000-8000-000000000317', 'Handles student tech problems as they arise.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0601/70caf55e-72b8-3f2e-73e3-c419a60a501c.png', null),
  ('a0000000-0000-4000-8000-000000060609', 'a0000000-0000-4000-8000-000000000350', 'a0000000-0000-4000-8000-000000000409', 'a0000000-0000-4000-8000-000000000316', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000060701', 'a0000000-0000-4000-8000-000000000350', 'a0000000-0000-4000-8000-000000000401', 'a0000000-0000-4000-8000-000000000319', 'Escalates unresolved issues to tutors@tutor.plus promptly.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0701/3a876ff6-fdbe-77c5-7a7f-1c7d1c305198.png', null),
  ('a0000000-0000-4000-8000-000000060709', 'a0000000-0000-4000-8000-000000000350', 'a0000000-0000-4000-8000-000000000409', 'a0000000-0000-4000-8000-000000000317', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000060909', 'a0000000-0000-4000-8000-000000000350', 'a0000000-0000-4000-8000-000000000409', 'a0000000-0000-4000-8000-000000000318', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000170303', 'a0000000-0000-4000-8000-000000000808', 'a0000000-0000-4000-8000-000000000972', 'a0000000-0000-4000-8000-000000000942', 'If it is less than 12 hours before session, tutor emails supervisor.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/00000000-0000-4000-8000-000000000000/456e2936-08f4-5150-1027-9e763987ab2f.png', null),
  ('a0000000-0000-4000-8000-000000170304', 'a0000000-0000-4000-8000-000000000808', 'a0000000-0000-4000-8000-000000000973', 'a0000000-0000-4000-8000-000000000942', 'Tutor supervisor receives email request for shift swap.', null, null),
  ('a0000000-0000-4000-8000-000000170306', 'a0000000-0000-4000-8000-000000000808', 'a0000000-0000-4000-8000-000000000974', 'a0000000-0000-4000-8000-000000000942', 'Email', null, null),
  ('a0000000-0000-4000-8000-000000170310', 'a0000000-0000-4000-8000-000000000808', 'a0000000-0000-4000-8000-000000000971', 'a0000000-0000-4000-8000-000000000942', '', null, null),
  ('a0000000-0000-4000-8000-000000180209', 'a0000000-0000-4000-8000-000000000809', 'a0000000-0000-4000-8000-000000002018', 'a0000000-0000-4000-8000-000000000951', 'Dev team
Design team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000180509', 'a0000000-0000-4000-8000-000000000809', 'a0000000-0000-4000-8000-000000002018', 'a0000000-0000-4000-8000-000000000954', 'Dev team
Design team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-0000001a0309', 'a0000000-0000-4000-8000-00000000080c', 'a0000000-0000-4000-8000-000000000856', 'a0000000-0000-4000-8000-000000000972', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-0000001a0409', 'a0000000-0000-4000-8000-00000000080c', 'a0000000-0000-4000-8000-000000000856', 'a0000000-0000-4000-8000-000000000973', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-0000001a0509', 'a0000000-0000-4000-8000-00000000080c', 'a0000000-0000-4000-8000-000000000856', 'a0000000-0000-4000-8000-000000000984', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-0000001a0709', 'a0000000-0000-4000-8000-00000000080c', 'a0000000-0000-4000-8000-000000000856', 'a0000000-0000-4000-8000-000000000974', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-0000001f0209', 'a0000000-0000-4000-8000-000000000811', 'a0000000-0000-4000-8000-0000000008a8', 'a0000000-0000-4000-8000-000000009a02', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-0000001f0309', 'a0000000-0000-4000-8000-000000000811', 'a0000000-0000-4000-8000-0000000008a8', 'a0000000-0000-4000-8000-000000009a03', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-0000001f0402', 'a0000000-0000-4000-8000-000000000811', 'a0000000-0000-4000-8000-0000000008a2', 'a0000000-0000-4000-8000-000000009a04', 'Inform classroom teacher about students that are absent.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0402/db5f36b0-90a1-dbfe-92eb-07af60fb4bc0.png', null),
  ('a0000000-0000-4000-8000-0000001f0501', 'a0000000-0000-4000-8000-000000000811', 'a0000000-0000-4000-8000-0000000008a1', 'a0000000-0000-4000-8000-000000009a05', 'Alerts lead tutor about unassigned or miss-assigned students using the "ask for help" alert.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0501/610fd0d7-ee32-6f6e-8d3c-7d56c796381e.png', null),
  ('a0000000-0000-4000-8000-0000001f0502', 'a0000000-0000-4000-8000-000000000811', 'a0000000-0000-4000-8000-0000000008a2', 'a0000000-0000-4000-8000-000000009a05', 'Respond to classroom teachers "ask for help" request.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0502/63b222f0-1142-8cd8-0979-aa8e4ba2bcc2.png', null),
  ('a0000000-0000-4000-8000-0000001f0509', 'a0000000-0000-4000-8000-000000000811', 'a0000000-0000-4000-8000-0000000008a8', 'a0000000-0000-4000-8000-000000009a05', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-0000001f0609', 'a0000000-0000-4000-8000-000000000811', 'a0000000-0000-4000-8000-0000000008a8', 'a0000000-0000-4000-8000-000000009a06', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-0000001f0709', 'a0000000-0000-4000-8000-000000000811', 'a0000000-0000-4000-8000-0000000008a8', 'a0000000-0000-4000-8000-000000009a07', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-0000001f0809', 'a0000000-0000-4000-8000-000000000811', 'a0000000-0000-4000-8000-0000000008a8', 'a0000000-0000-4000-8000-000000009a08', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-0000001f0909', 'a0000000-0000-4000-8000-000000000811', 'a0000000-0000-4000-8000-0000000008a8', 'a0000000-0000-4000-8000-000000009a09', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-0000001f1109', 'a0000000-0000-4000-8000-000000000811', 'a0000000-0000-4000-8000-0000000008a8', 'a0000000-0000-4000-8000-000000000974', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000a00209', 'a0000000-0000-4000-8000-000000000814', 'a0000000-0000-4000-8000-0000000008b8', 'a0000000-0000-4000-8000-000000009b02', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000a00309', 'a0000000-0000-4000-8000-000000000814', 'a0000000-0000-4000-8000-0000000008b8', 'a0000000-0000-4000-8000-000000009b03', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000a00402', 'a0000000-0000-4000-8000-000000000814', 'a0000000-0000-4000-8000-0000000008b2', 'a0000000-0000-4000-8000-000000009b04', 'Inform classroom teacher about students that are absent.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0402/db5f36b0-90a1-dbfe-92eb-07af60fb4bc0.png', null),
  ('a0000000-0000-4000-8000-000000a00501', 'a0000000-0000-4000-8000-000000000814', 'a0000000-0000-4000-8000-0000000008b1', 'a0000000-0000-4000-8000-000000009b05', 'Alerts lead tutor about unassigned or miss-assigned students using the "ask for help" alert.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0501/610fd0d7-ee32-6f6e-8d3c-7d56c796381e.png', null),
  ('a0000000-0000-4000-8000-000000a00502', 'a0000000-0000-4000-8000-000000000814', 'a0000000-0000-4000-8000-0000000008b2', 'a0000000-0000-4000-8000-000000009b05', 'Respond to classroom teachers "ask for help" request.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0502/63b222f0-1142-8cd8-0979-aa8e4ba2bcc2.png', null),
  ('a0000000-0000-4000-8000-000000a00509', 'a0000000-0000-4000-8000-000000000814', 'a0000000-0000-4000-8000-0000000008b8', 'a0000000-0000-4000-8000-000000009b05', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000a00609', 'a0000000-0000-4000-8000-000000000814', 'a0000000-0000-4000-8000-0000000008b8', 'a0000000-0000-4000-8000-000000009b06', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000a00809', 'a0000000-0000-4000-8000-000000000814', 'a0000000-0000-4000-8000-0000000008b8', 'a0000000-0000-4000-8000-000000009b08', 'Researchers set student order, Dev Team, Design Team.', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000b00209', 'a0000000-0000-4000-8000-000000000815', 'a0000000-0000-4000-8000-0000000008d8', 'a0000000-0000-4000-8000-000000009d02', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000b00309', 'a0000000-0000-4000-8000-000000000815', 'a0000000-0000-4000-8000-0000000008d8', 'a0000000-0000-4000-8000-000000009d03', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000b00402', 'a0000000-0000-4000-8000-000000000815', 'a0000000-0000-4000-8000-0000000008d2', 'a0000000-0000-4000-8000-000000009d04', 'Inform classroom teacher about students that are absent.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0402/db5f36b0-90a1-dbfe-92eb-07af60fb4bc0.png', null),
  ('a0000000-0000-4000-8000-000000b00501', 'a0000000-0000-4000-8000-000000000815', 'a0000000-0000-4000-8000-0000000008d1', 'a0000000-0000-4000-8000-000000009d05', 'Alerts lead tutor about unassigned or miss-assigned students using the "ask for help" alert.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0501/610fd0d7-ee32-6f6e-8d3c-7d56c796381e.png', null),
  ('a0000000-0000-4000-8000-000000b00502', 'a0000000-0000-4000-8000-000000000815', 'a0000000-0000-4000-8000-0000000008d2', 'a0000000-0000-4000-8000-000000009d05', 'Respond to classroom teachers "ask for help" request.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0502/63b222f0-1142-8cd8-0979-aa8e4ba2bcc2.png', null),
  ('a0000000-0000-4000-8000-000000b00509', 'a0000000-0000-4000-8000-000000000815', 'a0000000-0000-4000-8000-0000000008d8', 'a0000000-0000-4000-8000-000000009d05', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000b00609', 'a0000000-0000-4000-8000-000000000815', 'a0000000-0000-4000-8000-0000000008d8', 'a0000000-0000-4000-8000-000000009d06', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000b00709', 'a0000000-0000-4000-8000-000000000815', 'a0000000-0000-4000-8000-0000000008d8', 'a0000000-0000-4000-8000-000000009d07', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000b00809', 'a0000000-0000-4000-8000-000000000815', 'a0000000-0000-4000-8000-0000000008d8', 'a0000000-0000-4000-8000-000000009d08', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000b00909', 'a0000000-0000-4000-8000-000000000815', 'a0000000-0000-4000-8000-0000000008d8', 'a0000000-0000-4000-8000-000000009d09', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000b01109', 'a0000000-0000-4000-8000-000000000815', 'a0000000-0000-4000-8000-0000000008d8', 'a0000000-0000-4000-8000-000000009d0b', 'Dev Team, Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000c00209', 'a0000000-0000-4000-8000-000000000816', 'a0000000-0000-4000-8000-0000000008e8', 'a0000000-0000-4000-8000-000000009f02', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000c00309', 'a0000000-0000-4000-8000-000000000816', 'a0000000-0000-4000-8000-0000000008e8', 'a0000000-0000-4000-8000-000000009f03', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000c00402', 'a0000000-0000-4000-8000-000000000816', 'a0000000-0000-4000-8000-0000000008e2', 'a0000000-0000-4000-8000-000000009f04', 'Inform classroom teacher about students that are absent.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0402/db5f36b0-90a1-dbfe-92eb-07af60fb4bc0.png', null),
  ('a0000000-0000-4000-8000-000000c00409', 'a0000000-0000-4000-8000-000000000816', 'a0000000-0000-4000-8000-0000000008e8', 'a0000000-0000-4000-8000-000000009f04', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000c00501', 'a0000000-0000-4000-8000-000000000816', 'a0000000-0000-4000-8000-0000000008e1', 'a0000000-0000-4000-8000-000000009f05', 'Alerts lead tutor about unassigned or miss-assigned students using the "ask for help" alert.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0501/610fd0d7-ee32-6f6e-8d3c-7d56c796381e.png', null),
  ('a0000000-0000-4000-8000-000000c00502', 'a0000000-0000-4000-8000-000000000816', 'a0000000-0000-4000-8000-0000000008e2', 'a0000000-0000-4000-8000-000000009f05', 'Respond to classroom teachers "ask for help" request.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0502/63b222f0-1142-8cd8-0979-aa8e4ba2bcc2.png', null),
  ('a0000000-0000-4000-8000-000000c00609', 'a0000000-0000-4000-8000-000000000816', 'a0000000-0000-4000-8000-0000000008e8', 'a0000000-0000-4000-8000-000000009f06', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000c00709', 'a0000000-0000-4000-8000-000000000816', 'a0000000-0000-4000-8000-0000000008e8', 'a0000000-0000-4000-8000-000000009f07', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000c00809', 'a0000000-0000-4000-8000-000000000816', 'a0000000-0000-4000-8000-0000000008e8', 'a0000000-0000-4000-8000-000000009f08', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000c00909', 'a0000000-0000-4000-8000-000000000816', 'a0000000-0000-4000-8000-0000000008e8', 'a0000000-0000-4000-8000-000000009f09', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000c01009', 'a0000000-0000-4000-8000-000000000816', 'a0000000-0000-4000-8000-0000000008e8', 'a0000000-0000-4000-8000-000000009f0a', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000c01209', 'a0000000-0000-4000-8000-000000000816', 'a0000000-0000-4000-8000-0000000008e8', 'a0000000-0000-4000-8000-000000009f0c', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000d00209', 'a0000000-0000-4000-8000-000000000817', 'a0000000-0000-4000-8000-0000000008f8', 'a0000000-0000-4000-8000-000000009e02', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000d00309', 'a0000000-0000-4000-8000-000000000817', 'a0000000-0000-4000-8000-0000000008f8', 'a0000000-0000-4000-8000-000000009e03', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000d00402', 'a0000000-0000-4000-8000-000000000817', 'a0000000-0000-4000-8000-0000000008f2', 'a0000000-0000-4000-8000-000000009e04', 'Inform classroom teacher about students that are absent.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0402/db5f36b0-90a1-dbfe-92eb-07af60fb4bc0.png', null),
  ('a0000000-0000-4000-8000-000000d00409', 'a0000000-0000-4000-8000-000000000817', 'a0000000-0000-4000-8000-0000000008f8', 'a0000000-0000-4000-8000-000000009e04', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000d00501', 'a0000000-0000-4000-8000-000000000817', 'a0000000-0000-4000-8000-0000000008f1', 'a0000000-0000-4000-8000-000000009e05', 'Alerts lead tutor about unassigned or miss-assigned students using the "ask for help" alert.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0501/610fd0d7-ee32-6f6e-8d3c-7d56c796381e.png', null),
  ('a0000000-0000-4000-8000-000000d00502', 'a0000000-0000-4000-8000-000000000817', 'a0000000-0000-4000-8000-0000000008f2', 'a0000000-0000-4000-8000-000000009e05', 'Respond to classroom teachers "ask for help" request.', 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-0000001a0502/63b222f0-1142-8cd8-0979-aa8e4ba2bcc2.png', null),
  ('a0000000-0000-4000-8000-000000d00509', 'a0000000-0000-4000-8000-000000000817', 'a0000000-0000-4000-8000-0000000008f8', 'a0000000-0000-4000-8000-000000009e05', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000d00609', 'a0000000-0000-4000-8000-000000000817', 'a0000000-0000-4000-8000-0000000008f8', 'a0000000-0000-4000-8000-000000009e06', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000d00709', 'a0000000-0000-4000-8000-000000000817', 'a0000000-0000-4000-8000-0000000008f8', 'a0000000-0000-4000-8000-000000009e07', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000d00809', 'a0000000-0000-4000-8000-000000000817', 'a0000000-0000-4000-8000-0000000008f8', 'a0000000-0000-4000-8000-000000009e08', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000d00909', 'a0000000-0000-4000-8000-000000000817', 'a0000000-0000-4000-8000-0000000008f8', 'a0000000-0000-4000-8000-000000009e09', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000d01009', 'a0000000-0000-4000-8000-000000000817', 'a0000000-0000-4000-8000-0000000008f8', 'a0000000-0000-4000-8000-000000009e0a', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.'),
  ('a0000000-0000-4000-8000-000000d01209', 'a0000000-0000-4000-8000-000000000817', 'a0000000-0000-4000-8000-0000000008f8', 'a0000000-0000-4000-8000-000000009e0c', 'Dev Team
Design Team', null, 'Dev Team builds the app and the Design Team creates the screens and flows relevant to this step. Both implement the findings from the research team into the app in their respective role.')) as v(id, path_id, lane_id, step_id, content, frame, summary)
on conflict (id) do nothing;

-- Two of those cells carried more than text in the registry.

insert into public.resources (cell_id, kind, name, url, position, origin)
select
  'a0000000-0000-4000-8000-000000170303'::uuid,
  'link',
  v.name,
  v.url,
  v.position,
  'import'
from (values
  ('Onboarding Module 2', 'https://plus-tutors.notion.site/Module-2-Your-Role-at-PLUS-26fb7cca498280daac2fd7efc191708d', 0),
  ('Onboarding Module 8', 'https://plus-tutors.notion.site/Module-8-Day-to-Day-Protocols-26fb7cca49828064a32cdde194e36bbd', 1)
) as v(name, url, position)
where not exists (
  select 1
  from public.resources r
  where r.cell_id = 'a0000000-0000-4000-8000-000000170303'
    and r.url = v.url
);

-- The registry spelled the other one as a `tech_description` link, which is a
-- touchpoint placement rather than a resource. `Email` is already in the
-- catalog, so this cell needs the placement and the sentence, not a new tool.
insert into public.cell_touchpoints (cell_id, touchpoint_id, position, summary, origin)
select
  'a0000000-0000-4000-8000-000000170306'::uuid,
  '36c2abe1-b2a0-4807-836c-4b09dccff7cb'::uuid,
  0,
  'The tutor requests off via email when there is less than 12 hours before the session.',
  'import'
where not exists (
  select 1
  from public.cell_touchpoints ct
  where ct.cell_id = 'a0000000-0000-4000-8000-000000170306'
    and ct.touchpoint_id = '36c2abe1-b2a0-4807-836c-4b09dccff7cb'
);

-- What this migration makes true, asserted rather than counted: every cell it
-- names is a row, the step it attached reaches its path, and the two cells
-- that carried more than text carry it here too.
do $$
begin
  if exists (
    select 1
    from (values
      ('a0000000-0000-4000-8000-000000040202'),
      ('a0000000-0000-4000-8000-000000040302'),
      ('a0000000-0000-4000-8000-000000040401'),
      ('a0000000-0000-4000-8000-000000040402'),
      ('a0000000-0000-4000-8000-000000040501'),
      ('a0000000-0000-4000-8000-000000040502'),
      ('a0000000-0000-4000-8000-000000040601'),
      ('a0000000-0000-4000-8000-000000040609'),
      ('a0000000-0000-4000-8000-000000040701'),
      ('a0000000-0000-4000-8000-000000040709'),
      ('a0000000-0000-4000-8000-000000040909'),
      ('a0000000-0000-4000-8000-000000060202'),
      ('a0000000-0000-4000-8000-000000060302'),
      ('a0000000-0000-4000-8000-000000060401'),
      ('a0000000-0000-4000-8000-000000060402'),
      ('a0000000-0000-4000-8000-000000060501'),
      ('a0000000-0000-4000-8000-000000060502'),
      ('a0000000-0000-4000-8000-000000060509'),
      ('a0000000-0000-4000-8000-000000060601'),
      ('a0000000-0000-4000-8000-000000060609'),
      ('a0000000-0000-4000-8000-000000060701'),
      ('a0000000-0000-4000-8000-000000060709'),
      ('a0000000-0000-4000-8000-000000060909'),
      ('a0000000-0000-4000-8000-000000170303'),
      ('a0000000-0000-4000-8000-000000170304'),
      ('a0000000-0000-4000-8000-000000170306'),
      ('a0000000-0000-4000-8000-000000170310'),
      ('a0000000-0000-4000-8000-000000180209'),
      ('a0000000-0000-4000-8000-000000180509'),
      ('a0000000-0000-4000-8000-0000001a0309'),
      ('a0000000-0000-4000-8000-0000001a0409'),
      ('a0000000-0000-4000-8000-0000001a0509'),
      ('a0000000-0000-4000-8000-0000001a0709'),
      ('a0000000-0000-4000-8000-0000001f0209'),
      ('a0000000-0000-4000-8000-0000001f0309'),
      ('a0000000-0000-4000-8000-0000001f0402'),
      ('a0000000-0000-4000-8000-0000001f0501'),
      ('a0000000-0000-4000-8000-0000001f0502'),
      ('a0000000-0000-4000-8000-0000001f0509'),
      ('a0000000-0000-4000-8000-0000001f0609'),
      ('a0000000-0000-4000-8000-0000001f0709'),
      ('a0000000-0000-4000-8000-0000001f0809'),
      ('a0000000-0000-4000-8000-0000001f0909'),
      ('a0000000-0000-4000-8000-0000001f1109'),
      ('a0000000-0000-4000-8000-000000a00209'),
      ('a0000000-0000-4000-8000-000000a00309'),
      ('a0000000-0000-4000-8000-000000a00402'),
      ('a0000000-0000-4000-8000-000000a00501'),
      ('a0000000-0000-4000-8000-000000a00502'),
      ('a0000000-0000-4000-8000-000000a00509'),
      ('a0000000-0000-4000-8000-000000a00609'),
      ('a0000000-0000-4000-8000-000000a00809'),
      ('a0000000-0000-4000-8000-000000b00209'),
      ('a0000000-0000-4000-8000-000000b00309'),
      ('a0000000-0000-4000-8000-000000b00402'),
      ('a0000000-0000-4000-8000-000000b00501'),
      ('a0000000-0000-4000-8000-000000b00502'),
      ('a0000000-0000-4000-8000-000000b00509'),
      ('a0000000-0000-4000-8000-000000b00609'),
      ('a0000000-0000-4000-8000-000000b00709'),
      ('a0000000-0000-4000-8000-000000b00809'),
      ('a0000000-0000-4000-8000-000000b00909'),
      ('a0000000-0000-4000-8000-000000b01109'),
      ('a0000000-0000-4000-8000-000000c00209'),
      ('a0000000-0000-4000-8000-000000c00309'),
      ('a0000000-0000-4000-8000-000000c00402'),
      ('a0000000-0000-4000-8000-000000c00409'),
      ('a0000000-0000-4000-8000-000000c00501'),
      ('a0000000-0000-4000-8000-000000c00502'),
      ('a0000000-0000-4000-8000-000000c00609'),
      ('a0000000-0000-4000-8000-000000c00709'),
      ('a0000000-0000-4000-8000-000000c00809'),
      ('a0000000-0000-4000-8000-000000c00909'),
      ('a0000000-0000-4000-8000-000000c01009'),
      ('a0000000-0000-4000-8000-000000c01209'),
      ('a0000000-0000-4000-8000-000000d00209'),
      ('a0000000-0000-4000-8000-000000d00309'),
      ('a0000000-0000-4000-8000-000000d00402'),
      ('a0000000-0000-4000-8000-000000d00409'),
      ('a0000000-0000-4000-8000-000000d00501'),
      ('a0000000-0000-4000-8000-000000d00502'),
      ('a0000000-0000-4000-8000-000000d00509'),
      ('a0000000-0000-4000-8000-000000d00609'),
      ('a0000000-0000-4000-8000-000000d00709'),
      ('a0000000-0000-4000-8000-000000d00809'),
      ('a0000000-0000-4000-8000-000000d00909'),
      ('a0000000-0000-4000-8000-000000d01009'),
      ('a0000000-0000-4000-8000-000000d01209')    ) as v(id)
    where not exists (select 1 from public.cells c where c.id = v.id::uuid)
  ) then
    raise exception 'the board still has cells that live only in TypeScript';
  end if;

  if not exists (
    select 1 from public.path_steps
    where path_id = 'a0000000-0000-4000-8000-000000000808'
      and step_id = 'a0000000-0000-4000-8000-000000000942'
  ) then
    raise exception 'the step four of those cells sit on does not reach its path';
  end if;

  if (
    select count(*) from public.resources
    where cell_id = 'a0000000-0000-4000-8000-000000170303'
  ) < 2 then
    raise exception 'the onboarding-module links did not land';
  end if;

  if not exists (
    select 1 from public.cell_touchpoints
    where cell_id = 'a0000000-0000-4000-8000-000000170306'
  ) then
    raise exception 'the email placement did not land';
  end if;
end $$;

commit;
