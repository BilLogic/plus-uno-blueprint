---
status: complete
priority: p2
issue_id: 027
tags: [code-review, mobile, accessibility, quality]
dependencies: [023]
---

# Mobile shell: unreachable index, occluded navigation, stranded camera, a11y gaps

## Problem Statement

A cluster of smaller mobile defects found alongside the crash investigation.
Individually minor; together they are most of why the phone experience feels
unreliable. Several are resolved *by* the nav redesign, so they should be
triaged against that plan rather than fixed twice.

## Findings

**Correctness**

1. **The journey index is unreachable after the first navigation.**
   It renders only when `selectedScenarioId === null`, and nothing in
   `MobileShell` ever clears the selection (`clearSelection` and `goHome` both
   exist on `EditorContext` and are not imported). Open any scenario and the
   table of contents is gone for the session; "Journey" always returns you to
   the last scenario. — `MobileShell.tsx:235-244`

2. **Agent navigation lands behind an opaque sheet.** The bridge's
   `selectPhase`/`selectScenario` switch surfaces but never close the agent or
   nav sheets, so "take me to the Warm-Up scenario" navigates correctly behind
   a sheet covering 92% of the viewport — the user sees nothing happen.
   — `MobileShell.tsx:128-135` with `:391`

3. **`setSidebarCollapsed` is a no-op stub and the agent claims success
   anyway.** `agentSetSidebar` returns "Sidebar collapsed." unconditionally.
   This is exactly the failure mode `agentOpenCellPanel` was written to avoid.
   Make the capability optional in the bridge type rather than stubbed.
   — `MobileShell.tsx:137`, `uiBridge.ts:54-58`

4. **Rotating the phone on the Map strands the camera.** `onResize` bails when
   the user has adjusted the view — right for a desktop window drag, wrong for
   a rotation, which inverts the aspect ratio. And the Reset View control can
   never render on the plain overview Map (its two mount conditions are
   mutually exclusive), so there is no recovery except toggling surfaces,
   which only works by accident via the remount. — `useZoomPanViewport.ts:483-512`,
   `ServiceOverviewView.tsx:400-404`

5. **`scrollIntoView` fired at a transform canvas.** `agentOpenCellPanel`
   scrolls unconditionally; the Map viewport is `overflow-hidden` and moves by
   transform. Programmatic scroll on a hidden-overflow box still sets
   `scrollTop`, which every camera calculation assumes is zero — the board then
   zooms toward a point offset from the fingers, unrecoverable without a
   remount. Route canvas focus through `resolveFocusCells` instead.
   — `uiBridge.ts:80`, `blueprintCellConnections.ts:314-319`

6. **Reader cell sheet renders a stale snapshot.** `OpenCell` stores whole
   objects; after a refetch the sheet keeps rendering the old copy. Store the
   id, derive the rest. — `MobileScenarioReader.tsx:26-30`

7. **Nav tree bypasses the shared helpers.** Mobile filters `parentId`
   directly instead of `getMainSlides`/`getSubslides`, inheriting an
   undeclared dependency on upstream sort order, and ignores the
   `expandedPhaseIds` state that already exists for exactly the collapsible
   behaviour the redesign needs. — `MobileShell.tsx:102-115`

**Accessibility**

8. Theme toggle is a 28px target in a row of 44px targets — `MobileShell.tsx:183`
9. Slice rows ~34px while sibling phase/scenario rows are 44px — `:312`
10. Reader path chips 32px in a horizontally scrolling row — `MobileScenarioReader.tsx:275`
11. Slices group header not associated with its group; journey index nests
    scenario buttons outside a list — `:300-303`, `:425-453`

**Testing**

12. **Zero tests** reference `MobileShell`, `MobileScenarioReader`, or
    `isMobileViewport`, against ~324 vitest tests elsewhere. Finding 1 is
    precisely what one render test would have caught, and the redesign churns
    every one of these paths.

## Proposed Solutions

**A. Pin behaviour first, then redesign.** Add render tests for the surface
fold, nav routing, `?slice=` boot, and the four bridge handlers before the nav
redesign lands. *Effort:* Medium. *Risk:* Low — highest leverage item here.

**B. Fix 1-3 and 8-11 now** (small, independent of the redesign).

**C. Fold 4-7 into the redesign**, which restructures those paths anyway.

## Recommended Action

_(triage)_ — A, then B; C rides with the nav plan.

## Acceptance Criteria

- [ ] The journey index is reachable at any time
- [ ] Agent-driven navigation closes overlays that would hide the result
- [ ] `agentSetSidebar` reports honestly on surfaces with no sidebar
- [ ] Rotation on the Map keeps the board framed; a fit control is reachable
- [ ] All nav targets ≥ 44px
- [ ] Mobile shell has render-test coverage of its navigation paths

## Work Log

- 2026-08-16: Collected from the TypeScript-quality and frontend-races reviews
  during the mobile crash investigation.

## Resources

- Plan: `docs/plans/2026-08-16-001-feat-mobile-navigation-model-plan.md`
- Related: todos 023, 024, 025
