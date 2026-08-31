-- Reference snapshot: Service Blueprint schema
--
-- REGENERATED FROM THE LIVE SCHEMA on 2026-08-26. The previous version was
-- generated on 2026-08-20 and was wrong the next morning: the vocabulary
-- refactor's last three migrations landed on 2026-08-21, so this file spent six
-- days describing `service_lifecycles` and `propositions` at a database that
-- had neither. It also never gained `cells.status` or `paths.status` from the
-- `maturity` rename, and still carried the `services` placeholder table that
-- 20260821340000 dropped.
--
-- A snapshot regenerated one day before a rename is a snapshot that lies with a
-- generation stamp on it, which is worse than one that admits it is old.
--
-- To refresh, re-run docs/reference/schema-snapshot-queries.sql and rewrite this
-- file plus docs/reference/erd.mmd from its output. That file's fourth query —
-- the SECURITY DEFINER grant invariant — is now asserted by migration
-- 20260826130000 instead of being trusted to whoever remembers to run it.
--
-- READ THIS AS A SNAPSHOT, NOT AS DDL TO RUN. supabase/migrations/ is the source
-- of truth; column ORDER here follows the live table (which reflects the order
-- columns were added, not any design), and defaults are shown where they exist.
--
-- `entity_status` is a DOMAIN over text, not a per-table CHECK:
--   proposed | planned | built | live | at_risk | deprecated
-- One list, so `cells.status` and `paths.status` cannot drift apart.

