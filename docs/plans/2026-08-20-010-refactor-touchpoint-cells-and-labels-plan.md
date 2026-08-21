---
title: "One cell per touchpoint, and names that are names"
type: refactor
status: active
date: 2026-08-20
repos: uno-blueprint
related: docs/plans/2026-08-20-006-design-data-model.md, docs/plans/2026-08-20-005-feat-spec-fill-campaign-plan.md
---

# One cell per touchpoint, and names that are names

Two content defects, both visible on the canvas, both currently worked around
in the renderer instead of fixed in the data.

---

## 1. Tech cells carry sentences where they should carry names

A `frontstage_tech` or `backstage_tech` cell renders its `content` as **pills**
— one pill per newline-separated line. The pill is meant to be the touchpoint:
`Zoom`, `PLUS App`, `Email`. What is actually stored includes things like:

```
Calendar feed + reminder emails
PLUS App — alerts & reconfirm
PLUS App database (DB import)
Attendance write enables engagement field
Session condition decides Goals vs Mark Helped
```

Three different things are being packed into one field: the touchpoint's NAME,
a qualifier about which part of it, and a sentence about what happens there.
The last of those is not a touchpoint at all — it is a `function`.

**The rule this restores:** one cell per touchpoint. The pill carries the
touchpoint's name and nothing else; what happens there goes in `summary`, and
why goes in `function`, exactly as every other lane already works.

### Scope, to be measured before any edit

```sql
-- pills that are not names: length, punctuation, or a verb
select l.name as lane, c.id, c.content
from cells c join lanes l on l.id = c.lane_id
where l.lane_role in ('frontstage_tech','backstage_tech','support_systems')
  and (length(c.content) > 24 or c.content ~ '[—:+]' or c.content ~* '\y(is|are|and|when|decides|enables)\y')
order by length(c.content) desc;
```

### Method

- **Split, do not truncate.** `PLUS App — alerts & reconfirm` becomes a `PLUS
  App` cell whose `summary` says "alerts and reconfirmation"; it does not
  become a second touchpoint called "PLUS App alerts".
- A cell that is genuinely two touchpoints (`Calendar feed + reminder emails`)
  becomes **two cells** in the same slot — the slot already holds a list
  (`unique (lane_id, step_id, position)`).
- Dependencies must follow the split: an edge pointing at the old cell has to
  point at whichever half it meant. Where that is ambiguous, leave the edge on
  the primary half and report it rather than guessing.
- The touchpoint vocabulary converges the way lane labels do — reuse an
  existing name before minting one, and record the list in
  `docs/reference/touchpoint-vocabulary.md`.

### Risks

- `cells.content` on a tech lane is the **pill label**, and `tech_description`
  links key off that label to attach copy and screenshots
  (`blueprintTechDescriptions.ts`). Renaming a pill without moving its link
  silently drops the description. Every split has to carry its links.
- 38 `Front Stage Tech` rows and 38 `Back Stage Tech` rows exist per the lane
  census; the number of CELLS is larger. Measure first.

---

## 2. Lane and stakeholder names carry their own scaffolding

`Partner Action: Teacher` is a lane label with the blueprint's own structure
bolted onto the front of it. The reader needs `Teacher`; `Partner Action` is
the lane's ROLE, which `lane_role` already stores and the panel already says
in words.

Same class of defect, smaller:

| Now | Should be | Why |
|---|---|---|
| `Partner Action: Teacher` | `Teacher` | the role is a column, not a prefix |
| `Support Actions` | *(unchanged)* | it names no actor — it IS the structural row |
| `Regular Tutor` / `Tutor` | one of them | already recorded as an alias in `stakeholders` |

- The stakeholder registry seeded `Partner Action: Teacher` with alias
  `teacher`; renaming the row rewrites `slices.actor` through the trigger, and
  `lanes.name` has a column grant, so this is a data edit with no schema work.
- Do it **after** the touchpoint split — both are content sweeps and one
  review pass covers both.

---

## Acceptance criteria

- [ ] No tech-lane cell's `content` contains a sentence, an em dash, or a `+`
- [ ] Every split cell's `tech_description` links moved with it
- [ ] Every dependency edge still resolves to a cell that exists
- [ ] `docs/reference/touchpoint-vocabulary.md` lists the closed set
- [ ] No lane name contains its own role
- [ ] `check-jargon-lint` re-run; record which findings changed
