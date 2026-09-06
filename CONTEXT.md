# Vocabulary

The words this codebase fixes, and what each one is bound to in the schema.

**This file is definitions and nothing else.** No architecture, no process, no
opinions about how to work. If a sentence here starts explaining *how the app
does* something rather than *what a word means*, it belongs somewhere else and
should be moved. That constraint is the file's whole value: an agent or a person
can read it end to end before touching anything, and it stays readable because
it never grows a second job. `scripts/check-glossary-only.mjs` holds it there,
so the constraint is a gate rather than a habit.

Two reference tables used to live here and now live where they are enforced.
The rename map is `scripts/retired-vocabulary.mjs`, the one list three checks
read, and the reasoning about which words are retired as identifiers rather
than as words is the header of
[`scripts/check-retired-identifiers.mjs`](scripts/check-retired-identifiers.mjs).
Every panel label and the column behind it is
[`docs/reference/interface-schema-map.md`](docs/reference/interface-schema-map.md).

How to *read* the artifact these words describe — what to look at first, what
the layout is telling you — is
[`docs/product/03-reading-a-blueprint.md`](docs/product/03-reading-a-blueprint.md).
Where the schema and access model are described in full is
[`docs/engineering/access-and-security.md`](docs/engineering/access-and-security.md).
What the blueprint tells an agent about itself — retrieval, absence, what a
status licenses, the schema as the catalog describes it — is
[`docs/agents/blueprint.md`](docs/agents/blueprint.md).

---

## The blueprint

**service** — the whole relationship with the service, end to end. There is one
per deployment, and it is what the Overview page shows.
Table `services`. It used to be called a *lifecycle*, which was a longer name
for the same thing rather than a level above it.

**phase** — a chapter of that relationship, numbered and in time order. In
service terms: "the enrollment stage", "the weekly-sessions stage".
Table `phases`: `service_id`, `name`, `summary`, `position`, and
`loops_to_phase_id` for a phase that returns to an earlier one.

**scenario** — a concrete situation inside a phase, worth mapping on its own:
"a student's first session", "rescheduling". Each opens as its own board.
Its `layout` is how that board is drawn — `stacked`, each path its own band
on a shared step axis, or `merged`, the paths in one grid that splits where
they diverge — and it is remembered: a scenario left merged opens merged. A
one-path scenario is stacked with one band; there is no separate single view.
Table `scenarios`: `phase_id`, `name`, `summary`, `position`, `layout`.

**path** — a variant route through one scenario: the happy path where everything
works, plus the detours. A path is an **alternative, not a stage** — nothing
connects across paths.
Table `paths`: `scenario_id`, `name`, `kind`, `summary` (the "applies when"
condition), `note`.
`kind` is exactly three values: `happy`, `variant`, `exception`.

**step** — a column of the board: time, left to right. Step 1 happens before
step 2.
Table `steps`, scoped to a scenario. Column order is **per path**, through the
join table `path_steps` (`position`), so two paths can order the same step
differently.

**lane** — a horizontal row of the board, belonging to one kind of actor or
machinery: the customer's own actions, the staff actions the customer can see,
the visible tools, the backstage work, the internal systems, the supporting
teams.
Table `lanes`: `path_id`, `name` (free-form, any language), `lane_role` (the
semantic key, deliberately separate from the display name — inferring one from
the other broke every non-English blueprint), `stakeholder_id`, `owner_team`,
`kpis`, `tools`, `position`.

**line of visibility** — the horizontal rule separating what the customer
experiences from the machinery that makes it possible. Above it: what the
customer sees. Below it: everything that has to happen for the moment above to
feel effortless.
**Not a column.** It is derived at render time from `lane_role`. Its sibling,
the **line of interaction**, is drawn after the customer-actions lane.

**cell** — one box on the board: one moment, in one lane, at one step. The atom
of the whole system — slices cite cells, findings point at cells, share links
open cells.
Table `cells`: `path_id`, `lane_id`, `step_id`, `content`, `summary`, `frame`,
`function`, `form`, `value_props`, `owner`, `perceived_owner`,
`status`, `position`. A single (lane, step) slot can hold several stacked cells,
distinguished by `position`.

**touchpoint** — a thing the service uses that a customer or a member of staff
meets at a moment: an app, a document, a physical artifact, a channel, another
service. It belongs to the **deployment**, shared across its services and not
owned by any one of them, so renaming it once moves every place it appears. Its
`name` is its identity, unique deployment-wide (ADR 0014).
Table `touchpoints`: `name`, `kind`, `summary`, `url`,
`stakeholder_id`, `origin`.

