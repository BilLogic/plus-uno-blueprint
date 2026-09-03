---
audience: agents
summary: What this blueprint is, how to retrieve from it, what absence and status mean, and how paths relate to a scenario's main route — the hand-written core — followed by the vocabulary and the schema, rendered from the code and the catalog.
sources: src/lib/panelTerms.ts, src/types/database.ts, public.schema_comments(), src/lib/blueprintContract.ts, scripts/generate-agent-account.mjs
---

# The blueprint, for agents

This document is the blueprint's own account of itself, for any agent that
reads it: the Slack bot, an IDE session in this repository or in the kit's,
the canvas agent through `get_reference("blueprint")`. One source, four
readers. The first part is written by hand and says what the catalog cannot.
The two parts after it are rendered — from the entity definitions the board
shows a reader, and from the table and column comments in the database — and
`npm run check:agent-account` fails when either source changes and this file
does not.

## What it is

A service blueprint is a grid of one service, end to end. Phases run left to
right in time. Each phase holds scenarios: situations the service has to
handle. A scenario is drawn as one or more paths, and each path is a grid of
steps (columns, in that path's order) by lanes (rows: the customer, the staff
they see, the staff they do not, the tools each uses). A cell is what happens
at one lane in one step on one path. Everything else hangs off cells:
resources a cell points at, touchpoint placements, evidence, dependencies
between cells, and slices that cite cells.

## How to read it

Orient at phase and scenario level first, then open one scenario's grid. Read
a cell's `content` as the sentence of record — the thing that happens — and
its `summary` as the longer account. The spec fields (`function`, `form`,
`value_props`, `owner`, `perceived_owner`) say what the moment must do, how it
must feel, who gains, who owns it and who the customer believes owns it. A
step's `summary` is the one sentence that makes the whole column legible; a
lane's `owner_team`, `kpis` and `tools` say who staffs the row and what they
are measured on.

## Retrieval

`search_blueprint` is the one door. With `q` it ranks by meaning, prose and
structural name fused together. With filters (`filter_phase`,
`filter_scenario`, `filter_path_kind`, `filter_lane_role`) it narrows every
retriever to a scope. With filters and no `q` it returns the complete matching
set in structural order — the honest way to say "every exception path" or
"all of Discovery". `granularity` picks the level: phase, scenario, path,
step, lane or cell. Every row carries `matched_by` and `total_matched`, so
answer with the count behind the top-k: "113 cells mention Zoom; here are 15."
Direct selects, embed hints and service-key routes are in
[`blueprint-direct-access.md`](blueprint-direct-access.md).

## What absence means

- A cell with no evidence rows is an assumption. Say so when you cite it.
- A cell with no dependency rows has none recorded — report "none recorded",
  which is different from "independent".
- Every cell and path carries a `status`, defaulting to `live`: this is a
  current-state blueprint, and it documents what is in use. Future state is
  read off `status`, and only there — path names carry no convention.
- A placement with a `name` and no `touchpoint_id` is a real tool the
  registry lacks. Treat it as a touchpoint; the registry is the part that is
  behind.
- A cell with no resources points at nothing yet. Report the gap rather than
  guessing at a tool.
- A `null` placement `role` means nobody has judged it — neither core nor
  peripheral.

## What a status licenses you to say

`status` is one vocabulary on cells and paths, the `entity_status` domain:
`proposed`, `planned`, `built`, `live`, `at_risk`, `deprecated`.

- `proposed` — designed and discussed, with no build card behind it. Say "may
  never happen".
- `planned` — committed and carded, no code yet. Say "committed, not started".
- `built` — code exists, in build or QA, nobody uses it. Say "built, not
  deployed".
- `live` — in use today. This is what the service does. The default.
- `at_risk` — live and failing in a way somebody has measured. Say both
  halves.
- `deprecated` — on the way out. Say so, and point at what replaces it if a
  dependency says.

When the question is about today, answer from `live` and `at_risk`. When it is
about the roadmap, answer from `proposed`, `planned` and `built`.

## Paths and the main route

A path's `kind` is `happy`, `variant` or `exception`. The happy path IS the
scenario's main route. A variant is equally normal, chosen by a condition. An
exception is a rule or a failure diverting the route. Nothing connects across
paths: each path owns its lanes and cells, and shares the scenario's steps
through `path_steps` in its own order. A scenario's `layout` is `stacked` or
`merged` — how the board is drawn, a display setting and not a kind.
Dependencies between cells are `leads_to` (this cell makes the other happen,
drawn as an arrow) or `enables` (the other must already be in place).

