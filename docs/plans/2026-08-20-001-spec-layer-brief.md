---
title: "The spec layer — the finding, and the plans that came out of it"
type: brief
status: active
date: 2026-08-20
repos: uno-blueprint
---

# The spec layer

**One finding, eight plans.** This document is the evidence; the plans are the
work. Everything below was read from the live database or from a file that was
actually opened — no inference.

---

## The finding

Ten spec columns exist across cells, phases, lanes and the service. Their
migrations shipped. Their column-level grants shipped. **Four audit checks
were written against them.** Almost none of them contain data, because with
one exception nothing in the app can write to them.

Not a modelling problem. **A finished back end with no front door.**

| Column | Level | Filled |
|---|---|---|
| `cells.value_props` | cell | 11 / 955 |
| `cells.function` | cell | 11 / 955 |
| `cells.form` | cell | 8 / 955 |
| `cells.owner` | cell | 0 / 955 |
| `cells.perceived_owner` | cell | 0 / 955 |
| `phases.business_impact` | phase | 0 / 6 |
| `phases.operational_requirements` | phase | 0 / 6 |
| `layers.kpis` | lane | 0 / 299 |
| `layers.owner_team` | lane | 0 / 299 |
| `layers.tools` | lane | 0 / 299 |
| `propositions` (whole table) | service | 0 rows |

All 11 filled cells sit in **one path** — Warm-Up › Happy Path. Someone
piloted it and stopped.

### The measurable cost

`audit-playbook.md:48-58` skips a wave-2 check when its column is empty
everywhere. Against the numbers above:

| Check | Needs | Runs today? |
|---|---|---|
| `check-gap-sweep` · `check-jargon-lint` · `check-channel-conflict` | wave 1 | ✅ always |
| `check-kpi-alignment` | lane `kpis` | ❌ **never** |
| `check-perceived-owner` | `cells.perceived_owner` | ❌ **never** |
| `check-value-ledger` | `cells.value_props` | ⚠️ **1 of 22 scenarios** |
| `check-fee-visibility` | a money mention in scope — a **content** scan, not a column test | ⚠️ content-dependent |

`/audit` runs at under half its written capability. The playbook is honest
about it — *"every skip is reported with its reason"* — it just has little to
report on.

**The metric this whole effort is judged on: audit checks that can run in
any scenario, 3/7 → 7/7.** Plans 002–004 build the road; [plan 005](2026-08-20-005-feat-spec-fill-campaign-plan.md)
is the one that moves the number.

---

## The eight plans, and the order to build them

| # | Plan | Status | Why now |
|---|---|---|---|
| [002](2026-08-20-002-refactor-database-vocabulary-plan.md) | **Database vocabulary** — `layers`→`lanes`, `cell_triggers`→`cell_links`, `propositions`→`business_model`, `cells.description`→`summary` | active | The code already apologises for two of these in comments. Must land **after** `refactor/agent-tool-surface` merges |
| [006](2026-08-20-006-design-data-model.md) | **The data model** — every level, every field, a definition and a reason for each. The ERD, the two grain corrections, and four open questions | active | Decides what is worth storing, before anything is built to edit it |
| [003](2026-08-20-003-feat-entity-detail-panels-plan.md) | **Entity detail panels** — lane, phase, service, **scenario** (which hosts paths), on one lifted shell — **no new columns** | active | The front door. Everything else waits on it |
| [004](2026-08-20-004-feat-multi-service-support-plan.md) | **Multi-service** — RLS, `filter_service`, then a switcher | **active** | Decided: one app, many services. RLS first; the switcher must not ship before the RPC filter |
| [005](2026-08-20-005-feat-spec-fill-campaign-plan.md) | **Fill campaign** — scoped, cited, human-gated | blocked on 003 | Filling fields nobody can then see is how this content got lost the first time |
| [007](2026-08-20-007-feat-cross-repo-blueprint-contract-plan.md) | **Cross-repo contract** — uno-bot's `include` switch, and putting RPC params + FK names under the drift check | active | `cell_triggers` → `cell_links` can break uno-bot silently. This is what stops it |
| [008](2026-08-20-008-feat-create-a-service-first-run-plan.md) | **Create a service** — an empty service, a first-run flow, and the membership row it must write | active | Today a second team's first screen is a blank product with no way to begin |
| [009](2026-08-20-009-feat-stakeholder-registry-plan.md) | **Stakeholder registry** — one cast list replacing four free-text vocabularies | active | `check-value-ledger` would fire **six false warnings per scenario** today |

