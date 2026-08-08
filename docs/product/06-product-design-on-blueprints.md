---
audience: designers, product
summary: Grounding product and design decisions on the blueprint — cells as evidence, slices to specs, touchpoint reasoning, audits as design-debt radar.
sources: docs/plans/2026-08-06-001-plan-access-model-three-personas.md, src/lib/urlViewState.ts, src/lib/agent/skill/references/slice-playbook.md
last-reviewed: 2026-08-08
---

# Product design on blueprints

For designers and PMs using the blueprint as the evidence layer under
product decisions. Vocabulary assumed from
[03](03-reading-a-blueprint.md); presentation mechanics live in
[02](02-team-guide.md).

## Cells as evidence

A cell is a claim about reality — this moment happens, this actor owns it,
this is what it depends on — with the research evidence attached to the
cell itself. That makes cells citable the way tickets or research notes
are, but anchored in the journey:

- **Cite cells, not vibes.** "Students churn at scheduling" is an opinion;
  "the three cells between session-end and rebooking put all the work on
  the student" is an argument someone can check.
- **Deep-link them.** With a cell's panel open, the page URL identifies it —
  paste that link into the PRD, the Figma comment, the Slack thread. The
  link opens the live cell, so the citation can't silently go stale the
  way a screenshot does.
- **If the cell you need doesn't exist, that is itself a discovery**: the
  journey has an unmapped moment. Get it mapped (the team, or `/sb:map`)
  before building on it — designing against an unmapped moment is
  designing against a guess.

## Slices → specs

A slice is halfway to a spec: an ordered, cited selection of moments for
one audience. The workflow:

1. **Frame the question** — whose experience, which stretch of the journey?
2. **Cut the slice** (ask the team or use `/sb:slice`) — journey, moment,
   lane, or single-cell close-up.
3. **Read it as the requirements skeleton.** Each frame is a moment your
   feature must serve; each cited cell carries current behavior, owner,
   and dependencies — your as-is state, pre-researched.
4. **Write the spec against the frames**, keeping the cell citations. The
   spec inherits the blueprint's honesty: reviewers can open every claim.

Because slices only cite existing cells, a slice can never quietly assert
an interaction the service doesn't have — which is exactly the property
you want in a document that feeds a spec.

## Touchpoint reasoning across the line of visibility

The line of visibility is the design tool the blueprint gives you that a
flow diagram doesn't. For any moment you're redesigning, ask:

- **What's above the line here, and does it deserve to be?** Visible
  machinery (forms, confirmations, status pages) is either reassurance or
  burden — decide which, deliberately.
- **What's below the line that the customer wrongly senses?** Delays and
  handoffs leak. A backstage cell with a long dependency chain right under
  a "seamless" frontstage moment is a promise at risk.
- **Would moving it across the line change the experience?** Automating a
  frontstage moment pushes it below; surfacing backstage work (progress
  indicators) pulls it above. `/sb:whatif` can trace the consequences of
  such a restaging through the dependency graph before you commit —
  cheaper than prototyping the wrong side of the line.

## Audits as design-debt radar

Run through the finding list ([04](04-the-assistant-and-audits.md)) with a
designer's eye — several checks are UX-debt detectors by construction:
jargon findings mark copywriting debt, gap findings mark unowned moments,
channel conflicts mark moments where the service double-books people's
attention, perceived-owner findings mark trust debt, fee-visibility
findings mark dark-pattern risk. Sort by severity and you have a
prioritized, cell-cited design-debt backlog nobody had to compile by hand.

## Presenting upward

Executive versions of all this — slices as the stakeholder cut,
presentation mode in meetings, what to screenshot for decks — live in the
["Presenting and sharing" section of the team guide](02-team-guide.md#presenting-and-sharing).
One habit to add on top: when presenting a proposal, show the **as-is
slice** first, then the change. The blueprint gives you the before-state
for free; a proposal anchored in cited current reality is much harder to
wave away.
