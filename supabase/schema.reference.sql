-- Prepared v2.8.11 receipt tables and path-step FK added from the owned local catalog on 2026-10-31.
-- These additions have not been applied to the hosted deployment.
-- Reference snapshot: Service Blueprint schema
--
-- REGENERATED FROM THE LIVE SCHEMA on 2026-10-11, through 20261011120000.
-- The previous regeneration was 2026-08-26, and six weeks of hand patches
-- after it had not kept up: `audit_findings` still showed `note` where the
-- database has `summary`, and neither `impact` nor `effort`; `touchpoints`,
-- `cell_touchpoints` and `authoring_changes` were absent; `deleted_structure`
-- and `business_model` named tables the database no longer has (the ledger is
-- `authoring_changes`, the record is `business_models`);
-- `cell_dependencies.label` is `name`, `stakeholders.note` is `summary`,
-- `resources.kind` is `link | attachment` with every row owned by a cell, and
-- `scenarios.layout` is `stacked | merged`.
--
-- A snapshot regenerated one day before a rename is a snapshot that lies with a
-- generation stamp on it, which is worse than one that admits it is old.
--
-- To refresh, re-run docs/reference/schema-snapshot-queries.sql and rewrite this
-- file plus docs/reference/erd.mmd from its output. Columns and nullability
-- (query 1), foreign keys (2), CHECK constraints (3), defaults and generated
-- columns (5), PRIMARY KEY / UNIQUE / EXCLUDE constraints (6), partial unique
-- indexes (7), and the domain and views (8) are each read from pg_catalog by
-- the query named; the comments are the explanation the catalog cannot give. That file's fourth query — the SECURITY DEFINER grant
-- invariant — is asserted by `npm run check:identifiers` on every pull request.
--
-- READ THIS AS A SNAPSHOT, NOT AS DDL TO RUN. supabase/migrations/ is the source
-- of truth; column ORDER here follows the live table (which reflects the order
-- columns were added, not any design), and defaults are shown where they exist.
-- Triggers, functions, policies and grants are not reproduced: the migrations
-- say them, and `check:rls-posture:live` asks the database about the last two.
-- Prepared capability 20261031120000 adds rename_step only (not deployed).
-- It changes no table/domain/view shape in this snapshot; its function body
-- and execution grants remain declared solely by the migration.
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
  updated_at timestamptz not null default now(),
  origin text not null default 'import' check (origin in ('import','app')),
  entity_examples jsonb not null default '{}'::jsonb,   -- 20260902210000
  slug text unique                                       -- 20260902240000
);

create table public.phases (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  name text not null,
  summary text,   -- the stage in one line
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  loops_to_phase_id uuid references public.phases (id) on delete set null,
  business_impact text,
  operational_requirements text,
  origin text not null default 'import' check (origin in ('import','app'))
);

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases (id) on delete cascade,
  name text not null,
  summary text,   -- the situation this blueprint covers
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- What the board opens as, written by the header toggle.
  layout text not null default 'stacked' check (layout in ('stacked','merged')),
  origin text not null default 'import' check (origin in ('import','app')),
  note text
);

create table public.paths (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('happy','variant','exception')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  summary text,   -- when this route applies
  note text,      -- the author's aside: open questions, provenance, working state
  origin text not null default 'import' check (origin in ('import','app')),
  status entity_status not null default 'live'
);

