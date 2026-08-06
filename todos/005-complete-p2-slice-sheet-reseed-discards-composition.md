---
status: complete
priority: p2
issue_id: "005"
tags: [code-review, canvas, slices]
dependencies: []
---

# Slice sheet reseeds on selection identity and discards composed screens

## Problem Statement
`CreateSliceSheet` reseeds its screens whenever `cellIds` changes by
reference. The sheet floats over a live canvas; any stray pick or marquee
while it is open replaces the array and silently throws away all
drag-composed grouping, with no confirmation.

## Findings
- `src/components/editor/CreateSliceSheet.tsx` (`seededFrom !== cellIds`)
- Review finding #11 (TS reviewer, 2026-08-03)

## Proposed Solutions
1. Diff by value; reseed only when membership actually changed. Small.
2. Merge instead of reseed: drop removed ids from existing screens, append
   new ids as new screens. Medium — best UX.

## Acceptance Criteria
- [ ] Composing 3 screens, then picking one more cell on canvas, keeps the
      3 screens and appends the new cell.

## Work Log
- 2026-08-04: Fixed with solution 2 (merge). `mergeSelectionIntoScreens` in
  CreateSliceSheet: removals drop out of their screens, additions append as
  new screens, shaped screens survive.
