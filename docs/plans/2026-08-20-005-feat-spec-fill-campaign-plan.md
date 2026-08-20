---
title: "Fill the spec layer — scoped, cited, reviewed"
type: feat
status: blocked
date: 2026-08-20
repos: uno-blueprint
brief: docs/plans/2026-08-20-001-spec-layer-brief.md
blocked-by: docs/plans/2026-08-20-003-feat-entity-detail-panels-plan.md
---

# Spec fill campaign

> **Blocked on plan 003.** Filling fields a human cannot then see or correct
> is how the last round of this content ended up invisible. Panels first.

---

## Scope — smaller than it looks

The naive number is 955 cells × 5 fields. The honest number is much lower,
because two fields are at the wrong grain and two only apply frontstage.

| Field | Naive | **Honest scope** | Why |
|---|---|---|---|
| lane `owner_team` / `kpis` | 299 rows × 2 | **166 logical lanes × 2** — or 12, if the names are a shared vocabulary | 299 rows hold only 12 distinct lane names |
| lane `tools` | 299 | **only lanes whose `kpis` are filled** | one reader — `check-kpi-alignment` uses it for *"whether the measured thing is even instrumented."* A lane with tools and no KPIs feeds nothing |
| **storyboard `content`** | — | **215 positions, 0 written** | new target — see below |
| `cells.perceived_owner` | 955 | **241 frontstage** | a customer cannot mis-perceive a backstage row |
| `cells.form` | 955 | frontstage, optional even there | a database write has no tone; the pilot filled 8 of 11 |
| `cells.owner` | 955 | **0 — exceptions only** | it overrides the lane's `owner_team`; empty means "same as the lane" |
| `cells.function` | 955 | **955** | genuinely per-cell |
| `cells.value_props` | 955 | 955, pending the step question | see plan 003 |
| `phases.*` | 6 × 2 | 12 | human-written, not agent |
| business model | 5 | 5 | human-written, not agent |

### The storyboard row — a new target, and the cheapest one

[Plan 006](2026-08-20-006-design-data-model.md) established that the `visual`
lane is the step's own row and that it is **completely blank**:

```
215  (path, step) storyboard positions
147  cells written  ← 0 content, 0 description, 0 picture
 68  positions with no cell yet
```

It belongs in this campaign for a reason the other fields do not have: **it is
derivable from content that already exists.** A step's storyboard line is a
summary of the cells sitting under it — the agent reads five cells in a column
and writes the one sentence they add up to. That is a summarisation task with
the source in hand, not research, so the citation rule below is satisfied by
construction.

- Write `content` only. Leave `description` and `picture` empty — a storyboard
  cell has no tl;dr to hold and the agent cannot draw.
- **Per path, no fan-out.** Two paths through the same step get two lines, and
  they are allowed to differ — that is what a path is.
- Skip a column whose cells are all empty rather than inventing a moment.

**Phases and the business model are not part of the campaign.** Seventeen
fields describing commercial strategy are a conversation with the person who
knows the answer, not a research task.

---

## The house style is already written

The 11 pilot cells in Warm-Up › Happy Path are the only spec content that
exists, and they are consistent enough to be the standard:

```
content   "Circulates and quietly observes the students."
function  "Keep the classroom side steady while students transition into
           breakout rooms."
form      (empty)
value     2 entries

content   "Enters the student's breakout room."
function  "Open the tutoring moment: join the assigned breakout room within
           the first minute so the student is not left waiting."
form      "Prompt and unhurried; camera on where policy allows."
value     2 entries
```

**Rules extracted:**

- `function` is **one purposive sentence**. It answers *why this moment
  exists*, never restating `content`, which answers *what happens*.
- `form` is a **tone note**, and is legitimately blank. Three of eleven pilot
  cells have none, and they are the least presentational ones. Do not
  manufacture it.
- `value_props` is **two entries**, typically one human audience and one
  business audience.

Write this to `docs/reference/spec-house-style.md` before any agent runs.

---

## The risk, and the controls

`origin` on cells is `check (origin in ('import','app'))` — it records where a
**row** came from, not who wrote its **spec**. **There is no way to mark a
field as agent-authored.**

That matters in a blueprint whose central discipline is *"a cell with zero
evidence rows is an ASSUMPTION"* (`f65efcf`). Bulk agent prose in `function`
would be indistinguishable from verified fact.

Three controls, in order:

### 1. Cite or skip

An agent writes a spec field **only** when it can ground the claim in:

- the cell's own `content`, or
- its lane's role and name, or
- an existing `evidence` row on that cell.

