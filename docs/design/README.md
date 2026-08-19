---
audience: designers
summary: The design point of view — restraint, one signature per surface, the Supabase benchmark — plus a map of every surface and how to propose deviations.
sources: docs/plans/2026-08-04-001-refactor-supabase-design-system-alignment-plan.md, docs/plans/2026-08-08-001-feat-mobile-responsive-blueprint-plan.md, docs/plans/2026-08-08-002-feat-desktop-ui-refinements-plan.md, docs/plans/2026-08-16-002-feat-mobile-shell-implementation-plan.md, src/styles/
last-reviewed: 2026-08-18
---

# Design — the point of view

This app is a reading instrument for service blueprints. Its design identity is
**restraint**: quiet neutral surfaces, one brand accent, semantic tokens
everywhere, and boldness spent deliberately — **one signature element per
surface**, with everything around it disciplined. The house benchmark is
Supabase: not their look, their _code quality_ — the token architecture, file
discipline, and accessibility rigor of their design system, adopted wholesale in
the 2026-08-04 alignment (see that plan for the full rationale). When a choice
is unclear, "what would survive a Supabase design-system review?" is the tiebreak.
The deliberate refusal baked into that stance: no AI-default "acid accent on
near-black", no decoration that carries no information.

## How this folder is organized

- `foundations/` — the raw material: [color](foundations/color.md),
  [typography](foundations/typography.md), [motion](foundations/motion.md),
  [iconography](foundations/iconography.md), [elevation](foundations/elevation.md),
  [data-viz](foundations/data-viz.md), [layout](foundations/layout.md).
- [`components.md`](components.md) — which primitive for what, drawer/sheet
  postures, empty/error-state recipes.
- [`interaction.md`](interaction.md) — the click grammar, canvas modes, camera,
  the touch contract.
- [`responsive.md`](responsive.md) — the breakpoint contract (it is the single
  owner of breakpoints).
- [`content-voice.md`](content-voice.md) — UI copy, the agent's voice, naming.
- [`accessibility.md`](accessibility.md) — the bar every surface must clear.

Every fact has one owner doc; everything else links. Code owns values — these
docs point at token files and components, they do not restate numbers.

## Surface anatomy

**Overview board.** The pan/zoom canvas showing every phase at once
(`ZoomPanViewport`). Below the semantic-zoom threshold cells drop to the
**blocks tier** — flat blocks, counter-scaled phase labels — so the overview
reads as a table of contents (journey length, density per phase) instead of a
shrunken page. Signature: _the board that becomes a map at distance_. See
[data-viz](foundations/data-viz.md) and [interaction](interaction.md).

**Scenario detail.** The camera flies into one phase or scenario; phase badges
carry the time-marker register (`01 · ARRIVAL`), cells open the detail panel on
⌘-click. Signature: _the time-marker register_ — the typographic voice of the
time skeleton. See [typography](foundations/typography.md) and
[motion](foundations/motion.md).

**Compare cockpit.** Stacked per-path bands over a shared grid, the differences
ledger below the fold. Stacked uses quiet divergent-column tint; Merged uses
vertical version stacking plus rounded membership outlines. Exact navigation
lives in the Differences surface rather than a second strip above the canvas.
See [data-viz](foundations/data-viz.md).

**Slices and presentation.** A slice focuses its member cells — members keep
their role-accent rings while non-members dim and desaturate — and presentation
mode wraps the same view in a dark stage (`.dark` on a subtree, which is why
the semantic layer re-derives per scope). Signature: _the slice dim_. See
[color](foundations/color.md) and [motion](foundations/motion.md).

**Mobile shell.** Below the breakpoint the phone shows the same canvas as
desktop, scoped to one phase at a time — navigation is a camera move, a
single-select path pill replaces the PATHS checkboxes, and everything is
view-only for every tier. Signature: _the phase-scoped camera_. See
[responsive](responsive.md), which owns the whole contract.

**The agent panel.** Docked to the sidebar or floating; a bottom sheet on
mobile, entered through a floating action button. Its canvas annotations draw in a named, tokenized red ink no human
swatch offers, so "the agent drew this" is legible at a glance. Signature:
_the agent's ink_. See [color](foundations/color.md) and
[content-voice](content-voice.md) for its voice.

## Deviating

Every rule in this folder is a **default with a reason attached** — none is
policy for its own sake. To deviate, the _reason_ has to fail, not the rule:
find the owner doc, check why the rule exists, and if your case genuinely
breaks the premise, propose the deviation in the PR that needs it, stating the
why. A deviation without a stated reason gets reverted on review.

One vocabulary is pinned harder than the rest: motion. The drift test
(`scripts/tests/motion-tokens`) holds `src/styles/animations.css` and
`src/lib/motion.ts` to the same five numbers — a new duration or easing is a
_change to the vocabulary_, made in both homes with the test updated, never a
one-off literal at a call site.

## Design tooling

**The design source of truth is the code.** There is no Figma library, and
that is deliberate, not an omission — the token files under `src/styles/` and
the components under `src/components/` are the system of record, and a parallel
library would be a second owner that rots. Propose visual changes as **built
prototypes**: a branch, a before/after draft in a plan doc (the desktop-
refinements plan's ASCII drafts are the precedent), or a review deploy —
something that can be judged against the real board with real data.