## The vocabulary

Rendered from `ENTITY_KIND_DEFINITIONS` in `src/lib/panelTerms.ts` — the six
kinds the board defines for a reader who has never seen one.

<!-- generated:vocabulary from src/lib/panelTerms.ts — edit the source, then npm run agent-account -->

**Service** — The whole service this blueprint maps, end to end. Everything else on the board is part of it.

**Phase** — A chapter of the service, in time order. Each phase holds the scenarios that can happen during it.

**Scenario** — A specific situation inside a phase, mapped on its own board.

**Path** — One route through a scenario: the main way, plus variants and exceptions. Paths are alternatives, not stages — nothing carries across them.

**Step** — A column of the board: one moment in time, read down every lane at once. Steps run left to right.

**Lane** — A row of the board, for one kind of participant — the customer, frontstage staff, backstage work, the tools. A row reads across every step.

<!-- /generated:vocabulary -->

## The schema, as the catalog describes it

Rendered from `pg_description` through `public.schema_comments()`, laid over
the column inventory in `src/types/database.ts`. A dash is a column nobody has
described yet; the coverage ratchets upward in
`docs/reference/agent-account-baseline.json`. Renaming a column and rewriting
its description are the same migration.

<!-- generated:schema from public.schema_comments() and src/types/database.ts — edit the migration, then npm run agent-account -->

### `agent_messages`
Transcript events of an agent session, ordered by seq. Payload mirrors the app's TranscriptEvent.

0 of 6 columns described.

| Column | Meaning |
|---|---|
| `created_at` | — |
| `id` | — |
| `kind` | — |
| `payload` | — |
| `seq` | — |
| `session_id` | — |

### `agent_sessions`
One canvas-agent conversation. Ledger entries reference it via agentSessionId (client-side).

1 of 5 columns described.

| Column | Meaning |
|---|---|
| `created_at` | — |
| `id` | — |
| `title` | — |
| `updated_at` | — |
| `user_id` | Who owns this conversation. NULL means the row predates ownership (2026-08-28); those are readable by service accounts only and no new row may be NULL. |

### `audit_findings`
Audit / whatif / import-sweep outputs. Written by skills (IDE service key or canvas authenticated agent); humans triage by status. Prefixed on 2026-08-30 because the bare word `findings` gave a reader no clue which process produces the rows; the CONCEPT is still a finding everywhere else.

4 of 13 columns described.

| Column | Meaning |
|---|---|
| `cell_ids` | — |
| `cell_keys` | — |
| `check_key` | Roster check identifier, e.g. "gap-sweep". A key rather than a name because nobody reads it as prose — it is what a fingerprint is built from and what a run is grouped by. |
| `created_at` | — |
| `fingerprint` | check_key + sorted cell_keys hash. Dedupe/reopen identity across runs. |
| `id` | — |
| `summary` | The finding itself, in one line. It was `note`, which read as an aside about a finding rather than as the finding. |
| `run_id` | Audit-run identity. Intentionally FK-less — no runs table by design. |
| `service_id` | — |
| `severity` | — |
| `source` | — |
| `status` | — |
| `updated_at` | — |

### `authoring_changes`
Append-only record of every authoring write. Audit-only: the in-memory stack in src/lib/authoringSession.ts is still the undo affordance, and nothing replays `revert` from here. A row with `deleted_kind` set is a deletion and carries the rows it destroyed; `public.trash` is the view over exactly those.

4 of 12 columns described.

| Column | Meaning |
|---|---|
| `affected_slices` | — |
| `agent_session_id` | The agent conversation this write belongs to. No foreign key on purpose: the record has to outlive the session it names. |
| `args` | Exactly what was sent. Ids, not names — a name is resolved at render because a name is a thing that changes. |
| `at` | — |
| `author` | — |
| `author_id` | — |
| `deleted_kind` | — |
| `fn` | The operation: an authoring RPC name, or one of the direct-table mutation names the client logs under. Matches the WriteFn union in src/lib/authoringSession.ts. |
| `id` | — |
| `label` | — |
| `payload` | — |
| `revert` | The captured inverse, {fn, args}, where one exists. Recorded so a row can say what would undo it. Nothing replays it — see the header. |

### `cell_dependencies`
Dependency from one cell to another

2 of 7 columns described.

