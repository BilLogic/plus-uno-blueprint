---
status: pending
priority: p3
issue_id: "011"
tags: [code-review, quality, cleanup]
dependencies: []
---

# Review follow-ups: arrows, view-type representation, mechanical cleanups

## Problem Statement
Remaining P3 findings from the 2026-08-04 /ce:review that were not fixed
inline. None user-visible today; each is a latent sharp edge or cleanup.

## Findings
1. **IntegratedTriggerArrows re-measure** — `updateArrows` deps omit
   `cells`; correctness currently rides on `triggers` identity changing in
   the same memo. Also measured in `useEffect` (post-paint), so compare
   toggles paint one frame of arrows anchored to old positions. Add cells
   (or a layout-version key) to deps; consider `useLayoutEffect` for the
   first measure. `src/components/blueprint/IntegratedTriggerArrows.tsx:475`.
2. **`resolveViewType` cannot represent an explicit side-by-side choice** —
   overrides store `SlideViewType`, and `'side-by-side'` collapses into
   "unset". Store `SlideViewType | undefined` so per-scenario-beats-phase
   works for every value. `src/components/blueprint/PhaseScenarioOverview.tsx:115`,
   `src/contexts/EditorContext.tsx`.
3. **resetKey mid-save** — a draft save resolving after a scenario switch
   creates the cell "behind the user's back" (session sheet does name it
   under Elsewhere). Cancellation flag if it ever bites.
4. **Canvas mode store** — `setSharedMode('design')` accepted while
   `canWrite` is false; regaining access snaps every surface into Edit.
   Clear to 'view' on the canWrite true→false edge or guard the setter.
   `src/components/editor/CanvasModeProvider.tsx`.
5. **Mechanical batch** — shared `groupBy` for the three hand-rolled
   path-groupings (compare files); `TEXTAREA_CLASS` constant / PanelTextarea
   (CellPanelEditor ×3); `patchValueProp` helper; `errorMessage(e)` util in
   lib/utils (17 copies repo-wide); representative cell computed twice in
   IntegratedBlueprintGrid visual path; `rowTrackSizes` phantom dep;
   explicit `stacked={false}` noise; dead `size > 1` guard in the divergent
   slot branch.

## Acceptance Criteria
- [ ] Each item either fixed or consciously closed with a note

## Work Log
- 2026-08-04: Collected from TS/races/simplicity reviewers after the P1/P2
  fixes landed.
