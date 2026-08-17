---
status: pending
priority: p1
issue_id: 025
tags: [code-review, mobile, race-condition, slices]
dependencies: []
---

# Mobile boot slice presentation is derived from a live query — appears late, vanishes on refetch

## Problem Statement

A full-bleed `z-40` presentation covering the entire phone is gated on a
network query's *current* result, so it can both appear and disappear on its
own. Introduced with the mobile `?slice=` deep-link fix (todo: same session),
and it is the wrong shape: a place the user is standing must be state, not a
derived value.

## Findings

[MobileShell.tsx:93-100](src/components/mobile/MobileShell.tsx:93) derives
`bootPresentingId` from `slices.some(...)`, and `slices` collapses to `[]` on
query error ([useSlices.ts:16-26](src/hooks/useSlices.ts:16) returns null
fallback outside dev; the query layer deliberately lets error win over stale
data).

**Timeline A — late ambush (slow network):** user opens a `?slice=` link,
query is slow, they start reading a scenario; 8s later the query lands and a
slide deck replaces the screen, discarding their scroll position. Never
happens on a fast connection — a pure fast/slow asymmetry that only the worst
connections will report.

**Timeline B — vanishing (signal drop):** user is three frames into the deck,
phone enters a lift, refetch fails, `slices` empties, the presentation
unmounts mid-read. Signal returns, it remounts — and because `key={activeSliceId}`
it restarts **at frame 1**.

Secondary: the same block keeps four state atoms (`presentingSliceId`,
`bootSliceId`, `bootSliceDismissed`, derived `bootPresentingId`) for one
nullable value, and calls `resolvePending`, which opens a real tab in the
shared store — so after a boot the store and the local latch disagree about
what is showing. Crossing 768px then mounts the desktop shell straight into a
presentation the user already dismissed.

## Proposed Solutions

**A. One-shot latch.** Decide once, when the query first settles; refuse if the
user has already navigated. `presentingSliceId` (the nav-sheet path) is
already the correct shape — copy it.
*Effort:* Small. *Risk:* Low.

**B. Single source of truth in the store.** Delete all four locals and read the
active tab from `viewStateStore`, so both shells agree and `?slice=`
resolution lives in one shared hook instead of being duplicated in `TabStrip`
and `MobileShell`.
*Pros:* also fixes the cross-breakpoint divergence and the dropped
`missingSliceId` notice (mobile never mounts the component that renders it, so
a dead bot link silently does nothing on a phone).
*Effort:* Medium. *Risk:* Medium.

## Recommended Action

_(triage)_ — B is the right destination; A is acceptable if the nav redesign
is landing first and B would conflict.

## Technical Details

- `src/components/mobile/MobileShell.tsx:65,81,86,93-100,372-383`
- `src/contexts/viewStateStore.ts:116-127`
- `src/components/editor/TabStrip.tsx:258-272` — the duplicated resolver + notice

## Acceptance Criteria

- [ ] Slow-network boot does not hijack the screen after the user navigates
- [ ] Offline/online cycle mid-presentation does not restart at frame 1
- [ ] Dismissing on mobile then crossing 768px does not re-present
- [ ] A dead `?slice=` id surfaces the missing-slice notice on mobile

## Work Log

- 2026-08-16: Found by frontend-races and TypeScript reviews during the mobile
  crash investigation. The four-atom latch was introduced earlier the same
  session by the mobile deep-link fix.

## Resources

- Related: todo 024 (cell deep link), 023 (remount)
