-- Reference snapshot: Service Blueprint schema + legacy services catalog
-- Source of truth: supabase/migrations/

-- Hierarchy
create table public.service_lifecycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.phases (
  id uuid primary key default gen_random_uuid(),
  service_lifecycle_id uuid not null references public.service_lifecycles (id) on delete cascade,
  name text not null,
  description text,
  order_position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_scenarios (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases (id) on delete cascade,
  name text not null,
  description text,
  order_position integer not null default 0,
  view_type text not null default 'single' check (view_type in ('single', 'side-by-side', 'integrated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.paths (
  id uuid primary key default gen_random_uuid(),
  service_scenario_id uuid not null references public.service_scenarios (id) on delete cascade,
  name text not null,
  path_type text not null check (path_type in ('happy', 'unhappy', 'exception', 'alternative')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Blueprint grid
create table public.layers (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.paths (id) on delete cascade,
  name text not null,
  row_position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.steps (
  id uuid primary key default gen_random_uuid(),
  service_scenario_id uuid not null references public.service_scenarios (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.path_steps (
  path_id uuid not null references public.paths (id) on delete cascade,
  step_id uuid not null references public.steps (id) on delete cascade,
  column_position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (path_id, step_id),
  unique (path_id, column_position)
);

create table public.cells (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.paths (id) on delete cascade,
  layer_id uuid not null references public.layers (id) on delete cascade,
  step_id uuid not null references public.steps (id) on delete cascade,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (layer_id, step_id)
);

create table public.cell_triggers (
  id uuid primary key default gen_random_uuid(),
  source_cell_id uuid not null references public.cells (id) on delete cascade,
  target_cell_id uuid not null references public.cells (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_cell_id, target_cell_id),
  check (source_cell_id <> target_cell_id)
);
