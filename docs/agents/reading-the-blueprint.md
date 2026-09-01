---
summary: What the blueprint holds, entity by entity, and how to retrieve from it — the account this repo owns and uno-bot vendors, so a rename changes one file rather than two repos' prose.
---

# Reading the blueprint

The blueprint is a service blueprint: one service, laid out as a grid you read
by containment. This file says what each thing IS, what it holds, and what its
values are allowed to be. It is the account **this repo owns**, because this
repo owns the schema — uno-bot vendors it, and its `--check` sync fails when
the two copies part.

**Two rules govern edits here.**

Every schema name is written **qualified** — `cells.summary`, never a bare
`summary`. `check:contract:live` probes each one against the live database, so
a name that moved fails a check instead of quietly telling an agent to read a
column that is gone. A bare backticked word is prose and is not checked.

**No instance inventory.** How many phases there are, what the paths are
called, which scenarios are thin — all of that is a query, and a copy of it
here goes stale without saying so. Vocabulary is a contract; inventory is a
bug.

## The shape

```
service → phase → scenario → path → (lane × step) → cell
```

Containment, left to right. A **scenario** is one situation the service has to
handle; a **path** is one route through it; **lanes** are its rows and
**steps** its columns; a **cell** is what happens where a row meets a column on
that route.

Two traps in the words themselves. A `steps` row is a blueprint **column** — a
moment in the journey — not a phase. And a slot can hold **more than one
cell**, ordered by `cells.position`, so never assume one cell per intersection.

## service

`services.name`, `services.summary`. One row; everything else hangs off
`services.id`. Rarely worth reading directly.

## phase

A stretch of the service in time. `phases.name`, `phases.summary`,
`phases.position` for order, and `phases.loops_to_phase_id` when a phase sends
people back to an earlier one. `phases.business_impact` and
`phases.operational_requirements` carry the service-level why.

**The phase in a citation comes from a queried `phases` row.** Not from the
asker's wording, and not from a scenario name that sounds like a phase.

## scenario

One situation inside a phase. `scenarios.name`, `scenarios.summary`,
`scenarios.position`.

`scenarios.layout` is `single` or `stacked` — how the scenario's paths are
drawn. A third token, `merged`, is a display state the app computes and the
CHECK will not store. An older vocabulary of `single` / `side-by-side` /
`integrated` was deleted rather than translated.

## path

One route through a scenario.

`paths.kind` is `happy`, `variant` or `exception`. Exactly one `happy` per
scenario, so "the main route for X" is a single query and needs no name
matching. `variant` is equally normal and chosen by a CONDITION; `exception` is
a rule or a failure diverting the route. They are not degrees of the same
thing.

`paths.name` says the **condition**, not the activity — the scenario already
named the activity. So a path name is only meaningful beside its scenario, and
the same name recurs under different scenarios meaning different things.
**Never quote a path name without its scenario**, and never merge a `happy`
path and an `exception` into one answer.

`paths.summary` is the condition in prose; `paths.note` is the author's aside.

## step

One column of the board: a moment, read down every lane at once.
`steps.name`, `steps.summary`, scoped to a scenario by `steps.scenario_id`.

The same step sits at a different place in different paths, which is why
position lives on the join: `path_steps.position`, keyed by
`path_steps.path_id` and `path_steps.step_id`.

## lane

One row: a kind of participant, or a place the work happens.

`lanes.lane_role` is the closed vocabulary — `customer_actions`,
`frontstage_actions`, `backstage_actions`, `partner_actions`,
`frontstage_touchpoints`, `backstage_touchpoints`, `support_actions`,
`storyboard`. `lanes.name` is this instance's label for it; the role is the
word that travels.

**Mis-attribution is the most common error against this data.** A back-stage
action is not something the customer does, and a touchpoint lane is a surface,
not an actor. A multi-actor question spans the relevant rows — a one-lane
answer to a multi-actor question is incomplete, not merely brief.

`lanes.owner_team`, `lanes.kpis` and `lanes.tools` carry the operational side;
`lanes.stakeholder_id` points at who the lane is.

## cell

The evidence, at one (path × lane × step) slot.

**Four places carry it**: `cells.content` (the grid label, never empty),
`cells.summary` (the longer detail), `cells.frame` (an image reference), and
the `resources` table joined on `resources.cell_id`. A cell can hold real
evidence with a thin `content`, and many do — **check all four before calling a
topic empty**. Never infer a fact from an image filename or a link label
without opening the resource.

The spec columns answer "what is this and who owns it": `cells.function`,
`cells.form`, `cells.value_props`, `cells.owner`, `cells.perceived_owner`.

`cells.status` and `paths.status` share one domain: `proposed` (designed, may
never happen) · `planned` (decided and scheduled) · `built` (code exists, not
the live route yet) · `live` (today, and the default) · `at_risk` (live and
measurably failing) · `deprecated` (live and going away).

**`status <> 'live'` is the whole test for future state.** One predicate, on a
column, for both paths and cells. There is no name convention: `Planned:` and
`Prototype:` name prefixes were removed on 2026-08-21 and matching on one finds
nothing. Cell prose on unbuilt rows may still open `PLANNED (…)` — that is
legacy text, and the column is authoritative.

`cells.cell_key` is the stable IR key-path, which is how slices, findings and
evidence survive a re-import.

## cell_dependencies

One cell leads to or enables another. `cell_dependencies.kind` is `leads_to`
(the source makes the target happen) or `enables` (the target must already be
true for the source to work). **They are not inverses** — a precondition
causes nothing, so an `enables` edge narrated as one thing leading to another
misstates the blueprint.