| Column | Meaning |
|---|---|
| `created_at` | — |
| `id` | — |
| `kind` | leads_to = temporal (this cell makes the other happen; drawn as an arrow); enables = functional (the other must already be in place). enables renders in the panel only. |
| `name` | The word on the arrow, e.g. a channel tag like "Email". A name because it is what a reader navigates the dependency by; it was `label`, which said how it renders rather than what it is. |
| `source_cell_id` | — |
| `target_cell_id` | — |
| `updated_at` | — |

### `cell_touchpoints`
One touchpoint used at one cell: its own summary and role at this moment. Named by touchpoint_id into the registry, or by name alone when the registry lacks it. What it points at is in resources.

2 of 10 columns described.

| Column | Meaning |
|---|---|
| `cell_id` | — |
| `created_at` | — |
| `id` | — |
| `name` | The touchpoint's name when the registry lacks it. Exactly one of name and touchpoint_id is set; linking to the registry clears it. |
| `origin` | — |
| `position` | — |
| `role` | What this touchpoint is to this moment: core (the step happens through it) or peripheral (present, but not what the step turns on), or null for the unmarked majority. Null is a state of its own and not a quiet "peripheral": it means nobody has judged this placement, so the panel renders nothing for it rather than a badge saying so. On the placement and not the catalog because the same artifact is central at one step and incidental at another. |
| `summary` | — |
| `touchpoint_id` | — |
| `updated_at` | — |

### `cells`
Content at lane × step intersection, within one path.

10 of 17 columns described.

