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

## The analysis tier

**analysis tier** — the five tables that hold records *about* the board rather
than squares of it: `evidence`, `findings`, `slices`, `slice_items`,
`business_model`. What unites them is how they point at the board — softly, by
uuid with no foreign key — so that re-importing a scenario deletes and recreates
its cells without taking them along.
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

The reasoning, where it is worth knowing: `row` and `column` named how a lane
and a step happen to be *drawn* today, and the axis is a rendering fact rather
than a domain one. "Lifecycle" was not a level above the service — it *was* the
service, wearing a longer name. And `enables` was left alone, because it was
already the plain word for what it means.

## One permanent exemption, and one with a date on it

A rename sweep that catches every occurrence of a retired word breaks both of
these. They are here because this is where the person running that sweep looks.
The difference between them is the whole point of the section: one is a fact
about the language, and the other is a queue.

**Permanent — `evidence.proposition_question_key`.** `propositions` became
`business_model` on 2026-08-21, because that word already meant a *cell's*
value proposition. This column is not that table. It records which of the three
validation questions an evidence row answers — `understand`, `value`,
`usability` — and those three are propositions in the ordinary sense: claims
the service is betting on. The rename moved the container, not the concept.
This is the only entry here that does not expire, and #146's copy guard ships
with **zero** exemptions because the rest of them were removed rather than
documented.

**Dated, and owned by [#144](https://github.com/BilLogic/plus-uno-blueprint/issues/144)
— the breadcrumb label `'Layer: '`.** `src/lib/blueprintContract.ts` emits
breadcrumb segments labelled `Phase · Scenario · Path · Step · Layer`. All
**808 corpus chunks** carry `"Layer: …"` inside their *stored title*, and the
title is part of the **embedded** text, so flipping the label strands every
embedding until a full re-embed. The parser accepts both spellings through the
contract's `breadcrumb.aliases`. It flips to `Lane` in the same change that
re-embeds the corpus, and not before. See
[`docs/connectors/plus-uno.md`](docs/connectors/plus-uno.md).

That is an **ordering constraint with a ticket and an owner**, not standing
permission. It was written here as an "exception" once and read as one for six
months, which is how a two-week sequencing note turned into a protected name.
When #144 closes, this entry goes with it.

The list used to have a second permanent entry, "derived layer". It does not
any more: the tier was renamed to the **analysis tier** rather than exempted,
because a rename removes the collision and an exemption only records it. See
[The analysis tier](#the-analysis-tier).
