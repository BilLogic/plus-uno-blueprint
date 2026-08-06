---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, simplification, panel]
dependencies: []
---

# Deduplicate the cell panel's two Drawer shells and three lane-chip derivations

## Problem Statement
`src/components/blueprint/BlueprintCellDetailPanel.tsx` now contains the
`Drawer`/`DrawerContent` shell twice — the draft branch copies the main
return's props, the long positioning className (three `!important`
overrides), stopPropagation handlers and close button verbatim. Any future
tweak has two places to miss. The draft branch also re-derives the lane
chip (`layerRecord → zone → getBlueprintLayerStyle` + chip `<span>`) that
already exists as the `laneChipStyle` memo + `laneChip` element for
selections.

## Proposed Solutions
1. **Extract `CellDetailDrawerShell({ header, children })`** holding
   Drawer + DrawerContent + close button; both branches render into it.
   ~55 LOC saved. Effort: Small-Medium (regression-test open/close paths —
   the exit-animation state machine lives here).
2. Fold the draft render into the single main return as conditionals
   (`draft ? draftHeader : cellBreadcrumb`, etc.). Fewer elements, but the
   main return is already dense.

Also: make the `laneChipStyle` memo read
`selection?.layerName ?? draft?.layerName` and reuse `laneChip` in the
draft body.

## Acceptance Criteria
- [ ] One Drawer shell definition; draft and selection branches share it
- [ ] One lane-chip derivation
- [ ] Draft-during-exit-animation behavior unchanged (regression: open cell
      → close → immediately click + → draft form appears)

## Work Log
- 2026-08-04: Found by simplicity reviewer; deferred as pure refactor.
