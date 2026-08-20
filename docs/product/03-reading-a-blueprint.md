---
audience: everyone
summary: The vocabulary — phases, scenarios, paths, lanes, the line of visibility, steps, cells, triggers vs needs, slices, and findings.
sources: src/lib/agent/skill/references/lane-roles.md, src/lib/agent/skill/references/lane-vocabulary.md, src/components/blueprint/ServiceBlueprintGrid.tsx
last-reviewed: 2026-08-18
---

# Reading a blueprint

Every word the app uses, taught once. Each entry says what the thing looks
like on screen and what it means in service terms.

## Lifecycle, phases, scenarios, paths

These four nest inside each other, big to small:

- **Lifecycle** — the whole relationship with the service, from first
  hearing about it to (possibly) coming back. There's one; it's the
  Overview page.
- **Phases** — the big chapters of that relationship, numbered and in time
  order: on screen, the numbered sections of the Overview and the sidebar.
  In service terms: "the enrollment stage", "the weekly-sessions stage".
- **Scenarios** — concrete situations inside a phase, worth mapping on
  their own. On screen, each scenario opens as its own board. In service
  terms: "a student's first session", "rescheduling".
- **Paths** — variants of one scenario's journey: the happy path where
  everything works, plus the detours (tutor cancels, student is late). On
  screen, paths are labeled bands on the board, and the Compare surface
  puts them side by side.

## Lanes and the line of visibility

The board's horizontal rows are **lanes**. Each lane belongs to one kind of
actor or machinery: the customer's own actions, the staff actions the
customer can see, the visible tools and systems, the staff work backstage,
the internal systems, the supporting teams. Lane names are whatever the
service calls them ("Regular Tutor", "Scheduling system") — the row label
on the left edge tells you which is which.

Between the visible rows and the hidden ones runs the **line of
visibility** — a horizontal rule across the whole board. Above it: what the
customer experiences. Below it: the machinery — everything that has to
happen for the moment above to feel effortless. Most service problems live
in the mismatch across this line, which is why the app never lets you lose
sight of it — it runs across the board on every screen, phones included.

## Steps

**Steps** are the board's columns: time, left to right. Step 1 happens
before step 2 — on every screen, phones included.

## Cells

A **cell** is one box on the board: one moment, in one lane, at one step —
"the tutor greets the student", third lane, step 2. Click a cell and its
panel opens with the full description, who's responsible, what it depends
on, and the research evidence behind it. Cells are the atoms of the whole
system: slices cite them, findings point at them, share links open them.

## Triggers vs needs

Cells relate to each other in two different ways, and the board draws them
differently:

- **Triggers** (arrows) — "this sets that in motion." An arrow from cell A
  to cell B means A causes B to happen. Follow the arrows and you're
  following the causal flow of the service.
- **Needs** (listed in the cell's panel) — "this depends on that." A cell
  can need a system, a piece of information, or another cell's outcome to
  be in place. Needs don't cause anything; they're the prerequisites that
  will hurt if they're missing.

A useful test: remove the other cell and ask what happens. If this one never
starts, that was a trigger. If it starts but goes wrong, that was a need.

## Slices

A **slice** is a saved cut of the board for one audience: one actor's
journey, one moment across every lane, one lane end to end, or one cell
examined closely. On screen, slices live in the sidebar's Slices section
and play as frames, each citing the cells it's built from. In service
terms: the version of the map you'd show an exec, a new tutor, or a client
— without handing them the whole dense board. A slice never contains
anything the board doesn't; it's a view, not a copy.

## Findings

A **finding** is a recorded issue: "these two cells expect the same tutor
in two places at once", "step 4 talks about a fee no customer-visible cell
mentions". Findings come from audits — systematic checks explained in
[doc 04](04-the-assistant-and-audits.md) — and each one names the exact
cells it's about. A finding is an open question for a human, never an
automatic change: someone on the team resolves it (fixed) or dismisses it
(judged fine, with the system remembering that judgment).