Anything else is left empty and **reported as a gap**. Absence is a finding —
that is the blueprint's own doctrine, and it is cheaper to fill a gap later
than to unpick a plausible invention.

### 2. One scenario at a time, with a human gate

Twenty-two scenarios, twenty-two runs. Each ends with a review before the next
begins. The session ledger already makes every agent write revertible **within
its session**, which is exactly one scenario's worth.

### 3. A provenance column — only if 1 and 2 prove insufficient

Deferred on purpose. A schema change to solve a process problem is the wrong
order, and this session has already added enough surface.

---

## Order — cheapest signal first

| # | Target | Rows | Unblocks |
|---|---|---|---|
| 0 | **storyboard `content`** | 215 | nothing in `/audit` — but it is derived from cells that already exist, so it is the safest run to calibrate the review gate on |
| 1 | lane `kpis`, then `tools`, then `owner_team` | 166 logical | **`check-kpi-alignment`**, which has never run |
| 2 | `cells.perceived_owner` (frontstage) | 241 | **`check-perceived-owner`**, which has never run |
| 3 | `cells.value_props` | 955 | `check-value-ledger` beyond its 1 scenario |
| 4 | `cells.function` | 955 | nothing directly — the largest, and the least urgent |

**Order inside step 1 matters and is not cosmetic.** `kpis` → `tools` →
`owner_team`:

- **`kpis` first** — it is the only one of the three the audit check requires.
  `check-kpi-alignment` reads `kpis`, uses `tools` as a secondary signal, and
  **never reads `owner_team` at all**. Filling `owner_team` first would move
  the metric zero.
- **`tools` only where `kpis` was filled.** Its one consumer fires on lanes
  that carry KPIs; elsewhere it feeds nothing.
- **`owner_team` from a closed list, last.** It is for the human and the cell
  panel's inherited-owner display, not for any check. Agree the team names
  **before the run** and write them into `docs/reference/lane-vocabulary.md` —
  there are only 12 distinct lane names, so there are at most a dozen teams,
  and a closed list is what a stakeholder registry would back-fill from later.
  This resolves what read as a conflict with
  [plan 006](2026-08-20-006-design-data-model.md); see its stakeholder section.

Storyboard first, then lanes: 215 derivable rows make a good calibration run
for the human gate, and lanes are the only step that turns a dark audit check
on for the whole blueprint at once.

**Re-run `/audit` after each step and record which checks came alive.** That is
the metric, not fields filled.

---

## Agent brief (per scenario)

```
Read, in one round:
  get_reference('spec-house-style')      the standard
  get_reference('lane-vocabulary')       how lane names converge
  list_lanes()                           what already exists — reuse a label
  get_blueprint(scenario_id)             the grid, with its arrows
  list_evidence(...)                     what is already grounded

Then, for each lane in the scenario:
  propose owner_team / kpis / tools
  ground each in the lane's role, its name, or its cells
  SKIP anything you cannot ground, and list it as a gap

Write via update_lane. Do not touch cells in this pass.
Fill kpis first, then tools. Only propose tools for a lane whose
kpis you filled — tools on a lane with no KPI has no reader.
owner_team comes last and ONLY from lane-vocabulary.md's team
list. If the right team is not on that list, skip and report it —
do not coin a new team name.
Report: what you wrote, what you skipped, and why.
```

Sonnet 5, one agent per scenario, sequential — not parallel. Parallel agents
would each mint their own lane vocabulary, which is the exact divergence
`lane-vocabulary.md` exists to prevent.

---

## Acceptance criteria

- [ ] `docs/reference/spec-house-style.md` exists before the first run
- [ ] `docs/reference/lane-vocabulary.md` carries an agreed **team list**
      before any `owner_team` is written
- [ ] Every run reports written / skipped / why
- [ ] No field is written that the agent could not ground
- [ ] A human reviews each scenario before the next starts
- [ ] `cells.owner` is untouched
- [ ] `tools` is written only on lanes that also got `kpis`
- [ ] `owner_team` values all come from `lane-vocabulary.md`; any lane needing
      a team not on the list is reported, not invented
- [ ] Storyboard cells get `content` only — never `description`, never `picture`
- [ ] `perceived_owner` and `form` are written only on frontstage cells
- [ ] `/audit` re-run after each step, with the live-check count recorded

## Success metric

| | Now | After |
|---|---|---|
| Audit checks that can run in any scenario | **3 / 7** | **7 / 7** |
| `check-kpi-alignment` | never runs | runs |
| `check-perceived-owner` | never runs | runs |
| Scenarios where `check-value-ledger` runs | 1 / 22 | 22 / 22 |