| Column | Meaning |
|---|---|
| `content` | THE ONE DELIBERATE EXCEPTION to the name/title/summary vocabulary (#177): a cell's text is a sentence somebody wrote about a moment, not a name for the cell and not a one-line summary of something longer. It is the cell's own words, as typed into the grid. Renaming it to any of the three would have described the column less well than the word it already had. |
| `created_at` | — |
| `summary` | Optional longer cell description (detail panel, not grid label) |
| `form` | Spec: communication/look/feel/sound (what it must convey). |
| `function` | Spec: role/responsibility/requirements of this cell (what it must do). |
| `id` | — |
| `lane_id` | — |
| `status` | How far along the thing this cell describes is. Defaults to live — a current-state blueprint documents what is in use. |
| `owner` | Actual owning team/party for this cell. |
| `path_id` | — |
| `perceived_owner` | Who the customer believes owns this moment (mismatch = deception risk). |
| `frame` | One image for one cell — the frame. A step's frames across the lanes are its STRIP, and the storyboard cell in that step draws the strip rather than an image of its own. A cell outside the storyboard holds at most one frame. Holds a URL or a storage reference. The retired name is not repeated here on purpose: a comment is a swept prose surface, so naming the old word would leave the residue this file removes. |
| `search_tsv` | Generated FTS vector over the cell's own prose + spec columns, with a slash-stripped copy appended so "Zoom/Pencil"-style compounds match their parts (the parser treats a/b as a filename and indexes it whole). Consumed by public.search_blueprint. |
| `position` | — |
| `step_id` | — |
| `updated_at` | — |
| `value_props` | Array of {for, value} — value generated per beneficiary (user, business, actor). |

### `evidence`
Provenance rows for cells and proposition questions. A cell with zero rows is an ASSUMPTION (derived, never stored). Restricted SELECT: excerpts may hold interview content.

2 of 14 columns described.

| Column | Meaning |
|---|---|
| `added_by` | Agent name or participant-coded author. Never the interviewee. |
| `cell_id` | — |
| `cell_key` | — |
| `created_at` | — |
| `created_by` | — |
| `excerpt` | — |
| `id` | — |
| `kind` | — |
| `observed_at` | Date-only by design (timestamps could re-identify participants). |
| `proposition_question_key` | — |
| `ref` | — |
| `service_id` | — |
| `title` | — |
| `updated_at` | — |

### `evidence_counts`
cell_id -> evidence row count. Public: powers the assumption lens without exposing evidence content.

0 of 2 columns described.

| Column | Meaning |
|---|---|
| `cell_id` | — |
| `n` | — |

### `lanes`
Blueprint row (e.g. Users, Front Stage Employees)

4 of 11 columns described.

| Column | Meaning |
|---|---|
| `created_at` | — |
| `id` | — |
| `kpis` | String array: metrics this lane's team is measured on. |
| `lane_role` | Semantic role key that drives rendering (pill cells, storyboard rows, divider anchoring), deliberately separate from the free-form display name. Canonical values: customer_actions, frontstage_actions, backstage_actions, partner_actions, frontstage_touchpoints, backstage_touchpoints, support_actions, storyboard. Null = generic swimlane (e.g. actor lanes), and is permitted on purpose. Constrained by lanes_lane_role_check — a custom role is no longer allowed, because an unconstrained column is how 36 support lanes went unclassified. |
| `name` | — |
| `owner_team` | Team that staffs/owns this lane (feeds KPI-alignment audit). |
| `path_id` | — |
| `position` | — |
| `tools` | String array: systems/tools this lane's actors use. |
| `stakeholder_id` | — |
| `updated_at` | — |

### `path_steps`
Steps included on a path and their column order

1 of 5 columns described.

| Column | Meaning |
|---|---|
| `position` | Blueprint column index for this step on this path |
| `created_at` | — |
| `path_id` | — |
| `step_id` | — |
| `updated_at` | — |

### `paths`
One route through a scenario: happy, variant or exception (kind), and how far along it is (status). Nothing connects across paths; a path is a detour, not a stage.

4 of 9 columns described.

| Column | Meaning |
|---|---|
| `created_at` | — |
| `summary` | Optional summary of what this path variant represents |
| `id` | — |
| `name` | — |
| `note` | Optional path note shown alongside path metadata (e.g. parallel scenario context) |
| `kind` | How this route relates to the scenario's main one: happy (it IS the main route), variant (equally normal, chosen by condition), exception (a rule or a failure diverts it). How far along the route is does not belong here: paths.status carries that, on the entity_status domain — proposed, planned, built, live, at_risk, deprecated. |
| `status` | How far along this route is. Defaults to live. Replaces the "Prototype: " / "Planned: " name prefixes, which said the same thing where nothing could query it. |
| `scenario_id` | — |
| `updated_at` | — |

### `phases`
Ordered phase of the service, in time order.

3 of 10 columns described.

| Column | Meaning |
|---|---|
| `business_impact` | Commercial impact notes: opex, NPS, brand, retention, growth. |
| `created_at` | — |
| `id` | — |
| `loops_to_phase_id` | When set, UI shows a return transition from this phase to the target phase |
| `name` | — |
| `operational_requirements` | Process / system / people / legal requirements for this phase. |
| `position` | — |
| `service_id` | — |
| `summary` | — |
| `updated_at` | — |

### `resources`
Things a cell, or one touchpoint placement, points at. A link is one kind of resource and `kind` carries the subtype. cell_id is always set; cell_touchpoint_id is set as well when the resource is a placement's, so a design link can belong to the tool it documents while staying the cell's.

4 of 11 columns described.

| Column | Meaning |
|---|---|
| `cell_id` | The cell this resource belongs to — always. A placement-owned resource carries its placement in cell_touchpoint_id as well, and the composite key holds the two to one row. |
| `cell_touchpoint_id` | — |
| `created_at` | — |
| `featured` | The resource its owner leads with. One featured attachment per placement or per cell (the image it shows); any number of featured links. |
| `id` | — |
| `kind` | link = a place on the web; attachment = a file the cell points at, an object in the cell-attachments bucket reached by its public URL (#274). Both carry a url. Host and file type are read at render, never stored. |
| `name` | What the thing on the other end is called. `name`, not `label`: a reader navigates to it. |
| `origin` | — |
| `position` | — |
| `updated_at` | — |
| `url` | — |

### `scenarios`
Scenario within a phase

1 of 8 columns described.

| Column | Meaning |
|---|---|
| `created_at` | — |
| `id` | — |
| `name` | — |
| `position` | — |
| `phase_id` | — |
| `summary` | — |
| `updated_at` | — |
| `layout` | How the board is drawn: the paths stacked as bands on a shared step axis, or merged into one grid where the paths agree and split where they diverge. A display setting rather than a kind, which is why it is `layout` and not `kind`. Written by the header toggle through update_scenario_layout, so a scenario left merged opens merged. A one-path scenario is stacked with one band. |

### `services`
The service this board describes. One row. Renamed from service_lifecycles on 2026-08-21 — a service cannot contain several lifecycles, so the word named a level that does not exist.

3 of 8 columns described.

| Column | Meaning |
|---|---|
| `created_at` | — |
| `summary` | What this service is, in the words a newcomer needs. The one field above the business model in the service panel. |
| `id` | — |
| `name` | — |
| `slug` | — |
| `origin` | Where this service came from: import (the pipeline) or app (created in the canvas). The same two values its six sibling tables carry. |
| `entity_examples` | Per-service authored examples, one free-text value per core kind (service, phase, scenario, path, step, lane), shown under each kind's definition to ground it in this deployment. Blueprint data, not app config: it rides the service block so a re-map round-trips it. A jsonb object with no CHECK — the six-key shape is the app's, and an unwritten key simply does not render. |
| `updated_at` | — |

### `slices`
Saved 1D cuts through the blueprint grid. Reference cells only — never copy or create them.

2 of 13 columns described.

| Column | Meaning |
|---|---|
| `actor` | — |
| `created_at` | — |
| `created_by` | — |
| `summary` | — |
| `id` | — |
| `locale` | — |
| `authorship` | Who wrote this slice, and whether a regeneration may overwrite it: generated = safe to regenerate; customized = human-edited, regeneration must confirm; human = authored outright. Deliberately NOT called origin: every origin column in this schema answers "import or app", which is a different question with a different vocabulary. |
| `position` | — |
| `service_id` | — |
| `kind` | How the cut was made: journey (experience closure for an actor) \| step (one column) \| lane (one lane across the whole service) \| cell (single-cell spec) \| custom. |
| `title` | — |
| `stakeholder_id` | — |
| `updated_at` | — |

### `slides`
One slide of a slice. It shows the FRAMES of the cells it references — that strip is what the slide shows, so the two cannot disagree — and carries the words written over them. Empty cell_ids = a title-only divider slide. The retired table name is not repeated here: a comment is a swept prose surface, and CONTEXT.md's rename map is where the old name is recorded.

4 of 10 columns described.

| Column | Meaning |
|---|---|
| `title` | The words at the top of the slide, as somebody wrote them. A title rather than a name because a slide is authored content a reader reads, which is the rule #177 settled; it was `caption`. |
| `cell_ids` | SOFT refs to cells (no FK — must survive scenario re-import). Same order as cell_keys. Their frames are this slide's strip. |
| `cell_keys` | IR key-paths paired with cell_ids for orphan recovery after key renames. |
| `created_at` | — |
| `created_by` | auth.uid() at insert; null for service-key writes. |
| `id` | — |
| `narrative` | — |
| `position` | — |
| `slice_id` | — |
| `updated_at` | — |

### `stakeholders`
Deployment-level cast list: one pool of actors a lane picks from, unique by name across the deployment. A lane references a stakeholder; no service owns one (ADR 0014). The unscoped read this registry always did is now correct.

3 of 7 columns described.

| Column | Meaning |
|---|---|
| `aliases` | — |
| `created_at` | — |
| `id` | — |
| `kind` | What sort of party this is. staff/recipient/partner/provider are ACTORS — they can be a lane's stakeholder. team is an accountable group — it can be a lane's owner_team and never its stakeholder. |
| `name` | The identity: unique across the deployment, so the same actor recurs across services by name rather than as one row per service. |
| `summary` | What this party IS, in one line — a definition, not an aside. The lane panel and the owner badge read it; a lane never copies it, because one stakeholder owns many lanes and 37 copies is 37 chances to disagree. |
| `updated_at` | — |

### `steps`
Blueprint column (journey step) scoped to a service scenario

2 of 6 columns described.

| Column | Meaning |
|---|---|
| `created_at` | — |
| `id` | — |
| `name` | — |
| `scenario_id` | Scenario that owns this canonical step |
| `summary` | What this moment is, across every lane — the one sentence that makes the column legible without reading five cells. Shown as the caption under the step's strip, which is the frames of its cells read across the lanes. |
| `updated_at` | — |

### `touchpoints`
Deployment-level catalog of the tools, documents, channels and artifacts the services use. One row per real thing, unique by name across the deployment; a service references it, no service owns it (ADR 0014).

1 of 9 columns described.

| Column | Meaning |
|---|---|
| `created_at` | — |
| `id` | — |
| `kind` | — |
| `name` | The identity: unique across the deployment, so a second service reuses an entry by naming the same tool the same way rather than minting its own. |
| `origin` | — |
| `stakeholder_id` | — |
| `summary` | — |
| `updated_at` | — |
| `url` | — |

### `trash`
The deletions in public.authoring_changes, in the shape the retired deleted_structure table had. A filter over the one log, so the recovery list cannot drift from the record of what happened.

0 of 7 columns described.

| Column | Meaning |
|---|---|
| `affected_slices` | — |
| `deleted_at` | — |
| `deleted_by` | — |
| `id` | — |
| `kind` | — |
| `label` | — |
| `payload` | — |

### Not readable with the anon key

These exist and a service key reads them. What each is for:

- `business_models` — How the service is funded, priced and delivered. One row per service. Renamed from `propositions` on 2026-08-21 — that word already meant a cell's value proposition, which is a different thing at a different level.

<!-- /generated:schema -->
