---
title: "The spec layer — what we found, and the four plans that came out of it"
type: brief
status: active
date: 2026-08-20
repos: uno-blueprint
---

# The spec layer

**One finding, four plans.** This document is the evidence; the plans are the
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

**The metric for all four plans: audit checks live, 3/7 → 7/7.**

---

## The four plans

| # | Plan | Status | Why now |
|---|---|---|---|
| [002](2026-08-20-002-refactor-database-vocabulary-plan.md) | **Database vocabulary** — `layers`→`lanes`, `cell_triggers`→`cell_links`, `propositions`→`business_model`, `cells.description`→`summary` | active | The code already apologises for two of these in comments. Must land **after** `refactor/agent-tool-surface` merges |
| [003](2026-08-20-003-feat-entity-detail-panels-plan.md) | **Entity detail panels** — lane, phase, service, on one lifted shell. Includes the ERD and the field-grain verdict | active | The front door. Everything else waits on it |
| [004](2026-08-20-004-feat-multi-service-support-plan.md) | **Multi-service** — RLS, a service switcher, `filter_service` | not scheduled | One service today. Written down so the list isn't rediscovered |
| [005](2026-08-20-005-feat-spec-fill-campaign-plan.md) | **Fill campaign** — scoped, cited, human-gated | blocked on 003 | Filling fields nobody can then see is how this content got lost the first time |

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
Not in the four plans; worth its own.

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
- **`layers` is the table; lane is the word.** All four plans say lane.
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
- **Row and column are rendering words.** `row_position` and `column_position`
  name how a lane and a step happen to be drawn today; the compare view already
  draws the same lanes in a different geometry. Plan 002 moves them to
  `lane_position` and `step_position`.

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