-- ── Blueprint grid ───────────────────────────────────────────────────────────
create table public.lanes (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.paths (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Semantic key, deliberately separate from the display name: inferring one
  -- from the other broke every non-English blueprint. Null = generic swimlane.
  lane_role text check (lane_role is null or lane_role in (
    'customer_actions','frontstage_actions','backstage_actions','partner_actions',
    'frontstage_touchpoints','backstage_touchpoints','support_actions','storyboard')),
  owner_team text,
  kpis jsonb not null default '[]'::jsonb check (jsonb_typeof(kpis) = 'array'),
  tools jsonb not null default '[]'::jsonb check (jsonb_typeof(tools) = 'array'),
  origin text not null default 'import' check (origin in ('import','app')),
  -- Null on the structural rows (tech, support, storyboard, the action rows).
  -- A null stakeholder is what tells a check "this is scaffolding".
  stakeholder_id uuid references public.stakeholders (id),
  -- The target of cells_path_matches_lane_fkey below.
  constraint lanes_id_path_unique unique (id, path_id),
  -- One lane per slot. Deferred because reorder_lanes renumbers one statement
  -- per lane and add_lane opens a slot with a single self-colliding UPDATE
  -- (20260828130000); path_steps_path_column_unique is deferred for the same
  -- reason.
  constraint lanes_path_position_unique
    unique (path_id, position) deferrable initially deferred
);

create table public.steps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  origin text not null default 'import' check (origin in ('import','app')),
  summary text   -- what this moment is, across every lane (storyboard caption)
);

