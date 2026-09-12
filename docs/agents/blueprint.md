---
audience: agents
summary: What this blueprint is, how to retrieve from it, what absence and status mean, and how paths relate to a scenario's main route — the hand-written core — followed by the vocabulary and the schema, rendered from the code and the catalog.
sources: the package's src/lib/panelTerms.ts, deployment/types/database.ts, public.schema_comments(), deployment/lib/blueprintContract.ts, scripts/generate-agent-account.mjs
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

**Step** — One moment in time, read down every lane at once. Steps run left to right.

**Lane** — A row of the board, for one kind of participant — the customer, frontstage staff, backstage work, the tools. A row reads across every step.

<!-- /generated:vocabulary -->

## The schema, as the catalog describes it

Rendered from `pg_description` through `public.schema_comments()`, laid over
the column inventory in `deployment/types/database.ts`. A dash is a column nobody has
described yet; the coverage ratchets upward in
`docs/reference/agent-account-baseline.json`. Renaming a column and rewriting
its description are the same migration.

<!-- generated:schema from public.schema_comments() and deployment/types/database.ts — edit the migration, then npm run agent-account -->

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
| `id` | — |
| `service_id` | — |
| `run_id` | Audit-run identity. Intentionally FK-less — no runs table by design. |
| `source` | — |
| `check_key` | Roster check identifier, e.g. "gap-sweep". A key rather than a name because nobody reads it as prose — it is what a fingerprint is built from and what a run is grouped by. |
| `severity` | — |
| `cell_ids` | — |
| `cell_keys` | — |
| `summary` | The finding itself, in one line. It was `note`, which read as an aside about a finding rather than as the finding. |
| `fingerprint` | check_key + sorted cell_keys hash. Dedupe/reopen identity across runs. |
| `status` | — |
| `created_at` | — |
| `updated_at` | — |

### `authoring_changes`
Append-only record of every authoring write. Audit-only: the in-memory stack in src/lib/authoringSession.ts is still the undo affordance, and nothing replays `revert` from here. A row with `deleted_kind` set is a deletion and carries the rows it destroyed; `public.trash` is the view over exactly those.

4 of 12 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `at` | — |
| `author` | — |
| `author_id` | — |
| `agent_session_id` | The agent conversation this write belongs to. No foreign key on purpose: the record has to outlive the session it names. |
| `fn` | The operation: an authoring RPC name, or one of the direct-table mutation names the client logs under. Matches the WriteFn union in src/lib/authoringSession.ts. |
| `args` | Exactly what was sent. Ids, not names — a name is resolved at render because a name is a thing that changes. |
| `revert` | The captured inverse, {fn, args}, where one exists. Recorded so a row can say what would undo it. Nothing replays it — see the header. |
| `deleted_kind` | — |
| `label` | — |
| `payload` | — |
| `affected_slices` | — |

### `cell_dependencies`
Dependency from one cell to another

