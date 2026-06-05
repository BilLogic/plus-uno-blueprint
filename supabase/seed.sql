-- Development seed: service lifecycle with phases and in-session scenarios

insert into public.service_lifecycles (id, name, description)
values (
  'a0000000-0000-4000-8000-000000000001',
  'PLUS Application',
  'Application through onboarding and session lifecycle'
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description;

-- Replace any prior demo phases/scenarios for this lifecycle
delete from public.phases
where service_lifecycle_id = 'a0000000-0000-4000-8000-000000000001';

insert into public.phases (
  id,
  service_lifecycle_id,
  name,
  description,
  order_position,
  loops_to_phase_id
)
values
  (
    'a0000000-0000-4000-8000-000000000101',
    'a0000000-0000-4000-8000-000000000001',
    'Application',
    'Initial application and access',
    1,
    null
  ),
  (
    'a0000000-0000-4000-8000-000000000102',
    'a0000000-0000-4000-8000-000000000001',
    'Onboarding',
    'User onboarding before sessions',
    2,
    null
  ),
  (
    'a0000000-0000-4000-8000-000000000103',
    'a0000000-0000-4000-8000-000000000001',
    'Pre-session',
    'Preparation before an in-session experience',
    3,
    null
  ),
  (
    'a0000000-0000-4000-8000-000000000104',
    'a0000000-0000-4000-8000-000000000001',
    'in-session',
    'Active session',
    4,
    null
  ),
  (
    'a0000000-0000-4000-8000-000000000105',
    'a0000000-0000-4000-8000-000000000001',
    'post-session',
    'Wrap-up after session; may return to in-session',
    5,
    'a0000000-0000-4000-8000-000000000104'
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  order_position = excluded.order_position,
  loops_to_phase_id = excluded.loops_to_phase_id;

-- In-session scenarios
delete from public.service_scenarios
where phase_id in (
  'a0000000-0000-4000-8000-000000000103',
  'a0000000-0000-4000-8000-000000000104'
);

insert into public.service_scenarios (id, phase_id, name, description, order_position, view_type)
values
  (
    'a0000000-0000-4000-8000-000000000201',
    'a0000000-0000-4000-8000-000000000104',
    'Before Students Join',
    null,
    1,
    'single'
  ),
  (
    'a0000000-0000-4000-8000-000000000202',
    'a0000000-0000-4000-8000-000000000104',
    'Student Just Joined',
    null,
    2,
    'single'
  ),
  (
    'a0000000-0000-4000-8000-000000000203',
    'a0000000-0000-4000-8000-000000000104',
    'Warm-Up',
    'Compare service blueprint paths as tutors greet students and move through the warm-up flow in breakout rooms.',
    3,
    'side-by-side'
  ),
  (
    'a0000000-0000-4000-8000-000000000204',
    'a0000000-0000-4000-8000-000000000104',
    'Goal-Setting Phase',
    null,
    4,
    'single'
  ),
  (
    'a0000000-0000-4000-8000-000000000205',
    'a0000000-0000-4000-8000-000000000104',
    'Help Request',
    null,
    5,
    'single'
  ),
  (
    'a0000000-0000-4000-8000-000000000206',
    'a0000000-0000-4000-8000-000000000104',
    'Wrap-Up',
    null,
    6,
    'single'
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  order_position = excluded.order_position,
  view_type = excluded.view_type;

-- Warm-Up Happy Path blueprint (see supabase/seeds/warm_up_happy_path.sql)

-- Legacy catalog row
insert into public.services (name, description, slug)
values
  ('Example API', 'Placeholder service entry for local development', 'example-api')
on conflict (slug) do nothing;
