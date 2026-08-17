---
status: complete
priority: p1
issue_id: 026
tags: [code-review, desktop, layout, content]
dependencies: []
---

# Long cell text bleeds through its lane band into the row below

## Problem Statement

On the desktop canvas a long cell renders taller than its lane's grid row and
paints *over* the next lane, covering the band divider and overlapping the
cells beneath it. Reported with a screenshot: a 257-character cell in a pink
lane swallowing the row below it.

Two independent causes stack: a fixed row track that cannot grow, and a height
estimator that undershoots. Either alone would be survivable; together they
produce ~123px of bleed — about 1.3 lane rows.

## Findings

**1. The row track is fixed, and the fix already exists elsewhere in the file.**
[sideBySideCompareLayout.ts:539-541](src/lib/sideBySideCompareLayout.ts:539) —
`getCompareRowTrackCss` returns a bare `${px}px`. Its sibling
`getMergedCompareRowTrackCss` ([:715-723](src/lib/sideBySideCompareLayout.ts:715))
is the same function with `minmax(${px}px, auto)`, and its docstring explains
that a fixed track "would clip the swell." Merged view got the fix; **Stacked —
the default view — and Side-by-side did not.** Lane rows are
`overflow-visible` ([CompareLaneRowShell.tsx:68](src/components/blueprint/CompareLaneRowShell.tsx:68)),
so an oversized item paints over the next track instead of clipping.

**2. The height estimator undershoots ~35%.** Heights are estimated from
character count, never measured from the DOM. Three compounding errors:

| Where | Assumed | Actual |
| --- | --- | --- |
| `getBlueprintCellInnerWidth` ([blueprintLayout.ts:501](src/lib/blueprintLayout.ts:501)) subtracts only the shell's padding, not the button's `px-4` + borders | 192px | **158px** |
| `getTextBlockMinHeight` line height ([:552](src/lib/blueprintLayout.ts:552)) | 20px | **22.75px** (`text-sm` × `leading-relaxed`) |
| `getEffectiveLineCount` divides chars by chars-per-line | naive | greedy wrap costs ~15-20% more |

For the reported cell: estimate 280px, reality ~403px.

**3. There is no length constraint on `cells.content` anywhere** — not in the
database (`content text not null default ''`), not in the agent write path
(`registry.ts` `upsert_cell` / `update_cell_content`), not in the tool spec
(`specs.ts:455,468` gives a style rule but no length), not in the panel editor.
The app's only enforced text limit is `TITLE_MAX = 120` in `sliceValidation.ts`.

**4. The offending cell is an outlier by an order of magnitude.** Across 410
seed/fallback cells: median 21 chars, p95 72, all-time max 127. The bleeding
cell is **257** — 2× the previous max, 12× the median. It is agent-authored,
from `docs/plans/content-changes/pre-session-standard-scheduling.md`.

**5. Arrows follow the bleed.** Arrow geometry reads real bounding rects, so
arrows anchor to the overflowing box's true bottom — inside the lane below —
and the routing corridors baked into the fixed track heights get eaten.

## Proposed Solutions

**A. Make stacked/side-by-side tracks grow (1 line).** `minmax(${px}px, auto)`,
matching merged.
*Pros:* removes the failure mode entirely; the correctness floor.
*Cons:* precomputed panel heights under-report until the ResizeObserver
catches up; the fixed-height overview rows should keep fixed tracks and clamp.
*Effort:* Small. *Risk:* Low-Medium.

**B. Fix the estimator** (two constants + word-boundary wrapping, with a test
asserting estimate ≥ real height for the known-worst string).
*Cons:* every multi-line lane gets ~35% taller — a real visual change. A
complement to A, not a substitute; a font change would re-break it.
*Effort:* Small-Medium. *Risk:* Medium.

**C. Enforce a content budget at authoring time.** `CONTENT_MAX` beside
`TITLE_MAX`, enforced in the agent write path, documented in the tool spec,
`maxLength` in the panel editor. Overflow routes to `description`, which the
detail panel already scrolls.
*Pros:* removes the *reason* it fired. A 15-line cell is unreadable even when
it fits — the canvas exists to be read at a glance.
*Cons:* policy change; needs a one-time sweep of cells authored by the
2026-08-08 content plans.
*Effort:* Medium. *Risk:* Low.

**D. Clamp with expand-on-click.** Predictable geometry, matches
`CompareDifferencesSurface.tsx:128`, but hiding half a sentence behind a click
undercuts the canvas's purpose. Best reserved for locked-height overview rows.

## Recommended Action

_(triage)_ — **A + C**, with B's width correction as a cheap accuracy win. A
removes the failure mode, C removes the reason it fired.

**Proposed budget: hard cap 120 characters, soft warning at 90.** Justification
from measured geometry: 158px text box, 14px `text-sm`, 22.75px line height
→ ~21-22 chars/line → 120 chars ≈ 5-6 wrapped lines ≈ 176-199px, which keeps
lane rhythm intact. 120 matches the existing `TITLE_MAX`, and covers **409 of
410** existing cells — the cap costs exactly one legacy edit.

For the reported cell: keep the first sentence (58 chars) as `content`; move
the cancellation statistic and the shipping caveat to `description`, the same
treatment its sibling cells in that plan already received.

## Technical Details

- `src/lib/sideBySideCompareLayout.ts:539-541`, `:715-723`
- `src/lib/blueprintLayout.ts:501-504`, `:537-560`, `:592`, `:631`, `:641`
- `src/components/blueprint/{StackedCompareGrid,SideBySideCompareGrid,BlueprintPathBand,CompareLaneRowShell}.tsx`
- Write path: `src/lib/agent/tools/registry.ts:266-309`, `specs.ts:455,468`
- Offending cell: `a0000000-0000-4000-8000-000000140204`

## Acceptance Criteria

- [ ] The 257-char cell no longer crosses its band divider in stacked view
- [ ] Side-by-side and merged views unchanged visually for existing content
- [ ] Arrows anchored to the affected cell route correctly
- [ ] A layout test asserts estimated height ≥ real wrapped height
- [ ] Content over the cap is refused/warned at the agent and editor write paths

## Work Log

- 2026-08-16: Root-caused during the mobile review round after Bill reported
  bleeding with a screenshot.

## Resources

- Precedents already in-app: `ServiceBlueprintGrid.tsx:463-469` (minHeight
  rows), `:819-821` (scroll inside cell), `sliceValidation.ts:50` (TITLE_MAX)
