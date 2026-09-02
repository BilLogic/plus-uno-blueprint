# Vocabulary

The words this codebase fixes, and what each one is bound to in the schema.

**This file is definitions and nothing else.** No architecture, no process, no
opinions about how to work. If a sentence here starts explaining *how the app
does* something rather than *what a word means*, it belongs somewhere else and
should be moved. That constraint is the file's whole value: an agent or a person
can read it end to end before touching anything, and it stays readable because
it never grows a second job.

How to *read* the artifact these words describe — what to look at first, what
the layout is telling you — is
[`docs/product/03-reading-a-blueprint.md`](docs/product/03-reading-a-blueprint.md).
Where the schema and access model are described in full is
[`docs/engineering/access-and-security.md`](docs/engineering/access-and-security.md).

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
service. It belongs to the **service**, not to a cell, so renaming it once
moves every place it appears.
Table `touchpoints`: `service_id`, `name`, `kind`, `summary`, `url`,
`stakeholder_id`, `origin`.

**placement** — one touchpoint, used at one cell, this way. The catalog owns
the name; the placement owns the per-moment `summary`, `screenshot` and `url`,
because the same tool describes a different screen at a different step. It also
carries a `role` (`core` or `peripheral`), which sits here rather than on
the catalog because the same artifact is central at one moment and incidental
at another.
Table `cell_touchpoints`: `cell_id`, `touchpoint_id`, `position`, plus those.

**unplaced touchpoint detail** — a piece of writing about a touchpoint that
names nothing its cell shows. It is **not a placement**: nothing draws it, and
it has no touchpoint to point at, which is the whole reason it is waiting. A
work queue, resolved one row at a time by a person deciding which of the cell's
touchpoints the writing was about, or that it is not worth keeping. **Nothing
here is ever placed automatically** — assigning a detail to the touchpoint its
name resembles is what made 57 of them unreachable.
Table `unplaced_touchpoint_details`: `cell_id`, `name` (the name the detail
claims, and the one thing that must never decide anything), `summary`,
`screenshot`, `url`, `role`, `origin`.
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
Table `resources`: `cell_id` **or** `cell_touchpoint_id` — never both, and
never neither — plus `kind`, `name`, `url`, `position`, `origin`. Attaching one
to a placement rather than to the cell is how a design link belongs to the tool
it documents rather than to the moment at large.

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
vocabulary: `proposed`, `planned`, `built`, `live`, `at_risk`, `deprecated`.
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
content a reader reads — the rule the last four rows of the rename map settle.

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

---

## The rename map — fixed vocabulary

A domain rename landed across twelve commits during an audit, and nobody could
point at where the terms were defined. Here is where. **These are the current
names.**