**placement** — one touchpoint, used at one cell, this way. The catalog owns
the name; the placement owns the per-moment `summary`, because the same tool
describes a different screen at a different step. It also carries a `role`
(`core` or `peripheral`), which sits here rather than on the catalog because
the same artifact is central at one moment and incidental at another. That is
all a placement says; what it points at — a screen, a file, a page — is a
resource on it. A placement names its touchpoint one of two ways, and exactly
one: by `touchpoint_id` into the registry, or by `name` alone when the
registry lacks it.
Table `cell_touchpoints`: `cell_id`, `touchpoint_id` or `name`, `position`,
`summary`, `role`, `origin`.

**name-only placement** — a placement whose touchpoint the registry lacks: it
carries a `name` and no `touchpoint_id`. Drawn on the board with a dashed face,
it opens the same panel as any placement and offers to be linked to a registry
entry — a decision a person makes, never a match on the name. The 57 details
that used to wait in a side table became these (or linked placements, where
the registry already had the name) in `20260902170000`.
**storyboard** — the lane that draws the service rather than describing it.
`lane_role = 'storyboard'`, one of the eight the `lanes_lane_role_check`
constraint admits. Its own cells are empty: a storyboard cell's face is the
*strip* below, drawn from the cells beside it.

**frame** — one image on one cell. Column `cells.frame`. A cell outside the
storyboard holds at most one.

**strip** — a step's frames, read across the lanes: the script for that moment.
**Not a column.** It is derived at render time from the frames of the step's
cells, which is why a strip and the frames it is made of cannot disagree. A
*slide* shows one too, and it is the same word for the same thing — see
*slide*.

**resource** — something a cell points at: a spec, a Figma node, a Notion
module, a file in the repository. A **link** is one kind of resource, which is
why the table is named for the parent and `kind` carries the subtype.
Table `resources`: `cell_id` — always — plus `kind` (`link` or `attachment`),
`name`, `url`, `position`, `origin`, `featured`, and `cell_touchpoint_id` when
the resource is a placement's. A placement's resources are that cell's too:
they answer "what does this cell point at?" through the touchpoint, and the
pair of columns names one placement row, never a placement in another cell.
An **attachment** is a file the cell points at; a **featured** resource is the
one its owner leads with — one featured attachment per owner, any number of
featured links.

**dependency** — a relationship between two cells. One table, two kinds, both
read **source-first**:

- **`leads_to`** — the source makes the target happen. Drawn as an arrow.
- **`enables`** — the source makes the target possible without causing it.
  Never drawn.

Table `cell_dependencies`: `source_cell_id`, `target_cell_id`, `kind`, `label`,
`note`. Neither kind is `depends_on`, because both read source-first.

**need** — the `enables` kind, in the words a reader uses: a prerequisite that
does not cause anything. A cell can need a system, a piece of information, or
another cell's outcome to be in place.

> The test that separates the two: remove the other cell and ask what happens.
> If this one never starts, that was a `leads_to`. If it starts but goes wrong,
> that was an `enables`.

**status** — how far along a cell or a path is, on one shared six-value
vocabulary, the `entity_status` domain: `proposed`, `planned`, `built`,
`live`, `at_risk`, `deprecated`.
Default `live`. Paths share it deliberately; a second vocabulary for the same
question drifts from the first within a month.

**spec** — the descriptive detail hanging off a board object: not where the
thing sits, but what it *is*. A cell's position is structure; its `function`,
`form` and `value_props` are its spec. The word names the same family of fields
at four levels, and it is the answer to "what is this phase, in fields?".

| Level | Where the spec lives | Fields |
|---|---|---|
| service | table `business_models`, one row | `funding`, `pricing`, `delivery_cost`, `revenue_model`, `partners` |
| phase | columns on `phases` | `business_impact`, `operational_requirements` |
| lane | columns on `lanes` | `kpis`, `owner_team`, `tools` |
| cell | columns on `cells` | `function`, `form`, `value_props`, `owner`, `perceived_owner` |

**Scenario, step and path own no spec.** Scenario and step each open a detail
panel and fill it entirely from structure and from their cells; path has
`summary`, `note`, `kind` and `status`. Whether that is the design or the
backlog is undecided; the table above states what exists.

**Examples are not spec.** Alongside its spec row in `business_models`, the
`services` row carries `entity_examples` — a jsonb map of one authored,
free-text example per core kind (service, phase, scenario, path, step, lane),
shown under each kind's definition to ground it in this deployment (#302). It is
authored blueprint data that rides the service block, not descriptive detail
hanging off a board object, which is why it lives on `services` rather than in
the spec table above. The editing surface — an "Examples" section on the Service
panel — arrived with #312, which is when its **Examples** row joined
[`docs/reference/interface-schema-map.md`](docs/reference/interface-schema-map.md):
that map records only labels a panel puts in front of a reader, and now one does.