-- ── Hierarchy ────────────────────────────────────────────────────────────────
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.phases (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
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
  path_type text not null check (path_type in ('happy','variant','exception')),
  summary text,   -- when this route applies
  note text,      -- the author's aside: open questions, provenance, working state
  origin text not null default 'import' check (origin in ('import','app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status entity_status not null default 'live'
);

-- ── Blueprint grid ───────────────────────────────────────────────────────────
create table public.lanes (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.paths (id) on delete cascade,
  name text not null,
  -- Semantic key, deliberately separate from the display name: inferring one
  -- from the other broke every non-English blueprint.
  lane_role text,
  -- Null on the 224 structural rows (tech, support, storyboard, the action
  -- rows). A null stakeholder is what tells a check "this is scaffolding".
  stakeholder_id uuid references public.stakeholders (id),
  position integer not null default 0,
  owner_team text,
  kpis jsonb not null default '[]'::jsonb,
  tools jsonb not null default '[]'::jsonb,
  origin text not null default 'import' check (origin in ('import','app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One lane per slot. Deferred because reorder_lanes renumbers one statement
  -- per lane and add_lane opens a slot with a single self-colliding UPDATE
  -- (20260828130000); path_steps_path_column_unique is deferred for the same
  -- reason.
  constraint lanes_path_position_unique
    unique (path_id, position) deferrable initially deferred
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
  position integer not null default 0,       -- order within one (lane, step) slot
  cell_key text,
  origin text not null default 'import' check (origin in ('import','app')),
  search_tsv tsvector generated always as (/* content + summary + function + form
                                             + owner + perceived_owner + value_props */) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status entity_status not null default 'live',
  unique (lane_id, step_id, position)
);

-- Added by hand on 2026-08-31 with 20260830280000, which dropped `cells.links`
-- above. `evidence.note` went with it in the same edit, though 20260830190000
-- is what dropped the column — this file had simply not caught up.
--
-- NOT a regeneration, and it is still behind in ways this edit does not fix:
-- `touchpoints`, `cell_touchpoints` and `unplaced_touchpoint_details` are
-- absent, and `cells.picture` is `cells.frame` since 20260830270000. The
-- header at the top of this file says to read it as a snapshot; these are
-- what that sentence is currently about.
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  -- Exactly one of these two: check (num_nonnulls(cell_id, cell_touchpoint_id) = 1)
  cell_id uuid references public.cells (id) on delete cascade,
  cell_touchpoint_id uuid references public.cell_touchpoints (id) on delete cascade,
  kind text not null default 'link' check (kind in ('link','other')),
  name text not null,     -- what the thing on the other end is called
  url text,               -- required when kind = 'link'
  position integer not null,
  origin text not null check (origin in ('import','app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Both deferrable: a reorder swaps two positions inside one transaction.
  unique (cell_id, position),
  unique (cell_touchpoint_id, position)
);

create table public.cell_dependencies (
  id uuid primary key default gen_random_uuid(),
  source_cell_id uuid not null references public.cells (id) on delete cascade,
  target_cell_id uuid not null references public.cells (id) on delete cascade,
  -- leads_to = the source makes the target happen (drawn as an arrow)
  -- enables   = the source makes the target possible without causing it (never drawn)
  -- Both read SOURCE-FIRST, which is why neither is `depends_on`.
  kind text not null default 'leads_to' check (kind in ('leads_to','enables')),
  label text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_cell_id <> target_cell_id),
  unique (source_cell_id, target_cell_id, kind)
);

-- ── About the board: evidence, findings, slices, slides (2026-07-29) ────────
-- Records ABOUT the board rather than squares of it. Called the "derived layer"
-- until 2026-08-26, and nothing since: four of these five tables are authored
-- by a person rather than derived from anything, `layer` was the swimlane word,
-- and a replacement ("analysis tier") was wrong of half the set the same way.
-- Each has an OWNER instead, named by whichever tools may write it — see the
-- table in CONTEXT.md, held against the write surface by
-- scripts/tests/who-writes-what.test.mjs.
-- The cell references here are SOFT — no foreign key — so the importer's
-- scenario-scoped delete-and-reinsert cannot cascade into authored rows.
-- Absent from every previous version of this file, which is the drift that made
-- regenerating it worth doing rather than patching.

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  cell_id uuid,
  cell_key text,
  -- A row attaches to a CELL or to one of the three validation questions,
  -- never both: check (num_nonnulls(cell_id, proposition_question_key) = 1).
  proposition_question_key text check (proposition_question_key in ('understand','value','usability')),
  kind text not null,
  title text not null,
  ref text,
  excerpt text,
  observed_at date,
  added_by text,   -- agent name or participant code. Never the interviewee.
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
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
  service_id uuid not null references public.services (id) on delete cascade,
  slice_type text not null,
  title text not null,
  description text,
  actor text,   -- display text; a trigger keeps it equal to the linked name
  stakeholder_id uuid references public.stakeholders (id),
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

-- The cast list. Four free-text fields named the same people and agreed with
-- none of them; `check-value-ledger` could not tell an actor lane from a
-- structural one and would have warned six times per scenario.
create table public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  parent_id uuid references public.stakeholders (id) on delete set null,
  name text not null,
  -- `team` is a container, not a person: a team holds its people via parent_id.
  kind text not null check (kind in ('recipient','staff','partner','provider','team')),
  note text,
  aliases text[] not null default '{}',   -- other spellings seen in THIS blueprint
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, name)
);

-- One business-model record per service. The three validation questions live as
-- `evidence` rows keyed understand | value | usability, not as columns here —
-- which is why `evidence.proposition_question_key` keeps the word `proposition`
-- after the table stopped being called that. The rename moved the container,
-- not the concept.
create table public.business_model (
  service_id uuid primary key references public.services (id) on delete cascade,
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
  updated_at timestamptz not null default now(),
  -- 20260828120000. NULL = written before ownership was recorded; service
  -- accounts only. New rows cannot be NULL — the insert policy is the strict
  -- `user_id = auth.uid()` and the default supplies it.
  user_id uuid references auth.users (id) on delete cascade default auth.uid()
);

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.agent_sessions (id) on delete cascade,
  seq bigint not null,
  kind text not null check (kind in ('user','assistant','tool','status')),
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