This file used to add "and the old ones survive nowhere in the schema", which
was never true and is the sentence that let the residue hide. `alter table …
rename` moves the table and the column and nothing else: the index, the
constraint, the policy, the trigger and the comment all keep the name they were
created with. Twenty-two such objects still carried retired words when
production was swept on 2026-08-26 (#142); `20260826110000` renames them and
asserts against the catalogue that none is left. Making the next rename
remember is #145's job, not this paragraph's.

| Was | Is | Migration |
|---|---|---|
| `layers` (table), `layer_role`, `cells.layer_id` | `lanes`, `lane_role`, `cells.lane_id` | `20260820120000` |
| `cell_triggers` | `cell_dependencies` | `20260820100000` |
| `sets_off` (dependency kind) | `leads_to` | `20260820180000` |
| `service_scenarios`, `service_lifecycles`, `*_service_scenario_id`, `*_service_lifecycle_id` | `scenarios`, `services`, `scenario_id`, `service_id` | `20260820140000`, `20260821340000` |
| `row_position`, `column_position`, `slot_position`, `order_position` | `position` | `20260820130000` |
| `cells.maturity` | `cells.status`, on the `entity_status` domain | `20260821240000` |
| `propositions` | `business_model` | `20260821350000` |
| `stakeholders.note` | `stakeholders.summary` | `20260830170000` |
| `frontstage_tech`, `backstage_tech` | `frontstage_touchpoints`, `backstage_touchpoints` | `20260830150000` |
| `tech_description` | `cell_touchpoints` | `20260830140000` |
| `paths.description`, `cells.description`, `phases.description`, `scenarios.description`, `services.description` | `paths.summary`, `cells.summary`, `phases.summary`, `scenarios.summary`, `services.summary` | `20260820080000`, `20260820090000`, `20260820160000`, `20260821350000` |
| `slices.description`, `findings.note`, `cell_dependencies.label` | `slices.summary`, `audit_findings.summary`, `cell_dependencies.name` | `20260830190000` |
| `paths.path_type`, `slices.slice_type`, `scenarios.view_type` | `paths.kind`, `slices.kind`, `scenarios.layout` | `20260830190000` |
| `findings`, `findings.check_name` | `audit_findings`, `audit_findings.check_key` | `20260830190000` |
| `slices.origin`, `business_model` | `slices.authorship`, `business_models` | `20260830190000` |
| `visual` | `storyboard` | `20260830270000` |
| `cells.picture` | `cells.frame` | `20260830270000` |
| `slice_items`, `slice_items.caption` | `slides`, `slides.title` | `20260830270000` |
| `cells.links` | `resources`, `evidence` | `20260830280000` |
| `cell_touchpoints.prominence`, `unplaced_touchpoint_details.prominence` | `cell_touchpoints.role`, `unplaced_touchpoint_details.role` | `20260902110000` |
| `scenarios.layout = 'single'` | `scenarios.layout = 'stacked'` | `20260902120000` |
| `text` (label) | `Content` — `cells.content` | — |
| `value` (label) | `Value proposition` — `cells.value_props` | — |
| `columns` (label) | `Position` — `path_steps.position` | — |
| `applies when` (label) | `Summary` — `paths.summary` | — |
| `pill`, `chip` (design system) | `badge`, `tag` | — |

The reasoning, where it is worth knowing: a "tech" lane never held only
technology — a printed guide, a poster, a phone line and a Zoom recording were
all filed there, and four authored details had escaped onto Support Actions
cells because the name said they did not belong. A touchpoint also stopped
being a string: it was a name in `cells.content` whose detail lived in
`cells.links` under a matching label, and when the two stopped agreeing the
detail was simply not found — 57 of 117 were in that state. `row` and `column`
named how a lane and a step happen to be *drawn* today, and the axis is a rendering fact rather
than a domain one. "Lifecycle" was not a level above the service — it *was* the
service, wearing a longer name. And `enables` was left alone, because it was
already the plain word for what it means. A stakeholder's `note` held a
definition on all eighteen rows — "Who the tutoring is for", "The tutor running
a session" — and `summary` is this vocabulary's word for an entity's own
one-liner, while `note` is an author's aside about one.

**The `stakeholders.note` row is enforced somewhere else, and it has to be.** The
three checks these entries feed match a retired word as a SUBSTRING of an
identifier, and the retired word here is `note` — which `paths.note`,
`cell_dependencies.note` and `findings.note` all still carry correctly, because
all three genuinely are asides. Enforcing `note` would fail the series on those
three; enforcing `stakeholders.note` would match nothing, since the identifier
sweep reads a bare column name and never a qualified one. So that row's
`retired` and `copy` lists are empty on purpose and the rename is enforced by
[`scripts/tests/stakeholder-summary.test.mjs`](scripts/tests/stakeholder-summary.test.mjs),
against the one table it concerns.

The four `20260830190000` rows are one pass, and two rules decide all of it. **`name` is
for structure a reader navigates; `title` is for authored content a reader
reads** — which is why `slices.title` and `evidence.title` are not in the
table. **`summary` is the entity's own one-liner** — not an aside about it, so
`findings.note` was misnamed and `paths.note`, which genuinely is an aside, was
not. Classifiers settle on `kind`; `scenarios.view_type` is not a kind but a
display setting, so it is `layout` — and since `20260902120000` a setting that
is stored, `stacked` or `merged`, its old `single` value folded into `stacked`
because a one-path board was never a different board. `slices.origin` is renamed rather than
aligned because its vocabulary (`generated`, `customized`, `human`) answers a
different question from every other `origin` (`import`, `app`) — that word is
now free for `services`, which gained it in the same migration.

**Four of these renames are not in the enforced map's word lists**, and the
reason is structural. `audit_findings` contains `findings` and
`business_models` contains `business_model`, so no substring distinguishes the
old name from the new one; `label`, `note` and `origin` all remain live,
correct names on other tables. Those four are held by
`scripts/tests/one-spelling-each.test.mjs`, which names them table-qualified.

The three `20260830270000` rows are one pass too, and one rule decides all of
it: **a name says what the thing is for, not what it is made of.** `visual`
said the lane holds pictures, which is the least interesting thing about a row
sitting beside `customer_actions` and `support_actions`; `picture` said the
same thing one level down, about a column. So the lane is a **storyboard**, one
image on one cell is a **frame**, and a step's frames read across the lanes are
a **strip** — see the definitions above, which is where the vocabulary lives.
`slice_items` named a slide by its relationship to its parent, the shape
`layers` had before it was `lanes`, and a slide's `caption` becomes a `title`
under the rule the paragraph above settles.

**Two of that pass are not in the enforced word lists either, for the two
usual reasons.** `slice_items.caption` cannot be a fragment because `caption`
is a live, correct English word — `steps.summary` is *displayed* as one, and
that comment says so. And `slice_items.illustration` is not in the table at
all, because it was dropped rather than renamed: it held an image that
REPLACED a slide's strip instead of joining it, and no row ever set it. Both
are held by
[`scripts/tests/a-frame-a-strip-and-a-slide.test.mjs`](scripts/tests/a-frame-a-strip-and-a-slide.test.mjs),
which also holds the one thing no schema check can see — that no word on
screen calls a slide a frame.

**`cells.links` is the last row, and it is not in the word lists either.**
`links` is an ordinary English word the sweep would hit across the tree; the
hand-written fallback blueprints in `src/data` still carry a `links` array and
must, because `cellResources.ts` and `cellTouchpoints.ts` both read it; and
`search_blueprint` still emits an output column of that name, because uno-bot
reads it by key. What retired is the ARRANGEMENT — one column holding
resources, touchpoint detail and provenance citations under a name describing
one of them — and that is held by
[`scripts/tests/cell-resources.test.mjs`](scripts/tests/cell-resources.test.mjs),
which replays the series, asserts the column is gone and the table that
replaced it carries its one-owner constraint, and proves each finding goes red.

**One column is a deliberate exception.** `cells.content` keeps a word of its
own: a cell's text is a sentence somebody wrote about a moment, not a name for
the cell and not a one-line summary of something longer. The column's own
comment says so, and the same test asserts the comment is still there.

**The last five rows are a different kind of row, and the table says so in the
left column.** Every row above renames something in the database and the
interface follows. These do the opposite: the column was already right, and the
LABEL above it was saying a word no query could find. So there is no migration —
`cells.content`, `cells.value_props`, `path_steps.position` and `paths.summary`
were all correct while the panel said Text, Value, Columns and Applies when —
and the `Is` column carries two things: the word a reader now sees, and the
column it names. They are kept in the same table as the schema→schema rows
rather than beside them, because a reader looking up a word should not first
have to know which kind of rename it was. These five are the label renames
[#171](https://github.com/BilLogic/plus-uno-blueprint/issues/171) asked for;
the MAP it asked for — every current label and the name behind it, not only the
ones that moved — is [The interface→schema map](#the-interfaceschema-map)
below.

`column` and `applies when` are enforced as retired copy: neither is said
anywhere else on screen, so a reintroduction fails
[`scripts/tests/retired-copy.test.mjs`](scripts/tests/retired-copy.test.mjs).
`text` and `value` cannot be, for the reason four other rows here cannot —
"Text size", "Add text…" and "Delete text" on the annotation toolbar are correct
uses of the first, and the second is an ordinary English word the copy guard's
deliberately naive JSX extraction meets inside expressions. Those two are held
by [`scripts/tests/labels-name-their-columns.test.mjs`](scripts/tests/labels-name-their-columns.test.mjs),
which narrows the SUBJECT to panel labels — the `label`, `term` and `title`
props of the four components that put a field's name in front of a reader — and
is therefore narrow enough to say `Text` without saying it about "Text size".
The same test asserts the half no schema check can see: that the column each
label now names is a column the schema actually has, so a label cannot be
"fixed" by pointing it at a second word that is also not there.

**"Proposition" is now retired in the plural only, and that is a narrowing of
the spelling rather than of the rule.** `propositions` was a TABLE, and it was
renamed *because* the word already meant a cell's value proposition — the
rename moved the container and left the concept where it was. `cells.value_props`
still holds value propositions, `evidence.proposition_question_key` still
records which proposition an evidence row answers (see [One permanent
exemption](#one-permanent-exemption) below, which makes exactly this
distinction), and the panel now says **Value proposition** where it used to say
Value. Forbidding the singular on screen would forbid the word the rename was
performed in order to protect. The identifier fragment is untouched, because a
database object spelled `proposition` really is the retired one.

**The design system's own vocabulary is the last row, and it enforces from a
test rather than from here.** Four words had grown for two ideas. A **badge**
describes the thing it sits on: one per thing, not drawn from a set, never
interactive — the divider label, a cell's status, a lane's stakeholder. A
**tag** is one value out of a set, selectable or removable, and the owner
control is the only one in the app. "Chip" and "pill" were a third and fourth
name for those two, so a touchpoint is now a cell whose corner radius is a
variant rather than a component with a duplicate `Button` variant of its own.
No database object was ever called either word, so the identifier list is empty;
[`scripts/tests/badge-and-tag.test.mjs`](scripts/tests/badge-and-tag.test.mjs)
carries it, over every NAME under `src` and over one rule about behaviour —
**no badge changes colour or border on hover**, because a surface that repaints
under the pointer promises a click a badge never delivers. What a badge keeps is
the help cursor, the focus ring and the tooltip.

### A third spelling, for the fills

`retired` is how a name is written as a database identifier and `copy` is how
it is written for a reader. There is a third, and a word escaped through the
gap before anyone named it: `frontstage_tech` became `frontstage_touchpoints`
in the schema, and the fill kept saying `frontstage-tech` in
`blueprintCellStyle.ts` and `blueprint.css` for a fortnight.

Three guards looked straight at it and each declined for a reason correct on
its own. `check:identifiers` sweeps database identifiers, and a CSS attribute
value is not one. The identifier sweep matches substrings, and the fragment has
an underscore where the fill has a hyphen. `check:copy` reads what a person
reads, and nobody reads an attribute selector. Nothing was broken — the seam
was uncovered.

`RETIRED_PRESENTATION_SPELLINGS` derives the hyphenated form from `retired`,
mechanically, for the same reason `copy` is derived: a hand-kept third list
could disagree with the first two, and a vocabulary with two spellings of one
word is what this whole file exists to prevent.
[`scripts/tests/presentation-keys.test.mjs`](scripts/tests/presentation-keys.test.mjs)
holds the fill vocabulary to it, and holds the stylesheet and the module to
each other.

**A fill is a palette slot, not a role.** Several lane names point at one fill —
`Frontstage Actions` borrows `frontstage-touchpoint` in the legacy name-keyed
map, and `backstage_touchpoints` takes the `evidence` fill in the role-keyed
one. So the check asks that a fill name contains no retired word; it does not
ask that a fill be named after whichever role happens to use it.

## The interface→schema map

Every word a panel puts in front of a reader, and the name behind it. The
rename map above records the words that **changed**; this records what every
current word is **bound to**, the agreements included. A table of divergences
alone cannot say that the rest are fine — "not listed" would mean both
"aligned" and "nobody looked", and that ambiguity is the state
[#171](https://github.com/BilLogic/plus-uno-blueprint/issues/171) was raised
about: *"how come we have inconsistent naming from front and backend again
(i.e., resources vs. links)?"* The complaint was never that the words differ.
It was that no document said which of the differences were on purpose.

The interface word is a **panel label** — the `label`, `term` and `title` props
of the five components that put a field's name in front of a reader. The schema
word is a `table.column`, or a bare table where the label heads a whole
relation rather than one field of it. The two **agree** when they are the same
word once case, spaces and a foreign key's `_id` are set aside; singular and
plural agree too, because the label over a relation names the thing and the
table names the collection. Anything further apart than that owes the third
column a reason.

| The interface says | The schema says | Why they differ |
|---|---|---|
| **Content** | `cells.content` | — |
| **Summary** | `cells.summary`, `cell_touchpoints.summary`, `paths.summary`, `phases.summary`, `scenarios.summary`, `services.summary`, `steps.summary` | — |
| **Status** | `cells.status`, `paths.status` | — |
| **Owner** | `cells.owner` | — |
| **Perceived owner** | `cells.perceived_owner` | — |
| **Function** | `cells.function` | — |
| **Form** | `cells.form` | — |
| **Value proposition** | `cells.value_props` | `props` abbreviates this exact phrase and no other. A label is read once and a name is typed daily, so the panel spells out what the schema shortens. Singular on purpose: a cell has one value proposition, stated once per audience — each row is a `for` and a `value` — and the plural on the column counts those statements, not separate propositions. |
| **Touchpoint** | `touchpoints` | — |
| **Screenshot** | `cell_touchpoints.screenshot` | — |
| **Design link** | `cell_touchpoints.url` | A placement carries two URLs — this one and `screenshot` — so `url` alone cannot say which field a reader is standing in, and it is not a word a panel says out loud. The label names what this one is for. |
| **Role** | `cell_touchpoints.role` | — |
| **Stakeholder** | `lanes.stakeholder_id` | — |
| **Owner team** | `lanes.owner_team` | — |
| **KPIs** | `lanes.kpis` | — |
| **Tools** | `lanes.tools` | — |
| **Business impact** | `phases.business_impact` | — |
| **Operational requirements** | `phases.operational_requirements` | — |
| **Paths** | `paths` | — |
| **Author note** | `paths.note` | `note` is this vocabulary's word for an author's aside, and the label says whose aside it is because it sits directly under Summary, which is the path's own sentence. That distinction is worth a word on screen and not worth a second column. |
| **Funding** | `business_models.funding` | — |
| **Pricing** | `business_models.pricing` | — |
| **Delivery cost** | `business_models.delivery_cost` | — |
| **Revenue model** | `business_models.revenue_model` | — |
| **Partners** | `business_models.partners` | — |
| **Position** | `path_steps.position` | — |
| **Storyboard** | `lanes.lane_role` | The one row whose right-hand side is a VALUE rather than the name of a place to put one: `storyboard` is one of the eight `lane_role` admits, and this label heads the frames of the lane carrying it. The word is in the schema; it is simply not a column name. |

Four rows out of twenty-seven, and each one a decision rather than an accident.
That is the claim the table exists to make checkable, and
[`scripts/tests/labels-name-their-columns.test.mjs`](scripts/tests/labels-name-their-columns.test.mjs)
checks it four ways: every panel label has a row, every row is a label some
panel still says, every row names something the replayed schema has, and a
divergent row carries a reason while an aligned row does not. The last pair is
the one worth stating out loud. A reason recorded about a label that never
diverged reads as a decision and settles nothing, and a reason column with
decoration in it is a column readers learn to skip — taking the four real ones
with it.

Two of the four are the same shape, and it is the shape worth recognising when
the fifth arrives. `url` and `note` are ordinary words several tables carry,
naming what a value IS; **Design link** and **Author note** name what this
particular one is FOR. A column shared across tables cannot say which of them a
reader is standing in, and renaming it to the label would make it wrong on the
next table that needs it. The other two are one-offs: `value_props` abbreviates
its label, and `lane_role` holds its label as a value.

**The subject is panel labels, and that is narrower than "words on screen" on
purpose.** *Spec* never reaches the interface at all — the entry above says so
and why. *Line of visibility* and *strip* reach it as drawings rather than as
the name of a field, and are derived at render time from `lane_role` and from
the frames of a step, so there is nothing to bind them to. A word that heads no
field has no name to be bound to, and a rule pretending otherwise would be a
rule nobody could satisfy.

**The enforced half is a second list, deliberately, exactly as the rename map's
is.** `LABEL_COLUMNS` in that test file is what CI reads; this table is what a
person reads; neither derives from the other, and a parity test fails when they
disagree. The argument is the one the rename map already makes: a prose
document should not be load-bearing for a build, and a documented map that has
drifted from the enforced one is a lie in the file people trust to learn the
vocabulary.

## One permanent exemption

A rename sweep that catches every occurrence of a retired word breaks this one.
It is here because this is where the person running that sweep looks. There was
a second entry until 2026-08-26, and the difference between the two is the
lesson worth keeping: one is a fact about the language, the other was a queue
that had stopped moving.

**Permanent — `evidence.proposition_question_key`.** `propositions` became
`business_model` (today `business_models`) on 2026-08-21, because that word already meant a *cell's*
value proposition. This column is not that table. It records which of the three
validation questions an evidence row answers — `understand`, `value`,
`usability` — and those three are propositions in the ordinary sense: claims
the service is betting on. The rename moved the container, not the concept.
This is the only entry here that does not expire, and #146's copy guard ships
with **zero** exemptions because the rest of them were removed rather than
documented.

Two entries have left this list, and how each left is the point.

**"Derived layer" was renamed, not exempted.** A rename removes the collision
where an exemption only records it. The replacement was then dropped as well,
for a reason worth keeping: no one word was true of all four tables. See
[The three records, and the one that is nobody’s](#the-three-records-and-the-one-that-is-nobodys).

**The breadcrumb label `'Layer: '` was sequenced, and then the sequence ran.**
It was a real ordering constraint: the label sits inside every *stored* chunk
title, the stored title is part of the **embedded** text, and flipping it
without a full re-embed strands the whole index. But it was written here as an
"exception" and read as one for six months — a two-week sequencing note aged
into a protected name, which is why this section now insists a dated entry
carry an issue number and an owner. `20260826140000` flips the label in the
view and the RPC, the corpus was re-embedded in the same change, and the
contract's `breadcrumb.aliases` — the mechanism that let both spellings parse
across the window — went back to empty
([#144](https://github.com/BilLogic/plus-uno-blueprint/issues/144)). What
`search_blueprint` still accepts is the `'layer'` **granularity value**, which
is a different gate — uno-bot's vendored copy of the contract syncing — and it
is carried as a dated exemption in
[`scripts/check-retired-identifiers.mjs`](scripts/check-retired-identifiers.mjs),
not here. See [`docs/connectors/plus-uno.md`](docs/connectors/plus-uno.md).