**The word is schema-and-code only.** `docs/plans/2026-07-30-003` D3b bans it
from the interface — *"'Spec' is internal jargon that never appears anywhere
else in the product"* — and that rule stands. It is defined here because a term
banned from the UI still has to be defined *somewhere*, and this is the file
that defines the board's words. How a spec field is written is
[`docs/reference/spec-house-style.md`](docs/reference/spec-house-style.md).

The spec columns and the four tables below both arrived in
`20260729120000_derived_layer.sql`, under one name for two unrelated things.

## The three records, and the one that is nobody's

`evidence`, `audit_findings`, `slices` and `slides` are not squares of the
board; each exists to say something *about* it. Where they name a cell they do
it **softly** — `evidence.cell_id`, `audit_findings.cell_ids`,
`slides.cell_ids`, all bare uuid with no foreign key — so that re-importing a
scenario deletes and recreates its cells without taking them along. `slices`
names no cell itself; it reaches them through its slides.

**There is deliberately no collective noun for the four.** Two were tried and
both were wrong the same way, by claiming something untrue of half the set:

- *derived layer* — only `audit_findings` is derived; a human may author a
  slice, which `20260803001000_slices_origin_allows_human.sql` exists for. And
  `layer` is the word the board retired when `layers` became `lanes`.
- *analysis tier* — evidence is source material and a slice is a presentation
  for an audience. Neither is analysis. It replaced *derived layer* in #149,
  was never wrong in a way anyone could point at, and never stuck either, which
  is the more useful signal.

What they have instead is an OWNER, and the write surface says who — because a
table's owner is whoever may change it, not whoever reads it most:

| record | written by | belongs to |
| --- | --- | --- |
| `slices`, `slides` | `create_slice`, `update_slice`, `replace_slides` | the slice |
| `audit_findings` | `create_finding`, `update_finding` | the audit |
| `evidence` | `create_evidence`, `update_evidence` | **nobody** |

**Evidence is the one with no owner**, and that is a property of the thing
rather than an omission. It is research provenance: written when a blueprint is
imported, cited by a slice, weighed by an audit, read by a what-if. A tool
writes it, but no ONE reader's work is what it is for. Naming it after the
audit would be wrong in the direction a slice would notice first.

**And nothing at all belongs to what-if**, which is worth saying rather than
leaving as an absence: it walks the dependency graph and returns a trace, on a
copy. A category covering all four was always going to strain, because one of
the four readers has nothing in it.

So write the owner you mean — *the slice's record*, *the audit's findings*,
*evidence*. Where a statement genuinely covers all four — a grant, a
migration's scope — enumerate them, which is four words against a category name
that has twice had to be replaced.

`scripts/tests/who-writes-what.test.mjs` holds the table above against
`WRITE_TOOL_NAMES`: a tool that is renamed, removed, or added without an owner
fails there rather than leaving this file quietly wrong.

`business_models` is **not** among them, though it was once listed as though it
were. It is `service_id` plus `funding`, `pricing`, `delivery_cost`,
`revenue_model` and `partners`: five fields describing the service, not a
record about the board. It is the **service's spec row** — see *spec* above.

The migration that built the four keeps the retired name in its filename,
`20260729120000_derived_layer.sql`, and always will.

**slice** — a saved cut of the board for one audience: one actor's journey, one
moment across every lane, one lane end to end, or one cell examined closely.
**A view, not a copy** — a slice references cells and never contains anything the
board does not.
Tables `slices` and `slides` (each slide carrying a `cell_ids` array — that
array is what makes it a citation rather than a duplicate).

**slide** — one screen of a slice. Table `slides`: `slice_id`, `position`,
`cell_ids`, `cell_keys`, `title`, `narrative`. What it shows is the *strip* of
the cells it cites, which is why it has no image column of its own: one held a
picture that REPLACED the strip instead of joining it, no row ever used it, and
`20260830270000` dropped it so a slide and its cells cannot disagree.
A slide's title is a `title` and not a `name` because a slide is authored
content a reader reads: **`name` is for structure a reader navigates, `title`
for authored content a reader reads**, which is the rule `20260830190000`
settled across the whole board.

**finding** — a recorded issue produced by an audit: "these two cells expect the
same tutor in two places at once". Each names the exact cells it is about.
**A finding is an open question for a human, never an automatic change**:
someone resolves it (fixed) or dismisses it (judged fine, with the system
remembering that judgment).
Table `audit_findings`: `service_id`, `run_id`, `source`, `check_key`,
`severity`, `cell_ids`, `cell_keys`, `summary`, `fingerprint` (dedupe across
runs), `status`.

