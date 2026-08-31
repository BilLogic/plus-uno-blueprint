---
audience: agents and authors
summary: How a spec field is written in this blueprint — extracted from the eleven pilot cells, not invented.
last-reviewed: 2026-08-25
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

## A touchpoint's summary belongs to its STEP, not to its name

The same touchpoint appears all over the board — `PLUS App` and `Zoom` on
scores of cells each; [touchpoint-vocabulary.md](./touchpoint-vocabulary.md)
carries the current counts, taken after the 2026-08-20 sweep that split
multi-name cells into one cell per touchpoint. It is tempting — and it is wrong
— to write one summary per touchpoint and copy it wherever that name appears.

`PLUS App` in Fill-in Request is the Fill-In tab. In Goal Setting it is the
student list and its Action column. In Tech Setup it is a first sign-in.
`Email` in Interview & Offer schedules an interview; in Reporting an Issue it
is how a tutor raises a problem and how the answer comes back. `Zoom` at the
recruiting info session is not a breakout room.

**Content equality is not meaning equality.** A summary answers what this
system does *at this step*, which is the only reason the cell is on this
column rather than another.

This was learned the expensive way in Aug 2026: a propagation keyed on
`(content, lane_role)` filled 100 empty summaries by copying the most common
sentence for each touchpoint name, and put "The Fill-In tab." on 44 Goal Setting
cells. Copy a summary across twins only when the twins are the same MOMENT —
the same step under several path variants of one scenario — never merely the
same tool.
