---
audience: agents and authors
summary: How a spec field is written in this blueprint — extracted from the eleven pilot cells, not invented.
last-reviewed: 2026-08-20
---

# Spec house style

The standard every fill run writes to. It is **extracted**, not designed: the
eleven pilot cells in Warm-Up › Happy Path were the only spec content that
existed when this was written, and they are consistent enough to be the rule.

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

## The fields

| Field | One sentence | The trap |
|---|---|---|
| `content` | what happens in this moment | — |
| `summary` (cell) | the tl;dr the detail fields add up to | not a copy of `content` |
| `function` | **why this moment exists** — one purposive sentence | restating `content` in other words |
| `form` | tone and manner; **frontstage only**, legitimately blank | manufacturing a tone for a database write |
| `value_props` | who gets what — typically two entries, one human audience and one business | inventing an audience the registry does not know |
| `steps.summary` | what this moment is **across every lane** — the storyboard's caption | any single lane's action; that is a cell |
| lane `kpis` | how the lane is measured | a metric nothing instruments |
| lane `tools` | what it runs on — **only where `kpis` are filled** | its one reader fires on lanes with KPIs |
| lane `owner_team` | the accountable team, from the closed list | coining a new team name mid-run |

## Cite or skip

A field is written **only** when the claim is grounded in one of three things:

1. the cell's own `content`,
2. its lane's role and name, or
3. an `evidence` row on that cell.

Anything else is left empty and **reported as a gap**. Absence is a finding —
that is this blueprint's own doctrine, and unpicking a plausible invention
costs more than filling a gap later.

This matters because **there is no way to mark a field as agent-authored**:
`origin` records where a ROW came from, not who wrote its spec. Bulk agent
prose in `function` would be indistinguishable from verified fact.

## Audiences come from the registry

`value_props[].for` resolves against `stakeholders` — name or alias,
case-insensitively. Read `list_stakeholders` before writing one. `tutor` and
`Regular Tutor` are one person; `business` is PLUS, the provider, and is not a
lane. A new audience means a new member of the cast, which is a deliberate act
with its own tool.

## Voice

- One sentence. A `function` that needs two is usually two functions, which
  means the cell is two cells.
- Plain verbs, present tense, no filler. "Open the tutoring moment", not "This
  step is designed to facilitate the opening of the tutoring moment".
- Name what a reader can check. "within the first minute" is checkable;
  "quickly" is not.
- Never write the lane's name into the sentence — the row already says it.

## `steps.summary` in particular

It is the one field derived entirely from content that already exists: the
column's cells. Read them, write the one sentence they add up to, and name
more than one lane only when the moment genuinely involves more than one.

Skip a column whose cells are all empty rather than inventing a moment, and
report it as a gap.

Do **not** write to the storyboard cell's own `content`. No renderer reads it,
and filling an invisible field is the mistake this campaign exists to correct.
