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
Table `scenarios`: `phase_id`, `name`, `summary`, `position`, `view_type`.

**path** — a variant route through one scenario: the happy path where everything
works, plus the detours. A path is an **alternative, not a stage** — nothing
connects across paths.
Table `paths`: `scenario_id`, `name`, `path_type`, `summary` (the "applies when"
condition), `note`.
`path_type` is exactly three values: `happy`, `variant`, `exception`.

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
Table `cells`: `path_id`, `lane_id`, `step_id`, `content`, `summary`,
`function`, `form`, `value_props`, `owner`, `perceived_owner`, `links`,
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
carries `prominence` (`core` or `peripheral`), which sits here rather than on
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
`screenshot`, `url`, `prominence`, `origin`.

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
| service | table `business_model`, one row | `funding`, `pricing`, `delivery_cost`, `revenue_model`, `partners` |
| phase | columns on `phases` | `business_impact`, `operational_requirements` |
| lane | columns on `lanes` | `kpis`, `owner_team`, `tools` |
| cell | columns on `cells` | `function`, `form`, `value_props`, `owner`, `perceived_owner` |

**Scenario, step and path own no spec.** Scenario and step each open a detail
panel and fill it entirely from structure and from their cells; path has
`summary`, `note`, `path_type` and `status`. Whether that is the design or the
backlog is undecided; the table above states what exists.

**The word is schema-and-code only.** `docs/plans/2026-07-30-003` D3b bans it
from the interface — *"'Spec' is internal jargon that never appears anywhere
else in the product"* — and that rule stands. It is defined here because a term
banned from the UI still has to be defined *somewhere*, and this is the file
that defines the board's words. How a spec field is written is
[`docs/reference/spec-house-style.md`](docs/reference/spec-house-style.md).

The columns and the analysis tier below both arrived in
`20260729120000_derived_layer.sql`, under one name for two unrelated things.
Only the tier took a new name when that one was retired.

## The analysis tier

**analysis tier** — the four tables that hold records *about* the board rather
than squares of it: `evidence`, `findings`, `slices`, `slice_items`. What unites
them is aboutness: each one exists to say something concerning the board, and
none of them is part of it.

Where they name a cell they do it **softly** — `evidence.cell_id`,
`findings.cell_ids`, `slice_items.cell_ids`, all bare uuid with no foreign key —
so that re-importing a scenario deletes and recreates its cells without taking
them along. `slices` names no cell itself; it reaches them through its items.

`business_model` is **not** in the tier, though it was listed in it. It is
`service_id` plus `funding`, `pricing`, `delivery_cost`, `revenue_model` and
`partners`: five fields describing the service, not a record about the board.
It is the **service's spec row** — see *spec* above.
Formerly the *derived layer*, a name that was wrong twice: only `findings` is
actually derived (a human may author a slice — `20260803001000_slices_origin_allows_human.sql`
exists for exactly that), and "layer" is the word the board retired when
`layers` became `lanes`. The migration that built the tier keeps the old name
in its filename, `20260729120000_derived_layer.sql`, and always will.

**slice** — a saved cut of the board for one audience: one actor's journey, one
moment across every lane, one lane end to end, or one cell examined closely.
**A view, not a copy** — a slice references cells and never contains anything the
board does not.
Tables `slices` and `slice_items` (the frames, each carrying a `cell_ids` array
— that array is what makes it a citation rather than a duplicate).

**finding** — a recorded issue produced by an audit: "these two cells expect the
same tutor in two places at once". Each names the exact cells it is about.
**A finding is an open question for a human, never an automatic change**:
someone resolves it (fixed) or dismisses it (judged fine, with the system
remembering that judgment).
Table `findings`: `run_id`, `source`, `check_name`, `severity`, `cell_ids`,
`note`, `fingerprint` (dedupe across runs), `status`.

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
| `slices.description`, `findings.note`, `cell_dependencies.label` | `slices.summary`, `audit_findings.summary`, `cell_dependencies.name` | `20260830190000` |
| `paths.path_type`, `slices.slice_type`, `scenarios.view_type` | `paths.kind`, `slices.kind`, `scenarios.layout` | `20260830190000` |
| `findings`, `findings.check_name` | `audit_findings`, `audit_findings.check_key` | `20260830190000` |
| `slices.origin`, `business_model` | `slices.authorship`, `business_models` | `20260830190000` |

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

**The last row is the only one enforced somewhere else, and it has to be.** The
three checks these entries feed match a retired word as a SUBSTRING of an
identifier, and the retired word here is `note` — which `paths.note`,
`cell_dependencies.note` and `findings.note` all still carry correctly, because
all three genuinely are asides. Enforcing `note` would fail the series on those
three; enforcing `stakeholders.note` would match nothing, since the identifier
sweep reads a bare column name and never a qualified one. So this row's
`retired` and `copy` lists are empty on purpose and the rename is enforced by
[`scripts/tests/stakeholder-summary.test.mjs`](scripts/tests/stakeholder-summary.test.mjs),
against the one table it concerns.

The last four rows are one pass, and two rules decide all of it. **`name` is
for structure a reader navigates; `title` is for authored content a reader
reads** — which is why `slices.title` and `evidence.title` are not in the
table. **`summary` is the entity's own one-liner** — not an aside about it, so
`findings.note` was misnamed and `paths.note`, which genuinely is an aside, was
not. Classifiers settle on `kind`; `scenarios.view_type` is not a kind but a
display setting, so it is `layout`. `slices.origin` is renamed rather than
aligned because its vocabulary (`generated`, `customized`, `human`) answers a
different question from every other `origin` (`import`, `app`) — that word is
now free for `services`, which gained it in the same migration.

**Four of these renames are not in the enforced map's word lists**, and the
reason is structural. `audit_findings` contains `findings` and
`business_models` contains `business_model`, so no substring distinguishes the
old name from the new one; `label`, `note` and `origin` all remain live,
correct names on other tables. Those four are held by
`scripts/tests/one-spelling-each.test.mjs`, which names them table-qualified.

**One column is a deliberate exception.** `cells.content` keeps a word of its
own: a cell's text is a sentence somebody wrote about a moment, not a name for
the cell and not a one-line summary of something longer. The column's own
comment says so, and the same test asserts the comment is still there.

## One permanent exemption

A rename sweep that catches every occurrence of a retired word breaks this one.
It is here because this is where the person running that sweep looks. There was
a second entry until 2026-08-26, and the difference between the two is the
lesson worth keeping: one is a fact about the language, the other was a queue
that had stopped moving.

**Permanent — `evidence.proposition_question_key`.** `propositions` became
`business_model` on 2026-08-21, because that word already meant a *cell's*
value proposition. This column is not that table. It records which of the three
validation questions an evidence row answers — `understand`, `value`,
`usability` — and those three are propositions in the ordinary sense: claims
the service is betting on. The rename moved the container, not the concept.
This is the only entry here that does not expire, and #146's copy guard ships
with **zero** exemptions because the rest of them were removed rather than
documented.

Two entries have left this list, and how each left is the point.

**"Derived layer" was renamed, not exempted.** The tier is the **analysis
tier** now, because a rename removes the collision and an exemption only
records it. See [The analysis tier](#the-analysis-tier).

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