3 of 8 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `source_cell_id` | — |
| `target_cell_id` | — |
| `created_at` | — |
| `updated_at` | — |
| `kind` | leads_to = temporal (this cell makes the other happen; drawn as an arrow); enables = functional (the other must already be in place). enables renders in the panel only. |
| `name` | RETIRED (#550), and kept only so stage 1 is reversible. Documented as the word ON the arrow, it was never used as one: all 8 rows that carried it carried a sentence about why the edge exists, and 20260909040000 copied every one of them into note. Nothing writes it any more — not set_cell_dependency's argument, not the editor, not the agent tool. The dependency row still RENDERS it as a badge, because that row is held byte-identical to the template's and the change to stop belongs upstream; stage 2 drops the column and that badge together, and is a separate decision. |
| `note` | Anything worth knowing about this dependency, in the author's own words — rendered as the line under the dependency row, revealed on hover. General purpose, not "why this edge exists": the same kind of aside paths.note and scenarios.note carry, and since #550 the ONE prose field an edge has. Null means nothing was recorded, which is not the same as nothing worth recording. |

### `cell_touchpoints`
One touchpoint used at one cell: its own summary and role at this moment. Named by touchpoint_id into the registry, or by name alone when the registry lacks it. What it points at is in resources.

2 of 10 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `cell_id` | — |
| `touchpoint_id` | — |
| `position` | — |
| `summary` | — |
| `role` | What this touchpoint is to this moment: core (the step happens through it) or peripheral (present, but not what the step turns on), or null for the unmarked majority. Null is a state of its own and not a quiet "peripheral": it means nobody has judged this placement, so the panel renders nothing for it rather than a badge saying so. On the placement and not the catalog because the same artifact is central at one step and incidental at another. |
| `origin` | — |
| `created_at` | — |
| `updated_at` | — |
| `name` | The touchpoint's name when the registry lacks it. Exactly one of name and touchpoint_id is set; linking to the registry clears it. |

### `cells`
Content at lane × step intersection, within one path.

12 of 19 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `path_id` | — |
| `lane_id` | — |
| `step_id` | — |
| `content` | THE ONE DELIBERATE EXCEPTION to the name/title/summary vocabulary (#177): a cell's text is a sentence somebody wrote about a moment, not a name for the cell and not a one-line summary of something longer. It is the cell's own words, as typed into the grid. Renaming it to any of the three would have described the column less well than the word it already had. |
| `created_at` | — |
| `updated_at` | — |
| `frame` | One image for one cell — the frame. A step's frames across the lanes are its STRIP, and the storyboard cell in that step draws the strip rather than an image of its own. A cell outside the storyboard holds at most one frame. Holds a URL or a storage reference. The retired name is not repeated here on purpose: a comment is a swept prose surface, so naming the old word would leave the residue this file removes. |
| `summary` | Optional longer cell description (detail panel, not grid label) |
| `function` | Spec: role/responsibility/requirements of this cell (what it must do). |
| `form` | Spec: communication/look/feel/sound (what it must convey). |
| `value_props` | Array of {for, value} — value generated per beneficiary (user, business, actor). |
| `owner` | Actual owning team/party for this cell. |
| `perceived_owner` | Who the customer believes owns this moment (mismatch = deception risk). |
| `origin` | Where this cell came from: import (the pipeline) or app (created in the canvas). A cell minted by upsert_cell is app; one written by the import pipeline is import, and its cell_key is the pipeline's. |
| `cell_key` | THE STATEMENT OF RECORD for the cell-key format. Five slugified segments, service/scenario/path/lane/step — e.g. plus-application/before-students-join/happy-path/back-stage-actions/open-session. A phase is NOT a segment. Written by the import pipeline for origin=import, minted by upsert_cell for origin=app. Survives re-import; slides.cell_keys matches against it. |
| `position` | — |
| `search_tsv` | Generated FTS vector over the cell's own prose + spec columns, with a slash-stripped copy appended so "Zoom/Pencil"-style compounds match their parts (the parser treats a/b as a filename and indexes it whole). Consumed by public.search_blueprint. |
| `status` | How far along the thing this cell describes is. Defaults to live — a current-state blueprint documents what is in use. |

### `evidence`
Provenance rows for cells and proposition questions. A cell with zero rows is an ASSUMPTION (derived, never stored). Restricted SELECT: a note may hold interview content.

3 of 13 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `service_id` | — |
| `cell_id` | — |
| `cell_key` | — |
| `proposition_question_key` | — |
| `kind` | — |
| `title` | — |
| `note` | The one thing worth keeping about this source, in the author's own words: a quotation, an observation, or a link. A URL written here renders as a link wherever the source is displayed. |
| `observed_at` | Date-only by design (timestamps could re-identify participants). |
| `added_by` | Agent name or participant-coded author. Never the interviewee. |
| `created_by` | — |
| `created_at` | — |
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

5 of 12 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `path_id` | — |
| `name` | — |
| `position` | — |
| `created_at` | — |
| `updated_at` | — |
| `lane_role` | Semantic role key that drives rendering (pill cells, storyboard rows, divider anchoring), deliberately separate from the free-form display name. Canonical values: customer_actions, frontstage_actions, backstage_actions, partner_actions, frontstage_touchpoints, backstage_touchpoints, support_actions, storyboard. Null = generic swimlane (e.g. actor lanes), and is permitted on purpose. Constrained by lanes_lane_role_check — a custom role is no longer allowed, because an unconstrained column is how 36 support lanes went unclassified. |
| `owner_team` | Team that staffs/owns this lane (feeds KPI-alignment audit). |
| `kpis` | String array: metrics this lane's team is measured on. |
| `tools` | String array: systems/tools this lane's actors use. |
| `origin` | Where this lane came from: import (the pipeline) or app (created in the canvas). The same two values services and its five other sibling tables carry. |
| `stakeholder_id` | — |

### `path_steps`
Steps included on a path and their column order

1 of 5 columns described.

| Column | Meaning |
|---|---|
| `path_id` | — |
| `step_id` | — |
| `position` | Blueprint column index for this step on this path |
| `created_at` | — |
| `updated_at` | — |

### `paths`
One route through a scenario: happy, variant or exception (kind), and how far along it is (status). Nothing connects across paths; a path is a detour, not a stage.

5 of 10 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `scenario_id` | — |
| `name` | — |
| `kind` | How this route relates to the scenario's main one: happy (it IS the main route), variant (equally normal, chosen by condition), exception (a rule or a failure diverts it). How far along the route is does not belong here: paths.status carries that, on the entity_status domain — proposed, planned, built, live, at_risk, deprecated. |
| `created_at` | — |
| `updated_at` | — |
| `summary` | Optional summary of what this path variant represents |
| `note` | Optional path note shown alongside path metadata (e.g. parallel scenario context) |
| `origin` | Where this path came from: import (the pipeline) or app (created in the canvas). The same two values services and its five other sibling tables carry. |
| `status` | How far along this route is. Defaults to live. Replaces the "Prototype: " / "Planned: " name prefixes, which said the same thing where nothing could query it. |

### `phases`
Ordered phase of the service, in time order.

4 of 11 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `service_id` | — |
| `name` | — |
| `summary` | — |
| `position` | — |
| `created_at` | — |
| `updated_at` | — |
| `loops_to_phase_id` | When set, UI shows a return transition from this phase to the target phase |
| `business_impact` | Commercial impact notes: opex, NPS, brand, retention, growth. |
| `operational_requirements` | Process / system / people / legal requirements for this phase. |
| `origin` | Where this phase came from: import (the pipeline) or app (created in the canvas). The same two values services and its five other sibling tables carry. |

### `resources`
Things a cell, or one touchpoint placement, points at. A link is one kind of resource and `kind` carries the subtype. cell_id is always set; cell_touchpoint_id is set as well when the resource is a placement's, so a design link can belong to the tool it documents while staying the cell's.

4 of 11 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `cell_id` | The cell this resource belongs to — always. A placement-owned resource carries its placement in cell_touchpoint_id as well, and the composite key holds the two to one row. |
| `cell_touchpoint_id` | — |
| `kind` | link = a place on the web; attachment = a file the cell points at, an object in the cell-attachments bucket reached by its public URL (#274). Both carry a url. Host and file type are read at render, never stored. |
| `name` | What the thing on the other end is called. `name`, not `label`: a reader navigates to it. |
| `url` | — |
| `position` | — |
| `origin` | — |
| `created_at` | — |
| `updated_at` | — |
| `featured` | The resource its owner leads with. One featured attachment per placement or per cell (the image it shows); any number of featured links. |

### `scenarios`
Scenario within a phase

3 of 10 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `phase_id` | — |
| `name` | — |
| `summary` | — |
| `position` | — |
| `created_at` | — |
| `updated_at` | — |
| `layout` | How the board is drawn: the paths stacked as bands on a shared step axis, or merged into one grid where the paths agree and split where they diverge. A display setting rather than a kind, which is why it is `layout` and not `kind`. Written by the header toggle through update_scenario_layout, so a scenario left merged opens merged. A one-path scenario is stacked with one band. |
| `origin` | Where this scenario came from: import (the pipeline) or app (created in the canvas). The same two values services and its five other sibling tables carry. |
| `note` | An aside about the scenario, beside the summary that says what it is: most often what else may be running at the same time ("this scenario can run in parallel with Goal Setting and Help Request"). Blueprint data, not app configuration — it replaces a Record keyed on hardcoded scenario ids in src/lib/scenarioParallelInfo.ts (#326 S2, Decision D4). A scenario's fact, held once, rather than the same sentence copied onto each of its paths through paths.note. Free prose in the author's own language rather than a structured flag the renderer would have to compose a sentence from. |

### `services`
The service this board describes. One row. Renamed from service_lifecycles on 2026-08-21 — a service cannot contain several lifecycles, so the word named a level that does not exist.

4 of 8 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `name` | — |
| `summary` | What this service is, in the words a newcomer needs. The one field above the business model in the service panel. |
| `created_at` | — |
| `updated_at` | — |
| `origin` | Where this service came from: import (the pipeline) or app (created in the canvas). The same two values its six sibling tables carry. |
| `entity_examples` | Per-service authored examples, one free-text value per core kind (service, phase, scenario, path, step, lane), shown under each kind's definition to ground it in this deployment. Blueprint data, not app config: it rides the service block so a re-map round-trips it. A jsonb object with no CHECK — the six-key shape is the app's, and an unwritten key simply does not render. |
| `slug` | A service's stable route slug: `/<slug>` opens it (#303/#341). Its own identity, not derived from the name — a rename does not move the URL, and the unique constraint stops two services colliding. Backfilled from the name-derived slug (public.key_slug) when re-added; nullable so a cleared slug falls back to the name-derived route in the app. Editable by the deployer through a later panel write, which adds the UPDATE grant then. |

### `slices`
Saved 1D cuts through the blueprint grid. Reference cells only — never copy or create them.

2 of 13 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `service_id` | — |
| `kind` | How the cut was made: journey (experience closure for an actor) \| step (one column) \| lane (one lane across the whole service) \| cell (single-cell spec) \| custom. |
| `title` | — |
| `summary` | — |
| `actor` | — |
| `locale` | — |
| `authorship` | Who wrote this slice, and whether a regeneration may overwrite it: generated = safe to regenerate; customized = human-edited, regeneration must confirm; human = authored outright. Deliberately NOT called origin: every origin column in this schema answers "import or app", which is a different question with a different vocabulary. |
| `position` | — |
| `created_by` | — |
| `created_at` | — |
| `updated_at` | — |
| `stakeholder_id` | — |

### `slide_images`
The ordered set of images a slide shows once an author has picked. Empty with slides.shows_all_images false means show nothing; the untouched default stores no rows at all.

3 of 5 columns described.

| Column | Meaning |
|---|---|
| `cell_id` | Show this cited cell's frame, whatever that frame later becomes. Cascades away with the cell. |
| `id` | — |
| `image_url` | Show this uploaded image. It JOINS the slide's set; it never replaces the cited cells' frames. |
| `position` | The order a reader meets the images in. An order, not an index: dropping a member leaves the others where they were. |
| `slide_id` | — |

### `slides`
One slide of a slice. It shows an ordered set of images — every cited cell's frame while shows_all_images is true, and exactly the rows in slide_images once an author has picked — and carries the words written over them. Empty cell_ids = a title-only divider slide. The retired table name is not repeated here: a comment is a swept prose surface, and CONTEXT.md's rename map is where the old name is recorded.

6 of 11 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `slice_id` | — |
| `position` | — |
| `cell_ids` | SOFT refs to cells (no FK — must survive scenario re-import). Same order as cell_keys. Their frames are what an untouched slide shows, and the pool a picked one chooses from. |
| `cell_keys` | IR key-paths paired with cell_ids for orphan recovery after key renames. |
| `title` | The words at the top of the slide, as somebody wrote them. A title rather than a name because a slide is authored content a reader reads. |
| `caption` | The sentence a reader meets under this slide's frames. Authored content, not a story the slide tells. |
| `created_at` | — |
| `updated_at` | — |
| `created_by` | auth.uid() at insert; null for service-key writes. |
| `shows_all_images` | True until an author picks. True means show every cited cell's frame and keep doing so as the board changes; false means show exactly the rows in slide_images, including none. |

### `stakeholders`
Deployment-level cast list: one pool of actors a lane picks from, unique by name across the deployment. A lane references a stakeholder; no service owns one (ADR 0014). The unscoped read this registry always did is now correct.

4 of 8 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `name` | The identity: unique across the deployment, so the same actor recurs across services by name rather than as one row per service. |
| `kind` | What sort of party this is. staff/recipient/partner/provider are ACTORS — they can be a lane's stakeholder. team is an accountable group — it can be a lane's owner_team and never its stakeholder. |
| `summary` | What this party IS, in one line — a definition, not an aside. The lane panel and the owner badge read it; a lane never copies it, because one stakeholder owns many lanes and 37 copies is 37 chances to disagree. |
| `aliases` | — |
| `created_at` | — |
| `updated_at` | — |
| `parent_id` | The party this one is part of. Design's four sub-teams point at Design, so "what does Design own?" rolls them up while a lane can still name the specific one. |

### `steps`
Blueprint column (journey step) scoped to a service scenario

3 of 7 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `name` | — |
| `created_at` | — |
| `updated_at` | — |
| `scenario_id` | Scenario that owns this canonical step |
| `origin` | Where this step came from: import (the pipeline) or app (created in the canvas). The same two values services and its five other sibling tables carry. |
| `summary` | What this moment is, across every lane — the one sentence that makes the column legible without reading five cells. Shown as the caption under the step's strip, which is the frames of its cells read across the lanes. |

### `touchpoints`
Deployment-level catalog of the tools, documents, channels and artifacts the services use. One row per real thing, unique by name across the deployment; a service references it, no service owns it (ADR 0014).

4 of 12 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `name` | The identity: unique across the deployment, so a second service reuses an entry by naming the same tool the same way rather than minting its own. |
| `kind` | — |
| `summary` | — |
| `url` | — |
| `stakeholder_id` | — |
| `origin` | — |
| `created_at` | — |
| `updated_at` | — |
| `icon_url` | A stable URL for the touchpoint's stock icon or logo — the mark a well-known tool shows in the detail panel. A property of the thing the deployment owns, authored once per name, never per placement. Blueprint data rather than app configuration: null draws nothing, and the renderer reads this row instead of matching a tool name against a table baked into code (#326 S2, Decision D4). Matches the template's column of the same name (asb 21000124000000) so a re-map round-trips. |
| `tone` | The palette family this touchpoint's face is drawn in — the deployment's own choice, one of the renderer's tone names (crimson, gold, indigo, purple, red, tomato, yellow). A product fact ("Zoom is blue"), not a styling one, which is why it is a row and not a literal in touchpointColors.ts (#326 S2, #396 Q48). Deliberately unconstrained: the tone vocabulary belongs to the token model (ADR 0001) and a CHECK here would be a second copy of it, free to drift. Null means no preference — the renderer falls back deterministically, exactly as it does for a tool the old map never named. |
| `aliases` | The other spellings that mean this touchpoint — an older name the service has stopped using, a label that carried its own specification, a lower-case one a person typed into a cell. The name is the identity (ADR 0014); these resolve to it. This deployment's own history, which is why it is a column and not the TECH_LABEL_ALIASES literal in touchpointColors.ts (#326 S2, #396 Q48). Nullable rather than NOT NULL DEFAULT '{}' like stakeholders.aliases: null means no aliases have been considered, which is what every row means today. Uniqueness against other names and aliases is not constrained here — that rule belongs with the resolver, in S6. |

### `trash`
The deletions in public.authoring_changes, in the shape the retired deleted_structure table had. A filter over the one log, so the recovery list cannot drift from the record of what happened.

0 of 7 columns described.

| Column | Meaning |
|---|---|
| `id` | — |
| `deleted_at` | — |
| `deleted_by` | — |
| `kind` | — |
| `label` | — |
| `payload` | — |
| `affected_slices` | — |

### Not readable with the anon key

These exist and a service key reads them. What each is for:

- `business_models` — How the service is funded, priced and delivered. One row per service. Renamed from `propositions` on 2026-08-21 — that word already meant a cell's value proposition, which is a different thing at a different level.

<!-- /generated:schema -->