### Build order

```
007  cross-repo contract ← Phase 2 FIRST: it is what makes 002 safe
      │
      ▼
002  vocabulary          ← after refactor/agent-tool-surface merges
      │                    renames paths.description → summary, which 003 writes against
      ▼
003  panels              ← the front door. No new columns, no migration.
      │
      ├──▶ 005  fill campaign   ← needs somewhere for the content to be seen
      │
006  data model          ← reference, not work. Read alongside 002 and 003.

004  multi-service       ← independent. Its steps 1–2 (RLS, filter_service)
      │                    can land any time and change nothing observable.
      │                    Its switcher must NOT ship before step 2.
      ▼
008  create a service    ← needs 002 phase 6 (the real root table)
                           and 004 step 1 (service_members)

009  stakeholder registry ← independent of all of it. Needs NO uno-bot change,
                            by design: slices.actor stays, trigger-maintained.
```

**Nothing here needs a migration except 002's renames and 004's membership
table.** Every field the panels write already carries a column grant — that is
the whole finding.

---

## Evidence, kept because it is load-bearing

### The database is already finished

```sql
-- supabase/migrations/20260729120000_derived_layer.sql:299,304
grant update (owner_team, kpis, tools) on public.layers to authenticated;
grant update (business_impact, operational_requirements) on public.phases to authenticated;
```

RLS is on, every write policy is scoped to `authenticated`, and the
column-level grants are exactly the fields the panels would edit. **No
migration is needed for any of the new writes** — which matters, because
AGENTS.md:26 says *"Never widen RLS; the deployed site stays read-only."*

*(Separate ticket: `anon` also holds table-level INSERT/UPDATE grants on
`phases` and `layers`. Not exploitable — RLS has no anon write policy — but
the grants should match the intent.)*

### Why the propositions table is empty

From the `f65efcf` migration comments:

> `propositions`: "One business-model record per lifecycle. **The three
> validation questions live as evidence rows keyed understand|value|
> usability.**"

`evidence` enforces it: `check (num_nonnulls(cell_id,
proposition_question_key) = 1)` — a row attaches to a cell **or** to one of
three validation questions. **Both existing evidence rows attach to cells; the
question key has never been used.**

`PropositionCard.tsx` (239 lines) was deleted on 2026-07-29 in `5bdc685`,
*"remove UI the review rejected"*, at a time when `canWrite` was *"always
false in practice, so remaining mutation UI never renders."* It was cut as
dead code, not as a bad idea. Slices and evidence came back. Findings and the
proposition card did not.

### Findings has the same shape, and 5 real rows

| Entity | UI | Agent tools | Rows |
|---|---|---|---|
| slices | ✅ 10 components | 4 | 10 |
| evidence | ✅ `CellEvidenceTab` | 4 | 2 |
| **findings** | ❌ none | 3, **including writes** | **5** |
| **business model** | ❌ none | 1 read | 0 |

`/audit`'s entire output is findings, and no human can read one in the app.
Not in the five plans; worth its own.

### Two fields are at the wrong grain

```
299  lane rows       166 logical lanes (scenario × name)      12 distinct names
241  frontstage cells                                        955 cells total
```

`remove_lane(scenario_id, lane_name)` already deletes **by name across the
scenario** — the database keys the lane on `(scenario, name)`, not the row id.
That same mismatch caused the 8.5× undercount fixed in `20260820030000`.

And `cells.owner` restates the lane's `owner_team` 955 times. Full reasoning
and the fix in [plan 003](2026-08-20-003-feat-entity-detail-panels-plan.md).

