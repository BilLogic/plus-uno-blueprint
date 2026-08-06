---
status: pending
priority: p2
issue_id: 017
tags: [code-review, design-system, ux, quality]
dependencies: []
---

# Design audit 2026-08-06 — DS substitution + UX polish (25 findings)

Full audit by the design-audit agent; verdict: DS usage disciplined (~130
ui/ imports; big bespoke widgets documented-intentional: canvas context
menu, OwnerTagSelect pattern, annotation toolbar). Homepage motion-token
fix (#13) applied same day; everything else pending triage.

## Suggested DS substitutions (user to approve — suggestion only)

1. **P2** Segmented control hand-rolled 3× near-identically
   (`CellDependencyEditor.tsx:140`, `CanvasAnnotationToolbar.tsx:431`,
   `PhaseMenubarHeader.tsx:66`) — extract one `SegmentedControl` over
   `ui/toggle-group` (0 current imports). Effort M.
2. **P3** AgentPanel slash menu (`AgentPanel.tsx:820-835`) hand-rolled,
   hover-only, no arrow keys — the ui-inventory's stated trigger for
   `npx shadcn add command`. Effort M.
3. **P3** `TabStrip.tsx:283-330` raw `role="tab"` without roving
   tabindex — keep bespoke (intentional look), add arrow-key nav. S.
4. **P3** Raw icon buttons → `button.tsx` ghost/icon-sm:
   `SessionChangesSheet.tsx:359,370`, `SlicePresentation.tsx:355,404,419`. S.
5. **P3** `CanvasAnnotationLayer.tsx:322,574,731,943` repeat one 100-char
   ring recipe — extract const or dark Button variant. S.
6. **P3** TabStrip overflow-x has no affordance — scroll-area or fade
   masks. S.

## UX polish

7. **P2** SliceView/SlicePresentation load with spinner-then-pop
   (`SliceView.tsx:133`, `SlicePresentation.tsx:165`) while canvas uses
   shape-true `EditorLoadingSkeletons` — build slice-shaped skeleton.
8. **P2** Bare empty states → `CanvasEmptyState variant="panel"`:
   `ServiceBlueprintGrid.tsx:387` ("No layers defined."),
   `PhaseScenarioOverview.tsx:220`, `CanvasBlueprintArtboard.tsx:144`;
   align copy style with AgentPanel's teaching tone
   (`SlicesSidebarSection.tsx:158`).
9. **P2** 86× `text-[10px]`/`text-[11px]` literals — mint `text-2xs`/
   `text-3xs` @theme tokens and sweep.
10. **P2** Off-ladder hovers `hover:bg-neutral-100` + dark overrides
    (`CellResourcesTab.tsx:87`, `CellDependencySections.tsx:90`,
    `EditorSequenceNav.tsx:69-70`) → `hover:bg-accent`.
11. **P3** `duration-300` off the motion scale (4 files) → tokens; only
    EditorChrome consumes `duration-(--motion-*)` today — sweep.
12. **P3** Missing `motion-reduce:` on Homepage tab indicator.
13. **P3** Hover states lacking `transition-colors` clusters: AgentPanel
    (7), BlueprintCellDetailPanel (7), CanvasAnnotationToolbar (6).
14. **P3** Spacing magic: `gap-[7px]` (`CellResourcesTab.tsx:87`),
    `pl-[19px]`×3 (`CellDependencySections.tsx`), `!bottom-[61px]`×2
    (`BlueprintCellDetailPanel.tsx:661,1053` — derive from var).
15. **P3** Radius rhythm: `CanvasEmptyState` rounded-xl amid rounded-2xl
    artboard siblings; Homepage `rounded-[1.15rem]` squircle outlier.
16. **P3** Three floating-toolbar shadows in `CanvasAnnotationLayer.tsx`
    (:325 :347 :377) — one `--shadow-floating` token.

## Shortlist (agent's "do first")

Segmented control → slice skeletons → text-2xs tokens → motion sweep →
empty states.

## Work Log

- 2026-08-06: Audit run; #13 (Homepage inline 300ms bezier bypassing the
  motion drift test) fixed immediately, rest pending user triage.