**evidence** — a research artefact attached to a cell. A cell with zero evidence
rows is an *assumption*; that state is derived, never stored.

## Words this instance also uses

**canvas** — the pan/zoom surface the board is drawn on.
**compare** — the surface that puts two or more paths of one scenario against
each other.
**design mode** — the canvas mode in which cells become editable. Its opposite is
**view mode**. On the phone it does not exist at all — absent, never disabled.
**cover** — the shell's landing view, before any blueprint is open.

**change log** — the append-only record of every authoring write: what was
done, with which arguments, what would undo it, and who did it — a person, or
an agent and which of its sessions. It is **audit-only**. Nothing replays the
inverse it stores; the fast undo is the in-memory list the changes sheet reads,
and that list is emptied by a refresh while this is not.
Table `authoring_changes`.

**trash** — the deletions in the change log, which are the rows that carry a
`deleted_kind` and, with it, the payload of everything the delete destroyed.
**A view, not a table** (`trash`), so the recovery list cannot drift from the
record of what happened. It replaced `deleted_structure`, which recorded
deletions durably while every other write was remembered only until the tab
closed.

**`/sb:map`, `/sb:audit`, `/sb:whatif`, `/sb:slice`** — the four domain skills.
They are *skills*, not app surfaces, and they come from the installed `sb`
plugin (the `agentic-service-blueprinting` repo), not from this repo. Note that
**`slice` is overloaded**: `/sb:slice` is the skill that produces one, a *slice*
is the artefact it produces.

### Five words for arrival

Five words for *not there yet*, naming five different things. Two belong to the
shell, one to the canvas, one is a duration, and one is about the data rather
than the screen. They are set out together because apart they read as spellings
of one idea.

**entrance** — the shell's from-state as it arrives: `idle`, `pending`, `shown`.
`pending` lasts a single frame, and exists so that the fade which follows has
somewhere to start. Nothing is waiting on data while it runs, which is what
separates it from every other word here.

**boot** — the sidebar's once-per-entry latch: `off`, `armed`, `skeletoning`. It
answers whether this is the reader arriving or a surface they have already
loaded coming back — a question no rung of the canvas's ladder can answer,
because the canvas starts that ladder again every time it is uncovered.
`skeletoning` was called *staging* until the collision with the rung below was
named.

**revealStage** — the canvas's ladder, six rungs from `CANVAS_REVEAL_STAGING` to
`CANVAS_REVEAL_DONE`. It says how much of the board is painted and nothing about
the shell around it. The canvas is the only thing that sets it; everything else
reads it.

**hold** — `SKELETON_HOLD_MS`, 250 ms: how long a surface may load before its
skeleton is allowed to paint. **A duration, not a state** — the one word here
measured in milliseconds rather than spelled as values, and the reason a fast
load shows no placeholder at all instead of one that flashes.

**status** — what a query returned: `loading`, `ready` or `error`. It is a fact
about the data and not about the screen, so a bar can be `ready` while the
sidebar is still `skeletoning` without the two contradicting each other. **Not
the board's *status***, the six-value word for how far along a cell or a path
is: that one is stored in a column, this one only ever describes a read.

### The writing vocabulary

Five words for how a document is written and reached, shared with the sibling
repositories so that one harness review uses one language.

**pointer** — a line held in always-loaded context that names material outside
it and the branch that should reach it: a row of `AGENTS.md` § Progressive
loading, a path beside a security line. Its wording, not its target, decides
whether a session gets there. A *reference* is what a pointer points at.

**ladder** — where a piece of writing sits by how immediately a session needs
it: an in-file step, then an in-file reference, then a **disclosed** reference
behind a pointer. **Not the canvas's reveal ladder** in § Five words for
arrival, which is about how much of a board is painted.

**disclosed** — a reference pushed out of the always-loaded tier and behind a
pointer, loaded only when that pointer fires. Everything under `docs/` is
disclosed; `AGENTS.md` is the tier itself.

**leading word** — the first word of a routing item, chosen so that it is the
word carrying the branch — *writes*, *migrations*, *skills* — and front-loaded
so a scanned pointer triggers on it. `scripts/check-pointers.mjs` is what holds
it there.

**sprawl** — a document too long even when every line of it is live: attention
thins across the whole of it. The cure is the ladder rather than a shorter
sentence. Distinct from *bloat*, which is dead weight — and this file was both
at once until #365, when the rename map and the interface-to-schema map it had
grown moved out to the check and the reference that own them. What measures the
always-loaded tier's share of it is `scripts/check-router-budget.mjs`.