### Corrections made along the way

- **Cells open on a plain click**, not ⌘-click. `BlueprintCellButton.tsx:180`:
  *"a bare click on a canvas with no picker opens the panel."* ⌘-click is the
  escape hatch for when a slice picker owns the bare click.
- **`layers` is the table; lane is the word.** All five plans say lane.
- **The business model is at the service level**, not the phase level —
  `propositions.service_lifecycle_id`, one row per lifecycle.
- **`propositions` is not vestigial.** An earlier read of this called it a
  dead table and recommended dropping it. Wrong: it is a coherent design that
  was never reachable. Empty because unreachable, not because unwanted.
- **"Lifecycle" is not a level.** `services` and `service_lifecycles` have
  **no foreign key between them** — checked `pg_constraint` in both
  directions. `services` holds one placeholder row, `"Example API"`, that
  nothing in the app reads. `service_lifecycles` is the real root, and its own
  comment says `'End-to-end service journey'`. It **is** the service. Plan 002
  drops the dead table and renames the real one.
- **The storyboard row is empty everywhere, and no renderer reads its text.**
  The `visual` lane exists in all 38 paths and occupies **215 `(path, step)`
  grid positions** — 147 cells written, every one blank. But
  `BlueprintStepVisual.tsx:105` returns `null` without pictures, and
  `MergedCompareGrid.tsx:184` states it outright: *"A visual lane's face comes
  from the walkthrough layers' pictures, NOT from its own cell text."* So the
  cell's `content` has no front door. **`steps.summary` is the column** — one
  row per step, shown as the **caption on the storyboard frame** (and in a
  header hover card when there is no frame). Cheap because pictures are already
  resolved by `step.id`, and because `BlueprintStepVisual` has only two render
  call sites. Rename the lane label `Visual` → `Storyboard`; `layer_role` stays
  `visual`.
- **`lanes.tools` has exactly one reader.** `check-kpi-alignment.md:10-12` uses
  it for *"whether the measured thing is even instrumented"* — nothing renders
  it and no other check reads it. Fill it only after `kpis`, and only where
  `kpis` is non-empty.
- **A step has no grain problem.** `steps` holds one row per step keyed on
  `service_scenario_id`; `path_steps` only carries `column_position`. An
  earlier read called this a lane-shaped fan-out. It is not.
- **Row and column are rendering words.** `row_position` and `column_position`
  name how a lane and a step happen to be drawn today; the compare view already
  draws the same lanes in a different geometry. Plan 002 moves them to
  `lane_position` and `step_position`.

---

## Decisions recorded here, because they are not plans

**Findings get no UI.** Five open rows, three agent tools including writes, and
all of `/audit`'s output — readable by the agent, not by a human in the app.
Asked and answered: **no UI is being built.** The Flagged tab in
[plan 003](2026-08-20-003-feat-entity-detail-panels-plan.md) already scopes open
findings to the lane or phase you are looking at, which is the surface that
earns its place; a standalone findings view does not.

**`services.slug` is scaffolding, not intent.** Checked before plan 002 drops
the table. The row is `"Example API"` / `example-api` /
*"Placeholder service entry for local development"* — template residue from the
original import, not a designed multi-service URL scheme. Nothing to preserve.

**`filter_layer_role` is not a cross-repo risk.** uno-bot never passes it; the
string appears once, in a comment. The real cross-repo break is
`cell_triggers` → `cell_links`. Both corrected in plan 002, evidence in
plan 007.

---

## Sources

- Field counts, grants, RLS policies and row samples: read from the live
  production database
- UI architecture: mapped by two Sonnet 5 subagents over disjoint file sets
- Design system: `docs/reference/ui-inventory.md`'s need→primitive map, and
  the `value_props` editor at `CellPanelEditor.tsx:465-530` as the repeating-row
  precedent
- `docs/solutions/` does not exist in this repo
- Every `file:line` in these plans came from a file that was opened — re-verify
  before editing, the branch is moving
