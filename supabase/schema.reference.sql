-- Reference snapshot: Service Blueprint schema
--
-- REGENERATED FROM THE LIVE SCHEMA on 2026-08-20. The previous version claimed
-- to be "verified against migrations through 20260716120000_layer_role.sql
-- (2026-07-16)" and had drifted for five weeks and eleven migrations: it was
-- missing the entire derived layer (evidence, findings, slices, slice_items,
-- propositions) which shipped 2026-07-29, and every name in the vocabulary
-- refactor.
--
-- To refresh, re-run docs/reference/schema-snapshot-queries.sql and rewrite this
-- file plus docs/reference/erd.mmd from its output.
--
-- READ THIS AS A SNAPSHOT, NOT AS DDL TO RUN. supabase/migrations/ is the source
-- of truth; column ORDER here follows the live table (which reflects the order
-- columns were added, not any design), and defaults are shown where they exist.
--
-- Naming note: `service_lifecycles` is the real root. It has NO foreign key to
-- or from `services`, which holds a single unused placeholder row
-- ("Example API", slug "example-api", "Placeholder service entry for local
-- development"). Plan 002 Phase 6 renames the former to `services` and drops
-- the latter; that phase is PINNED with the rest of the service tier, so both
-- tables still exist and both appear below.

-- ── Hierarchy ────────────────────────────────────────────────────────────────
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
  summary text,   -- the stage in one line
  position integer not null default 0,
  loops_to_phase_id uuid references public.phases (id) on delete set null,
  business_impact text,
  operational_requirements text,
  origin text not null default 'import' check (origin in ('import','app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases (id) on delete cascade,
  name text not null,
  summary text,   -- the situation this blueprint covers
  position integer not null default 0,
  -- `merged` is a per-session display chosen in the compare control, never
  -- stored. create_scenario refuses it by name.
  view_type text not null default 'single' check (view_type in ('single','stacked')),
  origin text not null default 'import' check (origin in ('import','app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.paths (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  name text not null,
  path_type text not null,
  summary text,   -- when this route applies
  note text,      -- the author's aside: open questions, provenance, working state
  origin text not null default 'import' check (origin in ('import','app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Blueprint grid ───────────────────────────────────────────────────────────
create table public.lanes (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.paths (id) on delete cascade,
  name text not null,
  -- Semantic key, deliberately separate from the display name: inferring one
  -- from the other broke every non-English blueprint.
  lane_role text,
  position integer not null default 0,
  owner_team text,
  kpis jsonb not null default '[]'::jsonb,
  tools jsonb not null default '[]'::jsonb,
  origin text not null default 'import' check (origin in ('import','app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.steps (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  name text not null,
  summary text,   -- what this moment is, across every lane (storyboard caption)
  origin text not null default 'import' check (origin in ('import','app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.path_steps (
  path_id uuid not null references public.paths (id) on delete cascade,
  step_id uuid not null references public.steps (id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (path_id, step_id)
);

create table public.cells (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.paths (id) on delete cascade,
  lane_id uuid not null references public.lanes (id) on delete cascade,
  step_id uuid not null references public.steps (id) on delete cascade,
  content text not null default '',      -- what happens in this moment
  summary text,                          -- the tl;dr the detail fields add up to
  function text,                         -- why this moment exists
  form text,                             -- tone and manner; frontstage only
  value_props jsonb not null default '[]'::jsonb,
  owner text,            -- OVERRIDE of the lane's owner_team; empty = same as the lane
  perceived_owner text,  -- who the customer believes owns it; frontstage only
  picture text,
  links jsonb not null default '[]'::jsonb,  -- authored URLs (resources), NOT dependencies
  position integer not null default 0,       -- order within one (lane, step) slot
  cell_key text,
  origin text not null default 'import' check (origin in ('import','app')),
  search_tsv tsvector generated always as (/* content + summary + function + form
                                             + owner + perceived_owner + value_props */) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lane_id, step_id, position)
);

create table public.cell_dependencies (
  id uuid primary key default gen_random_uuid(),
  source_cell_id uuid not null references public.cells (id) on delete cascade,
  target_cell_id uuid not null references public.cells (id) on delete cascade,
  -- sets_off = the source makes the target happen (drawn as an arrow)
  -- enables   = the source makes the target possible without causing it (never drawn)
  -- Both read SOURCE-FIRST, which is why neither is `depends_on`.
  kind text not null default 'sets_off' check (kind in ('sets_off','enables')),
  label text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_cell_id <> target_cell_id),
  unique (source_cell_id, target_cell_id, kind)
);

-- ── Derived layer (shipped 2026-07-29 in f65efcf) ────────────────────────────
-- Absent from every previous version of this file, which is the drift that made
-- regenerating it worth doing rather than patching.

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  service_lifecycle_id uuid not null references public.service_lifecycles (id) on delete cascade,
  cell_id uuid,
  cell_key text,
  -- A row attaches to a CELL or to one of the three validation questions,
  -- never both: check (num_nonnulls(cell_id, proposition_question_key) = 1).
  proposition_question_key text check (proposition_question_key in ('understand','value','usability')),
  kind text not null,
  title text not null,
  ref text,
  excerpt text,
  note text,
  observed_at date,
  added_by text,   -- agent name or participant code. Never the interviewee.
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  service_lifecycle_id uuid not null references public.service_lifecycles (id) on delete cascade,
  run_id uuid not null,
  source text not null,
  check_name text not null,
  severity text not null,
  cell_ids uuid[] not null default '{}',
  cell_keys text[] not null default '{}',
  note text,
  fingerprint text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.slices (
  id uuid primary key default gen_random_uuid(),
  service_lifecycle_id uuid not null references public.service_lifecycles (id) on delete cascade,
  slice_type text not null,
  title text not null,
  description text,
  actor text,
  locale text not null default 'en',
  position integer not null default 0,
  origin text not null default 'import' check (origin in ('import','app')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.slice_items (
  id uuid primary key default gen_random_uuid(),
  slice_id uuid not null references public.slices (id) on delete cascade,
  position integer not null,
  cell_ids uuid[] not null default '{}',
  cell_keys text[] not null default '{}',
  caption text,
  narrative text,
  illustration jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One business-model record per lifecycle. The three validation questions live
-- as `evidence` rows keyed understand | value | usability, not as columns here.
create table public.propositions (
  service_lifecycle_id uuid primary key references public.service_lifecycles (id) on delete cascade,
  pricing text,
  revenue_model text,
  funding text,
  delivery_cost text,
  partners text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Agent session ledger (unrelated to the blueprint tree) ───────────────────
create table public.agent_sessions (
  id uuid primary key,
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.agent_sessions (id) on delete cascade,
  seq bigint not null,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- ── Deletion ledger ──────────────────────────────────────────────────────────
create table public.deleted_structure (
  id uuid primary key default gen_random_uuid(),
  deleted_at timestamptz not null default now(),
  deleted_by uuid,
  kind text not null,
  label text not null,
  payload jsonb not null,
  affected_slices jsonb not null default '[]'::jsonb
);

-- ── Legacy, pending plan 002 Phase 6 ─────────────────────────────────────────
-- One placeholder row, no foreign key in either direction, no reader anywhere
-- in the app. Kept in this snapshot because it is still in the database.
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
