-- Warm-Up Sad Path: first four steps match Happy Path; diverges at step 5 and ends at step 6.
-- Reuses scenario steps from warm_up_happy_path.sql via path_steps.

insert into public.paths (id, service_scenario_id, name, path_type)
values (
  'a0000000-0000-4000-8000-000000000360',
  'a0000000-0000-4000-8000-000000000203',
  'Sad Path',
  'unhappy'
)
on conflict (id) do update set
  name = excluded.name,
  path_type = excluded.path_type;

insert into public.path_steps (path_id, step_id, column_position)
values
  (
    'a0000000-0000-4000-8000-000000000360',
    'a0000000-0000-4000-8000-000000000311',
    1
  ),
  (
    'a0000000-0000-4000-8000-000000000360',
    'a0000000-0000-4000-8000-000000000312',
    2
  ),
  (
    'a0000000-0000-4000-8000-000000000360',
    'a0000000-0000-4000-8000-000000000313',
    3
  ),
  (
    'a0000000-0000-4000-8000-000000000360',
    'a0000000-0000-4000-8000-000000000314',
    4
  ),
  (
    'a0000000-0000-4000-8000-000000000360',
    'a0000000-0000-4000-8000-000000000315',
    5
  ),
  (
    'a0000000-0000-4000-8000-000000000360',
    'a0000000-0000-4000-8000-000000000316',
    6
  ),
  (
    'a0000000-0000-4000-8000-000000000360',
    'a0000000-0000-4000-8000-000000000317',
    7
  ),
  (
    'a0000000-0000-4000-8000-000000000360',
    'a0000000-0000-4000-8000-000000000318',
    8
  )
on conflict (path_id, step_id) do update set
  column_position = excluded.column_position;

-- Clone layers (…301–309 → …501–509)
insert into public.layers (id, path_id, name, row_position)
select
  replace(l.id::text, '00000003', '00000005')::uuid,
  'a0000000-0000-4000-8000-000000000360',
  l.name,
  l.row_position
from public.layers l
where l.path_id = 'a0000000-0000-4000-8000-000000000300'
on conflict (id) do update set
  name = excluded.name,
  row_position = excluded.row_position;

-- Clone all cells (…04xxxx → …08xxxx)
insert into public.cells (id, path_id, layer_id, step_id, content)
select
  replace(c.id::text, '00000004', '00000008')::uuid,
  'a0000000-0000-4000-8000-000000000360',
  replace(c.layer_id::text, '00000003', '00000005')::uuid,
  c.step_id,
  c.content
from public.cells c
where c.path_id = 'a0000000-0000-4000-8000-000000000300'
on conflict (id) do update set
  content = excluded.content,
  layer_id = excluded.layer_id,
  step_id = excluded.step_id;

-- Clone triggers (…05xxxx → …09xxxx)
insert into public.cell_triggers (id, source_cell_id, target_cell_id)
select
  replace(t.id::text, '00000005', '00000009')::uuid,
  replace(t.source_cell_id::text, '00000004', '00000008')::uuid,
  replace(t.target_cell_id::text, '00000004', '00000008')::uuid
from public.cell_triggers t
where exists (
    select 1
    from public.cells sc
    where sc.id = t.source_cell_id
      and sc.path_id = 'a0000000-0000-4000-8000-000000000300'
  )
on conflict (id) do update set
  source_cell_id = excluded.source_cell_id,
  target_cell_id = excluded.target_cell_id;

-- Sad-path step 5: PLUS app failure (shared steps 1–4 unchanged)
insert into public.steps (id, service_scenario_id, name)
values (
  'a0000000-0000-4000-8000-000000000319',
  'a0000000-0000-4000-8000-000000000203',
  'PLUS App Not Working'
)
on conflict (id) do update set
  name = excluded.name,
  service_scenario_id = excluded.service_scenario_id;

insert into public.steps (id, service_scenario_id, name)
values (
  'a0000000-0000-4000-8000-000000000320',
  'a0000000-0000-4000-8000-000000000203',
  'Unable to Complete Warm-Up'
)
on conflict (id) do update set
  name = excluded.name,
  service_scenario_id = excluded.service_scenario_id;

delete from public.path_steps
where path_id = 'a0000000-0000-4000-8000-000000000360';

insert into public.path_steps (path_id, step_id, column_position)
values
  ('a0000000-0000-4000-8000-000000000360', 'a0000000-0000-4000-8000-000000000311', 1),
  ('a0000000-0000-4000-8000-000000000360', 'a0000000-0000-4000-8000-000000000312', 2),
  ('a0000000-0000-4000-8000-000000000360', 'a0000000-0000-4000-8000-000000000313', 3),
  ('a0000000-0000-4000-8000-000000000360', 'a0000000-0000-4000-8000-000000000314', 4),
  ('a0000000-0000-4000-8000-000000000360', 'a0000000-0000-4000-8000-000000000319', 5),
  ('a0000000-0000-4000-8000-000000000360', 'a0000000-0000-4000-8000-000000000320', 6)
on conflict (path_id, step_id) do update set
  column_position = excluded.column_position;

-- Step 5 — PLUS app failure
update public.cells
set
  step_id = 'a0000000-0000-4000-8000-000000000319',
  content = 'PLUS app is not working properly and tutor is unable to update student data.'
where id = 'a0000000-0000-4000-8000-000000080503';

update public.cells
set
  step_id = 'a0000000-0000-4000-8000-000000000319',
  content = 'Onboarding & Lessons Modules'
where id = 'a0000000-0000-4000-8000-000000080505';

update public.cells
set
  step_id = 'a0000000-0000-4000-8000-000000000319',
  content = E'Zoom/Pencil\nPLUS App'
where id = 'a0000000-0000-4000-8000-000000080506';

update public.cells
set
  step_id = 'a0000000-0000-4000-8000-000000000319',
  content = E'Dev Team\nDesign team'
where id = 'a0000000-0000-4000-8000-000000080509';

-- Step 6 — unable to complete warm-up
update public.cells
set
  step_id = 'a0000000-0000-4000-8000-000000000320',
  content = 'Unable to complete warm up phase.'
where id = 'a0000000-0000-4000-8000-000000080603';

update public.cells
set
  step_id = 'a0000000-0000-4000-8000-000000000320',
  content = 'Onboarding & Lessons Modules'
where id = 'a0000000-0000-4000-8000-000000080605';

update public.cells
set
  step_id = 'a0000000-0000-4000-8000-000000000320',
  content = E'Zoom/Pencil\nPLUS App'
where id = 'a0000000-0000-4000-8000-000000080606';

update public.cells
set
  step_id = 'a0000000-0000-4000-8000-000000000320',
  content = E'Dev Team\nDesign team'
where id = 'a0000000-0000-4000-8000-000000080609';

-- Sad path ends at step 6: remove tail cells and downstream triggers.
delete from public.cell_triggers
where id in (
  'a0000000-0000-4000-8000-000000090106',
  'a0000000-0000-4000-8000-000000090107',
  'a0000000-0000-4000-8000-000000090112',
  'a0000000-0000-4000-8000-000000090118',
  'a0000000-0000-4000-8000-000000090119'
);

delete from public.cells
where path_id = 'a0000000-0000-4000-8000-000000000360'
  and (
    id::text like '%0000000807%'
    or id::text like '%0000000808%'
    or id::text like '%0000000809%'
    or id::text like '%0000000810%'
  );