create table public.path_steps (
  path_id uuid not null references public.paths (id) on delete cascade,
  step_id uuid not null references public.steps (id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (path_id, step_id),
  constraint path_steps_path_column_unique
    unique (path_id, position) deferrable initially deferred
);

create table public.cells (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.paths (id) on delete cascade,
  lane_id uuid not null references public.lanes (id) on delete cascade,
  step_id uuid not null references public.steps (id) on delete cascade,
  content text not null default '',      -- what happens in this moment
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  frame text check (frame is null or frame !~ '^/'),   -- an absolute URL, never a site path
  summary text,                          -- the tl;dr the detail fields add up to
  function text,                         -- why this moment exists
  form text,                             -- tone and manner; frontstage only
  value_props jsonb not null default '[]'::jsonb check (jsonb_typeof(value_props) = 'array'),
  owner text,            -- OVERRIDE of the lane's owner_team; empty = same as the lane
  perceived_owner text,  -- who the customer believes owns it; frontstage only
  origin text not null default 'import' check (origin in ('import','app')),
  cell_key text,         -- unique where not null (cells_cell_key_unique)
  position integer not null default 0,       -- order within one (lane, step) slot
  search_tsv tsvector generated always as (/* content + summary + function + form
                                             + owner + perceived_owner + value_props,
                                             plus content + summary with `/` split
                                             into words */) stored,
  status entity_status not null default 'live',
  constraint cells_lane_step_slot_unique unique (lane_id, step_id, position),
  -- A cell sits on its lane's path. The trigger cells_validate_path_match only
  -- sees writes to cells; this key also refuses moving the LANE (20260830180000).
  constraint cells_path_matches_lane_fkey foreign key (lane_id, path_id)
    references public.lanes (id, path_id) on delete cascade
);
create unique index cells_cell_key_unique on public.cells (cell_key) where cell_key is not null;

create table public.cell_dependencies (
  id uuid primary key default gen_random_uuid(),
  source_cell_id uuid not null references public.cells (id) on delete cascade,
  target_cell_id uuid not null references public.cells (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- leads_to = the source makes the target happen (drawn as an arrow)
  -- enables   = the source makes the target possible without causing it (never drawn)
  -- Both read SOURCE-FIRST, which is why neither is `depends_on`.
  kind text not null default 'leads_to' check (kind in ('leads_to','enables')),
  name text,   -- the word on the arrow; `label` until 20260830190000
  note text,   -- why the edge exists, in the author's own words
  constraint cell_dependencies_no_self_reference check (source_cell_id <> target_cell_id),
  constraint cell_dependencies_source_target_kind_unique
    unique (source_cell_id, target_cell_id, kind)
);

-- ── Touchpoints and resources ────────────────────────────────────────────────
-- A touchpoint is a thing the service owns (20260830140000): a deployment-level
-- catalog, unique by name, owned by no one service (ADR 0014). A cell places it
-- through cell_touchpoints, or names something that is not in the catalog.
create table public.touchpoints (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null default 'other'
    check (kind in ('app','document','physical','channel','service','other')),
  summary text,
  url text,
  stakeholder_id uuid references public.stakeholders (id),
  origin text not null check (origin in ('import','app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  icon_url text,
  -- Deliberately unconstrained: the tone vocabulary belongs to the token model
  -- (ADR 0001), and a CHECK here would be a second copy of it (20260905110000).
  tone text,
  aliases text[]   -- other names it answers to (20260905120000)
);

create table public.cell_touchpoints (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.cells (id) on delete cascade,
  touchpoint_id uuid references public.touchpoints (id) on delete restrict,
  position integer not null,
  summary text,
  role text check (role in ('core','peripheral')),
  origin text not null check (origin in ('import','app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A placement either points at the catalog or names a thing that is not in
  -- it, never both and never neither.
  name text,
  constraint cell_touchpoints_one_identity check ((touchpoint_id is null) <> (name is null)),
  constraint cell_touchpoints_name_not_blank check (name is null or btrim(name) <> ''),
  unique (cell_id, touchpoint_id),
  unique (id, cell_id),   -- the target of resources_placement_in_cell_fkey
  constraint cell_touchpoints_cell_position_unique
    unique (cell_id, position) deferrable initially deferred
);
create unique index cell_touchpoints_cell_name_key
  on public.cell_touchpoints (cell_id, lower(name)) where name is not null;

-- Every resource knows its cell (20260902130000); one that belongs to a
-- placement names that placement too, and the composite key below keeps the
-- two on the same cell.
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.cells (id) on delete cascade,
  cell_touchpoint_id uuid,
  kind text not null default 'link' check (kind in ('link','attachment')),
  name text not null,     -- what the thing on the other end is called
  -- Nullable in the catalog, required by a CHECK: resources_has_url is
  -- (nullif(btrim(url), '') is not null), which a blank string fails too.
  url text,
  position integer not null,
  origin text not null check (origin in ('import','app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  featured boolean not null default false,
  constraint resources_url_absolute check (url is null or url !~ '^/'),
  constraint resources_placement_in_cell_fkey foreign key (cell_touchpoint_id, cell_id)
    references public.cell_touchpoints (id, cell_id) on delete cascade,
  -- Both deferrable: a reorder swaps two positions inside one transaction.
  -- The cell's rule is an EXCLUDE, not a UNIQUE, since 20260902130000: once a
  -- placement's rows carried `cell_id` too, a plain unique (cell_id, position)
  -- collided with them, so it is restricted to the cell's own rows — and a
  -- unique index could carry that predicate but not the deferral that lets
  -- `sync_cell_resources` reorder in one statement.
  constraint resources_cell_position_unique exclude using btree
    (cell_id with =, position with =) where (cell_touchpoint_id is null)
    deferrable initially deferred,
  constraint resources_touchpoint_position_unique
    unique (cell_touchpoint_id, position) deferrable initially deferred
);
-- One featured attachment per cell, and one per placement.
create unique index resources_one_featured_attachment_per_cell on public.resources (cell_id)
  where featured and kind = 'attachment' and cell_touchpoint_id is null;
create unique index resources_one_featured_attachment_per_placement on public.resources (cell_touchpoint_id)
  where featured and kind = 'attachment' and cell_touchpoint_id is not null;

-- ── About the board: evidence, findings, slices, slides (2026-07-29) ────────
-- Records ABOUT the board rather than squares of it. Called the "derived layer"
-- until 2026-08-26, and nothing since: four of these five tables are authored
-- by a person rather than derived from anything, `layer` was the swimlane word,
-- and a replacement ("analysis tier") was wrong of half the set the same way.
-- Each has an OWNER instead, named by whichever tools may write it — see the
-- table in CONTEXT.md, held against the write surface by
-- scripts/tests/who-writes-what.test.mjs.
-- The cell references here are SOFT — no foreign key — so the importer's
-- scenario-scoped delete-and-reinsert cannot cascade into authored rows. The
-- paired *_cell_keys columns are how those rows find their cells again.

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  cell_id uuid,
  cell_key text,   -- check ((cell_id is null) = (cell_key is null))
  -- A row attaches to a CELL or to one of the three validation questions,
  -- never both: check (num_nonnulls(cell_id, proposition_question_key) = 1).
  proposition_question_key text check (proposition_question_key is null or proposition_question_key in ('understand','value','usability')),
  kind text not null check (kind in ('interview','survey','analytics','doc','meeting','decision','observation','other')),
  title text not null,
  -- The one prose column. `ref` was dropped and `excerpt` renamed to this by
  -- 20260909060000, which is why the word is back after 20260830190000 took it.
  note text,
  observed_at date,
  added_by text,   -- agent name or participant code. Never the interviewee.
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  run_id uuid not null,
  source text not null check (source in ('audit','whatif','import-sweep')),
  check_key text not null,
  severity text not null check (severity in ('info','warn','critical')),
  cell_ids uuid[] not null default '{}',
  cell_keys text[] not null default '{}',   -- check (cardinality(cell_ids) = cardinality(cell_keys))
  summary text,   -- the finding itself, in one line
  fingerprint text not null,   -- dedupe across runs
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 20261011120000. What fixing it is worth, and what it costs; null = unrated.
  impact text check (impact in ('low','medium','high')),
  effort text check (effort in ('low','medium','high'))
);
create unique index audit_findings_open_fingerprint_idx
  on public.audit_findings (service_id, fingerprint) where status = 'open';

create table public.slices (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  kind text not null check (kind in ('journey','step','lane','cell','custom')),
  title text not null,
  summary text,
  actor text,   -- display text; a trigger keeps it equal to the linked name
  locale text not null default 'en',
  authorship text not null default 'generated' check (authorship in ('generated','customized','human')),
  position integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  stakeholder_id uuid references public.stakeholders (id)
);

create table public.slides (
  id uuid primary key default gen_random_uuid(),
  slice_id uuid not null references public.slices (id) on delete cascade,
  position integer not null,
  cell_ids uuid[] not null default '{}',
  cell_keys text[] not null default '{}',   -- check (cardinality(cell_ids) = cardinality(cell_keys))
  title text,
  caption text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  -- `illustration jsonb` was dropped by 20260830270000. A slide has one image
  -- source: the set, which is every cited cell's frame while this is true.
  shows_all_images boolean not null default true,
  constraint slides_position_unique unique (slice_id, position) deferrable initially deferred
);

-- 20260910030000. The ordered set a slide shows once an author has picked;
-- until then `shows_all_images` is true and this table holds nothing for it.
create table public.slide_images (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references public.slides (id) on delete cascade,
  position integer not null,
  cell_id uuid references public.cells (id) on delete cascade,
  image_url text,
  constraint slide_images_one_source check (num_nonnulls(cell_id, image_url) = 1),
  constraint slide_images_position_unique unique (slide_id, position)
);

-- The cast list. Four free-text fields named the same people and agreed with
-- none of them; `check-value-ledger` could not tell an actor lane from a
-- structural one and would have warned six times per scenario.
create table public.stakeholders (
  id uuid primary key default gen_random_uuid(),
  -- Deployment-level catalog: the name is the identity, unique across the whole
  -- deployment and owned by no one service (ADR 0014).
  name text not null unique,
  -- `team` is a container, not a person: a team holds its people via part_of_id.
  kind text not null check (kind in ('recipient','staff','partner','provider','team')),
  summary text,   -- the definition; `note` until 20260830170000
  aliases text[] not null default '{}',   -- other spellings this deployment has seen
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  part_of_id uuid references public.stakeholders (id)
);

-- One business-model record per service. The three validation questions live as
-- `evidence` rows keyed understand | value | usability, not as columns here —
-- which is why `evidence.proposition_question_key` keeps the word `proposition`
-- after the table stopped being called that. The rename moved the container,
-- not the concept.
create table public.business_models (
  service_id uuid primary key references public.services (id) on delete cascade,
  funding text,
  pricing text,
  delivery_cost text,
  revenue_model text,
  partners text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- ── Authoring ledger ─────────────────────────────────────────────────────────
-- 20260830200000. Every authoring write leaves a row here, with its captured
-- inverse; a delete also keeps the row as it was, which is what the `trash`
-- view reads. It replaced `deleted_structure`, which recorded deletes alone.
create table public.authoring_changes (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  author text not null default 'human' check (author in ('human','agent')),
  author_id uuid default auth.uid(),
  -- No foreign key on purpose: the record outlives the session.
  -- check ((author = 'agent') = (agent_session_id is not null))
  agent_session_id uuid,
  fn text not null check (btrim(fn) <> ''),   -- the authoring RPC, or a mutation name
  args jsonb not null default '{}'::jsonb check (jsonb_typeof(args) = 'object'),
  revert jsonb check (revert is null or jsonb_typeof(revert) = 'object'),   -- {fn, args}
  deleted_kind text check (deleted_kind in ('scenario','path','lane','step','cell')),
  label text,
  payload jsonb,   -- check ((deleted_kind is null) = (payload is null))
  affected_slices jsonb not null default '[]'::jsonb check (jsonb_typeof(affected_slices) = 'array')
);

-- ── Agent session ledger (unrelated to the blueprint tree) ───────────────────
create table public.agent_sessions (
  id uuid primary key,
  title text not null default 'New session',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 20260828120000. NULL = written before ownership was recorded; service
  -- accounts only. New rows cannot be NULL — the insert policy is the strict
  -- `created_by = auth.uid()` and the default supplies it.
  created_by uuid references auth.users (id) on delete cascade default auth.uid()
);

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.agent_sessions (id) on delete cascade,
  seq bigint not null,
  kind text not null check (kind in ('user','assistant','tool','status')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (session_id, seq)
);

-- ── Views ────────────────────────────────────────────────────────────────────
-- `trash` (over authoring_changes' delete rows) and `evidence_counts`. Their
-- definitions are in the migrations that create them, 20260830200000 and
-- 20260729120000 onward.

-- Prepared v2.8.11 additions, generated with pg_dump from the isolated replay.
--
-- Name: cell_storyboard_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cell_storyboard_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cell_id uuid NOT NULL,
    actor text NOT NULL,
    uploaded_ids uuid[] NOT NULL,
    before_state jsonb NOT NULL,
    after_state jsonb NOT NULL
);


--
-- Name: structure_membership_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.structure_membership_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    step_id uuid NOT NULL,
    path_id uuid NOT NULL,
    present boolean NOT NULL,
    before_state jsonb NOT NULL,
    after_state jsonb NOT NULL,
    archive jsonb NOT NULL,
    reverted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cell_storyboard_receipts cell_storyboard_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cell_storyboard_receipts
    ADD CONSTRAINT cell_storyboard_receipts_pkey PRIMARY KEY (id);


--
-- Name: structure_membership_receipts structure_membership_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.structure_membership_receipts
    ADD CONSTRAINT structure_membership_receipts_pkey PRIMARY KEY (id);


--
-- Name: cell_storyboard_receipts_cell_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cell_storyboard_receipts_cell_idx ON public.cell_storyboard_receipts USING btree (cell_id);


--
-- Name: cell_storyboard_receipts cell_storyboard_receipts_cell_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cell_storyboard_receipts
    ADD CONSTRAINT cell_storyboard_receipts_cell_id_fkey FOREIGN KEY (cell_id) REFERENCES public.cells(id) ON DELETE CASCADE;


--
-- Name: cell_storyboard_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cell_storyboard_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: structure_membership_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.structure_membership_receipts ENABLE ROW LEVEL SECURITY;


ALTER TABLE ONLY public.cells ADD CONSTRAINT cells_path_step_fkey
  FOREIGN KEY (path_id, step_id) REFERENCES public.path_steps(path_id, step_id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX cells_path_step_idx ON public.cells USING btree (path_id, step_id);