`cell_dependencies.name` is the author's why-line when there is one. Edges are
ONE HOP: they name neighbours worth checking, not an impact analysis.

## resources

What a cell points at — `resources.name`, `resources.url`, `resources.kind`
(`link` or `other`). It replaced a JSONB array on cells that held three
unrelated things at once. Each row hangs off `resources.cell_id` **or**
`resources.cell_touchpoint_id`, never both.

## touchpoints

The service's registry of surfaces and systems — one row per named thing, not
per appearance. `touchpoints.name`, `touchpoints.summary`, `touchpoints.url`,
`touchpoints.stakeholder_id`, and `touchpoints.kind` from `app`, `document`,
`physical`, `channel`, `service`, `other`.

Where each one appears is `cell_touchpoints`, joined on
`cell_touchpoints.cell_id` and `cell_touchpoints.touchpoint_id`, carrying
`cell_touchpoints.summary` for detail specific to that placement,
`cell_touchpoints.url`, `cell_touchpoints.screenshot`, and
`cell_touchpoints.prominence` (`core` or `peripheral`).

This is the layer that answers "where do we use X" as a question about the
whole journey rather than about one cell. `unplaced_touchpoint_details` is a
holding pen for detail that never resolved to a named touchpoint — read it only
when asked about the gap itself.

## stakeholders

Who a lane or a touchpoint is. `stakeholders.name`, `stakeholders.summary`,
`stakeholders.aliases`, `stakeholders.parent_id` to roll a sub-team into its
parent, and `stakeholders.kind` from `recipient`, `staff`, `partner`,
`provider`, `team`.

## slices and slides

A **slice** is a view someone already cut for an audience: `slices.title`,
`slices.actor`, `slices.summary`, `slices.locale`. `slices.kind` is `journey`,
`step`, `lane`, `cell` or `custom`; `slices.authorship` is `generated`,
`customized` or `human`.

Its **slides** are the ordered contents — `slides.title`, `slides.narrative`,
`slides.cell_ids`, `slides.position`.

When one exists for the audience being asked about, point at it rather than
composing a substitute.

## audit_findings

Results already recorded against cells by an audit. `audit_findings.check_key`
names the check, `audit_findings.severity` is `info` / `warn` / `critical`,
`audit_findings.status` is `open` / `resolved` / `dismissed`, and
`audit_findings.summary` is the finding. `audit_findings.cell_ids` says which
cells.

Only `open` is worth surfacing: dismissed stays dismissed, and re-raising one
re-litigates a call the team already made. Triaging is a WRITE and belongs in
the app.

## evidence

The sources behind a cell — `evidence.kind`, `evidence.title`, `evidence.ref`,
`evidence.excerpt`, `evidence.observed_at`. A cell with none is an assumption
rather than a finding, and that state is derived, not stored.
`evidence_counts.n` gives the count per `evidence_counts.cell_id` without
reading the rows.

Provenance, not journey fact: do not answer a "how does it work" question from
it.

## The portal — `search_blueprint`

One RPC, every consumer's single entry point, in **three modes**.

**Ranked search.** Pass `q`. Vector, prose and structural-name retrieval all
run and are fused by reciprocal rank. This is the default and the right first
call for "where is X".

**Scoped search.** Pass `q` plus any of `filter_phase`, `filter_scenario`,
`filter_path_kind`, `filter_lane_role`. The filters apply to *all three*
retrievers, so scoping does not silently disable one. `filter_lane_role` is how
"re-query per actor" becomes one call instead of a hope.

**Filter-only predicate select.** Pass the filters with **no `q`** and no
embedding. This returns the COMPLETE matching set in structural order — not a
ranked top-k. It is the only call that can say *complete*, which makes it the
one to use before asserting something is not in a scenario.

`granularity` chooses which rungs come back — `phase`, `scenario`, `path`,
`step`, `lane`, `cell` — and defaults to cells. Structural rungs answer
"what exists here" without a keyword.

`include` adds `edges`, `findings` or `slices` to the same call, as extra rows
rather than extra round trips.

**Reading a result.** Every row carries `matched_by`: which retrievers agreed,
`+`-joined when more than one did, so `keyword+structural` is an ordinary
value and the test for a semantic-only guess is EQUALITY with `vector`, not
containment. Filter-only rows report `filter`. Every row also carries
`total_matched`, the corpus-wide count behind the page, so "113 cells mention
Zoom, here are 15" is sayable.

**Similarity is not confidence.** Measured across a 26-case set, questions with
no answer scored 0.607–0.654 while genuine hits reached down to 0.565. The
ranges overlap and no threshold separates them. Judge by corroboration, never
by score.

## Proving an absence

Four different questions hide under "it's not there", and they take different
calls. Answering one with another's evidence is how a retrieval miss becomes a
confident claim about the service.

| the question | the call that answers it |
|---|---|
| does this phase / scenario exist? | a structural read — `granularity` at that rung, or the live index |
| does this scenario say anything about X? | **filter-only** on that scenario: complete, not ranked |
| is this row current or still coming? | `paths.status` / `cells.status`, which the RPC does not project |
| did my query simply miss? | `matched_by` — every row `vector` alone means the blueprint's own words never matched |

A thin result is more often a content gap than a retrieval failure — say so and
route it as a gap, rather than assembling an answer out of adjacent scenarios.

## Known-silent

No structured field holds verbatim scripts, durations, counts, targets or
dates. They appear inside general cell evidence, sometimes. Absent after
checking all four places, abstain and name who would know.

`business_models` is not readable by the anon role, so the bot cannot reach the
service's spec row at all.
